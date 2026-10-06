const DEFAULT_STORE={prompts:[],websites:[{id:'chatgpt',domain:'chatgpt.com',enabled:true},{id:'claude',domain:'claude.ai',enabled:true},{id:'gemini',domain:'gemini.google.com',enabled:true}]};
async function getStore(){const r=await chrome.storage.local.get('store');if(r.store)return r.store;await chrome.storage.local.set({store:DEFAULT_STORE});return DEFAULT_STORE}
async function setStore(store){await chrome.storage.local.set({store})}
function id(){return crypto.randomUUID()}
