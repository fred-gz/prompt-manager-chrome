importScripts('common.js');

// Open the manager in its own extension window. Some Chromium derivatives
// handle action.openPopup differently from Chrome when called from a webpage.
function openPromptManager() {
  return extensionCall(chrome.windows, 'create', {
    url: chrome.runtime.getURL('popup/index.html'),
    type: 'popup',
    width: 392,
    height: 560,
    focused: true
  });
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'OPEN_PROMPT_MANAGER') return;
  openPromptManager().then(
    () => sendResponse({ok: true}),
    () => sendResponse({ok: false})
  );
  return true;
});
