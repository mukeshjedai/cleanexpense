import type { Category, Transaction } from './statement';
export const descriptionKey=(description:string)=>description.trim().replace(/\s+/g,' ').toLowerCase();
export function updateDescriptionCategory(rows:Transaction[],id:string,category:Category){
 const source=rows.find(t=>t.id===id);
 if(!source)return {rows,count:0};
 const key=descriptionKey(source.description);let count=0;
 const updated=rows.map(t=>{if(descriptionKey(t.description)!==key||t.category===category)return t;count++;return {...t,category};});
 return {rows:updated,count};
}
export type SortKey='description'|'date'|'category'|'amount'|'incoming'|'outgoing';
export type GroupKey='none'|'category'|'merchant'|'direction';
export const incoming=(t:Transaction)=>Math.max(t.amount,0);
export const outgoing=(t:Transaction)=>Math.max(-t.amount,0);
export function sortTransactions(rows:Transaction[],key:SortKey,direction:'asc'|'desc'){
 return [...rows].sort((a,b)=>{
  const av=key==='incoming'?incoming(a):key==='outgoing'?outgoing(a):a[key];
  const bv=key==='incoming'?incoming(b):key==='outgoing'?outgoing(b):b[key];
  const result=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'});
  return (direction==='asc'?result:-result)||a.id.localeCompare(b.id);
 });
}
export function groupTransactions(rows:Transaction[],key:GroupKey){
 const groups=new Map<string,Transaction[]>();
 for(const row of rows){const name=key==='category'?row.category:key==='merchant'?descriptionKey(row.description):key==='direction'?(row.amount<0?'Outgoing':row.amount>0?'Incoming':'No movement'):'All transactions';groups.set(name,[...(groups.get(name)||[]),row]);}
 return [...groups].map(([name,transactions])=>({name,transactions,incoming:transactions.reduce((n,t)=>n+Math.round(incoming(t)*100),0)/100,outgoing:transactions.reduce((n,t)=>n+Math.round(outgoing(t)*100),0)/100})).sort((a,b)=>b.outgoing-a.outgoing||a.name.localeCompare(b.name));
}
