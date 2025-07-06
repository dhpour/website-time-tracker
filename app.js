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
            <button id="closeTracker" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px;">×</button>
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

        // Event listeners
        document.getElementById('closeTracker').onclick = () => {
            panel.style.display = 'none';
        };

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
            right: 20px;
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