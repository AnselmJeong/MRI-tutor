import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createTaskId} from '../trainer/task-id.js';

const uuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
test('HTTP task IDs work without randomUUID and remain distinct UUIDs',()=>{
  const httpCrypto={getRandomValues:bytes=>webcrypto.getRandomValues(bytes)};
  const ids=Array.from({length:256},()=>createTaskId(httpCrypto));
  for(const id of ids)assert.match(id,uuidV4);
  assert.equal(new Set(ids).size,ids.length);
});
test('secure-context task IDs continue to use the native generator',()=>{
  const id=webcrypto.randomUUID();
  assert.equal(createTaskId({randomUUID:()=>id,getRandomValues:()=>assert.fail('Unexpected fallback')}),id);
});
