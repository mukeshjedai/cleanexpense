import {test} from 'node:test';
import assert from 'node:assert/strict';
import {daysInWindow,shiftDate,windowEnding,zoomWindow,newestExpenseFirst} from './timeline-window';
import type {Transaction} from './statement';
test('latest window contains exactly seven dates across month/year boundaries',()=>{assert.deepEqual(windowEnding('2027-01-03'),{start:'2026-12-28',end:'2027-01-03'});assert.equal(daysInWindow('2026-12-28','2027-01-03'),7);assert.equal(shiftDate('2027-01-03',-7),'2026-12-27');});
test('zoom preserves end date, has a one-day minimum and stops at full history',()=>{assert.deepEqual(zoomWindow('2026-11-18','2026-11-24','in',120),{start:'2026-11-21',end:'2026-11-24'});assert.deepEqual(zoomWindow('2026-11-24','2026-11-24','in',120),{start:'2026-11-24',end:'2026-11-24'});assert.equal(daysInWindow(zoomWindow('2026-11-18','2026-11-24','out',10).start,'2026-11-24'),10);});
test('expense dots sort newest date and latest source time first, with unknown times separate',()=>{const base={description:'Expense',amount:-1,category:'Other' as const};const rows:Transaction[]=[{...base,id:'old',date:'2026-11-20',time:'23:00'},{...base,id:'morning',date:'2026-11-24',time:'09:00'},{...base,id:'unknown',date:'2026-11-24'},{...base,id:'evening',date:'2026-11-24',time:'18:30'}];assert.deepEqual(rows.sort(newestExpenseFirst).map(t=>t.id),['evening','morning','unknown','old']);});
