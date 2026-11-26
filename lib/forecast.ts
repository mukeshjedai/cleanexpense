import {categories,Category,Transaction} from './statement';
import {daysInWindow,shiftDate} from './timeline-window';
export type HistoryDay={date:string;total:number;categories:{category:Category;amount:number}[]};
export type ForecastDay=HistoryDay&{low:number;high:number};
export type ForecastReport={history:HistoryDay[];days:ForecastDay[];currency?:string;method:string;backtestMAE:number;backtestDays:number;errorScale:number;summary:string;drivers:string[];caveats:string[]};
const round=(n:number)=>Math.round(n*100)/100;
const weekday=(date:string)=>new Date(date+'T00:00:00Z').getUTCDay();
function estimate(history:HistoryDay[],date:string,category:Category,method:string){
 const recent=history.slice(-56);const samples=(method==='Weekday pattern'?recent.filter(d=>weekday(d.date)===weekday(date)):recent.slice(-28));
 let sum=0,weight=0;samples.forEach((d,i)=>{const w=method==='Weekday pattern'?Math.pow(.85,samples.length-i-1):1;sum+=(d.categories.find(c=>c.category===category)?.amount||0)*w;weight+=w;});return round(weight?sum/weight:0);
}
export function makeForecast(rows:Transaction[],horizon:number,category='All categories'):ForecastReport{
 if(!Number.isInteger(horizon)||horizon<7||horizon>30)throw new Error('Choose a forecast horizon from 7 to 30 days.');
 if(!rows.length)throw new Error('Load saved transactions first.');
 const dates=rows.map(t=>t.date).sort(),end=dates.at(-1)!,start=dates[0]>shiftDate(end,-179)?dates[0]:shiftDate(end,-179);
 const count=daysInWindow(start,end);if(count<28)throw new Error('At least 28 calendar days of statement history are needed for a forecast.');
 const expenses=rows.filter(t=>t.amount<0&&t.category!=='Transfers'&&t.date>=start&&(category==='All categories'||t.category===category));
 if(!expenses.length)throw new Error('No expenses found for the selected category.');
 const used=categories.filter(c=>expenses.some(t=>t.category===c));
 const sums=new Map<string,Map<Category,number>>();for(const t of expenses){const day=sums.get(t.date)||new Map<Category,number>();day.set(t.category,(day.get(t.category)||0)+Math.round(-t.amount*100));sums.set(t.date,day);}
 const history=Array.from({length:count},(_,i)=>{const date=shiftDate(start,i),values=used.map(category=>({category,amount:(sums.get(date)?.get(category)||0)/100}));return {date,categories:values,total:round(values.reduce((n,v)=>n+v.amount,0))};});
 const holdout=Math.min(14,count-21);const scores=['Recent daily average','Weekday pattern'].map(method=>{const errors:number[]=[];for(let i=count-holdout;i<count;i++){const training=history.slice(0,i),predicted=used.reduce((n,c)=>n+estimate(training,history[i].date,c,method),0);errors.push(Math.abs(history[i].total-predicted));}return {method,errors,mae:errors.reduce((n,v)=>n+v,0)/errors.length};}).sort((a,b)=>a.mae-b.mae);
 const winner=scores[0],sorted=[...winner.errors].sort((a,b)=>a-b),errorScale=round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.8)-1)]||0);
 const days=Array.from({length:horizon},(_,i)=>{const date=shiftDate(end,i+1),values=used.map(category=>({category,amount:estimate(history,date,category,winner.method)})),total=round(values.reduce((n,v)=>n+v.amount,0)),spread=errorScale*Math.sqrt(1+i/7);return {date,categories:values,total,low:round(Math.max(0,total-spread)),high:round(total+spread)};});
 return {history,days,method:winner.method,backtestMAE:round(winner.mae),backtestDays:holdout,errorScale,summary:'Statistical preview based on your recorded spending. Generate an AI prediction to add OpenAI analysis.',drivers:[],caveats:['Forecast dates begin after the latest saved transaction, not necessarily today.','Days without recorded expenses are treated as zero; missing statements can bias the result.','Shaded ranges are illustrative, based on recent baseline errors; they are not calibrated confidence intervals.','One-off purchases and changing circumstances can make future spending differ substantially.']};
}
export function validateAIDays(days:{date:string;categories:{category:Category;amount:number}[]}[],baseline:ForecastReport):ForecastDay[]{
 if(days.length!==baseline.days.length)throw new Error('AI returned an incomplete forecast.');
 const allowed=baseline.days[0].categories.map(c=>c.category),cap=Math.max(1000,...baseline.history.map(d=>d.total*4));
 return days.map((day,i)=>{if(day.date!==baseline.days[i].date||day.categories.length!==allowed.length||new Set(day.categories.map(c=>c.category)).size!==allowed.length||day.categories.some(c=>!allowed.includes(c.category)||!Number.isFinite(c.amount)||c.amount<0||c.amount>cap))throw new Error('AI forecast failed validation.');const values=day.categories.map(c=>({...c,amount:round(c.amount)})),total=round(values.reduce((n,c)=>n+c.amount,0)),spread=baseline.errorScale*Math.sqrt(1+i/7);return {date:day.date,categories:values,total,low:round(Math.max(0,total-spread)),high:round(total+spread)};});
}
