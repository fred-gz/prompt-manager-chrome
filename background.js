// Content scripts request extension-only actions through the service worker.
async function openPromptManager() {
  try {
    await chrome.action.openPopup();
  } catch {
    // Older Chrome versions or unavailable toolbar popups use the same manager
    // in a compact extension window instead.
    await chrome.windows.create({
      url: chrome.runtime.getURL('popup/index.html'),
      type: 'popup',
      width: 392,
      height: 560
    });
  }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'OPEN_PROMPT_MANAGER') return;
  openPromptManager().then(
    () => sendResponse({ok: true}),
    () => sendResponse({ok: false})
  );
  return true;
});
