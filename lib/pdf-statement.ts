import { categorize, Transaction } from './statement';

export type PDFText = { str: string; x: number; y: number; width: number };
export type PDFPage = PDFText[];
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const datePattern = /^(\d{2}) ([A-Z][a-z]{2}) (\d{2}|\d{4})$/;
const amountPattern = /^\$([\d,]+\.\d{2})(?:\s+(CR|DR))?$/;
const cents = (s: string) => Math.round(Number(s.replace(/[$,]|\s+(CR|DR)$/g,''))*100);

/** Parse NAB Transaction Listings by column coordinates, never text reading order. */
export function parseNABPages(pages: PDFPage[]): Transaction[] {
 const all=pages.flat();
 if(!all.some(t=>t.str==='Transaction Listing') || !all.some(t=>/National Australia Bank/.test(t.str))) {
  throw new Error('This PDF layout is not supported by local import. Use AI PDF import for other banks or scanned statements.');
 }
 const header=(name:string)=>all.find(t=>t.str===name);
 const debit=header('Debits'),credit=header('Credits'),balance=header('Balance'),details=header('Details');
 if(!debit||!credit||!balance||!details)throw new Error('Could not identify the statement columns. Try AI PDF import.');
 const anchors=[debit,credit,balance].map(t=>t.x+t.width);
 const transactions:Transaction[]=[];
 const runningBalances:number[]=[];
 for(const page of pages){
  const footer=page.find(t=>t.str==='Important');
  const tokens=page.filter(t=>t.str.trim()&&(!footer||t.y>footer.y+2));
  const dates=tokens.filter(t=>t.x<details.x-5&&datePattern.test(t.str)).sort((a,b)=>b.y-a.y);
  for(let i=0;i<dates.length;i++){
   const start=dates[i],bottom=dates[i+1]?.y??(footer?.y??0);
   const row=tokens.filter(t=>t.y<=start.y+2&&t.y>bottom+2);
   const amounts=row.filter(t=>amountPattern.test(t.str)&&Math.abs(t.y-start.y)<3);
   const values:[number,number,number]=[0,0,0];const found=new Set<number>();
   for(const t of amounts){const end=t.x+t.width;const distances=anchors.map(a=>Math.abs(a-end));const column=distances.indexOf(Math.min(...distances));if(distances[column]>20||found.has(column))throw new Error('Ambiguous PDF amount columns. Use AI import or CSV.');values[column]=cents(t.str);if(/DR$/.test(t.str))values[column]*=-1;found.add(column);}
   if(!found.has(2)||(!found.has(0)&&!found.has(1)))throw new Error('A PDF row is missing an amount or balance. Try CSV or AI import.');
   const description=row.filter(t=>t.x>=details.x-2&&t.x<debit.x-35&&!amountPattern.test(t.str)&&!['Details','Date','Debits','Credits','Balance'].includes(t.str)).sort((a,b)=>Math.abs(a.y-b.y)>2?b.y-a.y:a.x-b.x).map(t=>t.str).join(' ').trim();
   if(!description)throw new Error('A PDF transaction description could not be read.');
   const match=start.str.match(datePattern)!;const year=match[3].length===2?2000+Number(match[3]):Number(match[3]);const month=months.indexOf(match[2])+1;
   if(!month)throw new Error('Unsupported transaction date.');
   const amount=(Math.abs(values[1])-Math.abs(values[0]))/100;
   transactions.push({id:crypto.randomUUID(),date:`${year}-${String(month).padStart(2,'0')}-${match[1]}`,description,amount,category:categorize(description,amount)});
   runningBalances.push(values[2]);
  }
 }
 if(!transactions.length)throw new Error('No transaction rows found. This may be a scanned PDF. Try AI PDF import.');
 // Verify every running balance and the listing summary; fail rather than silently import partial data.
 const summary=(label:string)=>{const t=pages[0].find(t=>t.str===label);if(!t)return undefined;const v=pages[0].find(v=>v.x>t.x&&Math.abs(v.y-t.y)<3&&amountPattern.test(v.str));return v?cents(v.str)*(/DR$/.test(v.str)?-1:1):undefined;};
 let previous=summary('Start Balance');
 for(let i=0;i<transactions.length;i++){if(previous!==undefined&&previous+Math.round(transactions[i].amount*100)!==runningBalances[i])throw new Error('The extracted transactions do not reconcile with the PDF running balances. Use CSV or AI import.');previous=runningBalances[i];}
 const totalDebit=transactions.reduce((sum,t)=>sum+Math.max(0,-Math.round(t.amount*100)),0);
 const totalCredit=transactions.reduce((sum,t)=>sum+Math.max(0,Math.round(t.amount*100)),0);
 if((summary('Total Debits')!==undefined&&summary('Total Debits')!==totalDebit)||(summary('Total Credits')!==undefined&&summary('Total Credits')!==totalCredit)||(summary('End Balance')!==undefined&&summary('End Balance')!==previous))throw new Error('PDF totals do not match the extracted transactions. No rows were imported. Try CSV or AI import.');
 return transactions;
}

export async function readPDFPages(data: Uint8Array, workerURL?: string): Promise<PDFPage[]> {
 const pdf=await import('pdfjs-dist/legacy/build/pdf.mjs');
 if(workerURL)pdf.GlobalWorkerOptions.workerSrc=workerURL;
 const task=pdf.getDocument({data,useSystemFonts:true});
 const doc=await task.promise;
 try{
  if(doc.numPages>100)throw new Error('Please split PDFs longer than 100 pages.');
  const pages:PDFPage[]=[];
  for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);const content=await page.getTextContent();pages.push(content.items.flatMap(t=>'str' in t?[{str:t.str.trim(),x:t.transform[4],y:t.transform[5],width:t.width}]:[]));page.cleanup();}
  return pages;
 }finally{await doc.destroy();}
}
