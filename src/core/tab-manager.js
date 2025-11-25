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
    this.reinitializing = false;
    this.instanceToken = this._generateRandomToken();
    this.writeCounter = 0;
    this.initialize();
  }
  
  /**
   * Generate a random token for identifying writers/instances.
   */
  _generateRandomToken() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return (
      Math.random().toString(36).slice(2) +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2)
    );
  }
  
  /**
   * Generate a unique token for each write attempt so we can detect
   * whether our mutation "won" the race when the state is re-read.
   */
  _nextWriteToken() {
    this.writeCounter += 1;
    return `${this.instanceToken}-${this.writeCounter}-${Date.now()}`;
  }
  
  /**
   * Normalize, sort, and deduplicate a list of tab IDs.
   */
  _normalizeTabs(tabs) {
    const numericTabs = [];
    for (let value of Array.isArray(tabs) ? tabs : []) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        numericTabs.push(Math.floor(parsed));
      }
    }
    numericTabs.sort((a, b) => a - b);
    const deduped = [];
    for (let id of numericTabs) {
      if (deduped.length === 0 || deduped[deduped.length - 1] !== id) {
        deduped.push(id);
      }
    }
    return deduped;
  }
  
  _tabsChanged(prev, next) {
    if (prev.length !== next.length) {
      return true;
    }
    for (let i = 0; i < prev.length; i++) {
      if (prev[i] !== next[i]) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Read the current tab state object from storage.
   * Supports legacy array format for backward compatibility.
   */
  _readTabState() {
    const raw = this.storage.getItem('tabs');
    let writer = null;
    let tabsPayload = [];
    
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          tabsPayload = parsed;
        } else if (parsed && Array.isArray(parsed.tabs)) {
          tabsPayload = parsed.tabs;
          writer = parsed.writer || null;
        }
      } catch (e) {
        if (this.config.debug) {
          console.warn('TabManager: failed to parse tab state payload, resetting.', e);
        }
        this.storage.removeItem('tabs');
      }
    }
    
    const normalized = this._normalizeTabs(tabsPayload);
    if (normalized.length !== tabsPayload.length) {
      // Rewrite state immediately to remove duplicates/invalid entries.
      this.storage.setItem('tabs', JSON.stringify({ writer, tabs: normalized }));
      if (this.config.debug && tabsPayload.length > normalized.length) {
        console.log(`Removed ${tabsPayload.length - normalized.length} invalid/duplicate tab ID(s)`);
      }
    }
    
    return { writer, tabs: normalized };
  }
  
  /**
   * Write the provided tabs list to storage alongside the writer token.
   */
  _writeTabState(tabs, writerToken) {
    const normalized = this._normalizeTabs(tabs);
    this.storage.setItem('tabs', JSON.stringify({
      writer: writerToken || null,
      tabs: normalized
    }));
    return normalized;
  }
  
  /**
   * Helper method to read and deduplicate the tabs array
   * This ensures we always work with a unique set of tab IDs
   */
  _readAndDeduplicateTabs() {
    return this._readTabState().tabs;
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
    if (this._tabsChanged(existingTabs, activeTabs)) {
      this._writeTabState(activeTabs, this._nextWriteToken());
    }
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
        // ID is available, claim it atomically using writer tokens
        const updatedTabs = [...currentTabs, candidateID];
        const writeToken = this._nextWriteToken();
        this._writeTabState(updatedTabs, writeToken);
        
        // Verify we successfully claimed it uniquely by ensuring our write "won"
        const verifyState = this._readTabState();
        if (verifyState.writer === writeToken && verifyState.tabs.includes(candidateID)) {
          nextTabID = candidateID;
        } else {
          retryCount++;
          if (this.config.debug && retryCount < maxRetries) {
            console.log(`Tab ID conflict detected after claim verification, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
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
    const pollKey = "tabpoll_" + this.tabID;
    this.storage.setItem(pollKey, Date.now().toString());
    this.interval = setInterval(() => {
      this._ensureTabStillRegistered();
      this.storage.setItem(pollKey, Date.now().toString());
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
      const filteredTabs = existingTabs.filter(v => v !== this.tabID);
      if (this._tabsChanged(existingTabs, filteredTabs)) {
        this._writeTabState(filteredTabs, this._nextWriteToken());
      }
      this.storage.removeItem("tabpoll_" + this.tabID);
    }
  }
  
  _ensureTabStillRegistered() {
    if (this.tabID === null || this.reinitializing) {
      return;
    }
    const tabs = this._readAndDeduplicateTabs();
    if (!tabs.includes(this.tabID)) {
      if (this.config.debug) {
        console.warn(`Lost ownership of tab ID ${this.tabID}, attempting recovery`);
      }
      this._recoverFromLostRegistration();
    }
  }
  
  _recoverFromLostRegistration() {
    if (this.reinitializing) {
      return;
    }
    this.reinitializing = true;
    const previousTabID = this.tabID;
    try {
      this.cleanup();
      this.tabID = null;
      this.initialize();
      if (this.config.debug) {
        console.log(`Recovered tab ID. Old ID: ${previousTabID}, New ID: ${this.tabID}`);
      }
    } finally {
      this.reinitializing = false;
    }
  }
}


