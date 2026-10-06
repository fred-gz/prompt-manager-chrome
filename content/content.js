(() => {
  let store, hostElement, shadow, panel, target, range, selection;
  const positionKey = 'floatingPosition:' + location.hostname;
  let position = null, drag = null, suppressClick = false;
  const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));
  const selector = 'textarea,input:not([type]),input[type="text"],input[type="search"],[contenteditable="true"],[contenteditable="plaintext-only"]';
  const editable = el => el instanceof Element && el.matches(selector) && !el.disabled && !el.readOnly && el.getClientRects().length > 0;

  function remember(event) {
    if (event.composedPath().includes(hostElement)) return;
    const el = document.activeElement?.closest(selector);
    if (!editable(el)) return;
    target = el;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      selection = [el.selectionStart, el.selectionEnd];
    } else {
      const current = window.getSelection();
      if (current.rangeCount && el.contains(current.anchorNode)) range = current.getRangeAt(0).cloneRange();
    }
  }
  ['focusin', 'keyup', 'pointerup', 'selectionchange'].forEach(type => document.addEventListener(type, remember));

  function render() {
    const enabled = store.websites.some(site => site.enabled && (location.hostname === site.domain || location.hostname.endsWith('.' + site.domain)));
    if (!enabled) { hostElement?.remove(); hostElement = null; return; }
    if (!hostElement) {
      hostElement = document.createElement('div');
      hostElement.id = 'prompt-manager-extension';
      shadow = hostElement.attachShadow({mode: 'closed'});
      shadow.innerHTML = `<style>
        :host{all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483647;font:14px system-ui;color:#202124}
        *{box-sizing:border-box}button{font:inherit;cursor:pointer}#toggle{width:48px;height:48px;border:0;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white;font-size:24px;box-shadow:0 5px 24px #1d4ed866;border:2px solid #bfdbfe;touch-action:none;user-select:none;cursor:grab}
        #toggle:active{cursor:grabbing}#toggle:focus-visible{outline:3px solid #60a5fa;outline-offset:3px}
        #panel{position:fixed;right:0;bottom:60px;width:min(320px,calc(100vw - 40px));max-height: min(440px,calc(100vh - 110px));overflow:auto;padding:12px;background:#dbeafe;border:1px solid #60a5fa;border-radius:14px;box-shadow:0 12px 40px #1e40af40}
        .panel-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.panel-header h2{margin:0}.settings{display:inline-flex;align-items:center;gap:5px;min-height:36px;padding:6px 9px;border:1px solid #93c5fd;border-radius:8px;background:#eff6ff;color:#1e40af;font-size:13px;font-weight:600;white-space:nowrap}.settings:hover{background:#bfdbfe}.settings:focus-visible{outline:2px solid #2563eb;outline-offset:2px}.settings{line-height:20px}.settings-icon{display:block;width:20px;height:20px;flex:0 0 20px}
        [hidden]{display:none!important}h2{color:#1e3a8a;font-size:16px;margin:4px 4px 12px}.prompt{display:block;text-align:left;width:100%;border:0;border-radius:8px;background:#eff6ff;margin-top:6px;padding:12px;color:#172554;overflow-wrap:anywhere}.prompt:hover,.prompt:focus-visible{background:#bfdbfe;outline-color:#2563eb}small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#475569;margin-top:4px}p{line-height:1.5;color:#334155;margin:8px 4px}
      </style><button id="toggle" title="点击打开提示词 · 拖动调整位置" aria-label="打开提示词，可拖动调整位置" aria-expanded="false">✦</button><section id="panel" aria-label="提示词列表" hidden></section>`;
      panel = shadow.querySelector('#panel');
      const toggle = shadow.querySelector('#toggle');
      toggle.onclick = () => { if (suppressClick) { suppressClick = false; return; } panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) { renderList(); layout(); } };
      bindDrag(toggle);
      shadow.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
      document.documentElement.append(hostElement);
      layout();
    }
    if (!panel.hidden) renderList();
  }
  function layout() {
    if (!hostElement) return;
    const x = clamp(position?.x ?? innerWidth - 68, 8, innerWidth - 56);
    const y = clamp(position?.y ?? innerHeight - 68, 8, innerHeight - 56);
    Object.assign(hostElement.style, {left:x + 'px', top:y + 'px', right:'auto', bottom:'auto', width:'48px', height:'48px'});
    const width = Math.min(320, innerWidth - 16);
    const above = y - 20, below = innerHeight - y - 68;
    const openAbove = above >= below;
    Object.assign(panel.style, {
      width:width + 'px', left:clamp(x + 48 - width, 8, innerWidth - width - 8) + 'px', right:'auto',
      top:openAbove ? 'auto' : y + 60 + 'px', bottom:openAbove ? innerHeight - y + 12 + 'px' : 'auto',
      maxHeight:Math.max(0, Math.min(440, openAbove ? above : below)) + 'px'
    });
  }
  function bindDrag(button) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary) return;
      suppressClick = false;
      const rect = hostElement.getBoundingClientRect();
      drag = {id:event.pointerId, startX:event.clientX, startY:event.clientY, x:rect.x, y:rect.y, moved:false};
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      position = {x:clamp(drag.x + dx, 8, innerWidth - 56), y:clamp(drag.y + dy, 8, innerHeight - 56)};
      layout();
    });
    const finish = event => {
      if (!drag || drag.id !== event.pointerId) return;
      if (drag.moved) {
        suppressClick = true;
        chrome.storage.local.set({[positionKey]:position}).catch(error => {
          button.title = '位置保存失败，请重试拖动';
          console.error(error);
        });
      }
      drag = null;
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, finish));
  }
  window.addEventListener('resize', layout);
  function close() { if (hostElement) { panel.hidden = true; shadow.querySelector('#toggle').setAttribute('aria-expanded', 'false'); } }
  function renderList() {
    panel.replaceChildren();
    const header = document.createElement('div'); header.className = 'panel-header';
    const heading = document.createElement('h2'); heading.textContent = '常用提示词';
    const settings = document.createElement('button'); settings.className = 'settings';
    settings.type = 'button'; settings.setAttribute('aria-label', '设置'); settings.title = '打开提示词管理';
    settings.innerHTML = '<svg class="settings-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 1.72l-.12.89a2 2 0 0 1-.99 1.45l-.19.11a2 2 0 0 1-1.75.12l-.83-.33a2 2 0 0 0-2.46.85l-.22.38a2 2 0 0 0 .47 2.57l.71.55a2 2 0 0 1 .76 1.58v.22a2 2 0 0 1-.76 1.58l-.71.55a2 2 0 0 0-.47 2.57l.22.38a2 2 0 0 0 2.46.85l.83-.33a2 2 0 0 1 1.75.12l.19.11a2 2 0 0 1 .99 1.45l.12.89a2 2 0 0 0 2 1.72h.44a2 2 0 0 0 2-1.72l.12-.89a2 2 0 0 1 .99-1.45l.19-.11a2 2 0 0 1 1.75-.12l.83.33a2 2 0 0 0 2.46-.85l.22-.39a2 2 0 0 0-.47-2.57l-.71-.55a2 2 0 0 1-.76-1.58v-.21a2 2 0 0 1 .76-1.58l.71-.55a2 2 0 0 0 .47-2.57l-.22-.38a2 2 0 0 0-2.46-.85l-.83.33a2 2 0 0 1-1.75-.12l-.19-.11a2 2 0 0 1-.99-1.45l-.12-.89a2 2 0 0 0-2-1.72Z"/><circle cx="12" cy="12" r="3"/></svg><span>设置</span>';
    settings.onclick = async () => {
      settings.disabled = true;
      try {
        const response = await chrome.runtime.sendMessage({type:'OPEN_PROMPT_MANAGER'});
        if (!response?.ok) throw new Error('无法打开设置');
        close();
      } catch {
        let message = panel.querySelector('[role="alert"]');
        if (!message) { message = document.createElement('p'); message.setAttribute('role', 'alert'); panel.append(message); }
        message.textContent = '无法打开设置，请刷新网页后重试。';
      } finally { settings.disabled = false; }
    };
    header.append(heading, settings); panel.append(header);
    if (!store.prompts.length) { const empty = document.createElement('p'); empty.textContent = '暂无提示词。点击浏览器工具栏的插件图标添加。'; panel.append(empty); }
    for (const prompt of store.prompts) {
      const button = document.createElement('button'); button.className = 'prompt'; button.textContent = prompt.name;
      const preview = document.createElement('small'); preview.textContent = prompt.content; button.append(preview);
      button.title = prompt.content; button.onclick = () => insert(prompt.content); panel.append(button);
    }
  }
  function insert(text) {
    text += '\n';
    const el = editable(target) && target.isConnected ? target : [...document.querySelectorAll(selector)].find(editable);
    if (!el) { const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = '请先点击页面中的输入框，再选择提示词。'; panel.append(message); return; }
    el.focus();
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const [start, end] = el === target && selection ? selection : [el.value.length, el.value.length];
      const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, el.value.slice(0, start) + text + el.value.slice(end));
      el.setSelectionRange(start + text.length, start + text.length);
      el.dispatchEvent(new InputEvent('input', {bubbles:true, composed:true, inputType:'insertText', data:text}));
    } else {
      const current = window.getSelection();
      current.removeAllRanges();
      if (el === target && range && el.contains(range.commonAncestorContainer)) current.addRange(range);
      else { const end = document.createRange(); end.selectNodeContents(el); end.collapse(false); current.addRange(end); }
      // Native editing preserves rich-editor behavior and undo history where supported.
      if (!document.execCommand('insertText', false, text)) {
        const cursor = current.getRangeAt(0); cursor.deleteContents();
        const node = document.createTextNode(text); cursor.insertNode(node); cursor.setStartAfter(node); cursor.collapse(true);
        current.removeAllRanges(); current.addRange(cursor);
        el.dispatchEvent(new InputEvent('input', {bubbles:true, composed:true, inputType:'insertText', data:text}));
      }
    }
    close(); remember({composedPath: () => []});
  }
  document.addEventListener('pointerdown', event => { if (!event.composedPath().includes(hostElement)) close(); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.store) { store = changes.store.newValue || structuredClone(DEFAULT_STORE); render(); } });
  Promise.all([getStore(), chrome.storage.local.get(positionKey)]).then(([value, saved]) => {
    store = value;
    const last = saved[positionKey];
    if (last && Number.isFinite(last.x) && Number.isFinite(last.y)) position = last;
    render();
  }).catch(console.error);
})();
