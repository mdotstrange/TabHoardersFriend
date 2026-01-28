// Default timer duration in minutes
const DEFAULT_TIMER_MINUTES = 30;

// Parent folder name
const PARENT_FOLDER_NAME = 'TabHoardersFriend';

// Track currently active tab per window
const activeTabByWindow = new Map();

// Cache for folders to prevent race conditions
let cachedParentFolderId = null;
let cachedDayFolderId = null;
let cachedFolderDate = null;
let folderCreationPromise = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.sync.get(['timerMinutes']);
  if (!settings.timerMinutes) {
    await chrome.storage.sync.set({ timerMinutes: DEFAULT_TIMER_MINUTES });
  }

  // Create context menu for renaming tabs
  chrome.contextMenus.create({
    id: 'rename-tab',
    title: 'Rename Tab (Tab Hoarders Friend)',
    contexts: ['page']
  });

  await initializeTimers();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'rename-tab' && tab) {
    // Get current custom name if any
    const currentName = await getCustomTabName(tab.id);
    const defaultValue = currentName || tab.title || '';

    // Inject script to show prompt
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (currentValue) => {
          const newName = prompt('Enter a custom name for this tab:', currentValue);
          return newName;
        },
        args: [defaultValue]
      });

      if (results && results[0] && results[0].result !== null) {
        const newName = results[0].result.trim();
        if (newName) {
          // Save the custom name
          const result = await chrome.storage.local.get(['tabNames']);
          const tabNames = result.tabNames || {};
          tabNames[tab.id] = newName;
          await chrome.storage.local.set({ tabNames });
        } else {
          // Empty string clears the name
          await removeCustomTabName(tab.id);
        }
      }
    } catch (error) {
      // Cannot rename tab (e.g., chrome:// pages)
    }
  }
});

// Get the current timer duration from settings
async function getTimerMinutes() {
  const settings = await chrome.storage.sync.get(['timerMinutes']);
  return settings.timerMinutes || DEFAULT_TIMER_MINUTES;
}

// Start a timer for a tab
async function startTabTimer(tabId) {
  const minutes = await getTimerMinutes();
  const alarmName = `tab-timer-${tabId}`;

  // Create alarm for this specific tab
  await chrome.alarms.create(alarmName, {
    delayInMinutes: minutes
  });
}

// Clear timer for a tab
async function clearTabTimer(tabId) {
  const alarmName = `tab-timer-${tabId}`;
  await chrome.alarms.clear(alarmName);
}

// Format date as "Month Day Year" (e.g., "January 27 2026")
function formatDateForFolder() {
  const date = new Date();
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  const formatted = date.toLocaleDateString('en-US', options);
  return formatted.replace(',', '');
}

// Find or create the parent TabHoardersFriend folder
async function getOrCreateParentFolder() {
  // Check cache first
  if (cachedParentFolderId) {
    try {
      const folder = await chrome.bookmarks.get(cachedParentFolderId);
      if (folder && folder.length > 0) {
        return cachedParentFolderId;
      }
    } catch (e) {
      cachedParentFolderId = null;
    }
  }

  // Search for existing folder
  const searchResults = await chrome.bookmarks.search({ title: PARENT_FOLDER_NAME });
  const existingFolder = searchResults.find(item => !item.url && item.title === PARENT_FOLDER_NAME);

  if (existingFolder) {
    cachedParentFolderId = existingFolder.id;
    return existingFolder.id;
  }

  // Create new folder in "Other Bookmarks" (id: "2")
  const newFolder = await chrome.bookmarks.create({
    parentId: '2',
    title: PARENT_FOLDER_NAME
  });

  cachedParentFolderId = newFolder.id;
  return newFolder.id;
}

// Find or create the bookmarks folder for today (inside TabHoardersFriend)
async function getOrCreateTodayFolder() {
  const folderName = formatDateForFolder();

  if (cachedDayFolderId && cachedFolderDate === folderName) {
    try {
      const folder = await chrome.bookmarks.get(cachedDayFolderId);
      if (folder && folder.length > 0) {
        return cachedDayFolderId;
      }
    } catch (e) {
      cachedDayFolderId = null;
      cachedFolderDate = null;
    }
  }

  if (folderCreationPromise) {
    return folderCreationPromise;
  }

  folderCreationPromise = (async () => {
    try {
      // Get or create parent folder first
      const parentFolderId = await getOrCreateParentFolder();

      // Search for today's folder within parent
      const parentChildren = await chrome.bookmarks.getChildren(parentFolderId);
      const existingFolder = parentChildren.find(item => !item.url && item.title === folderName);

      if (existingFolder) {
        cachedDayFolderId = existingFolder.id;
        cachedFolderDate = folderName;
        return existingFolder.id;
      }

      // Create new day folder inside parent
      const newFolder = await chrome.bookmarks.create({
        parentId: parentFolderId,
        title: folderName
      });

      cachedDayFolderId = newFolder.id;
      cachedFolderDate = folderName;
      return newFolder.id;
    } finally {
      folderCreationPromise = null;
    }
  })();

  return folderCreationPromise;
}

// Get custom name for a tab (if set by user)
async function getCustomTabName(tabId) {
  const result = await chrome.storage.local.get(['tabNames']);
  const tabNames = result.tabNames || {};
  return tabNames[tabId] || null;
}

// Remove custom name for a tab (cleanup)
async function removeCustomTabName(tabId) {
  const result = await chrome.storage.local.get(['tabNames']);
  const tabNames = result.tabNames || {};
  if (tabNames[tabId]) {
    delete tabNames[tabId];
    await chrome.storage.local.set({ tabNames });
  }
}

// Save tab URL to bookmarks
async function saveTabToBookmarks(tab) {
  if (!tab || !tab.url) return;

  if (tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:')) {
    return;
  }

  const folderId = await getOrCreateTodayFolder();

  // Use custom name if set, otherwise use page title, fallback to URL
  const customName = await getCustomTabName(tab.id);
  let bookmarkTitle = customName || tab.title || tab.url;

  await chrome.bookmarks.create({
    parentId: folderId,
    title: bookmarkTitle,
    url: tab.url
  });
}

// Close tab and save to bookmarks
async function closeTabAndSave(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);

    // Skip pinned or active tabs
    if (tab.pinned || tab.active) {
      return;
    }

    await saveTabToBookmarks(tab);
    await removeCustomTabName(tabId);
    await chrome.tabs.remove(tabId);
  } catch (error) {
    // Tab may have been closed already
  }
}

// Handle tab activation changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId, windowId } = activeInfo;
  const previousActiveTabId = activeTabByWindow.get(windowId);

  // Update tracking AFTER getting previous
  activeTabByWindow.set(windowId, tabId);

  // Clear any timer for the newly active tab (user is viewing it)
  await clearTabTimer(tabId);

  // Start timer for the tab user just left
  if (previousActiveTabId && previousActiveTabId !== tabId) {
    try {
      const previousTab = await chrome.tabs.get(previousActiveTabId);
      if (!previousTab.pinned) {
        await startTabTimer(previousActiveTabId);
      }
    } catch (e) {
      // Previous tab was closed
    }
  }
});

// Listen for new tabs
chrome.tabs.onCreated.addListener(async (tab) => {
  // Only start timer for background tabs (opened via middle-click, etc.)
  if (!tab.pinned && !tab.active) {
    await startTabTimer(tab.id);
  }
});

// Listen for tab updates (pin/unpin)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.hasOwnProperty('pinned')) {
    if (changeInfo.pinned) {
      await clearTabTimer(tabId);
    } else if (!tab.active) {
      await startTabTimer(tabId);
    }
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  await clearTabTimer(tabId);
  await removeCustomTabName(tabId);

  const activeTabId = activeTabByWindow.get(removeInfo.windowId);
  if (activeTabId === tabId) {
    activeTabByWindow.delete(removeInfo.windowId);
  }
});

// Listen for window removal
chrome.windows.onRemoved.addListener((windowId) => {
  activeTabByWindow.delete(windowId);
});

// Listen for alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('tab-timer-')) {
    const tabId = parseInt(alarm.name.replace('tab-timer-', ''));
    await closeTabAndSave(tabId);
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'hoardAllTabs') {
    hoardAllTabs().then(sendResponse);
    return true; // Keep channel open for async response
  }
  if (message.action === 'exportHoard') {
    exportHoardData().then(sendResponse);
    return true;
  }
});

// Export all day folders as data for CSV generation
async function exportHoardData() {
  try {
    // Find the parent folder
    const searchResults = await chrome.bookmarks.search({ title: PARENT_FOLDER_NAME });
    const parentFolder = searchResults.find(item => !item.url && item.title === PARENT_FOLDER_NAME);

    if (!parentFolder) {
      return { success: false, error: 'No TabHoardersFriend folder found' };
    }

    // Get all day folders
    const dayFolders = await chrome.bookmarks.getChildren(parentFolder.id);
    const exportData = [];

    for (const folder of dayFolders) {
      // Skip if it's a bookmark, not a folder
      if (folder.url) continue;

      // Get bookmarks in this day folder
      const bookmarks = await chrome.bookmarks.getChildren(folder.id);
      const urls = bookmarks
        .filter(b => b.url)
        .map(b => ({ title: b.title, url: b.url }));

      if (urls.length > 0) {
        exportData.push({
          folderName: folder.title,
          bookmarks: urls
        });
      }
    }

    return { success: true, data: exportData };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Hoard all non-pinned, non-active tabs immediately
async function hoardAllTabs() {
  const tabs = await chrome.tabs.query({});
  let count = 0;

  for (const tab of tabs) {
    // Skip pinned, active, or restricted tabs
    if (tab.pinned || tab.active) continue;
    if (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')) {
      continue;
    }

    try {
      await saveTabToBookmarks(tab);
      await clearTabTimer(tab.id);
      await removeCustomTabName(tab.id);
      await chrome.tabs.remove(tab.id);
      count++;
    } catch (error) {
      // Skip tabs that can't be hoarded
    }
  }

  return { count };
}

// Initialize - set up tracking and timers for existing tabs
async function initializeTimers() {
  const windows = await chrome.windows.getAll({ populate: true });

  for (const window of windows) {
    if (!window.tabs) continue;

    for (const tab of window.tabs) {
      if (tab.active) {
        activeTabByWindow.set(window.id, tab.id);
      } else if (!tab.pinned) {
        await startTabTimer(tab.id);
      }
    }
  }
}

// Initialize on browser startup
chrome.runtime.onStartup.addListener(initializeTimers);

// Initialize when service worker starts (but wait a moment for Chrome to be ready)
setTimeout(initializeTimers, 100);
