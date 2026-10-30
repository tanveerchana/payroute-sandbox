import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from '../src/pagination.js';

test('resetting a large ledger keeps its table on a populated valid page', () => {
  const largeLedger = Array.from({ length: 200 }, (_, i) => `pay_${i + 1}`);
  assert.deepEqual(paginate(largeLedger, 19, 10).rows, [
    'pay_191',
    'pay_192',
    'pay_193',
    'pay_194',
    'pay_195',
    'pay_196',
    'pay_197',
    'pay_198',
    'pay_199',
    'pay_200',
  ]);
  const reset = paginate(largeLedger.slice(0, 36), 19, 10);
  assert.equal(reset.page, 3);
  assert.deepEqual(reset.rows, ['pay_31', 'pay_32', 'pay_33', 'pay_34', 'pay_35', 'pay_36']);
  assert.equal(reset.start, 31);
  assert.equal(reset.end, 36);
});
test('empty filtered results reset pagination and report a consistent zero range', () => {
  assert.deepEqual(paginate([], 5, 10), { page: 0, rows: [], start: 0, end: 0 });
  assert.deepEqual(paginate(['only'], 0, 10), { page: 0, rows: ['only'], start: 1, end: 1 });
});
