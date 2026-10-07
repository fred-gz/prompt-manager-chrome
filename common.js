// Callback support is retained by older Chromium-based extension hosts.
function extensionCall(owner, method, ...args) {
  return new Promise((resolve, reject) => {
    try {
      const result = owner[method](...args, value => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve(value);
      });
      if (result && typeof result.then === 'function') result.then(resolve, reject);
    } catch (error) { reject(error); }
  });
}
function cloneStore(value) { return JSON.parse(JSON.stringify(value)); }
const DEFAULT_STORE = {
  defaultsVersion: 3,
  prompts: [],
  websites: [
    {id: 'chatgpt', domain: 'chatgpt.com', enabled: true},
    {id: 'claude', domain: 'claude.ai', enabled: true},
    {id: 'gemini', domain: 'gemini.google.com', enabled: true},
    {id: 'deepseek', domain: 'chat.deepseek.com', enabled: true},
    {id: 'qianwen', domain: 'qianwen.com', enabled: true},
    {id: 'qwen', domain: 'qwen.ai', enabled: true}
  ]
};
async function getStore() {
  const result = await extensionCall(chrome.storage.local, 'get', 'store');
  if (!result.store) return cloneStore(DEFAULT_STORE);
  const store = cloneStore(result.store);
  if ((store.defaultsVersion || 1) < 3) {
    const chatSite = store.websites.find(site => site.domain === 'chat.deepseek.com');
    if (chatSite) {
      store.websites = store.websites.filter(site => site.domain !== 'deepseek.com');
    } else {
      for (const site of store.websites) {
        if (site.domain === 'deepseek.com') site.domain = 'chat.deepseek.com';
      }
    }
  }
  if ((store.defaultsVersion || 1) < 2) {
    for (const site of DEFAULT_STORE.websites.slice(3)) {
      if (!store.websites.some(existing => existing.domain === site.domain)) {
        store.websites.push({...site});
      }
    }
    // Saved with the next user edit, avoiding writes from concurrent page loads.
    // The version preserves subsequent deletions and existing disabled entries.
    store.defaultsVersion = 2;
  }
  store.defaultsVersion = Math.max(store.defaultsVersion || 1, 3);
  return store;
}
async function setStore(store) { await extensionCall(chrome.storage.local, 'set', {store}); }
function id() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
function normalizeDomain(value) {
  const raw = value.trim();
  if (!raw || /\s/.test(raw)) throw new Error('请输入有效域名，例如 example.com');
  const url = new URL(raw.includes('://') ? raw : 'https://' + raw);
  const domain = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) || domain.split('.').some(part => !part || part.length > 63 || part.startsWith('-') || part.endsWith('-'))) {
    throw new Error('请输入有效的 HTTP / HTTPS 网站域名');
  }
  return domain;
}
