import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// Execute the page's actual loading/navigation functions with batched-state doubles.
// Deliberately keep pageNumbers stale during a click, as React does until render.
const source = readFileSync(new URL('../src/pages/AdminPage.tsx', import.meta.url), 'utf8');
const logic = source.slice(source.indexOf('  const load ='), source.indexOf('  useEffect(() => {', source.indexOf('  const load =')))
  .replace(': Record<AdminTab, string>', '')
  .replace('catch (err: any)', 'catch (err)')
  .replace('target: AdminTab, direction: number', 'target, direction');

function harness(tab: string, page = 1) {
  const state: any = { tab, pageNumbers: { [tab]: page }, data: { data: [], totalPages: 3 }, loading: false, busy: false, search: 'sample', status: 'PENDING', leadCampaign: 'campaign-1', withdrawalFilters: { page, search: '', status: 'ALL', paymentMethod: 'ALL' }, loadRequestId: { current: 0 }, activeTab: { current: tab }, calls: [], updates: [] };
  state.setLoading = (value: boolean) => { state.loading = value; };
  state.setError = (value: string) => { state.error = value; };
  state.setData = (value: any) => { state.data = value; };
  state.setPageNumbers = (update: any) => { state.updates.push(update(state.pageNumbers)); };
  state.adminApi = { get: async (path: string) => { state.calls.push(path); return { success: true, data: [{ id: new URL(path, 'http://test').searchParams.get('page') }], page: 2, total: 60, totalPages: 3 }; } };
  // with is confined to a test harness, so state reads mirror the closure's render values.
  const functions = new Function('state', `with(state) { ${logic}; return { load, changePage, applyFilters }; }`)(state);
  return { state, ...functions };
}

test('all four admin pagination tabs request the new page despite batched state and retain metadata', async () => {
  for (const tab of ['partners', 'referrals', 'leads', 'support']) {
    const h = harness(tab);
    h.changePage(tab, 1);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.state.calls.length, 1);
    const url = new URL(h.state.calls[0], 'http://test');
    assert.equal(url.pathname, `/admin/${tab}`);
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('search'), 'sample');
    assert.equal(url.searchParams.get('status'), 'PENDING');
    if (tab === 'leads') assert.equal(url.searchParams.get('campaignId'), 'campaign-1');
    assert.equal(h.state.data.totalPages, 3);
    assert.equal(h.state.data.total, 60);
    assert.equal(h.state.data.data[0].id, '2');
    assert.equal(h.state.updates[0][tab], 2);
    const previous = harness(tab, 3);
    previous.changePage(tab, -1);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(new URL(previous.state.calls[0], 'http://test').searchParams.get('page'), '2');
    const first = harness(tab); first.changePage(tab, -1); assert.equal(first.state.calls.length, 0);
    const last = harness(tab, 3); last.changePage(tab, 1); assert.equal(last.state.calls.length, 0);
    const loading = harness(tab); loading.state.loading = true; loading.changePage(tab, 1); assert.equal(loading.state.calls.length, 0);
    const empty = harness(tab); empty.state.data.totalPages = 1; empty.changePage(tab, 1); assert.equal(empty.state.calls.length, 0);
  }
});

test('apply/reset starts on page one and late responses cannot overwrite current records', async () => {
  const h = harness('leads', 3);
  h.applyFilters();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.state.updates[0].leads, 1);
  assert.equal(new URL(h.state.calls[0], 'http://test').searchParams.get('page'), '1');
  await h.load('leads', true, 1);
  const reset = new URL(h.state.calls[1], 'http://test');
  assert.equal(reset.search, '?page=1');
  const pending: ((value: any) => void)[] = [];
  h.state.adminApi.get = () => new Promise(resolve => pending.push(resolve));
  const old = h.load('leads', false, 1), current = h.load('leads', false, 2);
  pending[1]({ data: [{ id: 'new' }], totalPages: 3 }); await current;
  pending[0]({ data: [{ id: 'old' }], totalPages: 9 }); await old;
  assert.equal(h.state.data.data[0].id, 'new');
  assert.equal(h.state.data.totalPages, 3);
  h.state.adminApi.get = async () => { throw Error('offline'); };
  await h.load(); assert.equal(h.state.data, null); assert.equal(h.state.error, 'offline');
});

test('withdrawal paging remains independent and lead refresh uses the current page closure', async () => {
  const h = harness('withdrawals', 2);
  await h.load();
  assert.equal(new URL(h.state.calls[0], 'http://test').searchParams.get('page'), '2');
  assert.ok(source.includes('busy, pageNumbers.leads]'));
  for (const tab of ['partners', 'referrals', 'leads', 'support']) {
    assert.ok(source.includes(`changePage('${tab}', -1)`));
    assert.ok(source.includes(`changePage('${tab}', 1)`));
    assert.ok(source.includes(`loading || pageNumbers.${tab} >= (data?.totalPages || 1)`));
  }
});
