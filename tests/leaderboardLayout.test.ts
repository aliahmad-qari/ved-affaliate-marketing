import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { monthlyLeaderboardTableLayout as layout } from '../src/components/monthlyLeaderboardTableLayout.ts';

test('homepage and partner leaderboard share compact fixed column widths and wrapping responsive cells', () => {
  assert.deepEqual(layout.columnWidths, ['w-[9%]', 'w-[36%]', 'w-[25%]', 'w-[30%]']);
  assert.equal(layout.columnWidths.reduce((total, width) => total + Number(width.match(/\d+/)?.[0] || 0), 0), 100);
  assert.match(layout.table, /w-full table-fixed/);
  assert.match(layout.table, /sm:text-sm/);
  assert.match(layout.cell, /px-1\.5 py-2 sm:px-3 sm:py-3/);
  assert.match(layout.partnerCell, /overflow-wrap:anywhere/);

  for (const path of [
    '../src/components/home/PublicSuccessfulLeadsSection.tsx',
    '../src/components/partner/PartnerMonthlyLeaderboard.tsx',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /monthlyLeaderboardTableLayout as tableLayout/);
    assert.match(source, /tableLayout\.columnWidths\.map/);
    assert.doesNotMatch(source, /min-w-\[520px\]/);
  }
});
