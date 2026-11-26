import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeForecast,validateAIDays} from './forecast';
import {shiftDate} from './timeline-window';
import type {Transaction} from './statement';
const history:Transaction[]=Array.from({length:70},(_,i)=>({id:String(i),date:shiftDate('2026-01-01',i),description:'Expense',amount:-10,category:'Dining'}));
test('constant history forecasts constant spending with future-only dates and no negative ranges',()=>{const r=makeForecast(history,14);assert.equal(r.days.length,14);assert.equal(r.days[0].date,shiftDate(history.at(-1)!.date,1));assert.ok(r.days.every(d=>d.total===10&&d.low>=0&&d.low<=d.total&&d.high>=d.total));assert.equal(r.backtestMAE,0);});
test('rejects short histories, excludes income and transfers, and does not train on held-out future values',()=>{assert.throws(()=>makeForecast(history.slice(0,10),7),/28/);const r=makeForecast([...history,{...history[0],id:'credit',amount:1000},{...history[0],id:'transfer',category:'Transfers',amount:-500}],7);assert.equal(r.history[0].total,10);assert.equal(r.days[0].total,10);});
test('AI values must cover exactly the requested dates and categories, with finite nonnegative amounts',()=>{const baseline=makeForecast(history,7);const valid=baseline.days.map(d=>({date:d.date,categories:d.categories}));assert.equal(validateAIDays(valid,baseline).length,7);assert.throws(()=>validateAIDays(valid.slice(1),baseline));assert.throws(()=>validateAIDays(valid.map((d,i)=>i?d:{...d,date:'2099-01-01'}),baseline));assert.throws(()=>validateAIDays(valid.map((d,i)=>i?d:{...d,categories:[{category:'Dining',amount:-1}]}),baseline));});
