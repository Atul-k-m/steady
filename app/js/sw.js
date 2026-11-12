// MV3 service worker: stateless by design (Chrome stops it after ~30 s idle). It only opens the hub.
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('index.html') }));
