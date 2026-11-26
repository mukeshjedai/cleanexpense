import { Pool,PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { snapshotInput,snapshotSchema } from './transaction-file';

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
  const id=randomUUID();
  const saved=await client.query('INSERT INTO cleanexpense.snapshots (id,currency,source_key,transaction_count) VALUES ($1,$2,$3,$4) RETURNING saved_at',[id,data.currency,sourceKey||null,data.transactions.length]);
  const values=data.transactions.map((t,ordinal)=>({id:t.id,ordinal,date:t.date,time:t.time||null,description:t.description,amount:t.amount,category:t.category}));
  await client.query(`INSERT INTO cleanexpense.transactions (snapshot_id,id,ordinal,transaction_date,transaction_time,description,amount,category)
    SELECT $1::uuid,r.id,r.ordinal,r.date::date,r.time,r.description,r.amount,r.category
    FROM jsonb_to_recordset($2::jsonb) AS r(id text,ordinal integer,date text,time text,description text,amount numeric,category text)`,[id,JSON.stringify(values)]);
  await client.query('COMMIT');
  return {filename:`PostgreSQL snapshot ${id}`,savedAt:saved.rows[0].saved_at.toISOString(),count:data.transactions.length,id};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
async function readSnapshot(client:PoolClient,id:string){
 const result=await client.query('SELECT id,transaction_date::text AS date,transaction_time AS time,description,amount::text AS amount,category FROM cleanexpense.transactions WHERE snapshot_id=$1 ORDER BY ordinal',[id]);
 return result.rows.map(row=>({id:row.id,date:row.date,...(row.time?{time:row.time}:{}),description:row.description,amount:Number(row.amount),category:row.category}));
}
export async function loadPostgres(){
 const client=await postgresPool().connect();
 try{
  const result=await client.query('SELECT id,saved_at,currency,version,transaction_count FROM cleanexpense.snapshots ORDER BY saved_at DESC,id DESC LIMIT 1');
  if(!result.rows[0])return null;
  const row=result.rows[0],transactions=await readSnapshot(client,row.id);
  if(transactions.length!==row.transaction_count)throw new Error('Incomplete saved snapshot');
  return {filename:`PostgreSQL snapshot ${row.id}`,...snapshotSchema.parse({version:row.version,savedAt:row.saved_at.toISOString(),currency:row.currency,transactions})};
 }finally{client.release();}
}
