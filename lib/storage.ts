import {loadTransactions as loadAzure,saveTransactions as saveAzure} from './azure-files';
import {loadPostgres,savePostgres} from './postgres';
export function storageConfigured(){return !!(process.env.DATABASE_URL||process.env.AZURE_STORAGE_CONNECTION_STRING);}
// Explicitly configured PostgreSQL is primary. Database errors never fall back to stale Azure data.
export const loadTransactions=()=>process.env.DATABASE_URL?loadPostgres():loadAzure();
export const saveTransactions=(input:unknown)=>process.env.DATABASE_URL?savePostgres(input):saveAzure(input);
export const storageName=()=>process.env.DATABASE_URL?'PostgreSQL':'Azure Files';
