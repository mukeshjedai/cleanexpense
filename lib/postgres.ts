import { Pool,PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { snapshotInput,snapshotSchema } from './transaction-file';
import type {Category} from './statement';
import {descriptionKey,updateDescriptionCategory} from './transaction-view';
import {unseenTransactions} from './import-transactions';

let database:Pool|undefined;
export function postgresPool(){
 if(database)return database;
 const connection=process.env.DATABASE_URL;if(!connection)throw new Error('DATABASE_URL is not configured');
 const url=new URL(connection);
 // Configure TLS explicitly: URL sslmode options must not override CA verification.
 for(const name of ['sslmode','sslrootcert','sslcert','sslkey','uselibpqcompat'])url.searchParams.delete(name);
 const ca=process.env.DATABASE_CA_CERT_BASE64?Buffer.from(process.env.DATABASE_CA_CERT_BASE64,'base64').toString('utf8'):undefined;
 database=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:12000,statement_timeout:20000});
 database.on('error',()=>{});
 return database;
}
export async function closePostgres(){if(database){await database.end();database=undefined;}}
export async function savePostgres(input:unknown,sourceKey?:string){
 const data=snapshotInput.parse(input),client=await postgresPool().connect();
 try{
  await client.query('BEGIN');
  // Serialize complete saves so readers always see one committed, complete version.
  await client.query('SELECT pg_advisory_xact_lock(1935516041)');
  if(sourceKey){const existing=await client.query('SELECT id, saved_at, transaction_count FROM cleanexpense.snapshots WHERE source_key=$1',[sourceKey]);if(existing.rows[0]){await client.query('COMMIT');const row=existing.rows[0];return {filename:`PostgreSQL snapshot ${row.id}`,savedAt:row.saved_at.toISOString(),count:row.transaction_count,id:row.id};}}
  const result=await insertSnapshot(client,data,sourceKey);
  await client.query('COMMIT');
  return result;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
async function insertSnapshot(client:PoolClient,data:ReturnType<typeof snapshotInput.parse>,sourceKey?:string){
  const id=randomUUID();
  const saved=await client.query('INSERT INTO cleanexpense.snapshots (id,currency,source_key,transaction_count,saved_at) VALUES ($1,$2,$3,$4,clock_timestamp()) RETURNING saved_at',[id,data.currency,sourceKey||null,data.transactions.length]);
  const values=data.transactions.map((t,ordinal)=>({id:t.id,ordinal,date:t.date,time:t.time||null,description:t.description,amount:t.amount,category:t.category}));
  await client.query(`INSERT INTO cleanexpense.transactions (snapshot_id,id,ordinal,transaction_date,transaction_time,description,amount,category)
    SELECT $1::uuid,r.id,r.ordinal,r.date::date,r.time,r.description,r.amount,r.category
    FROM jsonb_to_recordset($2::jsonb) AS r(id text,ordinal integer,date text,time text,description text,amount numeric,category text)`,[id,JSON.stringify(values)]);

  return {filename:`PostgreSQL snapshot ${id}`,savedAt:saved.rows[0].saved_at.toISOString(),count:data.transactions.length,id};
}
async function readSnapshot(client:PoolClient,id:string){
 const result=await client.query('SELECT id,transaction_date::text AS date,transaction_time AS time,description,amount::text AS amount,category FROM cleanexpense.transactions WHERE snapshot_id=$1 ORDER BY ordinal',[id]);
 return result.rows.map(row=>({id:row.id,date:row.date,...(row.time?{time:row.time}:{}),description:row.description,amount:Number(row.amount),category:row.category}));
}
async function loadWithClient(client:PoolClient){
  const result=await client.query('SELECT id,saved_at,currency,version,transaction_count FROM cleanexpense.snapshots ORDER BY saved_at DESC,id DESC LIMIT 1');
  if(!result.rows[0])return null;
  const row=result.rows[0],transactions=await readSnapshot(client,row.id);
  if(transactions.length!==row.transaction_count)throw new Error('Incomplete saved snapshot');
  return {filename:`PostgreSQL snapshot ${row.id}`,...snapshotSchema.parse({version:row.version,savedAt:row.saved_at.toISOString(),currency:row.currency,transactions})};
}
export async function loadPostgres(){const client=await postgresPool().connect();try{return await loadWithClient(client);}finally{client.release();}}

export async function importPostgres(input:unknown,preview=false){
 const data=snapshotInput.parse(input),client=await postgresPool().connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(1935516041)');
  const saved=await loadWithClient(client);
  if(saved&&saved.currency!==data.currency)throw new Error('Import currency must match the saved workspace currency.');
  const result=unseenTransactions(saved?.transactions||[],data.transactions);
  const rules=new Map<string,Category>((await client.query('SELECT description_key,category FROM cleanexpense.category_rules')).rows.map(r=>[r.description_key,r.category]));
  const ids=new Set((saved?.transactions||[]).map(t=>t.id));
  const fresh=result.transactions.map(t=>({...t,id:ids.has(t.id)?randomUUID():t.id,category:rules.get(descriptionKey(t.description))||t.category}));
  if(preview||!fresh.length){await client.query('COMMIT');return {saved,transactions:fresh,added:fresh.length,skipped:result.skipped};}
  const merged=snapshotInput.parse({currency:data.currency,transactions:[...(saved?.transactions||[]),...fresh]});
  await insertSnapshot(client,merged);const updated=await loadWithClient(client);await client.query('COMMIT');
  return {saved:updated,transactions:fresh,added:fresh.length,skipped:result.skipped};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function correctPostgresCategory(description:string,category:Category){
 const client=await postgresPool().connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(1935516041)');
  const saved=await loadWithClient(client);if(!saved)throw new Error('No saved transactions.');
  const source=saved.transactions.find(t=>descriptionKey(t.description)===descriptionKey(description));if(!source)throw new Error('No matching saved description.');
  const result=updateDescriptionCategory(saved.transactions,source.id,category);
  await client.query(`INSERT INTO cleanexpense.category_rules (description_key,category) VALUES ($1,$2)
   ON CONFLICT (description_key) DO UPDATE SET category=EXCLUDED.category,updated_at=clock_timestamp()`,[descriptionKey(description),category]);
  if(result.count)await insertSnapshot(client,{currency:saved.currency,transactions:result.rows});
  const updated=await loadWithClient(client);await client.query('COMMIT');return {saved:updated,count:result.count};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

