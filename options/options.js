const $ = value => document.getElementById(value);
async function load() {
  const {websites} = await getStore();
  $('sites').replaceChildren();
  for (const site of websites) {
    const row = document.createElement('div'); row.className = 'site';
    row.innerHTML = '<span></span><label><input type="checkbox"><i></i></label><button>删除</button>';
    row.querySelector('span').textContent = site.domain;
    const checkbox = row.querySelector('input'); checkbox.checked = site.enabled;
    checkbox.setAttribute('aria-label', '启用 ' + site.domain);
    checkbox.onchange = () => update(store => { const current = store.websites.find(item => item.id === site.id); if (current) current.enabled = checkbox.checked; });
    row.querySelector('button').onclick = () => update(store => { store.websites = store.websites.filter(item => item.id !== site.id); });
    $('sites').append(row);
  }
}
async function update(mutate) {
  try { const store = await getStore(); mutate(store); await setStore(store); await load(); $('status').textContent = '已保存'; }
  catch (error) { $('status').textContent = error.message; await load(); }
}
$('add').onclick = async () => {
  try {
    const domain = normalizeDomain($('domain').value);
    await update(store => {
      if (store.websites.some(site => site.domain === domain)) throw new Error('该域名已存在');
      store.websites.push({id:id(), domain, enabled:true});
      $('domain').value = '';
    });
  } catch (error) { $('status').textContent = error.message; }
};
$('domain').onkeydown = event => { if (event.key === 'Enter') $('add').click(); };
load().catch(error => { $('status').textContent = error.message; });
