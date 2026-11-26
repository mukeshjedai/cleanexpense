import { z } from 'zod';
import { categories, parseDate } from './statement';

export const savedTransaction = z.object({
 id:z.string().min(1).max(100),
 date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{try{return parseDate(value)===value;}catch{return false;}},'Invalid date'),
 description:z.string().trim().min(1).max(1000),
 amount:z.number().finite().min(-1e12).max(1e12).refine(n=>Math.abs(n*100-Math.round(n*100))<0.001,'Amount must have at most two decimals'),
 category:z.enum(categories)
});
export const snapshotInput=z.object({currency:z.enum(['AUD','USD','GBP','EUR','INR']),transactions:z.array(savedTransaction).min(1).max(5000)}).superRefine((value,ctx)=>{
 if(new Set(value.transactions.map(t=>t.id)).size!==value.transactions.length)ctx.addIssue({code:'custom',message:'Duplicate transaction IDs'});
});
export const snapshotSchema=z.object({version:z.literal(1),savedAt:z.iso.datetime(),currency:z.enum(['AUD','USD','GBP','EUR','INR']),transactions:z.array(savedTransaction).min(1).max(5000)});
export function serializeTransactions(input:unknown,now=new Date()){
 const data=snapshotInput.parse(input);
 const snapshot={version:1 as const,savedAt:now.toISOString(),...data};
 return {snapshot,text:JSON.stringify(snapshot,null,2)+'\n'};
}
