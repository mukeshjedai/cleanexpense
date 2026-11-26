import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serializeTransactions,snapshotSchema} from './transaction-file';
const input={currency:'AUD',transactions:[{id:'one',date:'2026-11-24',description:'Café 日本',amount:-12.5,category:'Dining'}]};
test('UTF-8 transaction text round-trips with category, sign, date and currency',()=>{const {text,snapshot}=serializeTransactions(input,new Date('2026-11-26T00:00:00Z'));assert.deepEqual(snapshotSchema.parse(JSON.parse(Buffer.from(text).toString('utf8'))),snapshot);assert.equal(snapshot.transactions[0].description,'Café 日本');});
test('rejects empty, invalid dates, duplicate IDs and fractional cents',()=>{assert.throws(()=>serializeTransactions({...input,transactions:[]}));assert.throws(()=>serializeTransactions({...input,transactions:[{...input.transactions[0],date:'2026-02-30'}]}));assert.throws(()=>serializeTransactions({...input,transactions:[input.transactions[0],input.transactions[0]]}));assert.throws(()=>serializeTransactions({...input,transactions:[{...input.transactions[0],amount:1.234}]}));});
