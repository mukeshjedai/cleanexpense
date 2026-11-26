import type {Transaction} from './statement';
import {descriptionKey} from './transaction-view';
import {newestExpenseFirst} from './timeline-window';
export const transactionKey=(t:Transaction)=>JSON.stringify([t.date,t.time||'',descriptionKey(t.description),Math.round(t.amount*100)]);
/** Match occurrences, so two identical purchases on one day remain two real transactions. */
export function unseenTransactions(saved:Transaction[],incoming:Transaction[]){
 const remaining=new Map<string,number>();for(const t of saved){const key=transactionKey(t);remaining.set(key,(remaining.get(key)||0)+1);}
 const fresh:Transaction[]=[];for(const t of incoming){const key=transactionKey(t),count=remaining.get(key)||0;if(count)remaining.set(key,count-1);else fresh.push(t);}
 return {transactions:fresh.sort(newestExpenseFirst),skipped:incoming.length-fresh.length};
}
