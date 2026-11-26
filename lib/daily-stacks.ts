import {categories,Category,Transaction} from './statement';
export function dailyStacks(rows:Transaction[],month=''){
 const totals=new Map<string,Map<Category,number>>();
 for(const t of rows){if(t.amount>=0||t.category==='Transfers'||(month&&!t.date.startsWith(month)))continue;const day=totals.get(t.date)||new Map<Category,number>();day.set(t.category,(day.get(t.category)||0)+Math.round(-t.amount*100));totals.set(t.date,day);}
 let dates=[...totals.keys()].sort();
 if(month){const [year,m]=month.split('-').map(Number);const count=new Date(Date.UTC(year,m,0)).getUTCDate();dates=Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`);}
 return dates.map(date=>{const day=totals.get(date);const segments=categories.filter(c=>day?.has(c)).map(category=>({category,amount:day!.get(category)!/100}));return {date,segments,total:segments.reduce((n,s)=>n+Math.round(s.amount*100),0)/100};});
}
