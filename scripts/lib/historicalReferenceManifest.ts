import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface HistoricalReferenceManifest {
  version: 1;
  approvedBy: string;
  approvalReference: string;
  expectedTotalLeads: number;
  inventoryPolicy?: 'FROZEN_AT_CUTOVER';
  historicalRecordsDigest?: string;
  expectedCampaigns: number;
  entries: { originalReference: string; historicalIdentity: string; expectedRecords: number; expectedApproved: number; expectedPaid: number }[];
}

export function validateHistoricalManifest(value: any): HistoricalReferenceManifest {
  const fail = () => { throw new Error('Historical manifest validation failed.'); };
  if (!value || value.version !== 1 || typeof value.approvedBy !== 'string' || !value.approvedBy.trim() ||
      typeof value.approvalReference !== 'string' || !value.approvalReference.trim() ||
      !Number.isSafeInteger(value.expectedTotalLeads) || value.expectedTotalLeads < 1 ||
      (value.inventoryPolicy !== undefined && value.inventoryPolicy !== 'FROZEN_AT_CUTOVER') ||
      (value.inventoryPolicy === 'FROZEN_AT_CUTOVER' && (typeof value.historicalRecordsDigest !== 'string' || !/^[a-f\d]{64}$/.test(value.historicalRecordsDigest))) ||
      !Number.isSafeInteger(value.expectedCampaigns) || value.expectedCampaigns < 1 ||
      !Array.isArray(value.entries) || value.entries.length !== 2) fail();
  const refs = new Set<string>(), identities = new Set<string>();
  for (const entry of value.entries) {
    if (!entry || typeof entry.originalReference !== 'string' || !entry.originalReference.trim() || entry.originalReference.length > 1000 ||
        typeof entry.historicalIdentity !== 'string' || !/^historical:[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/.test(entry.historicalIdentity) ||
        refs.has(entry.originalReference) || identities.has(entry.historicalIdentity)) fail();
    for (const field of ['expectedRecords', 'expectedApproved', 'expectedPaid']) {
      if (!Number.isSafeInteger(entry[field]) || entry[field] < 0) fail();
    }
    if (!entry.expectedRecords || entry.expectedApproved + entry.expectedPaid > entry.expectedRecords) fail();
    refs.add(entry.originalReference); identities.add(entry.historicalIdentity);
  }
  return value;
}

/** The exact private file must be separately approved by SHA-256, outside Git. */
export function loadHistoricalManifest(file: string | undefined, approvedDigest: string | undefined) {
  if (!file && !approvedDigest) return undefined;
  if (!file || !path.isAbsolute(file) || !approvedDigest || !/^[a-f\d]{64}$/i.test(approvedDigest)) throw new Error('Private manifest approval is required.');
  const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
  const target = realpathSync(file);
  const relative = path.relative(root, target);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('Manifest must be outside the checkout.');
  const stat = statSync(target);
  if (!stat.isFile() || stat.size > 65536 || (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) throw new Error('Private manifest permissions or size are unsafe.');
  const bytes = readFileSync(target);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== approvedDigest.toLowerCase()) throw new Error('Manifest approval digest mismatch.');
  return { manifest: validateHistoricalManifest(JSON.parse(bytes.toString('utf8'))), digest };
}
