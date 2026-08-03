const slider = document.getElementById('timer-slider');
const timerValue = document.getElementById('timer-value');
const status = document.getElementById('status');
const tabNameInput = document.getElementById('tab-name');
const saveNameBtn = document.getElementById('save-name');
const clearNameBtn = document.getElementById('clear-name');
const currentNameDisplay = document.getElementById('current-name');
const hoardAllBtn = document.getElementById('hoard-all');
const exportBtn = document.getElementById('export-hoard');
const exportBookmarksBtn = document.getElementById('export-bookmarks');

let currentTabId = null;

// Show status message
function showStatus(message) {
  status.textContent = message;
  status.classList.add('show');
  setTimeout(() => {
    status.classList.remove('show');
  }, 2000);
}

// Load current tab info and any custom name
async function loadCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTabId = tab.id;

    // Check for existing custom name
    const result = await chrome.storage.local.get(['tabNames']);
    const tabNames = result.tabNames || {};

    if (tabNames[currentTabId]) {
      tabNameInput.value = tabNames[currentTabId];
      currentNameDisplay.textContent = `Custom name: "${tabNames[currentTabId]}"`;
      currentNameDisplay.classList.add('show');
    } else {
      tabNameInput.value = '';
      tabNameInput.placeholder = tab.title || 'Enter custom name...';
      currentNameDisplay.textContent = '';
      currentNameDisplay.classList.remove('show');
    }
  }
}

// Save custom tab name
async function saveTabName() {
  if (!currentTabId) return;

  const customName = tabNameInput.value.trim();
  if (!customName) {
    showStatus('Please enter a name');
    return;
  }

  const result = await chrome.storage.local.get(['tabNames']);
  const tabNames = result.tabNames || {};
  tabNames[currentTabId] = customName;
  await chrome.storage.local.set({ tabNames });

  currentNameDisplay.textContent = `Custom name: "${customName}"`;
  currentNameDisplay.classList.add('show');
  showStatus('Tab name saved!');
}

// Clear custom tab name
async function clearTabName() {
  if (!currentTabId) return;

  const result = await chrome.storage.local.get(['tabNames']);
  const tabNames = result.tabNames || {};
  delete tabNames[currentTabId];
  await chrome.storage.local.set({ tabNames });

  tabNameInput.value = '';
  currentNameDisplay.textContent = '';
  currentNameDisplay.classList.remove('show');
  showStatus('Custom name cleared');
}

// Load saved timer settings
chrome.storage.sync.get(['timerMinutes'], (result) => {
  const minutes = result.timerMinutes || 30;
  slider.value = minutes;
  timerValue.textContent = minutes;
});

// Update display when slider moves
slider.addEventListener('input', () => {
  timerValue.textContent = slider.value;
});

// Save timer setting when slider released
slider.addEventListener('change', async () => {
  const minutes = parseInt(slider.value);
  await chrome.storage.sync.set({ timerMinutes: minutes });
  showStatus('Timer setting saved!');
});

// Tab name buttons
saveNameBtn.addEventListener('click', saveTabName);
clearNameBtn.addEventListener('click', clearTabName);

// Allow Enter key to save name
tabNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveTabName();
  }
});

// Hoard all tabs button
hoardAllBtn.addEventListener('click', async () => {
  hoardAllBtn.disabled = true;
  hoardAllBtn.textContent = 'Hoarding...';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'hoardAllTabs' });
    if (response && response.count > 0) {
      showStatus(`Hoarded ${response.count} tab${response.count > 1 ? 's' : ''}!`);
    } else {
      showStatus('No tabs to hoard');
    }
  } catch (error) {
    showStatus('Error hoarding tabs');
  }

  hoardAllBtn.disabled = false;
  hoardAllBtn.textContent = 'Hoard All Tabs Not Pinned Down';
});

// Export hoard as CSV files
exportBtn.addEventListener('click', async () => {
  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'exportHoard' });

    if (response && response.success && response.data.length > 0) {
      // Generate and download CSV for each day folder
      for (const folder of response.data) {
        const csvContent = generateCSV(folder.bookmarks);
        downloadFile(csvContent, `${folder.folderName}.csv`, 'text/csv;charset=utf-8;');
      }
      showStatus(`Exported ${response.data.length} CSV file${response.data.length > 1 ? 's' : ''}!`);
    } else if (response && response.error) {
      showStatus(response.error);
    } else {
      showStatus('No bookmarks to export');
    }
  } catch (error) {
    showStatus('Error exporting');
  }

  exportBtn.disabled = false;
  exportBtn.textContent = 'Export Hoard as CSV';
});

// Export hoard as an importable bookmarks HTML file
exportBookmarksBtn.addEventListener('click', async () => {
  exportBookmarksBtn.disabled = true;
  exportBookmarksBtn.textContent = 'Exporting...';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'exportHoardBookmarks' });

    if (response && response.success && countBookmarks(response.tree) > 0) {
      const html = generateBookmarksHTML(response.tree);
      downloadFile(html, 'TabHoardersFriend Bookmarks.html', 'text/html;charset=utf-8;');
      showStatus('Exported bookmarks file!');
    } else if (response && response.error) {
      showStatus(response.error);
    } else {
      showStatus('No bookmarks to export');
    }
  } catch (error) {
    showStatus('Error exporting');
  }

  exportBookmarksBtn.disabled = false;
  exportBookmarksBtn.textContent = 'Export Hoard as Bookmarks';
});

// Count bookmarks anywhere in the exported tree
function countBookmarks(node) {
  if (node.url) return 1;
  return (node.children || []).reduce((sum, child) => sum + countBookmarks(child), 0);
}

// Escape text for the bookmarks HTML file
function escapeHTML(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Generate a Netscape Bookmark File (importable by Chrome, Firefox, Edge, Safari, etc.)
function generateBookmarksHTML(tree) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It will be read and overwritten.',
    '     DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>'
  ];

  function appendNode(node, depth) {
    const indent = '    '.repeat(depth);
    // Netscape format uses seconds; Chrome's dateAdded is milliseconds
    const addDate = node.dateAdded ? ` ADD_DATE="${Math.floor(node.dateAdded / 1000)}"` : '';

    if (node.url) {
      lines.push(`${indent}<DT><A HREF="${escapeHTML(node.url)}"${addDate}>${escapeHTML(node.title)}</A>`);
    } else {
      lines.push(`${indent}<DT><H3${addDate}>${escapeHTML(node.title)}</H3>`);
      lines.push(`${indent}<DL><p>`);
      for (const child of node.children || []) {
        appendNode(child, depth + 1);
      }
      lines.push(`${indent}</DL><p>`);
    }
  }

  appendNode(tree, 1);
  lines.push('</DL><p>');
  return lines.join('\n');
}

// Generate CSV content from bookmarks
function generateCSV(bookmarks) {
  const header = 'Title,URL';
  const rows = bookmarks.map(b => {
    // Escape quotes in title and wrap in quotes
    const title = `"${(b.title || '').replace(/"/g, '""')}"`;
    const url = `"${(b.url || '').replace(/"/g, '""')}"`;
    return `${title},${url}`;
  });
  return [header, ...rows].join('\n');
}

// Download a file
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Initialize
loadCurrentTab();
