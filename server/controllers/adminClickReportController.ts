import { Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { TrackingClick } from '../models/TrackingClick.ts';
import { Lead } from '../models/Lead.ts';
import { Partner } from '../models/Partner.ts';
import { PartnerSubTeamLink } from '../models/PartnerSubTeamLink.ts';

const COLUMNS = [
  'Click ID', 'Partner ID', 'Partner Name', 'Tracking Link', 'Sub-Partner / Referral ID',
  'Campaign Name', 'Click Date', 'Click Time', 'Customer Name (if submitted)', 'Customer Mobile Number (admin only)',
  'Lead Submission ID', 'Lead Status', 'Conversion Status',
];

function safeCell(value: unknown): string {
  const text = String(value ?? '');
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function utcDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function buildAdminClickReportFilter(query: Request['query']) {
  const filter: Record<string, any> = {};
  if (typeof query.partnerId === 'string' && query.partnerId.trim()) filter.partnerId = query.partnerId.trim().toUpperCase().slice(0, 40);
  if (typeof query.campaign === 'string' && query.campaign.trim()) {
    const campaign = query.campaign.trim().slice(0, 100);
    filter.$or = [{ campaignId: campaign }, { campaignSlug: campaign }];
  }
  if (typeof query.clickId === 'string' && query.clickId.trim()) filter.clickId = query.clickId.trim().slice(0, 80);
  const start = utcDate(query.startDate as string);
  const end = utcDate(query.endDate as string);
  if ((query.startDate && !start) || (query.endDate && !end) || (start && end && start > end)) {
    throw Object.assign(new Error('Use valid YYYY-MM-DD date filters.'), { status: 400 });
  }
  if (start || end) {
    filter.createdAt = {};
    if (start) filter.createdAt.$gte = start;
    if (end) filter.createdAt.$lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return filter;
}

function formatClickDate(value: Date) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
}
function formatClickTime(value: Date) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(value);
}

async function reportRows(req: Request): Promise<Record<string, string>[]> {
  const query = buildAdminClickReportFilter(req.query);
  const clickRows: any[] = await TrackingClick.find(query).sort({ createdAt: -1, _id: 1 }).lean().exec();
  const clickIds = clickRows.map(click => click.clickId);
  const [leads, partners, subTeamLinks] = await Promise.all([
    clickIds.length ? Lead.find({ vendorClickId: { $in: clickIds } }).select('vendorClickId leadId clientName clientMobile status reviewedBy rejectionReasonCode approvalReversal').lean().exec() : [],
    clickRows.length ? Partner.find({ partnerId: { $in: [...new Set(clickRows.map(click => click.partnerId))] } }).select('partnerId fullName').lean().exec() : [],
    clickRows.length ? PartnerSubTeamLink.find({ _id: { $in: [...new Set(clickRows.map(click => click.subTeamLinkId).filter(Boolean))] } }).select('trackingId').lean().exec() : [],
  ]);
  const leadsByClick = new Map<string, any[]>();
  for (const lead of leads as any[]) {
    const key = String(lead.vendorClickId);
    leadsByClick.set(key, [...(leadsByClick.get(key) || []), lead]);
  }
  const partnerNames = new Map(partners.map((partner: any) => [String(partner.partnerId).toUpperCase(), String(partner.fullName || '')]));
  const subTeamIds = new Map(subTeamLinks.map((link: any) => [String(link._id), String(link.trackingId)]));
  const leadStatus = typeof req.query.leadStatus === 'string' ? req.query.leadStatus.trim().toUpperCase() : '';
  const allowedStatuses = new Set(['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED', 'PAID', 'NOT_SUBMITTED', 'AMBIGUOUS_MULTIPLE_LEADS']);
  if (leadStatus && !allowedStatuses.has(leadStatus)) throw Object.assign(new Error('Invalid lead status filter.'), { status: 400 });
  return clickRows.map(click => {
    const attached = leadsByClick.get(String(click.clickId)) || [];
    const ambiguous = attached.length > 1;
    const lead: any = attached.length === 1 ? attached[0] : undefined;
    const status = ambiguous ? 'AMBIGUOUS_MULTIPLE_LEADS' : lead?.status || 'NOT_SUBMITTED';
    const at = new Date(click.clickedAt || click.createdAt);
    return {
      'Click ID': String(click.clickId),
      'Partner ID': String(click.partnerId),
      'Partner Name': String(partnerNames.get(String(click.partnerId).toUpperCase()) || 'VED Partner'),
      'Tracking Link': String(click.trackingLink || ''),
      'Sub-Partner / Referral ID': String(click.subTeamTrackingId || subTeamIds.get(String(click.subTeamLinkId)) || ''),
      'Campaign Name': String(click.campaignNameSnapshot || click.campaignSlug || ''),
      'Click Date': Number.isNaN(at.getTime()) ? '' : formatClickDate(at),
      'Click Time': Number.isNaN(at.getTime()) ? '' : formatClickTime(at),
      'Customer Name (if submitted)': String(ambiguous ? '' : lead?.clientName || ''),
      'Customer Mobile Number (admin only)': String(ambiguous ? '' : lead?.clientMobile || ''),
      'Lead Submission ID': String(ambiguous ? `MULTIPLE (${attached.length})` : lead?.leadId || ''),
      'Lead Status': status,
      'Conversion Status': ambiguous ? 'AMBIGUOUS_MULTIPLE_LEADS' : lead ? (['APPROVED', 'PAID'].includes(status)
        && !!lead.reviewedBy && !['VENDOR_WEBHOOK', 'SYSTEM'].includes(lead.reviewedBy)
        && !lead.approvalReversal && lead.rejectionReasonCode !== 'DUPLICATE_LEAD' ? 'SUCCESSFUL' : status) : 'NOT_SUBMITTED',
    };
  }).filter(row => !leadStatus || row['Lead Status'] === leadStatus);
}

export async function exportAdminClickReport(req: Request, res: Response, next: NextFunction, formatOverride?: 'csv' | 'xlsx'): Promise<void> {
  try {
    const rows = await reportRows(req);
    const csvValue = (value: unknown) => `"${safeCell(value).replace(/"/g, '""')}"`;
    if ((formatOverride || req.params.format) === 'csv') {
      const csv = [COLUMNS.map(csvValue).join(','), ...rows.map(row => COLUMNS.map(column => csvValue(row[column])).join(','))].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="ved-click-report-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(`\uFEFF${csv}`);
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Click Report');
    sheet.addRow(COLUMNS);
    for (const row of rows) sheet.addRow(COLUMNS.map(column => safeCell(row[column])));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ved-click-report-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) { next(error); }
}

export const adminClickReportColumns = COLUMNS;
export const protectClickReportCell = safeCell;
