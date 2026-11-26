import Papa from 'papaparse';
export const categories = ['Groceries','Dining','Shopping','Transport','Housing','Utilities','Health','Entertainment','Travel','Income','Transfers','Other'] as const;
export type Category = typeof categories[number];
export type Transaction = { id: string; date: string; time?: string; description: string; amount: number; category: Category };
export function parseTime(value:string){const match=value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);if(!match||Number(match[1])>23||Number(match[2])>59||(match[3]&&Number(match[3])>59))throw new Error('Time must use 24-hour HH:mm or HH:mm:ss format.');return `${match[1].padStart(2,'0')}:${match[2]}${match[3]?':'+match[3]:''}`;}
export function categorize(s: string, amount: number): Category {
 if (/transfer|payment to account|internal transfer/i.test(s)) return 'Transfers';
 if (amount > 0) return 'Income';
 const rules: [Category, RegExp][] = [['Groceries',/woolworth|coles|aldi|grocery|supermarket/],['Dining',/cafe|coffee|restaurant|mcdonald|uber eats|doordash|bakery/],['Transport',/petrol|fuel|shell|bp |translink|uber|parking|train/],['Housing',/rent|mortgage/],['Utilities',/electric|internet|telstra|optus|energy|water bill/],['Health',/pharmacy|chemist|medical|doctor|dental/],['Entertainment',/netflix|spotify|cinema|disney/],['Travel',/airline|qantas|hotel|airbnb|virgin/],['Shopping',/amazon|kmart|target|ikea|bunnings/]];
 return rules.find(([,r]) => r.test(s.toLowerCase()))?.[0] || 'Other';
}
export function parseDate(value: string): string {
 const s=value.trim(); let y:number,m:number,d:number;
 let match=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
 if(match) [,y,m,d]=match.map(Number); else {match=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/); if(!match) throw new Error(`Unsupported date: ${s}. Use DD/MM/YYYY or YYYY-MM-DD.`); d=+match[1];m=+match[2];y=+match[3];if(y<100)y+=2000;}
 const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw new Error(`Invalid date: ${s}`);
 return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
export function moneyNumber(s: string): number {
 const clean=s.trim().replace(/[$£€\s,]/g,'').replace(/^\((.*)\)$/,'-$1').replace(/CR$/i,'').replace(/DR$/i,'');
 if(!/^[+-]?\d+(\.\d{1,2})?$/.test(clean)) throw new Error(`Invalid amount: ${s}`);
 const n=Number(clean);return /DR\s*$/i.test(s)?-Math.abs(n):n;
}
export function parseCSV(text: string): Transaction[] {
 const parsed=Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.trim().toLowerCase().replace(/[^a-z]/g,'')});
 if(parsed.errors.length)throw new Error('CSV could not be read. Check quotes and column counts.');
 const rows=parsed.data; if(!rows.length)throw new Error('The statement has no transactions.');
 return rows.map((r,i)=>{const date=r.date||r.transactiondate||r.posteddate;const description=r.description||r.details||r.narrative||r.memo; if(!date||!description)throw new Error(`Row ${i+2}: Date and Description columns are required.`);
 let amount:number;if(r.amount?.trim())amount=moneyNumber(r.amount);else if(r.debit?.trim()||r.credit?.trim()){const debit=r.debit?.trim()?moneyNumber(r.debit):0;const credit=r.credit?.trim()?moneyNumber(r.credit):0;amount=Math.abs(credit)-Math.abs(debit);}else throw new Error(`Row ${i+2}: Amount or Debit/Credit columns are required.`);
 const time=(r.time||r.transactiontime||'').trim();return {id:crypto.randomUUID(),date:parseDate(date),...(time?{time:parseTime(time)}:{}),description:description.trim(),amount,category:categorize(description,amount)};});
}
export function exportCSV(rows: Transaction[]) {return Papa.unparse(rows.map(t=>({Date:t.date,Time:t.time||'',Description:/^[=+\-@\t\r]/.test(t.description)?`'${t.description}`:t.description,Amount:t.amount.toFixed(2),Category:t.category})));}
