// Right-click context menu: "Makale Özetle"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'summarize-selection',
    title: 'Makale Özetle',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'summarize-selection' && info.selectionText) {
    // Store selected text, popup will read it
    chrome.storage.local.set({ pendingText: info.selectionText.trim() });
    // Open popup (can't programmatically, but notify user)
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#171717' });
  }
});
