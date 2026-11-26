import { ShareServiceClient } from '@azure/storage-file-share';
import { randomUUID } from 'node:crypto';
import { serializeTransactions, snapshotSchema } from './transaction-file';

function shareClient(){
 const connection=process.env.AZURE_STORAGE_CONNECTION_STRING;
 if(!connection)throw new Error('STORAGE_NOT_CONFIGURED');
 return ShareServiceClient.fromConnectionString(connection,{retryOptions:{maxTries:2},keepAliveOptions:{enable:true}}).getShareClient(process.env.AZURE_STORAGE_FILE_SHARE||'cleanexpense');
}
export async function saveTransactions(input:unknown){
 const {snapshot,text}=serializeTransactions(input);
 const share=shareClient();await share.createIfNotExists();
 const filename=`transactions-${snapshot.savedAt.replace(/[:.]/g,'-')}-${randomUUID()}.txt`;
 const file=share.rootDirectoryClient.getFileClient(filename);
 await file.uploadData(Buffer.from(text,'utf8'),{fileHttpHeaders:{fileContentType:'text/plain; charset=utf-8'}});
 return {filename,savedAt:snapshot.savedAt,count:snapshot.transactions.length};
}
export async function loadTransactions(){
 const share=shareClient();
 if(!await share.exists())return null;
 let filename='';
 for await(const entry of share.rootDirectoryClient.listFilesAndDirectories({prefix:'transactions-'})){
  if(entry.kind==='file'&&/^transactions-\d{4}-\d{2}-\d{2}T[\dTZ-]+-[\da-f-]+\.txt$/.test(entry.name)&&entry.name>filename)filename=entry.name;
 }
 if(!filename)return null;
 const file=share.rootDirectoryClient.getFileClient(filename);
 const properties=await file.getProperties();
 if((properties.contentLength||0)>3_000_000)throw new Error('Stored file exceeds size limit');
 const content=await file.downloadToBuffer();
 return {filename,...snapshotSchema.parse(JSON.parse(content.toString('utf8')))};
}
