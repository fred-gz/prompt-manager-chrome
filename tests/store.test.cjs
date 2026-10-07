const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup() {
  let saved;
  const context = vm.createContext({URL, structuredClone, crypto:globalThis.crypto, chrome:{storage:{local:{get:async()=>({store:saved}),set:async value=>{saved=structuredClone(value.store);}}}}});
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../common.js'), 'utf8'), context);
  return context;
}
test('default websites, local persistence, and fresh default copies', async()=> {
  const context = setup();
  const initial = await context.getStore();
  assert.equal(initial.websites.map(site=>site.domain).join(','), 'chatgpt.com,claude.ai,gemini.google.com,chat.deepseek.com,qianwen.com,qwen.ai');
  assert.ok(initial.websites.every(site=>site.enabled));
  initial.prompts.push({id:'test',name:'Test',content:'hello'});
  assert.equal((await context.getStore()).prompts.length, 0);
  await context.setStore(initial);
  assert.equal((await context.getStore()).prompts[0].content, 'hello');
});
test('normalizes domains and URLs and rejects invalid input',()=> {
  const context = setup();
  for (const [input, expected] of [[' HTTPS://Example.COM:443/path?q=1 ', 'example.com'], ['example.com.', 'example.com'], ['localhost:3000', 'localhost']]) assert.equal(context.normalizeDomain(input), expected);
  for (const invalid of ['', 'hello world', 'https://user:pass@example.com', 'file://example.com', 'a..com', '-bad.com', 'bad-.com', '*.example.com']) assert.throws(()=>context.normalizeDomain(invalid));
});

test('upgrades old defaults while preserving prompts, disabled sites and later deletions', async () => {
  const context = setup();
  await context.setStore({prompts:[{id:'p', content:'keep'}], websites:[{id:'custom', domain:'deepseek.com', enabled:false}]});
  const upgraded = await context.getStore();
  assert.equal(upgraded.prompts[0].content, 'keep');
  assert.equal(upgraded.websites.length, 3);
  assert.equal(upgraded.websites[0].enabled, false);
  assert.equal(upgraded.defaultsVersion, 3);
  assert.equal(upgraded.websites[0].domain, 'chat.deepseek.com');
  upgraded.websites = upgraded.websites.filter(site => site.domain !== 'qianwen.com');
  await context.setStore(upgraded);
  assert.equal((await context.getStore()).websites.some(site => site.domain === 'qianwen.com'), false);
});

test('narrows saved DeepSeek domains without restoring deletions or duplicating chat entries', async () => {
  const context = setup();
  await context.setStore({defaultsVersion:2, prompts:[], websites:[{id:'deepseek', domain:'deepseek.com', enabled:false}]});
  const migrated = await context.getStore();
  assert.equal(migrated.websites[0].domain, 'chat.deepseek.com');
  assert.equal(migrated.websites[0].enabled, false);
  await context.setStore({defaultsVersion:2, prompts:[], websites:[]});
  assert.equal((await context.getStore()).websites.length, 0);
  await context.setStore({defaultsVersion:2, prompts:[], websites:[
    {id:'deepseek', domain:'deepseek.com', enabled:true},
    {id:'chat', domain:'chat.deepseek.com', enabled:false}
  ]});
  const deduplicated = await context.getStore();
  assert.equal(deduplicated.websites.length, 1);
  assert.equal(deduplicated.websites[0].id, 'chat');
  assert.equal(deduplicated.websites[0].enabled, false);
});

test('callback-only storage works without structuredClone or randomUUID', async () => {
  let saved;
  const context = vm.createContext({URL, Uint8Array, crypto:{getRandomValues:array=>globalThis.crypto.getRandomValues(array)}, chrome:{runtime:{},storage:{local:{
    get:(key, callback)=>queueMicrotask(()=>callback({store:saved})),
    set:(value, callback)=>queueMicrotask(()=>{saved=JSON.parse(JSON.stringify(value.store));callback();})
  }}}});
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../common.js'), 'utf8'), context);
  const store = await context.getStore();
  store.prompts.push({id:context.id(),name:'旧内核',content:'测试'});
  await context.setStore(store);
  assert.equal((await context.getStore()).prompts[0].content, '测试');
  assert.match(store.prompts[0].id, /^[0-9a-f]{32}$/);
  context.chrome.runtime.lastError = {message:'Storage unavailable'};
  await assert.rejects(context.getStore(), /Storage unavailable/);
});
