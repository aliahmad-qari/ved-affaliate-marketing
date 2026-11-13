import ExcelJS from 'exceljs';

export const ADMIN_LEAD_EXPORT_COLUMNS = [
  { header: 'Lead ID', key: 'leadId', width: 22 },
  { header: 'Click ID', key: 'clickId', width: 38 },
  { header: 'Campaign ID', key: 'campaignId', width: 28 },
  { header: 'Campaign Name', key: 'campaignName', width: 30 },
  { header: 'Partner ID', key: 'partnerId', width: 22 },
  { header: 'Customer Name', key: 'customerName', width: 28 },
  { header: 'Mobile Number', key: 'mobileNumber', width: 20 },
  { header: 'Status', key: 'status', width: 16 },
  { header: 'Payout Snapshot', key: 'payoutSnapshot', width: 20 },
  { header: 'Created At', key: 'createdAt', width: 25 },
  { header: 'Approved At', key: 'approvedAt', width: 25 },
  { header: 'Rejection Reason', key: 'rejectionReason', width: 40 },
  { header: 'Tracking Link', key: 'trackingLink', width: 60 },
] as const;

function safeSpreadsheetText(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function timestamp(value: unknown): string {
  if (value == null || value === '') return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

export function createAdminLeadWorkbook(leads: Record<string, unknown>[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VED Affiliate';
  const worksheet = workbook.addWorksheet('Leads');
  worksheet.columns = [...ADMIN_LEAD_EXPORT_COLUMNS];
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18243B' } };
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ADMIN_LEAD_EXPORT_COLUMNS.length } };

  for (const lead of leads) {
    const payout = Number(lead.payoutSnapshot);
    worksheet.addRow({
      leadId: safeSpreadsheetText(lead.leadId),
      clickId: safeSpreadsheetText(lead.clickId),
      campaignId: safeSpreadsheetText(lead.campaignId),
      campaignName: safeSpreadsheetText(lead.campaignName),
      partnerId: safeSpreadsheetText(lead.partnerId),
      customerName: safeSpreadsheetText(lead.clientName),
      mobileNumber: safeSpreadsheetText(lead.clientMobile),
      status: safeSpreadsheetText(lead.status),
      payoutSnapshot: Number.isFinite(payout) ? payout : '',
      createdAt: timestamp(lead.createdAt),
      approvedAt: timestamp(lead.approvedAt),
      rejectionReason: safeSpreadsheetText(lead.rejectionReason),
      trackingLink: safeSpreadsheetText(lead.trackingLink),
    });
  }
  return workbook;
}
