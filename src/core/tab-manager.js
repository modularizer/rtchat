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
  
  /**
   * Helper method to read and deduplicate the tabs array
   * This ensures we always work with a unique set of tab IDs
   */
  _readAndDeduplicateTabs() {
    const tabs = JSON.parse(this.storage.getItem('tabs') || '[]');
    // Remove duplicates by converting to Set and back to array
    const uniqueTabs = [...new Set(tabs)];
    // If duplicates were found, update storage immediately
    if (uniqueTabs.length !== tabs.length) {
      this.storage.setItem('tabs', JSON.stringify(uniqueTabs));
      if (this.config.debug) {
        console.log(`Removed ${tabs.length - uniqueTabs.length} duplicate tab ID(s)`);
      }
    }
    return uniqueTabs;
  }
  
  /**
   * Helper method to clean up stale tabs and return deduplicated active tabs
   */
  _cleanupStaleTabs() {
    let existingTabs = this._readAndDeduplicateTabs();
    
    const timeNow = Date.now();
    const timeout = this.config.tabs.timeout * 1000; // Convert to milliseconds
    
    // Clean up stale tabs
    const activeTabs = [];
    for (let existingTabID of existingTabs) {
      const ts = this.storage.getItem("tabpoll_" + existingTabID);
      if (ts) {
        const lastUpdateTime = new Date(1 * ts);
        if ((lastUpdateTime == "Invalid Date") || ((timeNow - lastUpdateTime) > timeout)) {
          // Tab is stale, remove it
          this.storage.removeItem("tabpoll_" + existingTabID);
        } else {
          // Tab is still active
          activeTabs.push(existingTabID);
        }
      } else {
        // No poll timestamp, remove it
        this.storage.removeItem("tabpoll_" + existingTabID);
      }
    }
    
    // Update storage with only active tabs (already deduplicated)
    this.storage.setItem('tabs', JSON.stringify(activeTabs));
    return activeTabs;
  }
  
  initialize() {
    if (!this.config.tabs.enabled) {
      this.tabID = null;
      return;
    }
    
    // Clean up stale tabs and get deduplicated active tabs
    this._cleanupStaleTabs();
    
    // Retry loop to handle race conditions when multiple tabs initialize simultaneously
    const maxRetries = 10;
    let retryCount = 0;
    let nextTabID = null;
    
    while (retryCount < maxRetries && nextTabID === null) {
      // Re-read and deduplicate tabs list to get the most current state
      let existingTabs = this._readAndDeduplicateTabs();
      
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
      
      // Re-read and deduplicate again to check for race condition
      let currentTabs = this._readAndDeduplicateTabs();
      
      // Check if candidate ID is already taken
      if (!currentTabs.includes(candidateID)) {
        // ID is available, claim it atomically
        currentTabs.push(candidateID);
        // Sort to maintain order (helps with gap detection)
        currentTabs.sort((a, b) => a - b);
        this.storage.setItem('tabs', JSON.stringify(currentTabs));
        
        // Verify we successfully claimed it uniquely (re-read and deduplicate)
        const verifyTabs = this._readAndDeduplicateTabs();
        const count = verifyTabs.filter(id => id === candidateID).length;
        if (count === 1) {
          // Successfully claimed unique ID
          nextTabID = candidateID;
        } else {
          // Another tab also claimed this ID, remove all instances and retry
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
      // Read and deduplicate tabs before removing this tab's ID
      let existingTabs = this._readAndDeduplicateTabs();
      // Remove all instances of this tab ID (should only be one, but be safe)
      existingTabs = existingTabs.filter(v => v !== this.tabID);
      this.storage.setItem('tabs', JSON.stringify(existingTabs));
      this.storage.removeItem("tabpoll_" + this.tabID);
    }
  }
}


