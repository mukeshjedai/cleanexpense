import {test} from 'node:test';
import assert from 'node:assert/strict';
import {daysInWindow,shiftDate,windowEnding,zoomWindow} from './timeline-window';
test('latest window contains exactly seven dates across month/year boundaries',()=>{assert.deepEqual(windowEnding('2027-01-03'),{start:'2026-12-28',end:'2027-01-03'});assert.equal(daysInWindow('2026-12-28','2027-01-03'),7);assert.equal(shiftDate('2027-01-03',-7),'2026-12-27');});
test('zoom preserves end date, has a one-day minimum and stops at full history',()=>{assert.deepEqual(zoomWindow('2026-11-18','2026-11-24','in',120),{start:'2026-11-21',end:'2026-11-24'});assert.deepEqual(zoomWindow('2026-11-24','2026-11-24','in',120),{start:'2026-11-24',end:'2026-11-24'});assert.equal(daysInWindow(zoomWindow('2026-11-18','2026-11-24','out',10).start,'2026-11-24'),10);});
