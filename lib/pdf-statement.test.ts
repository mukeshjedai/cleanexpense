import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNABPages, PDFPage } from './pdf-statement';
const item=(str:string,x:number,y:number,width=30)=>({str,x,y,width});
function fixture():PDFPage[]{return [[
 item('Transaction Listing',20,790),item('National Australia Bank Limited',20,20),
 item('Date',20,700),item('Details',75,700),item('Debits',330,700),item('Credits',400,700),item('Balance',510,700),
 item('Start Balance',200,770),item('$0.00 CR',480,770),
 item('Total Debits',200,760),item('$12.50',480,760),item('Total Credits',200,750),item('$100.00',480,750),item('End Balance',200,740),item('$87.50 CR',480,740),
 item('Page 1 of 1',510,810), // Page numbers can appear above the transactions.
 item('01 Nov 26',20,680),item('Salary',75,680),item('$100.00',400,680),item('$100.00 CR',510,680),
 item('02 Nov 26',20,660),item('Coles',75,660),item('Brisbane reference',75,650),item('$12.50',330,660),item('$87.50 CR',510,660),
 item('03 Nov 26',20,630),item('Interest notice',75,630),item('$0.00',400,630),item('$87.50 CR',510,630),
 item('Important',20,60),item('This is not a transaction',75,40)
 ]];}
test('local NAB parsing preserves debit/credit signs, multiline descriptions and zero amounts',()=>{const rows=parseNABPages(fixture());assert.equal(rows.length,3);assert.deepEqual(rows.map(t=>t.amount),[100,-12.5,0]);assert.equal(rows[1].description,'Coles Brisbane reference');assert.equal(rows[1].date,'2026-11-02');assert.equal(rows[1].category,'Groceries');});
test('rejects extracted rows when statement totals do not reconcile',()=>{const pages=fixture();pages[0].find(t=>t.str==='$12.50'&&t.x===330)!.str='$13.50';assert.throws(()=>parseNABPages(pages),/reconcile/);});
test('rejects unrecognized and scanned PDFs rather than importing partial data',()=>{assert.throws(()=>parseNABPages([[]]),/not supported/);});
