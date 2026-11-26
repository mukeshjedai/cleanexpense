import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unseenTransactions} from './import-transactions';
import type {Transaction} from './statement';
const base:Transaction={id:'a',date:'2026-11-01',description:'Cafe',amount:-10,category:'Dining'};
test('overlapping imports ignore IDs and category corrections, returning unseen rows newest first',()=>{const result=unseenTransactions([base],[{...base,id:'new-id',description:' CAFE ',category:'Other'},{...base,id:'b',date:'2026-11-03'},{...base,id:'c',date:'2026-11-02'}]);assert.equal(result.skipped,1);assert.deepEqual(result.transactions.map(t=>t.id),['b','c']);});
test('duplicate matching preserves additional identical purchases and makes re-import idempotent',()=>{const incoming=[{...base,id:'b'},{...base,id:'c'}];const first=unseenTransactions([base],incoming);assert.equal(first.transactions.length,1);assert.equal(unseenTransactions([base,...first.transactions],incoming).transactions.length,0);assert.equal(unseenTransactions([{...base,time:'09:00'}],[{...base,time:'10:00'}]).transactions.length,1);});
