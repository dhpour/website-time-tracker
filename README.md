# Website Time Tracker
A simple Tampermonkey script for tracking of time spendings on different sites (customizable). Created with Claude Sonnet 4.

## Features:

1. Time Tracking:

    - Tracks active time (stops when idle for 30+ seconds)
    - Monitors tab visibility (pauses when tab is hidden)
    - Stores data locally in browser storage


2. Visual Diagrams:

    - Hourly: Shows last 24 hours with bar chart
    - Daily: Shows last 7 days with bar chart
    - Weekly: Shows last 4 weeks with bar chart


3. Smart Detection:

    - Detects mouse movement, keyboard input, clicks, and scrolling
    - Pauses tracking when you're inactive or switch tabs
    - Works on any website you visit


4. User Interface:

    - Floating timer button (⏱️) in bottom-right corner
    - Click to open detailed statistics panel
    - Shows total time and current session time
    - Clean, professional design



## How to Install:

1. Install Tampermonkey: Add the Tampermonkey extension to your browser
2. Add Script: Copy the script code and create a new userscript in Tampermonkey
3. Save & Enable: The script will automatically start tracking on all websites

## How to Use:

- The script runs automatically on every website
- Click the ⏱️ button to view your statistics
- Data is saved locally and persists between browser sessions
- Each website is tracked separately

The script is lightweight, privacy-focused (all data stays local), and provides exactly the hourly, daily, and weekly breakdowns you requested. It will start tracking immediately once installed!

## 🔄 Data Management Features:
### Export Options:

- 📤 Export JSON: Complete data backup with metadata
- 📊 Export CSV: Spreadsheet-friendly format for analysis
- 💾 Create Backup: Local backup stored in browser

### Import Options:

- 📥 Import JSON: Merge data from exported files
- 🔄 Restore Backup: Restore from local backups (keeps last 5)

## Data Management:

- 📋 View All Data: See all tracked websites and total times
- 🗑️ Clear All Data: Complete reset with confirmation

## 🎯 How to Use:

1. Access Data Menu: Click the 💾 button in the tracker panel header
2. Export Data:

    - JSON format preserves all data structure
    - CSV format for spreadsheet analysis
    - Automatic filename with date stamp


3. Import Data:

    - Merges imported data with existing data
    - Handles duplicate websites intelligently
    - Shows success/error notifications


4. Backup System:

    - Creates timestamped backups
    - Automatically manages storage (keeps 5 most recent)
    - Easy restore with date selection



## 🛡️ Data Safety Features:

- Smart Merging: Importing data adds to existing data rather than replacing
- Validation: Checks data format before importing
- Automatic Backups: Creates backup before major operations
- Confirmation Dialogs: Prevents accidental data loss
- Error Handling: Clear error messages for failed operations

## 📊 Export Formats:
### JSON Export includes:

- All website data
- Export timestamp
- Data version
- Total statistics
- Complete hour/day/week breakdowns

### CSV Export includes:

- Domain, Date, Hour columns
- Time data in seconds
- Easy to analyze in Excel/Google Sheets

The data management system is now production-ready with proper error handling, user feedback, and data safety measures!