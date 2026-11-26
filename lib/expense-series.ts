import type { Transaction } from './statement';
export type Interval='day'|'week'|'month';
export function bucketDate(date:string,interval:Interval){
 if(interval==='month')return date.slice(0,7)+'-01';
 const d=new Date(date+'T00:00:00Z');
 if(interval==='week')d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 return d.toISOString().slice(0,10);
}
export function expenseSeries(rows:Transaction[],interval:Interval,start:string,end:string,category='All categories'){
 const expenses=rows.filter(t=>t.amount<0&&t.category!=='Transfers'&&(!start||t.date>=start)&&(!end||t.date<=end)&&(category==='All categories'||t.category===category));
 if(!expenses.length)return {dates:[] as string[],series:[] as {category:string;values:number[]}[],count:0};
 const first=bucketDate(expenses.reduce((a,t)=>t.date<a?t.date:a,expenses[0].date),interval),last=bucketDate(expenses.reduce((a,t)=>t.date>a?t.date:a,expenses[0].date),interval);
 const dates:string[]=[];const cursor=new Date(first+'T00:00:00Z');
 while(cursor.toISOString().slice(0,10)<=last){dates.push(cursor.toISOString().slice(0,10));if(dates.length>10000)throw new Error('Choose a shorter date range.');if(interval==='month')cursor.setUTCMonth(cursor.getUTCMonth()+1);else cursor.setUTCDate(cursor.getUTCDate()+(interval==='week'?7:1));}
 const totals=new Map<string,Map<string,number>>();
 for(const t of expenses){const key=bucketDate(t.date,interval);const map=totals.get(t.category)||new Map<string,number>();map.set(key,(map.get(key)||0)+Math.round(-t.amount*100));totals.set(t.category,map);}
 const series=[...totals].map(([category,map])=>({category,values:dates.map(d=>(map.get(d)||0)/100)})).sort((a,b)=>b.values.reduce((n,v)=>n+v,0)-a.values.reduce((n,v)=>n+v,0));
 return {dates,series,count:expenses.length};
}
