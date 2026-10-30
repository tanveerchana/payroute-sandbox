import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceToken} from '../src/client.js';
const memory=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};};
test('browser workspace token is stable within six days and rotates before storage expiry',()=>{
 const storage=memory();const original=workspaceToken(storage,1000000);assert.match(original,/^[a-f0-9]{64}$/);assert.equal(workspaceToken(storage,1000000+5*86400000),original);assert.notEqual(workspaceToken(storage,1000000+6*86400000),original);
});
test('legacy or malformed browser tokens are replaced with a fresh timestamped token',()=>{
 const storage=memory();storage.setItem('payroute-token','a'.repeat(64));assert.notEqual(workspaceToken(storage,1000000),'a'.repeat(64));assert.equal(storage.getItem('payroute-token-created'),'1000000');
});
