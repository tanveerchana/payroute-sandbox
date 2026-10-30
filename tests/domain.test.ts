import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAmount, seedWorkspace, reduceWorkspace, reconcile, exportCsv} from '../src/domain.js';
const payment = (overrides: Record<string,unknown> = {}) => ({type:'simulate', amount:'12.34', currency:'AUD', scenario:'success', reference:'Order 1042', key:'test-payment-0001', ...overrides});
const apply = (state: any, command: any) => {const output=reduceWorkspace(state,command); return 'state' in output ? output.state : output;};

test('decimal amounts preserve exact minor units without float rounding', () => {
  assert.equal(parseAmount('0.29'),29); assert.equal(parseAmount('12.3'),1230); assert.equal(parseAmount('1000000.00'),100000000);
});
test('rejects excess precision, nondecimal, zero, negative and unsafe amounts', () => {
 for(const value of ['1.005','-1','0','0.00','NaN','1e2','','1,000','1000000.01',12.34,null]) assert.throws(()=>parseAmount(value));
});
test('a successful payment stores a single attempt and an integer fee', () => {
 const s=apply(seedWorkspace(),payment()); const p=s.transactions.at(-1)!; assert.equal(p.status,'succeeded'); assert.equal(p.amountMinor,1234); assert.equal(p.attempts.length,1); assert.equal(p.attempts[0].providerId,'atlas'); assert.equal(p.feeMinor,51);
});
test('primary outage retries on the next available provider', () => {
 const s=apply(seedWorkspace(),payment({scenario:'primary_outage'})); const p=s.transactions.at(-1)!; assert.equal(p.status,'succeeded'); assert.deepEqual(p.attempts.map((a:any)=>a.outcome),['unavailable','approved']); assert.equal(p.providerId,'pulse');
});
test('hard decline never retries another provider', () => {
 const s=apply(seedWorkspace(),payment({scenario:'hard_decline'})); const p=s.transactions.at(-1)!; assert.equal(p.status,'declined'); assert.equal(p.attempts.length,1); assert.equal(p.feeMinor,0);
});
test('all providers unavailable exhausts routing and fails with no charge fee', () => {
 const s=apply(seedWorkspace(),payment({scenario:'all_down'})); const p=s.transactions.at(-1)!; assert.equal(p.status,'failed'); assert.equal(p.attempts.length,3); assert.equal(p.feeMinor,0);
});
test('same key and normalized request replays unchanged after provider config changes', () => {
 const s=apply(seedWorkspace(),payment()); const original=s.transactions.at(-1)!; const updated=apply(s,{type:'provider',id:'atlas',enabled:false,outage:true});
 const result=reduceWorkspace(updated,payment({amount:'12.340'.slice(0,-1)})); assert.deepEqual(result.state,updated); assert.equal(result.result!.replayed,true); assert.deepEqual(result.result!.payment,original);
});
test('same idempotency key with a different request is rejected', () => {
 const s=apply(seedWorkspace(),payment()); assert.throws(()=>apply(s,payment({amount:'12.35'})),/Idempotency/);
});
test('payment input validates currencies, scenarios, idempotency keys and reference', () => {
 for(const patch of [{currency:'BTC'},{scenario:'live'},{key:''},{key:'a'.repeat(129)},{reference:'x'.repeat(81)},{amount:1}]) assert.throws(()=>apply(seedWorkspace(),payment(patch)));
});
test('provider outage and enabled settings persist and route order is validated', () => {
 let s=apply(seedWorkspace(),{type:'provider',id:'atlas',enabled:false,outage:false}); s=apply(s,{type:'route',order:['harbor','atlas','pulse']}); s=apply(s,payment()); assert.equal(s.transactions.at(-1)!.providerId,'harbor');
 assert.throws(()=>apply(s,{type:'route',order:['atlas','atlas','pulse']})); assert.throws(()=>apply(s,{type:'provider',id:'atlas',enabled:'false',outage:false}));
});
test('reconciliation detects missing, amount mismatch, duplicate and unexpected records', () => {
 const tx=[{id:'one',status:'succeeded',amountMinor:1000,currency:'AUD'},{id:'two',status:'succeeded',amountMinor:500,currency:'AUD'},{id:'three',status:'succeeded',amountMinor:300,currency:'USD'}];
 const r=reconcile(tx as any,'transaction_id,amount_minor,currency\none,999,AUD\none,999,AUD\nunknown,300,USD');
 assert.deepEqual(r.issues.map((i:any)=>i.type).sort(),['amount_mismatch','duplicate','missing','missing','unexpected']); assert.equal(r.matched,0);
});
test('reconciliation matches exact records and rejects malformed statement rows',()=>{
 const tx=[{id:'one',status:'succeeded',amountMinor:29,currency:'AUD'}]; assert.equal(reconcile(tx as any,'transaction_id,amount_minor,currency\none,29,AUD').matched,1);
 for(const csv of ['id,amount\none,29','transaction_id,amount_minor,currency\none,2.9,AUD','transaction_id,amount_minor,currency\n"one,29,AUD']) assert.throws(()=>reconcile(tx as any,csv));
});
test('CSV export escapes formula-like user reference and supports commas',()=>{
 const s=apply(seedWorkspace(),payment({reference:'=SUM(1,2)'})); const csv=exportCsv([s.transactions.at(-1)!]); assert.ok(csv.includes('"\'=SUM(1,2)"'));
});
test('workspace limit refuses new payments while preserving existing idempotency',()=>{
 let s=seedWorkspace(); for(let i=s.transactions.length;i<200;i++)s=apply(s,payment({key:`limit-${String(i).padStart(4,'0')}`})); assert.throws(()=>apply(s,payment({key:'overflow-0001'})),/limit/i); assert.equal(apply(s,payment({key:'limit-0199'})).transactions.length,200);
});
