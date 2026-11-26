import {postgresPool} from './postgres';
import type {ForecastReport} from './forecast';
export async function savedForecasts(horizon:number,category:string,id?:string){
 const pool=postgresPool();
 const recent=await pool.query(`SELECT id,generated_at,horizon,category,data_cutoff::text FROM cleanexpense.forecasts
  WHERE status='complete' AND horizon=$1 AND category=$2 ORDER BY generated_at DESC,id DESC LIMIT 30`,[horizon,category]);
 const selected=id?await pool.query("SELECT id,generated_at,report FROM cleanexpense.forecasts WHERE id=$1 AND status='complete' AND horizon=$2 AND category=$3",[id,horizon,category]):recent.rows.length?await pool.query("SELECT id,generated_at,report FROM cleanexpense.forecasts WHERE id=$1 AND status='complete'",[recent.rows[0].id]):{rows:[]};
 return {forecasts:recent.rows.map(r=>({id:r.id,generatedAt:r.generated_at.toISOString(),horizon:r.horizon,category:r.category,dataCutoff:r.data_cutoff})),saved:selected.rows[0]?{id:selected.rows[0].id,generatedAt:selected.rows[0].generated_at.toISOString(),report:selected.rows[0].report as ForecastReport}:null};
}
export async function claimForecast(id:string,horizon:number,category:string,currency:string,source:string,cutoff:string){
 const result=await postgresPool().query(`INSERT INTO cleanexpense.forecasts (id,horizon,category,currency,source_snapshot,data_cutoff,status)
  VALUES ($1,$2,$3,$4,$5,$6,'pending') ON CONFLICT (id) DO NOTHING RETURNING id`,[id,horizon,category,currency,source,cutoff]);
 return result.rows.length>0;
}
export async function completeForecast(id:string,report:ForecastReport){
 const result=await postgresPool().query("UPDATE cleanexpense.forecasts SET status='complete',generated_at=clock_timestamp(),report=$2::jsonb WHERE id=$1 AND status='pending' RETURNING generated_at",[id,JSON.stringify(report)]);
 if(!result.rows[0])throw new Error('Forecast could not be saved.');
 return {id,generatedAt:result.rows[0].generated_at.toISOString(),report};
}
export async function failForecast(id:string){await postgresPool().query("UPDATE cleanexpense.forecasts SET status='failed' WHERE id=$1 AND status='pending'",[id]);}
