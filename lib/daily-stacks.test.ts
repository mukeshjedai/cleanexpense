import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dailyStacks} from './daily-stacks';
import type {Transaction} from './statement';
const base={description:'Expense',category:'Dining' as const};
const rows:Transaction[]=[{...base,id:'a',date:'2026-10-01',amount:-0.1},{...base,id:'b',date:'2026-10-01',amount:-0.2},{...base,id:'c',date:'2026-11-01',amount:-25,category:'Groceries'},{...base,id:'d',date:'2026-11-01',amount:100},{...base,id:'e',date:'2026-11-01',amount:-40,category:'Transfers'}];
test('keeps actual dates separate across months and stacks category cents correctly',()=>{const days=dailyStacks(rows);assert.deepEqual(days.map(d=>d.date),['2026-10-01','2026-11-01']);assert.equal(days[0].total,0.3);assert.deepEqual(days[1].segments,[{category:'Groceries',amount:25}]);});
test('selected month fills its real calendar days including leap February',()=>{const days=dailyStacks(rows,'2024-02');assert.equal(days.length,29);assert.equal(days.at(-1)?.date,'2024-02-29');assert.equal(days[0].total,0);assert.equal(dailyStacks(rows,'2026-11').length,30);});
