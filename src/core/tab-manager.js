/**
 * Tab Manager - Manages multiple tabs/windows for the same session
 * 
 * Uses storage adapter to track active tabs and assign unique IDs
 */

export class TabManager {
  constructor(storage, config) {
    this.storage = storage;
    this.config = config;
    this.tabID = null;
    this.interval = null;
    this.initialize();
  }
  
  initialize() {
    if (!this.config.tabs.enabled) {
      this.tabID = null;
      return;
    }
    
    // Find the id of all the tabs open
    let existingTabs = JSON.parse(this.storage.getItem('tabs') || '[]');
    
    const timeNow = Date.now();
    const timeout = this.config.tabs.timeout * 1000; // Convert to milliseconds
    
    // Clean up stale tabs
    for (let existingTabID of existingTabs) {
      const ts = this.storage.getItem("tabpoll_" + existingTabID);
      if (ts) {
        const lastUpdateTime = new Date(1 * ts);
        if ((lastUpdateTime == "Invalid Date") || ((timeNow - lastUpdateTime) > timeout)) {
          this.storage.removeItem("tabpoll_" + existingTabID);
          existingTabs = existingTabs.filter(v => v !== existingTabID);
          this.storage.setItem('tabs', JSON.stringify(existingTabs));
        }
      } else {
        this.storage.removeItem("tabpoll_" + existingTabID);
        existingTabs = existingTabs.filter(v => v !== existingTabID);
        this.storage.setItem('tabs', JSON.stringify(existingTabs));
      }
    }
    
    existingTabs = JSON.parse(this.storage.getItem('tabs') || '[]');
    
    // Find the next available tab ID
    // First, try to find a gap (reuse IDs from closed tabs)
    let nextTabID = 0;
    if (existingTabs.length > 0) {
      const sortedTabs = [...existingTabs].sort((a, b) => a - b);
      // Look for first gap starting from 0
      for (let i = 0; i < sortedTabs.length; i++) {
        if (sortedTabs[i] !== i) {
          nextTabID = i;
          break;
        }
        nextTabID = i + 1;
      }
    }
    
    this.tabID = nextTabID;
    existingTabs.push(this.tabID);
    this.storage.setItem('tabs', JSON.stringify(existingTabs));
    
    // Start polling to keep tab alive
    this.storage.setItem("tabpoll_" + this.tabID, Date.now().toString());
    this.interval = setInterval(() => {
      this.storage.setItem("tabpoll_" + this.tabID, Date.now().toString());
    }, this.config.tabs.pollInterval);
    
    if (this.config.debug) {
      console.log("Tab ID: ", this.tabID);
    }
  }
  
  getTabID() {
    return this.tabID;
  }
  
  cleanup() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    if (this.tabID !== null) {
      let existingTabs = JSON.parse(this.storage.getItem('tabs') || '[]');
      existingTabs = existingTabs.filter(v => v !== this.tabID);
      this.storage.setItem('tabs', JSON.stringify(existingTabs));
      this.storage.removeItem("tabpoll_" + this.tabID);
    }
  }
}

