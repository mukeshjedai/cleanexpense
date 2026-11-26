import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,parseDate,moneyNumber,exportCSV,categorize} from './statement';
test('signed CSV and day-first dates',()=>{const rows=parseCSV('Date,Description,Amount\n25/11/2026,"Coles, Brisbane",-45.20\n26/11/2026,Salary,3000');assert.equal(rows[0].date,'2026-11-25');assert.equal(rows[0].category,'Groceries');assert.equal(rows[1].amount,3000);});
test('debit credit columns and aliases',()=>{const rows=parseCSV('Transaction Date,Details,Debit,Credit\n2026-11-25,Cafe,12.50,\n2026-11-26,Salary,,500');assert.deepEqual(rows.map(t=>t.amount),[-12.5,500]);});
test('rejects malformed dates and amounts',()=>{assert.throws(()=>parseDate('31/02/2026'));assert.throws(()=>moneyNumber('abc'));assert.throws(()=>parseCSV('Date,Description,Amount\n25/11/2026,Cafe,oops'));assert.equal(moneyNumber('($1,234.56)'),-1234.56);});
test('transfers and export formula escaping',()=>{assert.equal(categorize('Internal transfer',500),'Transfers');const rows=parseCSV('Date,Description,Amount\n25/11/2026,=SUM(A1),-4');assert.match(exportCSV(rows),/'=SUM/);});
