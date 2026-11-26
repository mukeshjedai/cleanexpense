import {readFile} from 'node:fs/promises';
import {postgresPool,closePostgres,savePostgres,loadPostgres} from '../lib/postgres';
import {loadTransactions} from '../lib/azure-files';
import {snapshotInput} from '../lib/transaction-file';
async function main(){
 const client=await postgresPool().connect();
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(1935516041)');await client.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 const source=await loadTransactions();if(!source)throw new Error('No saved Azure dataset to import.');
 const saved=await savePostgres({currency:source.currency,transactions:source.transactions},'azure:'+source.filename);
 const loaded=await loadPostgres();
 if(!loaded||JSON.stringify(snapshotInput.parse(loaded))!==JSON.stringify(snapshotInput.parse(source)))throw new Error('Imported rows do not match source data; check whether a newer snapshot was saved concurrently.');
 const result=await postgresPool().query('SELECT count(*)::int AS rows, sum(incoming_amount)::text AS incoming, sum(outgoing_amount)::text AS outgoing FROM cleanexpense.current_transactions');
 console.log(JSON.stringify({schema:'cleanexpense',table:'transactions',currentView:'current_transactions',imported:saved.count,verified:true,totals:result.rows[0]}));
}
main().catch(error=>{console.error('Database migration failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1;}).finally(closePostgres);
