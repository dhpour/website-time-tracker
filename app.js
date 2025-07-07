// ==UserScript==
// @name         Website Time Tracker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Track time spent on websites with visual diagrams
// @author       You
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const STORAGE_KEY = 'websiteTimeTracker';
    const UPDATE_INTERVAL = 1000; // 1 second
    const IDLE_THRESHOLD = 30000; // 30 seconds of inactivity = idle

    // State variables
    let startTime = Date.now();
    let lastActivity = Date.now();
    let isVisible = true;
    let isIdle = false;
    let updateTimer;

    // Get current domain
    const currentDomain = window.location.hostname;

    // Data structure for tracking
    function getEmptyData() {
        return {
            totalTime: 0,
            sessions: [],
            hourlyData: {}, // { "2024-01-01-14": 3600 }
            dailyData: {},  // { "2024-01-01": 7200 }
            weeklyData: {}  // { "2024-W01": 25200 }
        };
    }

    // Utility functions
    function getDateKey(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    function getHourKey(date = new Date()) {
        return `${getDateKey(date)}-${date.getHours().toString().padStart(2, '0')}`;
    }

    function getWeekKey(date = new Date()) {
        const year = date.getFullYear();
        const week = getWeekNumber(date);
        return `${year}-W${week.toString().padStart(2, '0')}`;
    }

    function getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    // Storage functions
    function getData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return {};
        try {
            return JSON.parse(stored);
        } catch (e) {
            return {};
        }
    }

    function saveData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function getDomainData(domain) {
        const allData = getData();
        return allData[domain] || getEmptyData();
    }

    function saveDomainData(domain, data) {
        const allData = getData();
        allData[domain] = data;
        saveData(allData);
    }

    // Data export/import functions
    function exportData() {
        const data = getData();
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            data: data,
            totalSites: Object.keys(data).length,
            totalTime: Object.values(data).reduce((sum, site) => sum + site.totalTime, 0)
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `website-time-tracker-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return exportData;
    }

    function importData(jsonData) {
        try {
            const importData = JSON.parse(jsonData);
            
            // Validate data structure
            if (!importData.data || typeof importData.data !== 'object') {
                throw new Error('Invalid data format');
            }
            
            // Merge with existing data
            const currentData = getData();
            const mergedData = { ...currentData };
            
            for (const [domain, siteData] of Object.entries(importData.data)) {
                if (mergedData[domain]) {
                    // Merge existing domain data
                    mergedData[domain].totalTime += siteData.totalTime;
                    mergedData[domain].sessions = [...(mergedData[domain].sessions || []), ...(siteData.sessions || [])];
                    
                    // Merge hourly data
                    for (const [hour, time] of Object.entries(siteData.hourlyData || {})) {
                        mergedData[domain].hourlyData[hour] = (mergedData[domain].hourlyData[hour] || 0) + time;
                    }
                    
                    // Merge daily data
                    for (const [day, time] of Object.entries(siteData.dailyData || {})) {
                        mergedData[domain].dailyData[day] = (mergedData[domain].dailyData[day] || 0) + time;
                    }
                    
                    // Merge weekly data
                    for (const [week, time] of Object.entries(siteData.weeklyData || {})) {
                        mergedData[domain].weeklyData[week] = (mergedData[domain].weeklyData[week] || 0) + time;
                    }
                } else {
                    // New domain
                    mergedData[domain] = siteData;
                }
            }
            
            saveData(mergedData);
            return { success: true, message: `Successfully imported data for ${Object.keys(importData.data).length} websites` };
            
        } catch (error) {
            return { success: false, message: `Import failed: ${error.message}` };
        }
    }

    function exportCSV() {
        const data = getData();
        const csvRows = [];
        
        // Header
        csvRows.push('Domain,Date,Hour,Daily Time (seconds),Weekly Time (seconds),Total Time (seconds)');
        
        // Data rows
        for (const [domain, siteData] of Object.entries(data)) {
            // Daily data
            for (const [date, time] of Object.entries(siteData.dailyData || {})) {
                const weekKey = getWeekKey(new Date(date));
                const weeklyTime = siteData.weeklyData[weekKey] || 0;
                csvRows.push(`${domain},${date},,${time},${weeklyTime},${siteData.totalTime}`);
            }
            
            // Hourly data
            for (const [hourKey, time] of Object.entries(siteData.hourlyData || {})) {
                const [date, hour] = hourKey.split('-').slice(-2);
                const fullDate = hourKey.substring(0, hourKey.lastIndexOf('-'));
                csvRows.push(`${domain},${fullDate},${hour},${time},,${siteData.totalTime}`);
            }
        }
        
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `website-time-tracker-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function clearAllData() {
        if (confirm('Are you sure you want to clear all tracking data? This cannot be undone.')) {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
        }
    }

    function createBackup() {
        const data = getData();
        const backupKey = `${STORAGE_KEY}_backup_${Date.now()}`;
        localStorage.setItem(backupKey, JSON.stringify(data));
        
        // Keep only last 5 backups
        const backupKeys = Object.keys(localStorage).filter(key => key.startsWith(`${STORAGE_KEY}_backup_`));
        backupKeys.sort().slice(0, -5).forEach(key => localStorage.removeItem(key));
        
        return backupKey;
    }

    function getBackups() {
        const backupKeys = Object.keys(localStorage).filter(key => key.startsWith(`${STORAGE_KEY}_backup_`));
        return backupKeys.map(key => {
            const timestamp = parseInt(key.split('_').pop());
            return {
                key: key,
                date: new Date(timestamp),
                name: new Date(timestamp).toLocaleString()
            };
        }).sort((a, b) => b.date - a.date);
    }

    function restoreBackup(backupKey) {
        const backupData = localStorage.getItem(backupKey);
        if (backupData) {
            localStorage.setItem(STORAGE_KEY, backupData);
            location.reload();
        }
    }

    // Time tracking functions
    function updateTimeData(timeSpent) {
        const data = getDomainData(currentDomain);
        const now = new Date();
        
        data.totalTime += timeSpent;
        
        // Update hourly data
        const hourKey = getHourKey(now);
        data.hourlyData[hourKey] = (data.hourlyData[hourKey] || 0) + timeSpent;
        
        // Update daily data
        const dayKey = getDateKey(now);
        data.dailyData[dayKey] = (data.dailyData[dayKey] || 0) + timeSpent;
        
        // Update weekly data
        const weekKey = getWeekKey(now);
        data.weeklyData[weekKey] = (data.weeklyData[weekKey] || 0) + timeSpent;
        
        saveDomainData(currentDomain, data);
    }

    function trackActivity() {
        if (isVisible && !isIdle) {
            updateTimeData(1); // 1 second
        }
    }

    // Event handlers
    function handleVisibilityChange() {
        isVisible = !document.hidden;
        if (isVisible) {
            lastActivity = Date.now();
            isIdle = false;
        }
    }

    function handleActivity() {
        lastActivity = Date.now();
        isIdle = false;
    }

    function checkIdle() {
        const now = Date.now();
        if (now - lastActivity > IDLE_THRESHOLD) {
            isIdle = true;
        }
    }

    // UI Creation
    function createStatsPanel() {
        const panel = document.createElement('div');
        panel.id = 'timeTrackerPanel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            display: none;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            background: #333;
            color: white;
            padding: 10px;
            border-radius: 6px 6px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <span>Time Tracker - ${currentDomain}</span>
            <div>
                <button id="dataMenuBtn" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px; margin-right: 10px;">💾</button>
                <button id="closeTracker" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px;">×</button>
            </div>
        `;

        const content = document.createElement('div');
        content.id = 'trackerContent';
        content.style.cssText = `
            padding: 15px;
            max-height: 500px;
            overflow-y: auto;
        `;

        panel.appendChild(header);
        panel.appendChild(content);
        document.body.appendChild(panel);

        // Create data management dropdown
        const dataMenu = createDataMenu();
        panel.appendChild(dataMenu);

        // Event listeners
        document.getElementById('closeTracker').onclick = () => {
            panel.style.display = 'none';
        };

        document.getElementById('dataMenuBtn').onclick = () => {
            const menu = document.getElementById('dataMenu');
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        };

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('dataMenu');
            const btn = document.getElementById('dataMenuBtn');
            if (menu && !menu.contains(e.target) && e.target !== btn) {
                menu.style.display = 'none';
            }
        });

        return panel;
    }

    function createDataMenu() {
        const menu = document.createElement('div');
        menu.id = 'dataMenu';
        menu.style.cssText = `
            position: absolute;
            top: 50px;
            right: 60px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 10001;
            min-width: 200px;
            display: none;
        `;

        const menuItems = [
            { text: '📤 Export JSON', action: 'export' },
            { text: '📥 Import JSON', action: 'import' },
            { text: '📊 Export CSV', action: 'exportCSV' },
            { text: '💾 Create Backup', action: 'backup' },
            { text: '🔄 Restore Backup', action: 'restore' },
            { text: '📋 View All Data', action: 'viewAll' },
            { text: '🗑️ Clear All Data', action: 'clear' }
        ];

        menu.innerHTML = menuItems.map(item => `
            <div class="menu-item" data-action="${item.action}" style="
                padding: 10px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                hover: background: #f5f5f5;
            ">${item.text}</div>
        `).join('');

        // Add hover effects
        menu.addEventListener('mouseover', (e) => {
            if (e.target.classList.contains('menu-item')) {
                e.target.style.background = '#f5f5f5';
            }
        });

        menu.addEventListener('mouseout', (e) => {
            if (e.target.classList.contains('menu-item')) {
                e.target.style.background = '';
            }
        });

        // Add click handlers
        menu.addEventListener('click', (e) => {
            if (e.target.classList.contains('menu-item')) {
                const action = e.target.dataset.action;
                handleDataAction(action);
                menu.style.display = 'none';
            }
        });

        return menu;
    }

    function handleDataAction(action) {
        switch (action) {
            case 'export':
                const exportedData = exportData();
                showNotification(`Data exported successfully! ${exportedData.totalSites} websites tracked.`);
                break;
                
            case 'import':
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const result = importData(e.target.result);
                            showNotification(result.message, result.success ? 'success' : 'error');
                            if (result.success) {
                                setTimeout(() => location.reload(), 1500);
                            }
                        };
                        reader.readAsText(file);
                    }
                };
                input.click();
                break;
                
            case 'exportCSV':
                exportCSV();
                showNotification('CSV data exported successfully!');
                break;
                
            case 'backup':
                const backupKey = createBackup();
                showNotification('Backup created successfully!');
                break;
                
            case 'restore':
                showRestoreDialog();
                break;
                
            case 'viewAll':
                showAllDataDialog();
                break;
                
            case 'clear':
                clearAllData();
                break;
        }
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 10002;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    function showRestoreDialog() {
        const backups = getBackups();
        if (backups.length === 0) {
            showNotification('No backups found.', 'error');
            return;
        }

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10002;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 400px;
            width: 90%;
            max-height: 80%;
            overflow-y: auto;
        `;

        content.innerHTML = `
            <h3>Restore Backup</h3>
            <p>Select a backup to restore:</p>
            ${backups.map(backup => `
                <div style="
                    padding: 8px;
                    margin: 5px 0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                    hover: background: #f5f5f5;
                " onclick="restoreBackup('${backup.key}')">
                    ${backup.name}
                </div>
            `).join('')}
            <button onclick="this.parentElement.parentElement.remove()" style="
                margin-top: 15px;
                padding: 8px 16px;
                background: #ccc;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            ">Cancel</button>
        `;

        dialog.appendChild(content);
        document.body.appendChild(dialog);

        // Close on outside click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    function showAllDataDialog() {
        const data = getData();
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10002;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 600px;
            width: 90%;
            max-height: 80%;
            overflow-y: auto;
        `;

        const totalTime = Object.values(data).reduce((sum, site) => sum + site.totalTime, 0);
        const siteList = Object.entries(data)
            .sort(([,a], [,b]) => b.totalTime - a.totalTime)
            .map(([domain, siteData]) => `
                <div style="
                    padding: 10px;
                    margin: 5px 0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    display: flex;
                    justify-content: space-between;
                ">
                    <span>${domain}</span>
                    <span>${formatTime(siteData.totalTime)}</span>
                </div>
            `).join('');

        content.innerHTML = `
            <h3>All Tracked Websites</h3>
            <p><strong>Total Time Tracked:</strong> ${formatTime(totalTime)}</p>
            <p><strong>Websites Tracked:</strong> ${Object.keys(data).length}</p>
            <div style="margin-top: 20px;">
                ${siteList}
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="
                margin-top: 15px;
                padding: 8px 16px;
                background: #ccc;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            ">Close</button>
        `;

        dialog.appendChild(content);
        document.body.appendChild(dialog);

        // Close on outside click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });

        return panel;
    }

    function createBarChart(data, title, maxBars = 24) {
        const maxValue = Math.max(...Object.values(data));
        const entries = Object.entries(data).slice(-maxBars);
        
        return `
            <div style="margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">${title}</h3>
                <div style="display: flex; align-items: end; height: 100px; border-bottom: 1px solid #ccc; padding: 5px 0;">
                    ${entries.map(([key, value]) => {
                        const height = maxValue > 0 ? (value / maxValue) * 80 : 0;
                        const label = key.includes('-') ? key.split('-').pop() : key;
                        return `
                            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; margin: 0 1px;">
                                <div style="width: 100%; background: #4CAF50; height: ${height}px; margin-bottom: 5px;" title="${formatTime(value)}"></div>
                                <span style="font-size: 10px; writing-mode: vertical-lr; text-orientation: mixed;">${label}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function updateStatsPanel() {
        const panel = document.getElementById('timeTrackerPanel');
        if (!panel || panel.style.display === 'none') return;

        const data = getDomainData(currentDomain);
        const content = document.getElementById('trackerContent');
        
        // Current session time
        const sessionTime = Math.floor((Date.now() - startTime) / 1000);
        
        // Get recent data for charts
        const last24Hours = {};
        const last7Days = {};
        const last4Weeks = {};
        
        // Last 24 hours
        for (let i = 23; i >= 0; i--) {
            const date = new Date();
            date.setHours(date.getHours() - i);
            const key = getHourKey(date);
            last24Hours[key] = data.hourlyData[key] || 0;
        }
        
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const key = getDateKey(date);
            last7Days[key] = data.dailyData[key] || 0;
        }
        
        // Last 4 weeks
        for (let i = 3; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - (i * 7));
            const key = getWeekKey(date);
            last4Weeks[key] = data.weeklyData[key] || 0;
        }

        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 18px; font-weight: bold; color: #333;">
                    Total Time: ${formatTime(data.totalTime)}
                </div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">
                    Current Session: ${formatTime(sessionTime)}
                </div>
            </div>
            
            ${createBarChart(last24Hours, 'Last 24 Hours', 24)}
            ${createBarChart(last7Days, 'Last 7 Days', 7)}
            ${createBarChart(last4Weeks, 'Last 4 Weeks', 4)}
        `;
    }

    function createToggleButton() {
        const button = document.createElement('button');
        button.id = 'timeTrackerToggle';
        button.innerHTML = '⏱️';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 25px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: #4CAF50;
            color: white;
            border: none;
            font-size: 20px;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;

        button.onclick = () => {
            const panel = document.getElementById('timeTrackerPanel');
            if (panel.style.display === 'none' || !panel.style.display) {
                panel.style.display = 'block';
                updateStatsPanel();
            } else {
                panel.style.display = 'none';
            }
        };

        document.body.appendChild(button);
        return button;
    }

    // Initialize
    function init() {
        // Wait for document to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Create UI elements
        createStatsPanel();
        createToggleButton();

        // Set up event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('mousemove', handleActivity);
        document.addEventListener('keypress', handleActivity);
        document.addEventListener('click', handleActivity);
        document.addEventListener('scroll', handleActivity);

        // Start tracking
        updateTimer = setInterval(() => {
            checkIdle();
            trackActivity();
            updateStatsPanel();
        }, UPDATE_INTERVAL);

        console.log('Website Time Tracker initialized for:', currentDomain);
    }

    // Start the tracker
    init();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (updateTimer) {
            clearInterval(updateTimer);
        }
    });

})();