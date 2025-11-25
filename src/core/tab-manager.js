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
    
    // Retry loop to handle race conditions when multiple tabs initialize simultaneously
    const maxRetries = 10;
    let retryCount = 0;
    let nextTabID = null;
    
    while (retryCount < maxRetries && nextTabID === null) {
      // Re-read tabs list to get the most current state
      existingTabs = JSON.parse(this.storage.getItem('tabs') || '[]');
      
      // Find the next available tab ID
      // First, try to find a gap (reuse IDs from closed tabs)
      let candidateID = 0;
      if (existingTabs.length > 0) {
        const sortedTabs = [...existingTabs].sort((a, b) => a - b);
        // Look for first gap starting from 0
        for (let i = 0; i < sortedTabs.length; i++) {
          if (sortedTabs[i] !== i) {
            candidateID = i;
            break;
          }
          candidateID = i + 1;
        }
      }
      
      // Verify the candidate ID is not already taken (re-read to check for race condition)
      const currentTabs = JSON.parse(this.storage.getItem('tabs') || '[]');
      if (!currentTabs.includes(candidateID)) {
        // ID is available, claim it
        currentTabs.push(candidateID);
        this.storage.setItem('tabs', JSON.stringify(currentTabs));
        
        // Verify we successfully claimed it (check for race condition where another tab also added it)
        const verifyTabs = JSON.parse(this.storage.getItem('tabs') || '[]');
        const count = verifyTabs.filter(id => id === candidateID).length;
        if (count === 1) {
          // Successfully claimed unique ID
          nextTabID = candidateID;
        } else {
          // Another tab also claimed this ID, remove our claim and retry
          const cleanedTabs = verifyTabs.filter(id => id !== candidateID);
          this.storage.setItem('tabs', JSON.stringify(cleanedTabs));
          retryCount++;
          if (this.config.debug && retryCount < maxRetries) {
            console.log(`Tab ID conflict detected after claim, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
          }
        }
      } else {
        // ID was taken by another tab, retry
        retryCount++;
        if (this.config.debug && retryCount < maxRetries) {
          console.log(`Tab ID conflict detected, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
        }
      }
    }
    
    if (nextTabID === null) {
      throw new Error(`Failed to acquire unique tab ID after ${maxRetries} attempts`);
    }
    
    this.tabID = nextTabID;
    
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

