import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bucketDate,expenseSeries} from './expense-series';
import type {Transaction} from './statement';
const rows:Transaction[]=[{id:'1',date:'2026-11-01',description:'Cafe',amount:-0.1,category:'Dining'},{id:'2',date:'2026-11-01',description:'Cafe',amount:-0.2,category:'Dining'},{id:'3',date:'2026-11-03',description:'Coles',amount:-10,category:'Groceries'},{id:'4',date:'2026-11-02',description:'Transfer',amount:-100,category:'Transfers'},{id:'5',date:'2026-11-02',description:'Salary',amount:500,category:'Income'}];
test('fills missing dates, sums in cents and excludes transfers and credits',()=>{const r=expenseSeries(rows,'day','','');assert.deepEqual(r.dates,['2026-11-01','2026-11-02','2026-11-03']);assert.equal(r.count,3);assert.deepEqual(r.series.find(s=>s.category==='Dining')?.values,[0.3,0,0]);});
test('weeks start Monday across year boundaries; filters limit included transactions',()=>{assert.equal(bucketDate('2027-01-01','week'),'2026-12-28');assert.equal(bucketDate('2026-11-30','month'),'2026-11-01');const r=expenseSeries(rows,'month','2026-11-02','2026-11-03','Groceries');assert.deepEqual(r.series[0].values,[10]);assert.equal(r.count,1);});
