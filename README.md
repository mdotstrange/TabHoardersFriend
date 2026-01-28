![Alt text](icons/icon128.png)
# Tab Hoarders Friend

A Chrome extension for tab hoarders who open too many tabs and forget about them. It automatically closes inactive tabs after a set time and saves them to bookmarks so you never lose them.

* It has a pixel art Hitler icon because when I recommend that my wife close some of her 100 tabs she looks at me like I'm that dude 0_0

## Features

### Auto-Close Inactive Tabs
- Tabs are automatically closed after a user-defined time period (1-99 minutes)
- Timer only runs when a tab is **not** the active tab
- Switching to a tab resets its timer
- Pinned tabs are never affected

### Smart Bookmark Saving
- When a tab is auto-closed, its URL is saved to bookmarks
- Bookmarks are organized in folders by date (e.g., "January 28 2026")
- All date folders are stored inside a "TabHoardersFriend" parent folder
- Custom tab names are used as bookmark names if set

### Rename Tabs
- Give tabs custom names that will be used as bookmark names
- Rename via the extension popup or right-click context menu
- Useful for giving meaningful names to pages with generic titles

### Hoard All Tabs
- One-click button to immediately close and bookmark all non-pinned tabs
- Active tab is never affected
- Great for quickly clearing your tab bar while saving everything

### Export to CSV
- Export all your hoarded bookmarks as CSV files
- Each day folder becomes a separate CSV file
- CSV includes title and URL columns
- Easy to import into spreadsheets or other tools

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `TabHoardersFriend` folder

## Usage

### Setting the Timer
1. Click the extension icon in the toolbar
2. Use the slider to set the auto-close time (1-99 minutes)
3. Tabs will close after being inactive for this duration

### Renaming a Tab
**Via Popup:**
1. Navigate to the tab you want to rename
2. Click the extension icon
3. Enter a custom name and click "Save"

**Via Right-Click:**
1. Right-click anywhere on the page
2. Select "Rename Tab (Tab Hoarders Friend)"
3. Enter the new name in the prompt

### Protecting Tabs
- **Pin important tabs** - Pinned tabs are never auto-closed
- **Stay on a tab** - The active tab's timer is always paused

### Hoarding All Tabs
1. Click the extension icon
2. Click "Hoard All Tabs Not Pinned Down"
3. All non-pinned, non-active tabs will be bookmarked and closed

### Exporting Bookmarks
1. Click the extension icon
2. Click "Export Hoard as CSV"
3. A CSV file will be downloaded for each day folder

## How It Works

1. When you switch away from a tab, a timer starts
2. When you switch back to that tab, the timer resets
3. If the timer expires (tab was inactive for the set duration), the tab is:
   - Saved to bookmarks in a dated folder
   - Closed automatically
4. Pinned tabs and the active tab are always protected

## Bookmark Organization

```
Other Bookmarks/
└── TabHoardersFriend/
    ├── January 27 2026/
    │   ├── Article about cats
    │   ├── Shopping cart - Amazon
    │   └── GitHub - cool project
    ├── January 28 2026/
    │   ├── Recipe for cookies
    │   └── Stack Overflow question
    └── ...
```

## Permissions

- **tabs** - Monitor tab activity and close tabs
- **bookmarks** - Save closed tabs to bookmarks
- **storage** - Save settings and custom tab names
- **alarms** - Timer functionality for auto-close
- **contextMenus** - Right-click rename option
- **scripting** - Show rename prompt on pages
- **host_permissions** - Required for the rename prompt to work on all sites

## Tips

- Set a longer timer (30+ minutes) if you frequently return to tabs
- Set a shorter timer (5-10 minutes) for aggressive tab cleanup
- Pin tabs you're actively working on
- Use custom names for tabs with unhelpful titles
- Export your hoard periodically as a backup

## License

MIT License - Feel free to use, modify, and distribute.
