import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { failPreflight } from './releasePreflight.ts';

export const LIVE_OPERATIONAL_FILES = ['deploy.sh', 'ecosystem.config.cjs'] as const;

/** Parse raw --porcelain=v1 -z --untracked-files=all; never trim its leading status bytes. */
export function permittedUntrackedPaths(status: string, live: boolean) {
  if (status === '') return [];
  if (!live || !status.endsWith('\0')) return failPreflight('GIT_CLEANLINESS');
  const paths: string[] = [];
  for (const record of status.slice(0, -1).split('\0')) {
    const name = record.slice(3);
    if (!record.startsWith('?? ') || !LIVE_OPERATIONAL_FILES.some(allowed => name === allowed) || paths.includes(name)) return failPreflight('GIT_CLEANLINESS');
    paths.push(name);
  }
  return paths.sort();
}

/** Read-only fingerprints; never execute, copy, edit or reveal operational file contents. */
export function verifyCheckoutCleanliness(root: string, status: string, live: boolean) {
  const untracked = permittedUntrackedPaths(status, live);
  if (!live) return [];
  const fingerprints: { name: string; sha256: string; mode: number }[] = [];
  for (const name of LIVE_OPERATIONAL_FILES) {
    const file = path.join(root, name);
    let stat;
    try { stat = lstatSync(file); }
    catch (error: any) {
      if (error.code === 'ENOENT' && !untracked.includes(name)) continue;
      return failPreflight('GIT_CLEANLINESS');
    }
    if (!stat.isFile() || stat.isSymbolicLink()) return failPreflight('GIT_CLEANLINESS');
    const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = fstatSync(fd);
      if (!opened.isFile() || opened.ino !== stat.ino || opened.dev !== stat.dev) return failPreflight('GIT_CLEANLINESS');
      const sha256 = createHash('sha256').update(readFileSync(fd)).digest('hex');
      const after = fstatSync(fd);
      if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.mode !== opened.mode) return failPreflight('GIT_CLEANLINESS');
      fingerprints.push({ name, sha256, mode: after.mode });
    } finally { closeSync(fd); }
  }
  return fingerprints;
}

export function assertOperationalPathsUntracked(currentTracked: string[], releaseTracked: string[]) {
  if ([...currentTracked, ...releaseTracked].some(file => LIVE_OPERATIONAL_FILES.some(name => file === name || file.startsWith(name + '/')))) return failPreflight('GIT_CLEANLINESS');
}
