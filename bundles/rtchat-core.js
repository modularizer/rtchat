var RTChatCore = (function (exports) {
  'use strict';

  /**
   * Default Configuration Values for RTChat
   * 
   * This file contains all default configuration values with detailed documentation.
   * These defaults are used when creating an RTCConfig instance.
   */

  /**
   * Get the default configuration object
   * @returns {Object} Default configuration object
   */
  function getDefaults() {
    return {
      // ============================================================================
      // IDENTITY CONFIGURATION
      // ============================================================================
      
      /**
       * User's display name
       * - If null, will be auto-generated or loaded from storage
       * - Auto-generated format: "User #123"
       * - Saved to storage for persistence (unless starts with "anon" or "User #")
       * - Cannot contain: (, ), |, or leading/trailing spaces
       */
      name: null,
      
      /**
       * Additional user information to share with peers
       * - Sent during connection handshake
       * - Can include publicKeyString, custom metadata, etc.
       * - Used by peers to make connection decisions
       */
      userInfo: {},
      
      // ============================================================================
      // MQTT CONFIGURATION
      // ============================================================================
      
      mqtt: {
        /**
         * MQTT broker WebSocket URL
         * - Used for signaling (connection establishment)
         * - Format: wss://[username]:[password]@[host]:[port]
         * - Default: Public cloud.shiftr.io broker (no auth required)
         * - Only used briefly for signaling, then direct WebRTC takes over
         */
        broker: 'wss://public:public@public.cloud.shiftr.io',
        
        /**
         * MQTT client ID
         * - Unique identifier for this MQTT connection
         * - If null, auto-generated as: baseTopic + name
         * - Should be unique to avoid connection conflicts
         */
        clientId: null,
        
        /**
         * MQTT username (if broker requires authentication)
         * - Used for authenticated MQTT brokers
         * - Can also be included in broker URL
         */
        username: null,
        
        /**
         * MQTT password (if broker requires authentication)
         * - Used for authenticated MQTT brokers
         * - Can also be included in broker URL
         */
        password: null,
        
        /**
         * Reconnection delay in milliseconds
         * - How long to wait before attempting to reconnect to MQTT broker
         * - Used when connection is lost
         */
        reconnectPeriod: 1000,
        
        /**
         * Connection timeout in milliseconds
         * - Maximum time to wait for MQTT connection to establish
         * - Throws error if connection not established within this time
         */
        connectTimeout: 30000
      },
      
      // ============================================================================
      // WEBRTC CONFIGURATION
      // ============================================================================
      
      webrtc: {
        /**
         * ICE (Interactive Connectivity Establishment) servers
         * - Array of STUN/TURN servers for NAT traversal
         * - STUN: Discovers public IP/port (free, public servers available)
         * - TURN: Relays traffic if direct connection fails (usually requires credentials)
         * - Format: [{ urls: 'stun:server:port' }, { urls: 'turn:server:port', username: 'user', credential: 'pass' }]
         * - Multiple servers provide redundancy and better connection success
         * - Default: Multiple Google STUN servers for reliability
         */
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        
        /**
         * ICE transport policy
         * - 'all': Try both STUN and TURN servers (recommended)
         * - 'relay': Only use TURN servers (more expensive, but works behind strict firewalls)
         * - Use 'relay' if you have TURN servers and want to ensure connectivity
         */
        iceTransportPolicy: 'all',
        
        /**
         * Bundle policy for RTP streams
         * - 'balanced': Balance between compatibility and performance (recommended)
         * - 'max-compat': Maximum compatibility (may use more bandwidth)
         * - 'max-bundle': Maximum bundling (better performance, less compatibility)
         */
        bundlePolicy: 'balanced',
        
        /**
         * RTCP muxing policy
         * - 'require': Require RTCP muxing (recommended, more efficient)
         * - 'negotiate': Allow non-muxed RTCP (for compatibility with older implementations)
         */
        rtcpMuxPolicy: 'require'
      },
      
      // ============================================================================
      // TOPIC/ROOM CONFIGURATION
      // ============================================================================
      
      topic: {
        /**
         * Base topic prefix for MQTT
         * - All messages are published to: baseTopic + separator + room
         * - Used to namespace different applications/instances
         * - Default: 'mrtchat'
         */
        base: 'mrtchat',
        
        /**
         * Room/channel identifier
         * - If null, auto-detected from URL (hostname + pathname)
         * - Users in the same room can discover and connect to each other
         * - Can be any string (sanitized to alphanumeric)
         * - Examples: 'lobby', 'game-room-1', 'private-chat'
         */
        room: null,
        
        /**
         * Separator between base topic and room
         * - Used when constructing full topic: base + separator + room
         * - Default: '/'
         * - Example: 'mrtchat/lobby'
         */
        separator: '/'
      },
      
      // ============================================================================
      // DEPENDENCY INJECTION
      // ============================================================================
      
      /**
       * Storage adapter instance
       * - If null, uses LocalStorageAdapter (browser) or falls back to memory
       * - Allows swapping storage implementations for testing or custom storage
       * - Must implement: getItem(key), setItem(key, value), removeItem(key)
       * - See: src/storage/storage-adapter.js
       */
      storage: null,
      
      /**
       * Crypto API instance
       * - If null, uses window.crypto (browser Web Crypto API)
       * - Allows injecting mock crypto for testing
       * - Must implement: subtle.generateKey(), subtle.sign(), subtle.verify()
       */
      crypto: null,
      
      /**
       * MQTT library instance
       * - If null, auto-loads from CDN (mqtt.js)
       * - Allows injecting custom MQTT library or pre-loaded instance
       * - Must implement: connect(url, options), on('connect'), on('message'), publish()
       */
      mqttLibrary: null,
      
      // ============================================================================
      // COMPRESSION CONFIGURATION
      // ============================================================================
      
      compression: {
        /**
         * Enable message compression
         * - Reduces bandwidth usage for large messages
         * - Uses LZ-String by default
         * - Only compresses messages above threshold
         */
        enabled: true,
        
        /**
         * Compression library to use
         * - 'lz-string': LZ-String (default, good balance)
         * - 'pako': Pako (zlib, better compression, larger library)
         * - 'none': No compression
         */
        library: 'lz-string',
        
        /**
         * Minimum message size to compress (in bytes)
         * - Messages smaller than this are sent uncompressed
         * - Compression has overhead, so small messages aren't worth compressing
         * - Default: 100 bytes
         */
        threshold: 100
      },
      
      // ============================================================================
      // CONNECTION BEHAVIOR
      // ============================================================================
      
      connection: {
        /**
         * Automatically connect to MQTT on client creation
         * - If false, must call client.load() manually
         * - Useful for delayed connection or testing
         */
        autoConnect: true,
        
        /**
         * Automatically reconnect if connection is lost
         * - Attempts to reconnect with exponential backoff
         * - Set to false to handle reconnection manually
         */
        autoReconnect: true,
        
        /**
         * Maximum number of reconnection attempts
         * - Infinity: Keep trying forever (default)
         * - Number: Stop after N attempts
         * - Useful for limiting reconnection attempts
         */
        maxReconnectAttempts: Infinity,
        
        /**
         * Delay between reconnection attempts (milliseconds)
         * - Initial delay before first reconnection attempt
         * - May increase with exponential backoff
         */
        reconnectDelay: 1000,
        
        /**
         * Connection timeout (milliseconds)
         * - Maximum time to wait for initial connection
         * - Throws error if not connected within this time
         */
        connectionTimeout: 30000,
        
        /**
         * Automatically accept all peer connection requests
         * - If true, bypasses connection prompts and accepts all requests
         * - Only applies to SignedMQTTRTCClient (MQTTRTCClient always auto-accepts)
         * - When false, prompts user based on trust levels
         * - Useful for testing, public demos, or trusted environments
         */
        autoAcceptConnections: false
      },
      
      // ============================================================================
      // HISTORY/LOGGING
      // ============================================================================
      
      history: {
        /**
         * Enable message history tracking
         * - Tracks all MQTT messages sent/received
         * - Useful for debugging and message replay
         * - Disable to save memory in production
         */
        enabled: true,
        
        /**
         * Maximum number of messages to keep in history
         * - Older messages are removed when limit is reached
         * - Set to 0 to disable history (saves memory)
         * - Default: 1000 messages
         */
        maxLength: 1000
      },
      
      // ============================================================================
      // TAB MANAGEMENT
      // ============================================================================
      
      tabs: {
        /**
         * Enable multi-tab management
         * - Tracks multiple browser tabs/windows for the same session
         * - Adds tab ID to username to distinguish tabs
         * - Disable if you don't need multi-tab support
         */
        enabled: true,
        
        /**
         * Polling interval for tab keep-alive (milliseconds)
         * - How often to update the "last seen" timestamp
         * - Lower values = more responsive, but more storage writes
         * - Default: 250ms
         */
        pollInterval: 250,
        
        /**
         * Tab timeout (seconds)
         * - Tabs not seen for this long are considered closed
         * - Used to clean up stale tab entries
         * - Default: 300 seconds (5 minutes)
         */
        timeout: 300
      },
      
      // ============================================================================
      // DEBUG/LOGGING
      // ============================================================================
      
      /**
       * Enable debug logging
       * - Logs detailed information about connections, messages, etc.
       * - Useful for development and troubleshooting
       * - Disable in production for better performance
       */
      debug: false,
      
      /**
       * Custom logger function
       * - If provided, used instead of console.log/error
       * - Signature: (level: string, message: string, ...args: any[]) => void
       * - Allows integration with custom logging systems
       * - If null, uses console methods
       */
      logger: null,
      
      // ============================================================================
      // CONNECTION LOADING
      // ============================================================================
      
      /**
       * Auto-load flag
       * - If false, client won't automatically connect
       * - Must call client.load() manually
       * - Default: true (auto-connect)
       */
      load: true
    };
  }

  /**
   * Object Utilities - Helper functions for object manipulation
   * 
   * Provides utilities for deep merging objects and type checking.
   */

  /**
   * Check if a value is a plain object (not array, null, or other types)
   * @param {*} item - Value to check
   * @returns {boolean} True if item is a plain object
   */
  function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Deep merge two objects recursively
   * 
   * Merges source into target, creating a new object. Nested objects are merged
   * recursively rather than being replaced entirely.
   * 
   * @param {Object} target - Target object to merge into
   * @param {Object} source - Source object to merge from
   * @returns {Object} New merged object (target is not modified)
   * 
   * @example
   * const merged = deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 }, e: 4 });
   * // Result: { a: 1, b: { c: 2, d: 3 }, e: 4 }
   */
  function deepMerge(target, source) {
    const output = { ...target };
    
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  /**
   * RTCConfig - Configuration management for RTChat
   * 
   * Centralized configuration system with validation, normalization, and presets.
   * Uses nested configuration format with validation and presets.
   */


  class RTCConfig {
    // Static defaults object - single source of truth
    static getDefaults() {
      return getDefaults();
    }
    
    constructor(userConfig = {}) {
      // Normalize user config (handle common string formats)
      const normalized = this.normalizeUserConfig(userConfig);
      
      // Get defaults from separate file and merge with user config
      const defaults = getDefaults();
      this.config = deepMerge(defaults, normalized);
      
      // Apply computed defaults (functions that need instance context)
      this.applyComputedDefaults();
      
      // Validate configuration
      this.validate();
      
      // Normalize values (e.g., convert single STUN to array)
      this.normalize();
    }
    
    normalizeUserConfig(userConfig) {
      const normalized = { ...userConfig };
      
      // Handle topic as string -> topic.room
      if (typeof userConfig.topic === 'string') {
        normalized.topic = { room: userConfig.topic };
      }
      
      return normalized;
    }
    
    applyComputedDefaults() {
      // Apply defaults that require instance methods (only for dynamic values that can't be in static defaults)
      // These are values that depend on runtime context (localStorage, window.location, etc.)
      if (!this.config.name) {
        this.config.name = this.getDefaultName();
      }
      
      if (!this.config.topic.room) {
        this.config.topic.room = this.getDefaultRoom();
      }
      
      // iceServers is now in the defaults dictionary, so deepMerge will handle it automatically
      // Only need to handle explicit null/empty array cases
      if (this.config.webrtc.iceServers === null || 
          (Array.isArray(this.config.webrtc.iceServers) && this.config.webrtc.iceServers.length === 0)) {
        // User explicitly wants to use defaults, copy from defaults
        this.config.webrtc.iceServers = [...getDefaults().webrtc.iceServers];
      }
    }
    
    getDefaultName() {
      // Try localStorage, then generate
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const stored = localStorage.getItem('rtchat_name') || localStorage.getItem('name');
          if (stored && !stored.startsWith('anon')) {
            return stored;
          }
        } catch (e) {
          // localStorage might not be available
        }
      }
      return `User #${Math.floor(Math.random() * 1000)}`;
    }
    
    getDefaultRoom() {
      // Auto-detect from URL if in browser
      if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname
          .replace(/rtchat\/?/, '')
          .replace(/index\.html$/, '')
          .replace(/\.html$/, '')
          .replace(/[^a-zA-Z0-9]/g, '');
        
        // Skip localhost/127.0.0.1 for room name
        if (!['localhost', '127.0.0.1'].includes(hostname)) {
          return hostname + pathname;
        }
        return pathname || 'default';
      }
      return 'default';
    }
    
    validate() {
      // Validate name
      if (this.config.name) {
        if (this.config.name.includes('(') || this.config.name.includes(')') || this.config.name.includes('|')) {
          throw new Error('Name cannot contain (, ), or |');
        }
        if (this.config.name !== this.config.name.trim()) {
          throw new Error('Name cannot have leading or trailing spaces');
        }
      }
      
      // Validate MQTT broker URL
      if (this.config.mqtt.broker) {
        try {
          new URL(this.config.mqtt.broker);
        } catch (e) {
          throw new Error(`Invalid MQTT broker URL: ${this.config.mqtt.broker}`);
        }
      }
      
      // Validate ICE servers
      if (this.config.webrtc.iceServers) {
        if (!Array.isArray(this.config.webrtc.iceServers)) {
          // Will be normalized to array, but check if it's a valid string
          if (typeof this.config.webrtc.iceServers !== 'string') {
            throw new Error('iceServers must be an array or string');
          }
        }
      }
    }
    
    normalize() {
      // Ensure ICE servers is always an array
      if (!Array.isArray(this.config.webrtc.iceServers)) {
        const server = this.config.webrtc.iceServers;
        if (typeof server === 'string') {
          this.config.webrtc.iceServers = [{ urls: server }];
        } else if (server && server.urls) {
          this.config.webrtc.iceServers = [server];
        } else {
          // Use defaults from defaults file
          this.config.webrtc.iceServers = [...getDefaults().webrtc.iceServers];
        }
      }
      
      // Convert string URLs to object format
      this.config.webrtc.iceServers = this.config.webrtc.iceServers.map(server => {
        if (typeof server === 'string') {
          return { urls: server };
        }
        return server;
      });
      
      // Ensure topic separator is applied correctly
      if (this.config.topic.separator && !this.config.topic.room.includes(this.config.topic.separator)) ;
    }
    
    // Getters for easy access
    get name() { return this.config.name; }
    get broker() { return this.config.mqtt.broker; }
    get iceServers() { return this.config.webrtc.iceServers; }
    get topic() { 
      const sep = this.config.topic.separator || '/';
      return `${this.config.topic.base}${sep}${this.config.topic.room}`;
    }
    get baseTopic() { return this.config.topic.base; }
    get room() { return this.config.topic.room; }
    
    // Get full config object
    getConfig() {
      return this.config;
    }
    
    // Update specific config values
    update(updates) {
      const normalized = this.normalizeUserConfig(updates);
      this.config = deepMerge(this.config, normalized);
      this.applyComputedDefaults();
      this.validate();
      this.normalize();
    }
  }

  // Preset configurations
  const ConfigPresets = {
    // Default - balanced for most use cases
    default: () => new RTCConfig({}),
    
    // High performance - multiple STUN servers, optimized settings
    performance: () => new RTCConfig({
      webrtc: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceTransportPolicy: 'all'
      },
      connection: {
        autoReconnect: true,
        reconnectDelay: 500
      }
    }),
    
    // Privacy-focused - custom STUN/TURN servers
    privacy: (customServers) => new RTCConfig({
      webrtc: {
        iceServers: customServers || [
          // User should provide their own servers
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    }),
    
    // Development - local MQTT broker
    development: (localBroker = 'ws://localhost:1883') => new RTCConfig({
      mqtt: {
        broker: localBroker
      },
      debug: true
    }),
    
    // Production - optimized for production use
    production: () => new RTCConfig({
      compression: { enabled: true },
      history: { maxLength: 500 },
      connection: {
        autoReconnect: true,
        maxReconnectAttempts: 10
      },
      debug: false
    })
  };

  /**
   * Storage Adapter - Abstract base class for storage operations
   * 
   * This is an abstract class that must be extended. It defines the interface
   * for storage operations, allowing swapping between localStorage, memory storage,
   * or custom implementations for better testability and flexibility.
   * 
   * @abstract
   * @class StorageAdapter
   * 
   * @example
   * // Extend this class to create a custom storage adapter
   * class MyStorageAdapter extends StorageAdapter {
   *   constructor() {
   *     super(); // Required
   *     // Initialize your storage
   *   }
   *   
   *   getItem(key) {
   *     // Implement getItem
   *   }
   *   
   *   // ... implement other methods
   * }
   */
  class StorageAdapter {
    constructor() {
      // Prevent direct instantiation of abstract class
      if (this.constructor === StorageAdapter) {
        throw new Error('StorageAdapter is an abstract class and cannot be instantiated directly. Extend it instead.');
      }
    }
    
    /**
     * Get an item from storage by key
     * @abstract
     * @param {string} key - The key to retrieve
     * @returns {string|null} The value associated with the key, or null if not found
     */
    getItem(key) {
      throw new Error('getItem must be implemented by subclass');
    }
    
    /**
     * Set an item in storage
     * @abstract
     * @param {string} key - The key to store
     * @param {string} value - The value to store
     */
    setItem(key, value) {
      throw new Error('setItem must be implemented by subclass');
    }
    
    /**
     * Remove an item from storage
     * @abstract
     * @param {string} key - The key to remove
     */
    removeItem(key) {
      throw new Error('removeItem must be implemented by subclass');
    }
    
    /**
     * Clear all items from storage
     * @abstract
     */
    clear() {
      throw new Error('clear must be implemented by subclass');
    }
    
    /**
     * Get the key at the specified index
     * @abstract
     * @param {number} index - The index of the key to retrieve
     * @returns {string|null} The key at the index, or null if not found
     */
    key(index) {
      throw new Error('key must be implemented by subclass');
    }
    
    /**
     * Get the number of items in storage
     * @abstract
     * @returns {number} The number of items
     */
    get length() {
      throw new Error('length must be implemented by subclass');
    }
  }

  /**
   * LocalStorage Adapter - Browser localStorage implementation
   */


  class LocalStorageAdapter extends StorageAdapter {
    constructor() {
      super();
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage is not available in this environment');
      }
      this.storage = window.localStorage;
    }
    
    getItem(key) {
      try {
        return this.storage.getItem(key);
      } catch (e) {
        console.warn('localStorage.getItem failed:', e);
        return null;
      }
    }
    
    setItem(key, value) {
      try {
        this.storage.setItem(key, value);
      } catch (e) {
        console.warn('localStorage.setItem failed:', e);
        // Handle quota exceeded or other errors
        if (e.name === 'QuotaExceededError') {
          throw new Error('Storage quota exceeded');
        }
      }
    }
    
    removeItem(key) {
      try {
        this.storage.removeItem(key);
      } catch (e) {
        console.warn('localStorage.removeItem failed:', e);
      }
    }
    
    clear() {
      try {
        this.storage.clear();
      } catch (e) {
        console.warn('localStorage.clear failed:', e);
      }
    }
    
    key(index) {
      try {
        return this.storage.key(index);
      } catch (e) {
        console.warn('localStorage.key failed:', e);
        return null;
      }
    }
    
    get length() {
      try {
        return this.storage.length;
      } catch (e) {
        return 0;
      }
    }
  }

  /**
   * Memory Storage Adapter - In-memory storage for testing or server-side use
   */


  class MemoryAdapter extends StorageAdapter {
    constructor() {
      super();
      this.data = {};
    }
    
    getItem(key) {
      return this.data[key] || null;
    }
    
    setItem(key, value) {
      this.data[key] = String(value);
    }
    
    removeItem(key) {
      delete this.data[key];
    }
    
    clear() {
      this.data = {};
    }
    
    key(index) {
      const keys = Object.keys(this.data);
      return keys[index] || null;
    }
    
    get length() {
      return Object.keys(this.data).length;
    }
  }

  /**
   * EventEmitter - Simple event system for RTChat
   * 
   * Provides on, off, emit methods for event-driven architecture
   */

  class EventEmitter {
    constructor() {
      this.events = {};
    }
    
    on(event, handler) {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(handler);
      
      // Return unsubscribe function
      return () => this.off(event, handler);
    }
    
    off(event, handler) {
      if (!this.events[event]) {
        return;
      }
      this.events[event] = this.events[event].filter(h => h !== handler);
    }
    
    emit(event, ...args) {
      if (!this.events[event]) {
        return;
      }
      // Create a copy to avoid issues if handlers modify the array
      const handlers = [...this.events[event]];
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (e) {
          console.error(`Error in event handler for ${event}:`, e);
        }
      });
    }
    
    once(event, handler) {
      const wrappedHandler = (...args) => {
        handler(...args);
        this.off(event, wrappedHandler);
      };
      return this.on(event, wrappedHandler);
    }
    
    removeAllListeners(event) {
      if (event) {
        delete this.events[event];
      } else {
        this.events = {};
      }
    }
    
    listenerCount(event) {
      return this.events[event] ? this.events[event].length : 0;
    }
  }

  /**
   * DeferredPromise - Promise that can be resolved/rejected externally
   */

  class DeferredPromise {
    constructor() {
      this.promise = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }
  }

  /**
   * Tab Manager - Manages multiple tabs/windows for the same session
   * 
   * Uses storage adapter to track active tabs and assign unique IDs
   */

  class TabManager {
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
      
      const maxTabID = existingTabs.length ? (Math.max(...existingTabs)) : -1;
      const minTabID = existingTabs.length ? (Math.min(...existingTabs)) : -1;
      this.tabID = (minTabID < 10) ? (maxTabID + 1) : 0;
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

  /**
   * MQTT Library Loader - Handles loading MQTT and compression libraries
   */

  class MQTTLoader {
    constructor(config) {
      this.config = config;
      this.mqtt = null;
      this.compression = null;
      this.loading = false;
    }
    
    async load() {
      if (this.loading) {
        return this.waitForLoad();
      }
      
      this.loading = true;
      
      // If mqttLibrary is provided, use it
      if (this.config.mqttLibrary) {
        this.mqtt = this.config.mqttLibrary;
        this.loading = false;
        return this.mqtt;
      }
      
      // Otherwise, try to load from global or CDN
      if (typeof window !== 'undefined') {
        // Check if already loaded
        if (window.mqtt) {
          this.mqtt = window.mqtt;
          this.loading = false;
          return this.mqtt;
        }
        
        // Load from CDN
        return this.loadFromCDN();
      }
      
      throw new Error('MQTT library not available and cannot be loaded');
    }
    
    loadFromCDN() {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/mqtt/dist/mqtt.min.js";
        script.onload = () => {
          if (window.mqtt) {
            this.mqtt = window.mqtt;
            this.loadCompression().then(() => {
              this.loading = false;
              resolve(this.mqtt);
            });
          } else {
            this.loading = false;
            reject(new Error('MQTT library failed to load'));
          }
        };
        script.onerror = () => {
          this.loading = false;
          reject(new Error('Failed to load MQTT library from CDN'));
        };
        document.head.appendChild(script);
      });
    }
    
    async loadCompression() {
      if (!this.config.compression.enabled) {
        return;
      }
      
      const library = this.config.compression.library;
      
      if (library === 'lz-string') {
        if (window.LZString) {
          this.compression = window.LZString;
          return;
        }
        
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js";
          script.onload = () => {
            if (window.LZString) {
              this.compression = window.LZString;
              resolve();
            } else {
              reject(new Error('LZ-String library failed to load'));
            }
          };
          script.onerror = () => {
            reject(new Error('Failed to load LZ-String library'));
          };
          document.head.appendChild(script);
        });
      }
    }
    
    getMQTT() {
      return this.mqtt;
    }
    
    getCompression() {
      return this.compression;
    }
    
    compress(data) {
      if (!this.compression || !this.config.compression.enabled) {
        return data;
      }
      
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      if (str.length < this.config.compression.threshold) {
        return data;
      }
      
      if (this.compression.compressToUint8Array) {
        return this.compression.compressToUint8Array(str);
      }
      return data;
    }
    
    decompress(data) {
      if (!this.compression || !this.config.compression.enabled) {
        return data;
      }
      
      if (this.compression.decompressFromUint8Array) {
        return this.compression.decompressFromUint8Array(data);
      }
      return data;
    }
    
    waitForLoad() {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.loading && this.mqtt) {
            clearInterval(checkInterval);
            resolve(this.mqtt);
          }
        }, 100);
      });
    }
  }

  /**
   * MQTT-RTC Client Library - Core peer-to-peer communication system
   * 
   * This module provides a complete implementation for establishing peer-to-peer connections
   * using MQTT for signaling and WebRTC for direct communication. It handles connection
   * management, data channels, video/audio calls, and message passing.
   * 
   * Architecture:
   * - BaseMQTTRTCClient: Base class with MQTT and WebRTC connection logic
   * - PromisefulMQTTRTCClient: Adds promise-based APIs for async operations
   * - MQTTRTCClient: High-level client with event callbacks and peer management
   * - RTCConnection: Manages individual WebRTC peer connections
   * - Peer: Convenience wrapper for interacting with a specific peer
   * 
   * Usage:
   *   import { MQTTRTCClient } from './mqtt-rtc.js';
   *   
   *   const client = new MQTTRTCClient({
   *     name: 'MyName',
   *     topic: 'myroom',
   *     broker: 'wss://broker.example.com',
   *     stunServer: 'stun:stun.example.com:19302'
   *   });
   * 
   *   client.on('connectedtopeer', (user) => {
   *     console.log('Connected to', user);
   *   });
   * 
   *   client.on('chat', (message, sender) => {
   *     console.log(`${sender}: ${message}`);
   *   });
   * 
   *   // Send a message to all connected peers
   *   client.sendRTCChat('Hello everyone!');
   * 
   *   // Get a peer object for direct interaction
   *   const peer = client.getPeer('OtherUser');
   *   peer.dm('Private message');
   *   peer.ask('What is 2+2?').then(answer => console.log(answer));
   * 
   * Features:
   * - Automatic connection establishment via MQTT signaling
   * - WebRTC data channels for messaging
   * - Video/audio calling support
   * - Question/answer system for RPC-like communication
   * - Ping/pong for connection health checks
   * - Tab ID management for multiple tabs
   * - Message compression using LZ-String
   * - Connection history tracking
   * 
   * Configuration:
   * - broker: MQTT broker URL (default: public cloud.shiftr.io)
   * - stunServer: STUN server for NAT traversal (default: Google STUN)
   * - baseTopic: Base MQTT topic prefix (default: 'mrtchat')
   * - topic: Room/channel identifier (auto-derived from URL by default)
   * - name: User identifier (auto-generated if not provided)
   * 
   * @module mqtt-rtc
   */




  //______________________________________________________________________________________________________________________



  // EventEmitter is now imported above

  class BaseMQTTRTCClient extends EventEmitter {
    constructor(userConfig){
      super(); // Initialize EventEmitter
      userConfig = userConfig || {};
      
      // Use RTCConfig system (always available now)
      const config = userConfig instanceof RTCConfig ? userConfig : new RTCConfig(userConfig);
      const configObj = config.getConfig();
      
      // Initialize storage adapter
      const storage = userConfig.storage || new LocalStorageAdapter();
      
      // Initialize tab manager
      let tabManager = null;
      if (configObj.tabs.enabled) {
        tabManager = new TabManager(storage, configObj);
      }
      
      // Initialize MQTT loader
      const mqttLoader = new MQTTLoader(configObj);
      
      // Set properties from config
      const tabIDValue = tabManager ? tabManager.getTabID() : null;
      this.name = configObj.name + (tabIDValue ? ('(' + tabIDValue + ')') : '');
      this.userInfo = configObj.userInfo || {};
      this.mqttBroker = configObj.mqtt.broker;
      this.iceServers = configObj.webrtc.iceServers;
      this.baseTopic = configObj.topic.base;
      this.topic = config.topic;
      this.config = config;
      this.storage = storage;
      this.tabManager = tabManager;
      this.mqttLoader = mqttLoader;
      this.maxHistoryLength = configObj.history.maxLength;
      
      // Save name to storage if not anonymous
      if (!configObj.name.startsWith("anon") && !configObj.name.startsWith("User #")) {
        storage.setItem("name", configObj.name);
        storage.setItem("rtchat_name", configObj.name);
      }
      
      // Load flag
      const load = userConfig.load !== false;

      // bind methods to this
      // MQTT methods
      this.load = this.load.bind(this);
      this._onMQTTConnect = this._onMQTTConnect.bind(this);
      this.onConnectedToMQTT = this.onConnectedToMQTT.bind(this);
      this._onMQTTMessage = this._onMQTTMessage.bind(this);
      this.onMQTTMessage = this.onMQTTMessage.bind(this);
      this.beforeunload = this.beforeunload.bind(this);
      this.postPubliclyToMQTTServer = this.postPubliclyToMQTTServer.bind(this);
      for (let [k, v] of Object.entries(this.mqttHandlers)){
          this.mqttHandlers[k] = v.bind(this);
      }
      this.changeName = this.changeName.bind(this);
      this.recordNameChange = this.recordNameChange.bind(this);
      this.onNameChange = this.onNameChange.bind(this);


      // RTC connection methods
      this.shouldConnectToUser = this.shouldConnectToUser.bind(this);
      this.connectToUser = this.connectToUser.bind(this);
      this.connectionToUser = this.connectionToUser.bind(this);
      this.connectionsToUsers = this.connectionsToUsers.bind(this);
      this.disconnectFromUser = this.disconnectFromUser.bind(this);
      this.onConnectedToUser = this.onConnectedToUser.bind(this);
      this.onDisconnectedFromUser = this.onDisconnectedFromUser.bind(this);
      this.onrtcdisconnectedFromUser = this.onrtcdisconnectedFromUser.bind(this);

      // RTC send/receive methods
      this.callUser = this.callUser.bind(this);
      this.callFromUser = this.callFromUser.bind(this);
      this.acceptCallFromUser = this.acceptCallFromUser.bind(this);
      this.oncallconnected = this.oncallconnected.bind(this);
      this.isConnectedToUser = this.isConnectedToUser.bind(this);

      this.sendOverRTC = this.sendOverRTC.bind(this);
      this.onrtcmessage = this.onrtcmessage.bind(this);
      this.onrtcerror = this.onrtcerror.bind(this);

      // initialize state tracking variables
      this.rtcConnections = {};
      this.knownUsers = {};
      this.pendingIceCandidates = {};


      this.mqttHistory = [];
      this.announceInterval = null; // For periodic announcements

      // load the MQTT client
      if (load){
          this.load();
      }
      
      // Optional window.rtc assignment (can be disabled via config)
      const assignToWindow = userConfig.assignToWindow !== false;
      
      if (assignToWindow && typeof window !== 'undefined') {
        if (window.rtc){
          let old = window.rtc;
          console.warn("RTC already exists. Saving old RTC object to window.rtc.old,", old);
          old.name;
          window.rtc = {
              oldName: old,
              name: this
          };
        }else {
          window.rtc = this;
        }
      }
    }
    //________________________________________________________ MQTT BASICS _______________________________________________
    async load(){
      // Use MQTTLoader (always available now)
      await this.mqttLoader.load();
      const mqtt = this.mqttLoader.getMQTT();
      if (!mqtt) {
        throw new Error('MQTT library not available');
      }
      
      const configObj = this.config.getConfig();
      const clientId = configObj.mqtt?.clientId || (this.baseTopic + this.name);
      const mqttOptions = {
        clientId: clientId,
        username: configObj.mqtt.username,
        password: configObj.mqtt.password,
        reconnectPeriod: configObj.mqtt.reconnectPeriod,
        connectTimeout: configObj.mqtt.connectTimeout
      };
      
      this.client = mqtt.connect(this.mqttBroker, mqttOptions);
      this.client.on('connect', this._onMQTTConnect.bind(this));
      this.client.on('message', this._onMQTTMessage.bind(this));
      
      if (typeof window !== 'undefined') {
        window.addEventListener("beforeunload", this.beforeunload.bind(this));
      }
    }
    _onMQTTConnect(){
      this.client.subscribe(this.topic, ((err)=>{
      if (!err) {
          console.log("subscribed to ", this.topic);
          // Send initial connect message immediately after subscription is confirmed
          // This ensures we announce our presence as soon as we're ready to receive messages
          this.postPubliclyToMQTTServer("connect", this.userInfo);
          this.onConnectedToMQTT();
          
          // Also set up periodic announcements to catch any missed connections
          // This handles race conditions when two users connect simultaneously
          // Announce every 3 seconds for the first 15 seconds, then every 30 seconds
          // Only announce if we don't have active connections (to reduce noise)
          let announcementCount = 0;
          this.announceInterval = setInterval(() => {
            // Only send periodic announcements if we have no active connections
            // This reduces unnecessary connect messages when already connected
            const hasActiveConnections = Object.keys(this.rtcConnections).some(user => {
              const conn = this.rtcConnections[user];
              return conn && conn.peerConnection && 
                     (conn.peerConnection.connectionState === "connected" || 
                      conn.peerConnection.connectionState === "completed");
            });
            
            // Only announce if no active connections (removed the "announcementCount < 5" condition)
            if (!hasActiveConnections) {
              this.postPubliclyToMQTTServer("connect", this.userInfo);
            }
            
            announcementCount++;
            // After 5 announcements (15 seconds), switch to less frequent announcements
            if (announcementCount >= 5 && this.announceInterval) {
              clearInterval(this.announceInterval);
              // Switch to less frequent announcements (every 30 seconds, only if no connections)
              this.announceInterval = setInterval(() => {
                const hasActiveConnections = Object.keys(this.rtcConnections).some(user => {
                  const conn = this.rtcConnections[user];
                  return conn && conn.peerConnection && 
                         (conn.peerConnection.connectionState === "connected" || 
                          conn.peerConnection.connectionState === "completed");
                });
                if (!hasActiveConnections) {
                  this.postPubliclyToMQTTServer("connect", this.userInfo);
                }
              }, 30000);
            }
          }, 3000);
      }else {
          console.error("Error subscribing to " + this.topic, err);
      }
      }).bind(this));


    }
      onConnectedToMQTT(){
          console.log("Connected to MQTT: " + this.topic + " as " + this.name);
          this.emit('mqttconnected', this.topic, this.name);
      }
    _onMQTTMessage(t, payloadString){
          if (t === this.topic){
              let payload;
              try{
                  // Use MQTTLoader for decompression
                  const decompressed = this.mqttLoader.decompress(payloadString);
                  payload = typeof decompressed === 'string' ? JSON.parse(decompressed) : decompressed;
              }catch(e){
                  // Fallback to uncompressed if decompression fails
                  payload = JSON.parse(payloadString);
              }
              if (payload.sender === this.name){
                  return;
              }
              let subtopic = payload.subtopic;
              payload.sent = false;
              payload.receiveTimestamp = Date.now();
              this.mqttHistory.push(payload);
              while (this.mqttHistory.length > this.maxHistoryLength){
                  this.mqttHistory.shift();
              }
              // Log removed to reduce console noise
              if (this.mqttHandlers[subtopic]){
                  this.mqttHandlers[subtopic](payload);
              }else {
                  this.onMQTTMessage(subtopic, payload.data, payload.sender, payload.timestamp);
                  console.warn("Unhandled message: " + subtopic, payload);
              }
          }
      }
    onMQTTMessage(subtopic, data, sender, timestamp){
      console.log("Received message from " + sender + " on " + subtopic, data);
      this.emit('mqttmessage', subtopic, data, sender, timestamp);
    }
    beforeunload(){
      this.postPubliclyToMQTTServer("unload", "disconnecting");
      
      // Cleanup tab manager if using new system
      if (this.tabManager) {
        this.tabManager.cleanup();
      }
    }
    
    disconnect(){
      // Cleanup connections
      for (let user of Object.keys(this.rtcConnections)) {
        this.disconnectFromUser(user);
      }
      
      // Stop periodic announcements
      if (this.announceInterval) {
        clearInterval(this.announceInterval);
        this.announceInterval = null;
      }
      
      // Cleanup MQTT client
      if (this.client) {
        this.client.end();
        this.client = null;
      }
      
      // Cleanup tab manager
      if (this.tabManager) {
        this.tabManager.cleanup();
      }
    }
    postPubliclyToMQTTServer(subtopic, data){
      let payload = {
          sender: this.name,
          timestamp: Date.now(),
          subtopic: subtopic,
          data: data
      };
      let payloadString = JSON.stringify(payload);
      payloadString.length;
      
      // Use MQTTLoader's compression if available
      if (this.mqttLoader) {
        const compressed = this.mqttLoader.compress(payloadString);
        if (compressed !== payloadString) {
          payloadString = compressed;
        }
      }
      
      // Reduce logging for frequent messages like ICE candidates
      if (subtopic === "RTCIceCandidate") {
        // Only log null candidates (end of ICE gathering) or log at debug level
        if (!data || data === null) {
          console.log("Sending message to " + this.topic + " subtopic " + subtopic + " (end of ICE gathering)");
        }
        // Otherwise, ICE candidates are sent too frequently to log each one
      } else {
        console.log("Sending message to " + this.topic + " subtopic " + subtopic, data);
      }
      this.client.publish(this.topic, payloadString);
      payload.sent = true;
      this.mqttHistory.push(payload);
      while (this.mqttHistory.length > this.maxHistoryLength){
          this.mqttHistory.shift();
      }
    }

    //____________________________________________________________________________________________________________________
    mqttHandlers = {
      connect: payload => {//connection
          // Log removed to reduce console noise
          
          // Check if we're already connected and the connection is healthy
          const existingConnection = this.rtcConnections[payload.sender];
          if (existingConnection) {
              const connectionState = existingConnection.peerConnection.connectionState;
              const iceConnectionState = existingConnection.peerConnection.iceConnectionState;
              
              // If connection is healthy, ignore this connect message (likely a periodic announcement)
              if (connectionState === "connected" && 
                  (iceConnectionState === "connected" || iceConnectionState === "completed")) {
                  // Log removed to reduce console noise
                  this.knownUsers[payload.sender] = payload.data; // Update user info
                  return;
              }
              
              // Connection exists but is broken, disconnect it
              if (connectionState === "failed" || connectionState === "closed" ||
                  iceConnectionState === "failed" || iceConnectionState === "closed") {
                  console.warn("Connection to " + payload.sender + " is broken, disconnecting");
                  this.disconnectFromUser(payload.sender);
              } else if (connectionState === "new") {
                  // Connection is in "new" state - check if it's been stuck for too long
                  // If it's been more than 10 seconds, allow a retry
                  const connectionAge = Date.now() - (existingConnection.createdAt || 0);
                  if (connectionAge > 10000) {
                      console.warn("Connection to " + payload.sender + " stuck in 'new' state for " + connectionAge + "ms, allowing retry");
                      this.disconnectFromUser(payload.sender);
                      // Fall through to create new connection
                  } else {
                      // Connection is new but not stuck yet, don't interfere
                      this.knownUsers[payload.sender] = payload.data; // Update user info
                      return;
                  }
              } else if (connectionState === "connecting") {
                  // Connection is actively connecting, don't interfere
                  this.knownUsers[payload.sender] = payload.data; // Update user info
                  return;
              } else {
                  // Other states (checking, etc.), allow retry if stuck
                  const connectionAge = Date.now() - (existingConnection.createdAt || 0);
                  if (connectionAge > 15000) {
                      console.warn("Connection to " + payload.sender + " stuck in '" + connectionState + "' state for " + connectionAge + "ms, allowing retry");
                      this.disconnectFromUser(payload.sender);
                      // Fall through to create new connection
                  } else {
                      // Connection is progressing, don't interfere
                      this.knownUsers[payload.sender] = payload.data; // Update user info
                      return;
                  }
              }
          }
          
          this.knownUsers[payload.sender] = payload.data;
          this.shouldConnectToUser(payload.sender, payload.data).then(r => {
              if (r){
                  this.connectToUser(payload.sender);
              }
          });
      },
      nameChange: payload => {//name
          this.recordNameChange(payload.data.oldName, payload.data.newName);
      },
      unload: payload => {
          this.disconnectFromUser(payload.sender);
          delete this.knownUsers[payload.sender];
      },
      RTCOffer: payload => {//rtc offer
          this.shouldConnectToUser(payload.sender, payload.data.userInfo).then(r => {
              if (r){
                  if (payload.data.offer.target != this.name){return}                if (this.rtcConnections[payload.sender]){
                      console.warn("Already have a connection to " + payload.sender + ". Closing and reopening.");
                      this.rtcConnections[payload.sender].close();
                  }
                  this.rtcConnections[payload.sender] = new RTCConnection(this, payload.sender);
                  this.rtcConnections[payload.sender].respondToOffer(payload.data.offer.localDescription);
                  let pendingIceCandidate = this.pendingIceCandidates[payload.sender];
                  if (pendingIceCandidate){
                      console.log("Found pending ice candidate for " + payload.sender);
                      this.rtcConnections[payload.sender].onReceivedIceCandidate(pendingIceCandidate);
                      delete this.pendingIceCandidates[payload.sender];
                  }
              }else {
                  console.warn("Not connecting to " + payload.sender);
                  // TODO: actually reject offer
              }
          });

      },

      RTCIceCandidate: payload => {//rtc ice candidate
          if (payload.data){
              let rtcConnection = this.rtcConnections[payload.sender]; // Using the correct connection
              if (!rtcConnection){
      //            console.error("No connection found for " + payload.sender);
                  this.pendingIceCandidates[payload.sender] = payload.data;
      //            rtcConnection = new RTCConnection(this, payload.sender);
      //            this.rtcConnections[payload.sender] = rtcConnection
              }else {
                  rtcConnection.onReceivedIceCandidate(payload.data);
              }
          }
      },
      RTCAnswer: payload => {//rtc answer
          if (payload.data.target != this.name){return}        let rtcConnection = this.rtcConnections[payload.sender]; // Using the correct connection
          if (!rtcConnection){
              console.error("No connection found for " + payload.sender);
              return
          }
          rtcConnection.receiveAnswer(payload.data.localDescription);
      }
    }
    shouldConnectToUser(user, userInfo){
      return Promise.resolve(true);
    }

    callUser(user, callInfo){
      let callStartPromise;
      if (callInfo instanceof MediaStream){
          let localStream = callInfo;
          // startCall returns a promise that resolves to {localStream, remoteStream}
          callStartPromise = this.rtcConnections[user].startCall(localStream);
      }else {
          callInfo = callInfo || {video: true, audio: true};
          callStartPromise = navigator.mediaDevices.getUserMedia(callInfo).then(localStream => {
              // startCall returns a promise that resolves to {localStream, remoteStream}
              return this.rtcConnections[user].startCall(localStream);
          });
      }
      let callEndPromise = this.rtcConnections[user].callEndPromise.promise;
      return {start: callStartPromise, end: callEndPromise};
    }
    endCallWithUser(user){
      console.log("Ending call with " + user);
      if (this.rtcConnections[user]){
          this.rtcConnections[user].endCall();
      }
    }
    callFromUser(user, callInfo, initiatedCall, promises){
      callInfo = callInfo || {video: true, audio: true};
      if (initiatedCall){
          return navigator.mediaDevices.getUserMedia(callInfo)
      }else {
          return this.acceptCallFromUser(user, callInfo, promises).then(r=> {
              if (r === false || r === null || r === undefined){
                  return Promise.reject("Call rejected");
              }
              // If acceptCallFromUser returns modified callInfo (object), use it
              // Otherwise use the original callInfo
              const mediaCallInfo = (typeof r === 'object' && r !== null && (r.video !== undefined || r.audio !== undefined)) 
                  ? r 
                  : callInfo;
              return navigator.mediaDevices.getUserMedia(mediaCallInfo)
          })
      }
    }
    oncallended(user){
      console.log("Call ended with " + user);
      // Emit the callended event so UI components can react
      this.emit('callended', user);
    }
    acceptCallFromUser(user, callInfo, promises){
       return Promise.resolve(true);
    }
    connectToUser(user){
      if (this.rtcConnections[user]){
          console.warn("Already connected to " + user);
          try{
              this.disconnectFromUser(user);
          }catch{}
          delete this.rtcConnections[user];
      }
      if (!this.connectionToUser(user)){
          this.rtcConnections[user] = new RTCConnection(this, user);
          this.rtcConnections[user].sendOffer();
          return this.rtcConnections[user];
      }
    }
    connectionToUser(user){
      let existingConnection = this.rtcConnections[user];
      if (existingConnection && existingConnection.peerConnection.connectionState === "connected"){
          return existingConnection
      }else if (existingConnection){
          console.warn("Already have a connection to " + user + " but it's not connected.", existingConnection.peerConnection.connectionState);
          if (existingConnection.peerConnection.connectionState == "failed"){
              console.warn("Connection failed. Closing and reopening.");
              this.disconnectFromUser(user);
              return null;
          }


          return existingConnection;

      }
      return null;
    }
    connectionsToUsers(users){
      users = users || Object.keys(this.rtcConnections);
      if (typeof users === "string"){
          users = [users];
      }
      return users.filter(c => this.connectionToUser(c));
    }
    get connectedUsers(){
      return this.connectionsToUsers();
    }
    disconnectFromUser(user){
      console.warn("Closing connection to " + user);
      let rtcConnection = this.rtcConnections[user];
      if (rtcConnection){
          rtcConnection.close();
          delete this.rtcConnections[user];
          console.warn("Closed connection to " + user);
      }else {
          console.warn("No connection to close to " + user);
      }
    }
    onConnectedToUser(user){
      console.log("Connected to user ", user);
      this.emit('connectedtopeer', user);
    }
    isConnectedToUser(user){
      return this.rtcConnections[user] && this.rtcConnections[user].peerConnection.connectionState === "connected";
    }
    onrtcdisconnectedFromUser(user){
      if (!this.rtcConnections[user]){
          console.warn("Already disconnected from" + user);
          return;
      }
      console.log("Disconnected from user ", user);
      delete this.rtcConnections[user];
      this.onDisconnectedFromUser(user);
    }
    onDisconnectedFromUser(user){
      console.log("Disconnected from user ", user);
      this.emit('disconnectedfrompeer', user);
    }

    changeName(newName){
      this.name;
      const tabID = this.tabManager ? this.tabManager.getTabID() : (typeof tabID !== 'undefined' ? tabID : null);
      this.name = newName + (tabID ? ('(' + tabID + ')') : '');
      
      // Use storage adapter if available, otherwise use localStorage
      if (this.storage) {
        this.storage.setItem("name", newName);
        this.storage.setItem("rtchat_name", newName);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem("name", newName);
      }
      
      this.postPubliclyToMQTTServer("nameChange", {oldName: this.name, newName});
    }
    recordNameChange(oldName, newName){
      this.knownUsers[newName] = this.knownUsers[oldName];
      delete this.knownUsers[oldName];
      this.rtcConnections[newName] = this.rtcConnections[oldName];
      delete this.rtcConnections[oldName];
      this.onNameChange(oldName, newName);
    }
      onNameChange(oldName, newName){
          console.log(oldName + " changed name to " + newName);
      }
    //____________________________________________________________________________________________________________________
    sendOverRTC(channel, data, users){
      if (!channel){ throw new Error("No channel specified") }
      if (!this.rtcHandlers[channel]){throw new Error("Unsupported RTC channel: " + channel)}
      let handler = this.rtcHandlers[channel];
      data = data || channel;
      let serializedData = data;
      if (handler && !handler.raw){
          serializedData = (handler.serializer || JSON.stringify)(data);
      }
      for (let user of this.connectionsToUsers(users)){
          if (!this.verifyUser(channel, data, user)){
              console.warn("Not connected to " + user);
              continue;
          }else {
              const sendResult = this.rtcConnections[user].send(channel, serializedData);
              // If send returns a promise (channel not ready), handle it
              if (sendResult && typeof sendResult.then === 'function') {
                  sendResult.catch(err => {
                      console.error(`Failed to send on channel ${channel} to ${user}:`, err);
                  });
              }
          }
      }
    }
    verifyUser(channel, data, user){
      return true;
    }

    //____________________________________________________________________________________________________________________
    rtcHandlers = {
      connectedViaRTC: (data, sender) => { this.onConnectedToUser(sender); },
    }

    onrtcmessage(channel, data, sender){
      let handler = this.rtcHandlers[channel];
      let deserializedData = data;
      if (handler && !handler.raw){
          deserializedData = (handler.deserializer || JSON.parse)(data);
      }
      if (handler){
          handler(deserializedData, sender);
      }else {
          console.warn("No handler found for " + channel);
      }
      // Emit generic RTC message event
      this.emit('rtcmessage', channel, deserializedData, sender);
    }
    onrtcerror(channel, error, sender){
      let handler = this.rtcHandlers[channel];
      if (handler && handler.error){
          handler.error(error, sender);
      }
    }
  }


  class RTCConnection {
      constructor(mqttClient, target){
          // Use iceServers array if available, otherwise fall back to stunServer
          const iceServers = mqttClient.iceServers || 
            (mqttClient.stunServer ? [{ urls: mqttClient.stunServer }] : 
             [{ urls: "stun:stun4.l.google.com:19302" }]);
          
          this.rtcConfiguration = { 
            iceServers: iceServers,
            iceTransportPolicy: mqttClient.config?.getConfig()?.webrtc?.iceTransportPolicy || 'all',
            bundlePolicy: mqttClient.config?.getConfig()?.webrtc?.bundlePolicy || 'balanced',
            rtcpMuxPolicy: mqttClient.config?.getConfig()?.webrtc?.rtcpMuxPolicy || 'require'
          };
          this.target = target;
          this.mqttClient = mqttClient;
          this.dataChannels = {};
          this.createdAt = Date.now(); // Track when connection was created
          this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);
          this.peerConnection.onicecandidate = this.onicecandidate.bind(this);

          this.startCall = this.startCall.bind(this);
          this.onTrack = this.onTrack.bind(this);
          this.sentOffer = false;

          this.streamChannels = ["streamice", "streamoffer", "streamanswer", "endcall"];

          this.dataChannelDeferredPromises = Object.fromEntries(Object.entries(mqttClient.rtcHandlers).map(([name, handler]) => [name, new DeferredPromise()]));
          this.streamChannels.forEach(channel => this.dataChannelDeferredPromises[channel] = new DeferredPromise());

          this.loadPromise = Promise.all(Object.values(this.dataChannelDeferredPromises).map((deferredPromise) => deferredPromise.promise));
          this.loaded = false;
          this.loadPromise.then((() => {this.loaded = true;}).bind(this));

          this.peerConnection.ondatachannel = ((event) => {
              this.registerDataChannel(event.channel);
          }).bind(this);
          this.peerConnection.oniceconnectionstatechange = (function() {
              if (this.peerConnection.iceConnectionState === 'disconnected' ||
                  this.peerConnection.iceConnectionState === 'failed' ||
                  this.peerConnection.iceConnectionState === 'closed') {
                  this.mqttClient.onDisconnectedFromUser(this.target);
              }
          }).bind(this);

          this.pendingStreamIceCandidate = null;
          this.streamConnection = null;
          this.remoteStream = null;
          this.localStream = null;
          this.sendstreamice = false;
          this.initiatedCall = false;
          this.streamConnectionPromise = new DeferredPromise();
          this.streamPromise = new DeferredPromise();
          this.callEndPromise = new DeferredPromise();
          this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};
      }
      registerDataChannel(dataChannel){
          dataChannel.onmessage = ((e) => {
              this.onmessage(e, dataChannel.label);
          }).bind(this);
          dataChannel.onerror = ((e) => {
              this.dataChannelDeferredPromises[dataChannel.label].reject(e);
              this.ondatachannelerror(e, dataChannel.label);
          }).bind(this);
          dataChannel.onopen = ((e) => {
              this.dataChannelDeferredPromises[dataChannel.label].resolve(e);
          }).bind(this);
          this.dataChannels[dataChannel.label] = dataChannel;
      }
      setupDataChannels(){
          for (let [name, dataChannelHandler] of Object.entries(this.mqttClient.rtcHandlers)){
              let dataChannel = this.peerConnection.createDataChannel(name);
              this.registerDataChannel(dataChannel);
          }
          this.streamChannels.forEach(channel => {
              let dataChannel = this.peerConnection.createDataChannel(channel);
              this.registerDataChannel(dataChannel);
          });
      }

      startCall(stream){
          this.initiatedCall = true;
          // Detect call type from stream tracks
          const hasVideo = stream.getVideoTracks().length > 0;
          const hasAudio = stream.getAudioTracks().length > 0;
          let streamInfo = {video: hasVideo, audio: hasAudio};
          this.streamConnection = this._makeStreamConnection(stream);

          this.streamConnection.createOffer()
              .then(offer => this.streamConnection.setLocalDescription(offer))
              .then(() => {
                  // Send offer via MQTT
                  this.send("streamoffer", JSON.stringify({"offer": this.streamConnection.localDescription, "streamInfo": streamInfo}));
              });

           this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};

          return this.streamPromise.promise;
      }
      _makeStreamConnection(stream){
          if (this.streamConnection){
              console.warn("Already have a stream connection");
              return;
          }
          this.localStream = stream;
          this.streamConnection = new RTCPeerConnection(this.rtcConfiguration);

          stream.getTracks().forEach(track => this.streamConnection.addTrack(track, stream));

          this.streamConnection.onicecandidate = this.onstreamicecandidate.bind(this);
          this.streamConnection.ontrack = this.onTrack;
          this.streamConnectionPromise.resolve(this.streamConnection);
          this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};
          return this.streamConnection;
      }
      onTrack(event){
          console.warn("Track event", event);
          this.remoteStream = event.streams[0];
          let d = {
              localStream: this.localStream,
              remoteStream: this.remoteStream
          };
          this.streamPromise.resolve(d);
          this.mqttClient.oncallconnected(this.target, d);
      }
      sendOffer(){
          this.setupDataChannels();
          this.peerConnection.createOffer()
            .then(offer => this.peerConnection.setLocalDescription(offer))
            .then(() => {
              // Send offer via MQTT
              console.log("Sending offer to " + this.target);
              this.mqttClient.postPubliclyToMQTTServer("RTCOffer", {userInfo: this.mqttClient.userInfo, offer: {"localDescription": this.peerConnection.localDescription, "target": this.target}});
            });
          this.sentOffer = true;
      }
      respondToOffer(offer){
          this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
                .then(() => this.peerConnection.createAnswer())
                .then(answer => this.peerConnection.setLocalDescription(answer))
                .then((answer) => {
                  // Send answer via MQTT
                  this.mqttClient.postPubliclyToMQTTServer("RTCAnswer", {
                      "localDescription": this.peerConnection.localDescription,
                      "target": this.target,
                  });
                });
      }
      receiveAnswer(answer){
          if (this.peerConnection.signalingState !== 'have-local-offer') {
              // This can happen if answer arrives after connection is established or out of order
              // It's not necessarily an error, just means we can't process this answer
              if (this.peerConnection.signalingState !== 'stable') {
                  // Only warn if it's an unexpected state (not just "stable" which is normal)
                  console.warn("Received answer in unexpected signaling state: " + this.peerConnection.signalingState);
              }
              return;
          }
          this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          // Wait for all data channels to be ready before notifying connection
          this.loadPromise.then((() => {
              this.send("connectedViaRTC", null);
              this.mqttClient.onConnectedToUser(this.target);
          }).bind(this));
      }
      send(channel, serializedData){
          let dataChannel = this.dataChannels[channel];
          if (!dataChannel){
              if (this.mqttClient.rtcHandlers[channel]){
                  console.warn("handler found for ", channel, "but no data channel");
              }
              throw new Error("No data channel for " + channel);
          }
          
          // If channel is not open, wait for it to open
          if (dataChannel.readyState !== "open"){
              if (dataChannel.readyState === "closed") {
                  throw new Error("Channel closed: " + channel);
              }
              // Channel is connecting, wait for it to open
              return new Promise((resolve, reject) => {
                  const timeout = setTimeout(() => {
                      reject(new Error(`Channel ${channel} did not open within 10 seconds`));
                  }, 10000);
                  
                  const onOpen = () => {
                      clearTimeout(timeout);
                      dataChannel.removeEventListener('open', onOpen);
                      dataChannel.removeEventListener('error', onError);
                      try {
                          dataChannel.send(serializedData);
                          resolve();
                      } catch (e) {
                          reject(e);
                      }
                  };
                  
                  const onError = (e) => {
                      clearTimeout(timeout);
                      dataChannel.removeEventListener('open', onOpen);
                      dataChannel.removeEventListener('error', onError);
                      reject(new Error(`Channel ${channel} error: ${e.message || e}`));
                  };
                  
                  dataChannel.addEventListener('open', onOpen);
                  dataChannel.addEventListener('error', onError);
              });
          }
          
          dataChannel.send(serializedData);
      }
      onmessage(event, channel){
          if (channel === "streamoffer"){
              console.log("received stream offer", event.data);
              let {offer, streamInfo} = JSON.parse(event.data);
              // Use streamInfo from the offer if available, otherwise default to video+audio
              const callInfo = streamInfo || {video: true, audio: true};
              this.mqttClient.callFromUser(this.target, callInfo, this.initiatedCall, this.callPromises).then(stream => {
                  if (!this.streamConnection){
                      this.streamConnection = this._makeStreamConnection(stream);
                  }
                  return this.streamConnection;
              }).catch(e => {
                  // If call was rejected, properly end the call
                  if (e === "Call rejected" || (typeof e === 'string' && e.includes('rejected'))) {
                      console.log(`Call rejected by ${this.target}, ending call`);
                      // End the call properly
                      this.endCall();
                  }
                  this.streamConnectionPromise.reject(e);
                  this.streamPromise.reject(e);
              }).then(streamConnection => {
                  streamConnection.setRemoteDescription(new RTCSessionDescription(offer))
                      .then(() => this.streamConnection.createAnswer())
                      .then(answer => this.streamConnection.setLocalDescription(answer))
                      .then(() => {
                          // Send answer via MQTT
                          console.log("Sending stream answer", this.streamConnection.localDescription);
                          this.send("streamanswer", JSON.stringify({"answer": this.streamConnection.localDescription}));
                          if (this.pendingStreamIceCandidate){
                              console.log("Found pending stream ice candidate");
                              this.streamConnection.addIceCandidate(new RTCIceCandidate(this.pendingStreamIceCandidate));
                              this.pendingStreamIceCandidate = null;
                          }
                      });
              });

          }else if (channel === "streamanswer"){
              console.log("received stream answer", event.data);
              let {answer} = JSON.parse(event.data);
              this.streamConnection.setRemoteDescription(new RTCSessionDescription(answer));
          }else if (channel === "streamice"){
              console.log("received stream ice", event.data);
              if (event.data){
                  if (this.streamConnection){
                      this.streamConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(event.data)));
                  }else {
                      this.pendingStreamIceCandidate = JSON.parse(event.data);
                  }
              }
          }else if (channel === "endcall"){
              this._closeCall();
          }else {
              this.mqttClient.onrtcmessage(channel, event.data, this.target);
          }
      }
      endCall(){
          this.send("endcall", null);
          this._closeCall();
      }
      _closeCall(){
          if (this.streamConnection){
              this.streamConnection.close();
              this.localStream.getTracks().forEach(track => track.stop());
              this.remoteStream.getTracks().forEach(track => track.stop());
              this.remoteStream = null;
              this.localStream = null;
          }
          this.callEndPromise.resolve();
          this.callEndPromise = new DeferredPromise();
          this.callRinging = false;
          this.initiatedCall = false;
          this.streamConnection = null;
          this.pendingStreamIceCandidate = null;
          this.streamConnectionPromise = new DeferredPromise();
          this.streamPromise = new DeferredPromise();
          this.callEndPromise = new DeferredPromise();
          this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};

          this.mqttClient.oncallended(this.target);
      }

      onReceivedIceCandidate(data) {
          this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }

      onicecandidate(event){
  //        if (event.candidate && !this.sentice) {
  //            this.sentice = true;
              // Send ICE candidate via MQTT
              this.mqttClient.postPubliclyToMQTTServer("RTCIceCandidate", event.candidate);
  //        }
      }
      onstreamicecandidate(event){
          if (event.candidate) {
              // Send ICE candidate via RTC
              // Reduced logging - ICE candidates are sent very frequently during connection setup
              // console.log("Sending stream ice", this, event.candidate);
              this.send("streamice", JSON.stringify(event.candidate));
          }
      }
      ondatachannel(event){
          let dataChannel = event.channel;
          this.dataChannels[event.name] = dataChannel;
          dataChannel.onmessage = this.onmessage.bind(this);
      }
      ondatachannelerror(error, channelName){
          this.mqttClient.onrtcerror(channelName, error, this.target);
      }

      close(){
          if (this.closed){return}
          this.peerConnection.close();
          this.closed = true;
          this.peerConnection = null;
          this.mqttClient.onrtcdisconnectedFromUser(this.target);
      }
  }


  class PromisefulMQTTRTCClient extends BaseMQTTRTCClient {
      constructor(config){
      config = config || {};
      let {name, userInfo, questionHandlers, handlers, load} = config;
      if (load === undefined){
          load = true;
      }

      config.load = false;
      // initialize state tracking variables
      super(config);

      Object.assign(this.rtcHandlers, this.extraRTCHandlers);
      Object.assign(this.rtcHandlers, handlers || {});
      for (let [k, v] of Object.entries(this.rtcHandlers)){
          this.rtcHandlers[k] = v.bind(this);
      }

      if (questionHandlers){
          this.questionHandlers = questionHandlers;
      }else if (!this.questionHandlers){
          this.questionHandlers = {};
      }
      this.questionPromises = {};
      this.latestPings = {};
      this.questionNumber = 0;

      this.mqttConnected = new DeferredPromise();
      this.nextUserConnection = new DeferredPromise();
      this.nextUserDisconnectionPromises = {};
      this.nextDMPromises = {};
      this.nextChatPromises = {};
      this.nextQuestionPromises = {};
      this.nextAnswerPromises = {};
      this.nextPingPromises = {};
      this.nextPongPromises = {};
      this.nextMQTTMessagePromises = {};


      this.onConnectedToMQTT = this.onConnectedToMQTT.bind(this);
      this.sendRTCDM = this.sendRTCDM.bind(this);
      this.onRTCDM = this.onRTCDM.bind(this);
      this.sendRTCChat = this.sendRTCChat.bind(this);
      this.onRTCChat = this.onRTCChat.bind(this);
      this.onConnectedToUser = this.onConnectedToUser.bind(this);
      this.onDisconnectedFromUser = this.onDisconnectedFromUser.bind(this);
      this.sendRTCQuestion = this.sendRTCQuestion.bind(this);
      this.onRTCQuestion = this.onRTCQuestion.bind(this);
      this.respondToQuestion = this.respondToQuestion.bind(this);
      this.onRTCAnswer = this.onRTCAnswer.bind(this);
      this.pingEveryone = this.pingEveryone.bind(this);
      this.ping = this.ping.bind(this);
      this.receivedPing = this.receivedPing.bind(this);
      this.receivedPong = this.receivedPong.bind(this);

      this.nextUserDisconnection = this.nextUserDisconnection.bind(this);
      this.nextMQTTMessage = this.nextMQTTMessage.bind(this);
      this.nextAnswer = this.nextAnswer.bind(this);
      this.nextQuestion = this.nextQuestion.bind(this);
      this.nextChat = this.nextChat.bind(this);
      this.nextDM = this.nextDM.bind(this);
      this.nextPing = this.nextPing.bind(this);
      this.nextPong = this.nextPong.bind(this);

      this.addQuestionHandler = this.addQuestionHandler.bind(this);

      if (load){
          this.load();
      }
    }
    addQuestionHandler(name, handler){
          this.questionHandlers[name] = handler;
    }

    extraRTCHandlers = {
      dm: (data, sender) => {
          this.onRTCDM(data, sender);
          if (this.nextDMPromises["anyone"]){
              this.nextDMPromises["anyone"].resolve([data, sender]);
              delete this.nextDMPromises["anyone"];
          }
          if (this.nextDMPromises[sender]){
              this.nextDMPromises[sender].resolve(data);
              delete this.nextDMPromises[sender];
          }
      },
      chat: (data, sender) => {
          this.onRTCChat(data, sender);
          if (this.nextChatPromises["anyone"]){
              this.nextChatPromises["anyone"].resolve([data, sender]);
              delete this.nextChatPromises["anyone"];
          }
          if (this.nextChatPromises[sender]){
              this.nextChatPromises[sender].resolve(data);
              delete this.nextChatPromises[sender];
          }
      },
      question: (data, sender) => {
          this.onRTCQuestion(data, sender);
          if (this.nextQuestionPromises["anyone"]){
              this.nextQuestionPromises["anyone"].resolve([data, sender]);
              delete this.nextQuestionPromises["anyone"];
          }
          if (this.nextQuestionPromises[sender]){
              this.nextQuestionPromises[sender].resolve(data);
              delete this.nextQuestionPromises[sender];
          }

      },
      answer: (data, sender) => {
          this.onRTCAnswer(data, sender);
          if (this.nextAnswerPromises["anyone"]){
              this.nextAnswerPromises["anyone"].resolve([data, sender]);
              delete this.nextAnswerPromises["anyone"];
          }
          if (this.nextAnswerPromises[sender]){
              this.nextAnswerPromises[sender].resolve(data);
              delete this.nextAnswerPromises[sender];
          }
      },
      ping: (data, sender) => {
          this.sendOverRTC("pong", null, sender);
          this.receivedPing(sender);
          if (this.nextPingPromises["anyone"]){
              this.nextPingPromises["anyone"].resolve([data, sender]);
              delete this.nextPingPromises["anyone"];
          }
          if (this.nextPingPromises[sender]){
              this.nextPingPromises[sender].resolve(data);
              delete this.nextPingPromises[sender];
          }
      },
      pong: (data, sender) => {
          this.latestPings[sender].resolve();
          this.receivedPong(sender);
          if (this.nextPongPromises["anyone"]){
              this.nextPongPromises["anyone"].resolve([data, sender]);
              delete this.nextPongPromises["anyone"];
          }
          if (this.nextPongPromises[sender]){
              this.nextPongPromises[sender].resolve(data);
              delete this.nextPongPromises[sender];
          }
      },
    }

    onConnectedToMQTT(){
      this.mqttConnected.resolve();
      console.log("Connected to MQTT");
    }
    postPubliclyToMQTTServer(subtopic, data){
      super.postPubliclyToMQTTServer(subtopic, data);
    }
    onMQTTMessage(subtopic, data, sender, timestamp){
      console.log("Received message from " + sender + " on " + subtopic, data);
      if (this.nextMQTTMessagePromises["anysubtopic"]){
          this.nextMQTTMessagePromises["anysubtopic"].resolve([data, sender, timestamp]);
          delete this.nextMQTTMessagePromises["anysubtopic"];
      }
      if (this.nextMQTTMessagePromises[subtopic]){
          this.nextMQTTMessagePromises[subtopic].resolve([data, sender, timestamp]);
          delete this.nextMQTTMessagePromises[subtopic];
      }
      // Call parent to emit event
      super.onMQTTMessage(subtopic, data, sender, timestamp);
    }

   //__________________________________________________ RTC ______________________________________________________________
    onConnectedToUser(user){
      console.log("Connected to user ", user);
      this.nextUserConnection.resolve(user);
      this.nextUserConnection = new DeferredPromise();
    }
    onDisconnectedFromUser(user){
      console.log("Disconnected from user ", user);
      this.nextUserDisconnection.resolve(user);
      if (this.nextUserDisconnectionPromises["anyone"]){
          this.nextUserDisconnectionPromises["anyone"].resolve(user);
          delete this.nextUserDisconnectionPromises["anyone"];
      }
      if (this.nextUserDisconnectionPromises[user]){
          this.nextUserDisconnectionPromises[user].resolve(user);
          delete this.nextUserDisconnectionPromises[user];
      }
    }

    sendRTCDM(message, target){
      this.sendOverRTC("dm", message, target);
    }
    onRTCDM(message, sender){
      console.log("Received DM from " + sender, message);
    }
    nextDM(target='anyone'){
      this.nextDMPromises[target] = new DeferredPromise();
      return this.nextDMPromises[target].promise;
    }
    nextChat(target='anyone'){
      this.nextChatPromises[target] = new DeferredPromise();
      return this.nextChatPromises[target].promise;
    }
    nextQuestion(target='anyone'){
      this.nextQuestionPromises[target] = new DeferredPromise();
      return this.nextQuestionPromises[target].promise;
    }
      nextAnswer(target='anyone'){
          this.nextAnswerPromises[target] = new DeferredPromise();
          return this.nextAnswerPromises[target].promise;
      }
      nextPing(target='anyone'){
          this.nextPingPromises[target] = new DeferredPromise();
          return this.nextPingPromises[target].promise;
      }
      nextPong(target='anyone'){
          this.nextPongPromises[target] = new DeferredPromise();
          return this.nextPongPromises[target].promise;
      }
      nextUserDisconnection(target='anyone'){
          this.nextUserDisconnectionPromises[target] = new DeferredPromise();
          return this.nextUserDisconnectionPromises[target].promise;
      }
      nextMQTTMessage(subtopic='anysubtopic'){
          this.nextMQTTMessagePromises[subtopic] = new DeferredPromise();
          return this.nextMQTTMessagePromises[subtopic].promise;
      }


    sendRTCChat(message){
      this.sendOverRTC("chat", message);
    }
    onRTCChat(message, sender){
      console.log("Received chat from " + sender, message);
    }
    sendRTCQuestion(topic, content, target){
      let question = {topic, content};
      let n = this.questionNumber;
      this.questionNumber++;
      let p = new DeferredPromise();
      this.questionPromises[n] = p;
      let data = {n, question};
      this.sendOverRTC("question", data, target);
      return p.promise;
    }
    onRTCQuestion(data, sender){
      let {n, question} = data;
      let answer = this.respondToQuestion(question, sender);
      if (answer instanceof Promise){
          answer.then((a) => {
              this.sendOverRTC("answer", {n, answer: a, question}, sender);
          });
      }else {
          this.sendOverRTC("answer", {n, answer, question}, sender);
      }
    }
    respondToQuestion(question, sender){
      let {topic, content} = question;
      if (this.questionHandlers[topic]){
          return this.questionHandlers[topic](content, sender);
      }else {
          console.warn("No handler found for question " + topic);
          throw new Error("No handler found for question " + topic);
      }
    }
    onRTCAnswer(data, sender){
      let {n, answer} = data;
      if (this.questionPromises[n]){
          this.questionPromises[n].resolve(answer);
          delete this.questionPromises[n];
      }else {
          console.warn("No promise found for question " + n);
      }
    }
    pingEveryone(){
      this.latestPings = {};
      for (let user of this.connectedUsers){
          this.ping(user);
      }
      return Promise.all(Object.values(this.latestPings).map((p) => p.promise));
    }
    ping(user){
      this.latestPings[user] = new DeferredPromise();
      this.sendOverRTC("ping", "ping", users);
      return this.latestPings[user].promise;
    }
    receivedPing(sender){
      console.log("Received ping from " + sender);
    }
    receivedPong(sender){
      console.log("Received pong from " + sender);
    }



  }

  class MQTTRTCClient extends PromisefulMQTTRTCClient {
      constructor(config){
          config = config || {};
          let {name, userInfo, questionHandlers, handlers, load} = config;
          // this.knownUsers = {name: userInfo, ...} of all users, even those we're not connected to
          // this.rtcConnections = {name: rtcConnection, ...} of active connections
          // this.connectedUsers = [name, ...] of all users we're connected to
          if (load === undefined){
              load = true;
          }
          config.load = false;
          super(config);
          

          if (load){
              this.load();
          }

      }
      on(rtcevent, handler){
          // Use EventEmitter for standard events, but handle special cases
          if (rtcevent === "connectionrequest"){
              // Special case: connectionrequest sets shouldConnectToUser
              this.shouldConnectToUser = handler.bind(this);
              // Also register as event listener for consistency
              return super.on(rtcevent, handler);
          }else if (rtcevent === "call"){
              // Special case: call sets acceptCallFromUser
              this.acceptCallFromUser = handler.bind(this);
              // Also register as event listener
              return super.on(rtcevent, handler);
          }else if (rtcevent === "callended"){
              // Special case: callended sets oncallended
              this.oncallended = handler.bind(this);
              // Also register as event listener
              return super.on(rtcevent, handler);
          }else if (rtcevent === "question"){
              // Question handlers are registered via addQuestionHandler
              this.addQuestionHandler(rtcevent, handler);
              // Also emit events for consistency
              return super.on(rtcevent, handler);
          }else {
              // All other events use EventEmitter
              return super.on(rtcevent, handler);
          }
      }

      shouldConnectToUser(user, userInfo){
          return super.shouldConnectToUser(user, userInfo);
        }

      changeName(newName){
          super.changeName(newName);
      }
      onNameChange(oldName, newName){
          super.onNameChange(oldName, newName);
          this.emit('namechange', oldName, newName);
      }

      onConnectedToMQTT(){
          console.log("Connected to MQTT");
          this.emit('mqttconnected');
      }
      onConnectedToUser(user){
          console.log("Connected to user ", user);
          this.emit('connectedtopeer', user);
      }
      onDisconnectedFromUser(user){
          console.log("Disconnected from user ", user);
          this.emit('disconnectedfrompeer', user);
      }
      onRTCDM(data, sender){
          this.emit('dm', data, sender);
      }
      onRTCChat(data, sender){
          this.emit('chat', data, sender);
      }
      addQuestionHandler(name, handler){
          super.addQuestionHandler(name, handler);
      }
      oncallconnected(sender, {localStream, remoteStream}){
          this.emit('callconnected', sender, {localStream, remoteStream});
      }

      pingEveryone(){
          let start = Date.now();
          return super.pingEveryone().then(() => {
              console.log("Pinged everyone in " + (Date.now() - start) + "ms");
          });
      }
      ping(user){
          // time the ping
          let start = Date.now();
          return super.ping(user).then(() => {
              console.log("Pinged " + user + " in " + (Date.now() - start) + "ms");
          });
      }
      receivedPing(sender){
          this.emit('ping', sender);
      }

      // nextUserConnection is a promise that resolves when the client connects to a new user
      get nextDMPromise() {return this.nextDM();}
      get nextChatPromise() {return this.nextChat();}
      get nextQuestionPromise() {return this.nextQuestion();}
      get nextAnswerPromise() {return this.nextAnswer();}
      get nextPingPromise() {return this.nextPing();}
      get nextPongPromise() {return this.nextPong();}
      get nextUserDisconnectionPromise() {return this.nextUserDisconnection();}

      get connectedUsers(){
          return this.connectionsToUsers();
      }

      disconnectFromUser(user){
          super.disconnectFromUser(user);
          return this.nextUserDisconnection(user);
      }

      getPeer(user){
          return new Peer(this, user);
      }
      get peers(){
          return Object.fromEntries(Object.entries(this.connectedUsers).map(name => [name, new Peer(this, name)]));
      }
      get peerList(){
          return Object.values(this.peers);
      }
      send(data, channel = 'chat', users){
          return super.sendOverRTC(channel, data, users);
      }
  }

  class Peer{
      constructor(mqttclient, name){
          this.mqttClient = mqttclient;
          this.target = name;
      }
      dm(message){
          return this.mqttClient.sendRTCDM(message, this.target);
      }
      chat(message){
          return this.mqttClient.sendRTCChat(message);
      }
      ask(question){
          return this.mqttClient.sendRTCQuestion(question, this.target);
      }
      ping(){
          return this.mqttClient.ping(this.target);
      }

  }

  /**
   * Keys - Cryptographic key management for identity verification
   * 
   * Manages RSA-PSS key pairs for signing and verification.
   * Handles key generation, storage, and challenge/response operations.
   * 
   * @param {string} name - The name associated with these keys
   * @param {boolean|'force'} generate - Whether to generate new keys if none exist. 'force' will always generate.
   * @param {Object} dependencies - Injected dependencies
   * @param {StorageAdapter} [dependencies.storage] - Storage adapter for key persistence. Falls back to localStorage if available.
   * @param {Crypto} [dependencies.crypto] - Web Crypto API instance. Falls back to window.crypto if available.
   */

  class Keys {
    algorithm = {
      name: "RSA-PSS",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: {name: "SHA-256"},
    }
    extractable = true;
    keyUsages = ["sign", "verify"];

    constructor(name, generate=true, { storage = null, crypto = null } = {}) {
      this._name = null;
      this.name = name;
      
      // Use storage adapter if provided, otherwise fall back to localStorage
      this.storage = storage || (typeof localStorage !== 'undefined' ? {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: (key) => localStorage.removeItem(key)
      } : null);
      
      // Use crypto if provided, otherwise fall back to window.crypto
      this.crypto = crypto || (typeof window !== 'undefined' && window.crypto ? window.crypto : null);
      
      if (!this.crypto || !this.crypto.subtle) {
        throw new Error("Web Crypto API not available. Please provide a crypto instance via constructor.");
      }

      this._loadKeys = this._loadKeys.bind(this);
      this.load = this.load.bind(this);
      this.generate = this.generate.bind(this);
      this._dumpKey = this._dumpKey.bind(this);
      this._loadPrivateKey = this._loadPrivateKey.bind(this);
      this._loadPublicKey = this._loadPublicKey.bind(this);
      this.sign = this.sign.bind(this);
      this.getChallengeString = this.getChallengeString.bind(this);
      this.verify = this.verify.bind(this);
      this.savePublicKey = this.savePublicKey.bind(this);
      this.savePublicKeyString = this.savePublicKeyString.bind(this);
      this.getPublicKey = this.getPublicKey.bind(this);
      this.clearOwnKeys = this.clearOwnKeys.bind(this);
      this.clearKnownHosts = this.clearKnownHosts.bind(this);
      this.getPeerNames = this.getPeerNames.bind(this);
      this.reset = this.reset.bind(this);

      this.loadedPromise = this.load(generate);
    }
    
    load(generate=true) {
      this.loading = true;
      this.loaded = false;
      this.loadedPromise = this._loadKeys(generate).then((keys) => {
        if (!this.storage) {
          this._knownHostsStrings = {};
          this._knownHostsKeys = {};
        } else {
          this._knownHostsStrings = JSON.parse(this.storage.getItem("knownHostsStrings") || "{}");
          for (let [name, key] of Object.entries(this._knownHostsStrings)) {
            if (name.startsWith("anon")){
              delete this._knownHostsStrings[name];
            }
          }
          this._knownHostsKeys = {};
        }
        
        this._privateKey = keys.privateKey;
        this._publicKey = keys.publicKey;
        this._privateKeyString = keys.privateKeyString;
        this.publicKeyString = keys.publicKeyString;
        
        if (this.storage) {
          this.storage.setItem("privateKeyString", this._privateKeyString);
          this.storage.setItem("publicKeyString", this.publicKeyString);
        }
        
        this.loaded = true;
        this.loading = false;
        return this.publicKeyString;
      });
      return this.loadedPromise;
    }
    
    _loadKeys(generate=true) {
      if (!this.storage) {
        if (!generate) {
          throw new Error("No storage available and generate is false");
        }
        return this.generate();
      }
      
      let privateKeyString = this.storage.getItem("privateKeyString");
      let publicKeyString = this.storage.getItem("publicKeyString");
      if (generate !== 'force' && publicKeyString && privateKeyString) {
        return this._loadPrivateKey(privateKeyString).then((privateKey) => {
          return this._loadPublicKey(publicKeyString).then((publicKey) => {
            return {privateKey, publicKey, privateKeyString, publicKeyString};
          });
        })
      }
      if (!generate) {
        throw new Error("No keys found and generate is false");
      }
      return this.generate()
    }
    
    generate(){
      return this.crypto.subtle.generateKey(
        this.algorithm, this.extractable, this.keyUsages
      ).then((keys) => {
        return this._dumpKey(keys.privateKey).then(privateKeyString => {
          keys.privateKeyString = privateKeyString;
          return this._dumpKey(keys.publicKey).then(publicKeyString => {
            keys.publicKeyString = publicKeyString;
            return keys;
          });
        });
      });
    }
    
    _dumpKey(key){
      return this.crypto.subtle.exportKey("jwk", key).then(JSON.stringify);
    }
    
    _loadPrivateKey(key){
      return this.crypto.subtle.importKey("jwk", JSON.parse(key), this.algorithm, this.extractable, ["sign"])
    }
    
    _loadPublicKey(key){
      return this.crypto.subtle.importKey("jwk", JSON.parse(key), this.algorithm, this.extractable, ["verify"])
    }
    
    getChallengeString() {
      return Array.from(this.crypto.getRandomValues(new Uint8Array(32))).map(b => String.fromCharCode(b)).join('');
    }
    
    sign(challenge) {
      if (this.loading && !this._loaded) {
        return this.loadedPromise.then(() => this.sign(challenge));
      }
      return this.crypto.subtle.sign(
        {
          name: "RSA-PSS",
          saltLength: 32,
        },
        this._privateKey,
        new Uint8Array(challenge.split('').map((c) => c.charCodeAt(0))).buffer
      ).then((signature) => {
        return String.fromCharCode.apply(null, new Uint8Array(signature));
      });
    }
    
    verify(publicKeyString, signatureString, challenge) {
      return this._loadPublicKey(publicKeyString).then((publicKey) => {
        return this.crypto.subtle.verify(
          {
            name: "RSA-PSS",
            saltLength: 32,
          },
          publicKey,
          new Uint8Array(signatureString.split('').map((c) => c.charCodeAt(0))).buffer,
          new Uint8Array(challenge.split('').map((c) => c.charCodeAt(0))).buffer
        );
      });
    }
    
    getPeerNames(publicKeyString) {
      let matchingPeers = [];
      if (!this._knownHostsStrings) return matchingPeers;
      for (let [name, key] of Object.entries(this._knownHostsStrings)) {
        if (key === publicKeyString) {
          matchingPeers.push(name);
        }
      }
      return matchingPeers;
    }
    
    savePublicKey(peerName, publicKey) {
      peerName = peerName.split("|")[0].split("(")[0].trim();
      if (publicKey instanceof CryptoKey) {
        return this._dumpKey(publicKey).then((publicKeyString) => {
          this.savePublicKey(peerName, publicKeyString);
          this._knownHostsKeys[peerName] = publicKey;
          return true;
        });
      }else {
        return this.savePublicKeyString(peerName, publicKey);
      }
    }
    
    savePublicKeyString(peerName, publicKeyString) {
      peerName = peerName.split("|")[0].split("(")[0].trim();
      let matchingPeers = this.getPeerNames(publicKeyString);
      if (matchingPeers.length > 0) {
        // If the public key is already registered to this peer name, allow updating
        if (matchingPeers.includes(peerName)) {
          // Same peer, same key - no change needed, but update anyway to be safe
          this._knownHostsStrings[peerName] = publicKeyString;
          if (this.storage) {
            this.storage.setItem("knownHostsStrings", JSON.stringify(this._knownHostsStrings));
          }
          return true;
        }
        // Public key is registered to a different peer name
        console.error("Public key already registered for another peer", matchingPeers);
        throw new Error("Public key already registered for another peer");
      }
      this._knownHostsStrings[peerName] = publicKeyString;
      if (this.storage) {
        this.storage.setItem("knownHostsStrings", JSON.stringify(this._knownHostsStrings));
      }
      return true;
    }

    getPublicKey(peerName) {
      peerName = peerName.split("|")[0].split("(")[0].trim();
      let publicKey = this._knownHostsKeys?.[peerName];
      if (publicKey) { return Promise.resolve(publicKey); }
      let publicKeyString = this._knownHostsStrings?.[peerName];
      if (publicKeyString) {
        return this._loadPublicKey(publicKeyString).then((publicKey) => {
          if (!this._knownHostsKeys) this._knownHostsKeys = {};
          this._knownHostsKeys[peerName] = publicKey;
          return publicKey;
        });
      }
      return Promise.resolve(null);
    }
    
    getPublicKeyString(peerName) {
      peerName = peerName.split("|")[0].split("(")[0].trim();
      return this._knownHostsStrings?.[peerName] || null;
    }
    
    removePublicKey(peerName) {
      peerName = peerName.split("|")[0].split("(")[0].trim();
      if (this._knownHostsStrings) {
        delete this._knownHostsStrings[peerName];
      }
      if (this._knownHostsKeys) {
        delete this._knownHostsKeys[peerName];
      }
      if (this.storage) {
        this.storage.setItem("knownHostsStrings", JSON.stringify(this._knownHostsStrings || {}));
      }
    }

    get knownHosts() {
      if (!this._knownHostsStrings) return [];
      return Object.entries(this._knownHostsStrings).map(([name, key]) => {
        return name + "|" + key;
      });
    }
    
    clearOwnKeys() {
      if (this.storage) {
        this.storage.removeItem("privateKeyString");
        this.storage.removeItem("publicKeyString");
      }
      this._privateKey = null;
      this._publicKey = null;
      this._privateKeyString = null;
      this.publicKeyString = null;
    }
    
    clearKnownHosts() {
      if (this.storage) {
        this.storage.removeItem("knownHostsStrings");
      }
      this._knownHostsKeys = {};
      this._knownHostsStrings = {};
    }

    reset(){
      this.clearOwnKeys();
      this.clearKnownHosts();
    }

    get name(){return this._name}
    set name(name) {
      if (name.includes("|")) {
        throw new Error("Name cannot contain |");
      }
      this._name = name;
    }

    get identity() {
      if (!this.loaded){return null}
      let name = this.name.split("|")[0].split("(")[0].trim();
      return name + "|" + this.publicKeyString;
    }

    register(identity) {
      let [peerName, publicKeyString] = identity.split("|");
      return this.savePublicKeyString(peerName, publicKeyString);
    }
  }

  /**
   * Signed MQTT-RTC Client - Secure peer-to-peer communication with identity verification
   * 
   * Extends MQTTRTCClient with cryptographic identity verification using RSA-PSS keys.
   * Implements a challenge/response system to verify peer identities and prevent impersonation.
   * 
   * Usage:
   *   import { SignedMQTTRTCClient } from './signed-mqtt-rtc.js';
   *   
   *   const client = new SignedMQTTRTCClient({
   *     name: 'MyName',
   *     trustMode: 'moderate',  // Trust configuration
   *     generate: true          // Generate new keys if none exist
   *   });
   * 
   *   client.on('validation', (peerName, trusted) => {
   *     console.log(`Peer ${peerName} validated, trusted: ${trusted}`);
   *   });
   * 
   *   client.on('validationfailure', (peerName, message) => {
   *     console.error(`Validation failed for ${peerName}: ${message}`);
   *   });
   * 
   * Identity System:
   * - Each client generates an RSA-PSS key pair (2048-bit)
   * - Public keys are stored in localStorage (knownHostsStrings)
   * - Private keys are stored encrypted in localStorage
   * - Identity = name + "|" + publicKeyString
   * 
   * Trust Levels:
   * - reject: Do not connect
   * - promptandtrust: Prompt user, then trust if challenge passes
   * - connectandprompt: Connect first, then prompt to trust
   * - connectandtrust: Connect and automatically trust
   * 
   * Trust Modes (pre-configured trust level mappings):
   * - strict: Only auto-trust "the one and only" known peers
   * - moderate: Trust known peers and aliases, prompt for others
   * - lax: Trust most cases, prompt only for suspicious ones
   * - unsafe: Trust everyone (not recommended)
   * - rejectall: Reject all connections
   * 
   * User Categories (automatic detection):
   * - theoneandonly: Known key and name match perfectly
   * - knownwithknownaliases: Known key, but also known by other names
   * - possiblenamechange: Known key, but different name
   * - possiblesharedpubkey: Known key with multiple other names
   * - nameswapcollision: Suspicious name/key mismatch
   * - pretender: Unknown key using a known name
   * - nevermet: Completely new peer
   * 
   * Challenge/Response Flow:
   * 1. When connecting, peers exchange public keys via MQTT
   * 2. After WebRTC connection, challenge is sent via RTC
   * 3. Peer signs challenge with private key
   * 4. Signature is verified using stored public key
   * 5. If valid, peer is added to validatedPeers list
   * 
   * Methods:
   * - trust(peerName): Trust a peer and save their public key
   * - challenge(peerName): Challenge a peer to prove identity
   * - untrust(peerName): Remove trust and disconnect
   * - register(identity): Register a peer's identity (name|publicKey)
   * - reset(): Clear all keys and known hosts
   * 
   * @module signed-mqtt-rtc
   */


  let trustLevels = {
      reject: 0, // do not even connect
      promptandtrust: 1, // prompt whether to connect and then trust (assuming they pass the challenge)
      connectandprompt: 2, // connect and then prompt whether to trust
      connectandtrust: 3 // connect and trust
  };

  let suspicionLevels = {
          trusted: 0,
          nonsuspicious: 1,
          slightlyodd: 2,
          odd: 3,
          veryodd: 4
      };

  class SignedMQTTRTCClient extends MQTTRTCClient {
      constructor(userConfig) {
          userConfig = userConfig || {};
          
          // Extract config values
          const config = userConfig instanceof RTCConfig ? userConfig : new RTCConfig(userConfig);
          const configObj = config.getConfig();
          const generate = userConfig.generate !== false;
          const load = configObj.load !== false;
          const trustMode = userConfig.trustMode || configObj.trustMode || "strict";
          const name = config.name;
          const autoAcceptConnections = configObj.connection?.autoAcceptConnections ?? false;

          // Prepare config for parent (don't pass load flag, we'll handle it)
          super({ ...userConfig, load: false });
          
          // Get name from config or use the one we extracted
          const finalName = name || (this.name ? this.name.split('(')[0] : 'User');
          
          // Initialize keys with storage adapter and crypto from config
          const storage = this.storage || (typeof localStorage !== 'undefined' ? {
            getItem: (key) => localStorage.getItem(key),
            setItem: (key, value) => localStorage.setItem(key, value),
            removeItem: (key) => localStorage.removeItem(key)
          } : null);
          
          // Get crypto from config
          const crypto = configObj.crypto || (typeof window !== 'undefined' && window.crypto ? window.crypto : null);
          
          this.keys = new Keys(finalName, generate, { storage, crypto });
          this.validatedPeers = [];

          // Set up trust configuration
          if (trustMode === undefined) {trustMode = "strict";}
          if (this.trustConfigs[trustMode]){
              this.trustConfig = this.trustConfigs[trustMode];
          }else {
              this.trustConfig = trustMode;
          }
          if (!this.trustConfig || Object.keys(this.userCategories).map((category) => this.trustConfig[category]).some((level) => level === undefined)){
              throw new Error("Invalid trust mode");
          }
          this.completeUserInfo = {};

          this.shouldConnectToUser = this.shouldConnectToUser.bind(this);
          this.checkTrust = this.checkTrust.bind(this);
          this._getFullUserInfo = this._getFullUserInfo.bind(this);

          this.trust = this.trust.bind(this);
          this.register = this.register.bind(this);
          this.challenge = this.challenge.bind(this);
          this.untrust = this.untrust.bind(this);
          
          // Store auto-accept setting
          this.autoAcceptConnections = autoAcceptConnections;

          this.addQuestionHandler('identify', this._returnPublicKey.bind(this));
          this.addQuestionHandler('challenge', this._sign.bind(this));
          this.on('connectedtopeer', (peerName)=>{
              // Only validate if not already validated to prevent infinite loops
              if (!this.validatedPeers.includes(peerName)) {
                  setTimeout(()=> {this.trustOrChallenge.bind(this)(peerName);}, 1000);
              }
          });

          if (load) {
              this.keys.loadedPromise.then(() => {
                  this.userInfo.publicKeyString = this.keys.publicKeyString;
                  this.load();
              });
          }
      }
      verifyUser(channel, data, peerName) {
          console.log("Verifying user", channel, data, peerName, this.validatedPeers);
          if (["question", "answer"].includes(channel) && ["identify", "challenge"].includes(data.question.topic)) {
              return true;
          }
          return this.validatedPeers.includes(peerName);
      }

      _getFullUserInfo(peerName, userInfo) {
          let _bareName = peerName.split('|')[0].split('(')[0].trim();
          if (_bareName.startsWith("anon")) {
              return {
                  peerName: peerName,
                  bareName: _bareName,
                  userInfo: userInfo,
                  providedPubKey: false,
                  knownPubKey: false,
                  knownName: false,
                  otherNamesForPubKey: [],
                  otherPubKeyForName: null,
                  completedChallenge: false,
                  explanation: "anonymous",
                  suspiciousness: suspicionLevels.nonsuspicious,
                  category: "nevermet",
                  hint: "anon"
              }
          }
          let providedPubKey = !!userInfo.publicKeyString;
          let peerNames = providedPubKey?this.keys.getPeerNames(userInfo.publicKeyString):[];
          let _opk = this.keys.getPublicKeyString(_bareName);
          let info = {
              peerName: peerName,
              bareName: _bareName,
              userInfo: userInfo,
              providedPubKey: providedPubKey,
              knownPubKey: (peerNames.length > 0), // bool of whether the public key is known
              knownName: peerNames.includes(_bareName), // bool of whether the public key is known under the name provided
              otherNamesForPubKey: peerNames.filter((name) => name !== _bareName), // array of other names the public key is known under as well (if any)
              otherPubKeyForName: (_opk && (_opk !== userInfo.publicKeyString)) ? _opk : null, // public key string for the name provided (if different from the public key string provided)
              completedChallenge: false // bool of whether the challenge has been completed
          };
          let category = this.categorizeUser(info);
          info.explanation = category.explanation;
          info.suspiciousness = category.suspiciousness;
          info.category = category.category;

          let hint = '';
          if (info.category === 'theoneandonly'){
              hint = '';
          }else if (['knownwithknownaliases', 'possiblenamechange', 'possiblesharedpubkey'].includes(info.category)){
              hint = ` who is known as ${info.otherNamesForPubKey.join(', ')}`;
          }else if (info.category === 'nameswapcollision'){
              hint = `it appears ${info.otherNamesForPubKey[0]} (who you know) is using ${peerName}'s public key to impersonate them'`;
          }else if (info.category === 'pretender'){
              hint = ` who is pretending to be ${info.otherNamesForPubKey[0]}`;
          }else if (info.category === 'nevermet'){
              hint = ` who you have not met`;
          }
          hint = hint? ` (${hint})`: '';
          info.hint = hint;

          return info
      }

      shouldConnectToUser(peerName, userInfo) {
          console.log("Checking if we should connect to user", peerName, userInfo);
          let info = this._getFullUserInfo(peerName, userInfo);
          console.log("info", info);
          let trustLevel = this.checkTrust(info);

          info.trustLevel = trustLevel;
          info.trustLevelString = Object.keys(this.trustLevels).find((key) => this.trustLevels[key] === trustLevel);

          if (this.completeUserInfo[peerName] && this.isConnectedToUser(peerName)) {
              console.warn("Rejecting connection to " + peerName + " because we are already connected to someone with that name");
              return Promise.resolve(false);
          }
          this.completeUserInfo[peerName] = info;

          if (trustLevel === trustLevels.reject) {
              console.error("Rejecting connection to " + peerName);
              return Promise.resolve(false);
          }else if ([trustLevels.doubleprompt, trustLevels.promptandtrust].includes(trustLevel)) {
              return this.connectionrequest(peerName, info).then((connect) => {
                  if (connect) {
                      console.log("Decided to connect to " + peerName);
                  }else {
                      console.log("Decided not to connect to " + peerName);
                  }
                  return connect;
              }, (e)=> {console.log("Error in connection request", e); return false});
          }else {
              console.log("will connect to " + peerName);
              return Promise.resolve(true);
          }
      }
      trustLevels = trustLevels
      suspicionLevels = suspicionLevels
      userCategories = {
          theoneandonly: {knownPubKey: true, knownName: true, otherNamesForPubKey: false, otherPubKeyForName: false,
              explanation: "you know this person by the public key provided and don't now anyone else by this name or public key",
              suspiciousness: suspicionLevels.trusted,
              category: "theoneandonly"
          },
          knownwithknownaliases: {knownPubKey: true, knownName: true, otherNamesForPubKey: true, otherPubKeyForName: false,
              explanation: "you know this person by the public key provided, but you also know them by other names",
              suspiciousness: suspicionLevels.slightlyodd,
              category: "knownwithknownaliases"
          },
          possiblenamechange: {knownPubKey: true, knownName: false, otherNamesForPubKey: 1, otherPubKeyForName: false,
              explanation: "you recognize the public key but know it by a different name",
              suspiciousness: suspicionLevels.slightlyodd,
              category: "possiblenamechange"
          },
          possiblesharedpubkey: {knownPubKey: true, knownName: false, otherNamesForPubKey: true, otherPubKeyForName: false,
              explanation: "you recognize the public key but know it by more than one other name",
              suspiciousness: suspicionLevels.slightlyodd,
              category: "possiblesharedpubkey"
          },
          nameswapcollision: {knownPubKey: true, knownName: false, otherNamesForPubKey: true, otherPubKeyForName: true,
              explanation: "someone you know tried to change their name to the name of someone else you know",
              suspiciousness: suspicionLevels.odd,
              category: "nameswapcollision"
          },
          //___________________________________________________________________________________
          pretender: {knownPubKey: false, knownName: false, otherNamesForPubKey: false, otherPubKeyForName: true,
              explanation: "someone you don't know is using the name of someone you do know",
              suspiciousness: suspicionLevels.veryodd,
              category: "pretender"
          },
          nevermet: {knownPubKey: false, knownName: false, otherNamesForPubKey: false, otherPubKeyForName: false,
              explanation: "you don't know anyone with this pub key or name, you probably just haven't met yet",
              suspiciousness: suspicionLevels.notsuspicious,
              category: "nevermet"
          }
      }


      trustConfigs = {
          alwaysprompt: {
              theoneandonly: trustLevels.promptandtrust,
              knownwithknownaliases: trustLevels.promptandtrust,
              possiblenamechange: trustLevels.promptandtrust,
              possiblesharedpubkey: trustLevels.promptandtrust,
              nameswapcollision: trustLevels.promptandtrust,
              pretender: trustLevels.promptandtrust,
              nevermet: trustLevels.promptandtrust
          },
          strict: {
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.promptandtrust,
              possiblenamechange: trustLevels.promptandtrust,
              possiblesharedpubkey: trustLevels.promptandtrust,
              nameswapcollision: trustLevels.promptandtrust,
              pretender: trustLevels.promptandtrust,
              nevermet: trustLevels.promptandtrust
          },
          strictandquiet: {
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.reject,
              possiblenamechange: trustLevels.reject,
              possiblesharedpubkey: trustLevels.reject,
              nameswapcollision: trustLevels.reject,
              pretender: trustLevels.reject,
              nevermet: trustLevels.promptandtrust
          },
          moderate: {
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.connectandtrust,
              possiblenamechange: trustLevels.connectandtrust,
              possiblesharedpubkey: trustLevels.connectandtrust,
              nameswapcollision: trustLevels.promptandtrust,
              pretender: trustLevels.promptandtrust,
              nevermet: trustLevels.promptandtrust
          },
          moderateandquiet: {
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.connectandtrust,
              possiblenamechange: trustLevels.connectandtrust,
              possiblesharedpubkey: trustLevels.connectandtrust,
              nameswapcollision: trustLevels.reject,
              pretender: trustLevels.reject,
              nevermet: trustLevels.promptandtrust
          },
          lax: {
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.connectandtrust,
              possiblenamechange: trustLevels.connectandtrust,
              possiblesharedpubkey: trustLevels.connectandtrust,
              nameswapcollision: trustLevels.promptandtrust,
              pretender: trustLevels.promptandtrust,
              nevermet: trustLevels.connectandtrust
          },
          unsafe:{
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.connectandtrust,
              possiblenamechange: trustLevels.connectandtrust,
              possiblesharedpubkey: trustLevels.connectandtrust,
              nameswapcollision: trustLevels.connectandtrust,
              pretender: trustLevels.connectandtrust,
              nevermet: trustLevels.connectandtrust
          },
          rejectall: {
              theoneandonly: trustLevels.reject,
              knownwithknownaliases: trustLevels.reject,
              possiblenamechange: trustLevels.reject,
              possiblesharedpubkey: trustLevels.reject,
              nameswapcollision: trustLevels.reject,
              pretender: trustLevels.reject,
              nevermet: trustLevels.reject
          }
      }
      categorizeUser(info){
          if (info.knownPubKey){// we know this pubkey
              if (info.knownName) { // we know this pubkey by this name (but maybe other names too?)
                  if (info.otherPubKeyForName) {
                      throw new Error("knownName should mean that this name matches the pubkey so therefore otherPubKeyForName should be null");
                  }else { // we don't know of any other pubkeys for this name
                      if (info.otherNamesForPubKey.length === 0) { // we don't know of any other names for this pubkey
                          return this.userCategories.theoneandonly;
                      }else { // we know of other names for this pubkey (and we know this name as well)
                          return this.userCategories.knownwithknownaliases;
                      }
                  }
              }else { // we know this pubkey but not by this name
                  if (info.otherNamesForPubKey.length === 0) {
                      throw new Error("knownPubKey should mean that this pubkey matches at least one name so if knownName is false then there should be at least one other name for this pubkey");
                  }else if (info.otherNamesForPubKey.length === 1) { // we know this pubkey by one other name
                      if (info.otherPubKeyForName) {
                          return this.userCategories.nameswapcollision; // we know this pubkey by one other name and we know another pubkey by this name : VERY SUSPICIOUS
                      }else {
                          return this.userCategories.possiblenamechange; // we know this pubkey by one other name and we don't know another pubkey by this name
                      }
                  }else {// we know this pubkey by more than one other name
                      if (info.otherPubKeyForName) {
                          return this.userCategories.nameswapcollision; // we know this pubkey by more than one other name and we know another pubkey by this name : VERY SUSPICIOUS
                      }else {
                          return this.userCategories.possiblesharedpubkey; // we know this pubkey by more than one other name and we don't know another pubkey by this name
                      }
                  }
              }
          }else {
              if (info.otherPubKeyForName) {
                  return this.userCategories.pretender;
              }else {
                  return this.userCategories.nevermet;
              }
          }
      }

      checkTrust({peerName, bareName, userInfo, providedPubKey, peerNames, knownPubKey, knownName, otherNamesForPubKey, otherPubKeyForName, completedChallenge,
          explanation, suspiciousness, category}) {
          console.log("Checking trust for " + peerName, category, this.trustConfig);
          return this.trustConfig[category];
      }
      connectionrequest(peerName, info) {
          // If auto-accept is enabled, automatically accept
          if (this.autoAcceptConnections) {
              console.log("Auto-accepting connection request from", peerName);
              return Promise.resolve(true);
          }
          
          // Otherwise, prompt whether to connect to a peer
          // This can be overridden by listening to the 'connectionrequest' event
          let answer = confirm("Do you want to connect to " + peerName + "?");
          return Promise.resolve(answer);
      }
      trustOrChallenge(peerName) {
          this.keys.getPublicKey(peerName).then((publicKey) => {
              if (!publicKey) {
                  console.log("No public key found for " + peerName);
                  let info = this.completeUserInfo[peerName];
                  
                  // If info doesn't exist, create it with default values
                  if (!info) {
                      info = this._getFullUserInfo(peerName, {});
                      const trustLevel = this.checkTrust(info);
                      info.trustLevel = trustLevel;
                      info.trustLevelString = Object.keys(this.trustLevels).find((key) => this.trustLevels[key] === trustLevel);
                      this.completeUserInfo[peerName] = info;
                  }
                  
                  const trustLevel = info.trustLevel;

                  if ([this.trustLevels.reject].includes(trustLevel)) {
                      console.error("Rejecting connection to " + peerName);
                      this.untrust(peerName);
                      return;
                  }else if ([this.trustLevels.connectandprompt].includes(trustLevel)) {
                      this.connectionrequest(peerName, info).then((connect) => {
                          if (connect) {
                              this.trust(peerName);
                          }else {
                              this.untrust(peerName);
                          }
                      });
                      return;
                  }else if ([this.trustLevels.promptandtrust, this.trustLevels.connectandtrust].includes(trustLevel)) {
                      this.trust(peerName);
                  }
              }else {
                  this.challenge(peerName);
              }
          });
      }
      _returnPublicKey(challenge, senderName) {
          console.log("Challenge received from " + senderName);
          return this.keys.sign(challenge).then((signature) => {
              let answer =  {publicKeyString: this.keys.publicKeyString, signature: signature};
              console.log("Returning public key to " + senderName, answer);
              return answer;
          });
      }
      reset(){
          this.keys.reset();
          this.validatedPeers = [];
      }
      trust(peerName){
          /* trust a peer, assuming they give you a public key they are abe to sign, save that public key to their name */
          let oldPublicKeyString = this.keys.getPublicKeyString(peerName);
          let challengeString = this.keys.getChallengeString();
          return this.sendRTCQuestion("identify", challengeString, peerName).then(({publicKeyString, signature}) => {
               if (oldPublicKeyString && (oldPublicKeyString !== publicKeyString)) {
                  console.error("Public key changed for " + peerName, oldPublicKeyString, publicKeyString);
                  throw new Error("Public key changed for " + peerName);
              }
              return this.keys.verify(publicKeyString, signature, challengeString).then((valid) => {
                  if (valid) {
                      console.log("Signature valid for " + peerName + ", trusting and saving public key");
                      // Check if this public key is already registered to a different name
                      const existingPeers = this.keys.getPeerNames(publicKeyString);
                      if (existingPeers.length > 0 && !existingPeers.includes(peerName)) {
                          // Public key is registered to a different name - update the mapping
                          console.log("Public key already registered to", existingPeers, "updating to", peerName);
                          // Remove old name mappings
                          existingPeers.forEach(oldName => {
                              delete this.keys._knownHostsStrings[oldName];
                          });
                          // Update storage after removing old mappings
                          if (this.keys.storage) {
                              this.keys.storage.setItem("knownHostsStrings", JSON.stringify(this.keys._knownHostsStrings));
                          }
                      }
                      this.keys.savePublicKeyString(peerName, publicKeyString);
                      // Only add to validatedPeers if not already there (prevent duplicates)
                      if (!this.validatedPeers.includes(peerName)) {
                          this.validatedPeers.push(peerName);
                          this.onValidatedPeer(peerName, true);
                      }
                      return true;
                  } else {
                      console.error("Signature invalid for " + peerName);
                      this.untrust(peerName);
                      this.onValidationFailed(peerName);
                      return false;
                  }
              });
          })
      }

      challenge(peerName) {
          /* challenge a peer to prove they have the private key corresponding to the public key you have saved for them */
          let publicKeyString = this.keys.getPublicKeyString(peerName);
          let challengeString = this.keys.getChallengeString();
          return this.sendRTCQuestion("challenge", challengeString, peerName).then((signature) => {
              return this.keys.verify(publicKeyString, signature, challengeString).then((valid) => {
                  console.log("Signature valid for " + peerName, valid);
                  // Only add to validatedPeers if not already there (prevent duplicates)
                  if (!this.validatedPeers.includes(peerName)) {
                      this.validatedPeers.push(peerName);
                      console.log("Validated peers", this.validatedPeers);
                      this.onValidatedPeer(peerName);
                  }

                  return valid;
              }, (err) => {
                  console.error("Error verifying signature of "+ peerName, err);
                  this.untrust(peerName);
                  this.onValidationFailed(peerName);
                  throw err;
              });
          });
      }
      on(event, callback) {
          if (event === "connectionrequest"){
              this.connectionrequest = callback;
              return super.on(event, callback);
          }else {
              return super.on(event, callback);
          }
      }

      onValidatedPeer(peerName, trusting=false) {
          if (trusting) {
              console.log("Trusting peer " + peerName + " is who they say they are.");
          }
          console.log("Peer " + peerName + " validated");
          this.emit('validation', peerName, trusting);
          // Don't emit connectedtopeer here - it causes infinite loops
          // ChatManager now listens to 'validation' events to add users after validation
      }
      onValidationFailed(peerName, message) {
          console.error("Peer " + peerName + " validation failed" + (message ? ": " + message : ""));
          this.emit('validationfailure', peerName, message);
      }
      untrust(peerName) {
          /* remove a public key from a peer */

          this.keys.removePublicKey(peerName);
          console.error("Untrusting peer " + peerName, this.validatedPeers);
          if (this.validatedPeers.includes(peerName)) {
              this.validatedPeers = this.validatedPeers.filter((name) => name !== peerName);
          }
          console.error("Disconnecting from untrusted peer " + peerName, this.validatedPeers);
          this.disconnectFromUser(peerName);
      }
      _sign(challengeString, peerName) {return this.keys.sign(challengeString);}
      register(identity) {return this.keys.register(identity);}
  }

  /**
   * CallState - Platform-agnostic, UI-agnostic call state management
   * 
   * This module provides a structured way to track call state per user.
   * State can be: inactive, active, or pending
   * Each state can have audio and/or video capabilities.
   * 
   * Usage:
   *   import { CallState } from './call-state.js';
   *   
   *   const callState = new CallState();
   *   callState.setUserState('user1', {status: 'active', audio: true, video: true});
   *   const state = callState.getUserState('user1');
   *   // {status: 'active', audio: true, video: true}
   * 
   * @module call-state
   */

  class CallState {
    /**
     * Create a new CallState instance
     */
    constructor() {
      // Map<user, {status: 'inactive'|'active'|'pending', audio: boolean, video: boolean}>
      this._userStates = new Map();
    }

    /**
     * Set call state for a user
     * @param {string} user - User name
     * @param {Object} state - State object {status: string, audio: boolean, video: boolean}
     */
    setUserState(user, state) {
      if (!user) {
        throw new Error('User name is required');
      }
      
      const normalizedState = {
        status: state.status || 'inactive',
        audio: state.audio === true,
        video: state.video === true
      };
      
      // Validate status
      if (!['inactive', 'active', 'pending'].includes(normalizedState.status)) {
        throw new Error(`Invalid status: ${normalizedState.status}. Must be 'inactive', 'active', or 'pending'`);
      }
      
      this._userStates.set(user, normalizedState);
    }

    /**
     * Get call state for a user
     * @param {string} user - User name
     * @returns {Object|null} State object {status: string, audio: boolean, video: boolean} or null if not found
     */
    getUserState(user) {
      if (!user) {
        return null;
      }
      const state = this._userStates.get(user);
      return state ? { ...state } : null;
    }

    /**
     * Get all users with a specific status
     * @param {string} status - Status to filter by ('inactive', 'active', or 'pending')
     * @returns {Array<string>} Array of user names
     */
    getUsersByStatus(status) {
      if (!['inactive', 'active', 'pending'].includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be 'inactive', 'active', or 'pending'`);
      }
      
      const users = [];
      for (const [user, state] of this._userStates.entries()) {
        if (state.status === status) {
          users.push(user);
        }
      }
      return users;
    }

    /**
     * Get all active calls (grouped by audio/video)
     * @returns {Object} {audio: Set<string>, video: Set<string>}
     */
    getActiveCalls() {
      const audio = new Set();
      const video = new Set();
      
      for (const [user, state] of this._userStates.entries()) {
        if (state.status === 'active') {
          if (state.audio) {
            audio.add(user);
          }
          if (state.video) {
            video.add(user);
          }
        }
      }
      
      return { audio, video };
    }

    /**
     * Get all pending calls
     * @returns {Set<string>} Set of user names with pending calls
     */
    getPendingCalls() {
      return new Set(this.getUsersByStatus('pending'));
    }

    /**
     * Get all users with active or pending calls
     * @returns {Set<string>} Set of user names
     */
    getActiveOrPendingCalls() {
      const users = new Set();
      for (const [user, state] of this._userStates.entries()) {
        if (state.status === 'active' || state.status === 'pending') {
          users.add(user);
        }
      }
      return users;
    }

    /**
     * Check if a user has an active call
     * @param {string} user - User name
     * @returns {boolean} True if user has an active call
     */
    hasActiveCall(user) {
      const state = this.getUserState(user);
      return state && state.status === 'active';
    }

    /**
     * Check if a user has a pending call
     * @param {string} user - User name
     * @returns {boolean} True if user has a pending call
     */
    hasPendingCall(user) {
      const state = this.getUserState(user);
      return state && state.status === 'pending';
    }

    /**
     * Remove state for a user
     * @param {string} user - User name
     */
    removeUser(user) {
      this._userStates.delete(user);
    }

    /**
     * Clear all states
     */
    clear() {
      this._userStates.clear();
    }

    /**
     * Get all states (for debugging/inspection)
     * @returns {Map} Map of user -> state
     */
    getAllStates() {
      return new Map(this._userStates);
    }
  }

  /**
   * CallManager - Platform-agnostic call state and business logic management
   * 
   * This class manages all call-related business logic without any UI dependencies.
   * It tracks call state, manages mute states, handles timeouts, and collects statistics.
   * 
   * Usage:
   *   import { CallManager } from './call-manager.js';
   *   import { EventEmitter } from './event-emitter.js';
   *   
   *   const callManager = new CallManager(rtcClient);
   *   callManager.on('callstarted', (user, type) => { ... });
   *   callManager.on('callended', (user) => { ... });
   *   callManager.on('mutechanged', ({mic, speakers, video}) => { ... });
   *   
   *   // Start a call
   *   await callManager.startCall(user, 'audio');
   *   
   *   // Mute/unmute
   *   callManager.setMicMuted(true);
   *   callManager.setSpeakersMuted(true);
   *   callManager.setVideoHidden(true);
   * 
   * Features:
   * - Call state tracking (active calls, pending calls, outgoing calls)
   * - Mute state management (mic, speakers, video)
   * - Call timeout handling
   * - Connection statistics collection
   * - Event-driven architecture
   * 
   * @module call-manager
   */


  class CallManager extends EventEmitter {
    /**
     * Create a new CallManager instance
     * @param {Object} rtcClient - RTC client instance (MQTTRTCClient or similar)
     * @param {Object} options - Configuration options
     * @param {number} options.callTimeout - Call timeout in milliseconds (default: 15000)
     * @param {number} options.statsPollInterval - Stats polling interval in milliseconds (default: 2000)
     * @param {CallUIInterface} options.callUI - Optional call UI component implementing CallUIInterface
     * @param {StreamDisplayInterface} options.videoDisplay - Optional video display component
     * @param {StreamDisplayInterface} options.audioDisplay - Optional audio display component
     * @param {AudioControllerInterface} options.audioController - Optional audio controller
     * @param {VideoControllerInterface} options.videoController - Optional video controller
     * @param {RingerInterface} options.ringer - Optional ringtone component
     * @param {NotificationInterface} options.notifications - Optional notification component
     */
    constructor(rtcClient, options = {}) {
      super();
      
      this.rtcClient = rtcClient;
      this.options = {
        callTimeout: options.callTimeout || 15000,
        statsPollInterval: options.statsPollInterval || 2000,
        ...options
      };
      
      // Optional UI components
      this.callUI = options.callUI || null;
      this.videoDisplay = options.videoDisplay || null;
      this.audioDisplay = options.audioDisplay || null;
      this.audioController = options.audioController || null;
      this.videoController = options.videoController || null;
      this.ringer = options.ringer || null;
      this.notifications = options.notifications || null;
      
      // Unified call state tracking (platform-agnostic, UI-agnostic)
      this.callState = new CallState();
      
      // Additional metadata tracking (not part of core state)
      this.pendingCalls = new Map(); // Map<user, {callInfo, promises, timeoutId, promptElement}>
      this.outgoingCalls = new Map(); // Map<user, {type, cancelFn, timeoutId}>
      this.localStreams = new Map(); // Map<user, MediaStream>
      
      // Mute state
      this.muteState = {
        mic: false,
        speakers: false,
        video: false
      };
      
      // Statistics
      this.statsInterval = null;
      this.latencyMetrics = new Map(); // Map<user, {rtt, packetLoss, jitter}>
      
      // Bind methods
      this._handleIncomingCall = this._handleIncomingCall.bind(this);
      this._handleCallConnected = this._handleCallConnected.bind(this);
      this._handleCallEnded = this._handleCallEnded.bind(this);
      
      // Setup RTC client event listeners if available
      if (rtcClient) {
        this._setupRTCEventListeners();
      }
    }

    /**
     * Setup event listeners on RTC client
     * @private
     */
    _setupRTCEventListeners() {
      if (this.rtcClient.on) {
        this.rtcClient.on('call', this._handleIncomingCall);
        this.rtcClient.on('callconnected', this._handleCallConnected);
        this.rtcClient.on('callended', this._handleCallEnded);
        this.rtcClient.on('disconnectedfrompeer', (user) => {
          this._handleDisconnectedFromUser(user);
        });
      }
    }

    /**
     * Handle incoming call from RTC client
     * @param {string} peerName - Name of the peer calling
     * @param {Object} callInfo - Call information {video: boolean, audio: boolean}
     * @param {Object} promises - Call promises {start: Promise, end: Promise}
     * @returns {Promise} Promise that resolves to acceptance result
     * @private
     */
    _handleIncomingCall(peerName, callInfo, promises) {
      console.log('CallManager._handleIncomingCall called', { peerName, callInfo, hasRinger: !!this.ringer });
      
      // Set up timeout for unanswered call
      const timeoutId = setTimeout(() => {
        this._handleCallTimeout(peerName, 'incoming');
      }, this.options.callTimeout);
      
      // Track pending call
      this.pendingCalls.set(peerName, {
        callInfo,
        promises,
        timeoutId,
        promptElement: null // UI can set this
      });
      
      // Update unified call state
      this.callState.setUserState(peerName, {
        status: 'pending',
        audio: callInfo.audio !== false, // Default to true if not specified
        video: callInfo.video === true
      });
      
      // Start ringing if ringer is provided
      if (this.ringer && typeof this.ringer.start === 'function') {
        console.log('Starting ringtone...');
        this.ringer.start().catch(err => {
          console.error('Could not start ringtone:', err);
        });
      } else {
        console.warn('No ringer available or ringer.start is not a function', { 
          hasRinger: !!this.ringer, 
          ringerType: this.ringer ? typeof this.ringer : 'undefined',
          hasStart: this.ringer ? typeof this.ringer.start : 'N/A'
        });
      }
      
      // Emit event for UI to handle
      this.emit('incomingcall', {
        peerName,
        callInfo,
        promises,
        timeoutId
      });
      
      // Use callUI if provided, otherwise auto-accept
      if (this.callUI && typeof this.callUI.showIncomingCallPrompt === 'function') {
        return this.callUI.showIncomingCallPrompt(peerName, callInfo);
      }
      
      // Default: auto-accept
      return Promise.resolve(true);
    }

    /**
     * Handle call connected event
     * @param {string} sender - Name of the peer
     * @param {Object} streams - Stream objects {localStream, remoteStream}
     * @private
     */
    _handleCallConnected(sender, {localStream, remoteStream}) {
      // Clear timeout
      const pendingCall = this.pendingCalls.get(sender);
      if (pendingCall && pendingCall.timeoutId) {
        clearTimeout(pendingCall.timeoutId);
        pendingCall.timeoutId = null;
      }
      this.pendingCalls.delete(sender);
      
      // Stop ringing if ringer is provided
      if (this.ringer && typeof this.ringer.stop === 'function') {
        this.ringer.stop();
      }
      
      // Determine call type
      const hasVideo = localStream?.getVideoTracks().length > 0 || 
                       remoteStream?.getVideoTracks().length > 0;
      const hasAudio = localStream?.getAudioTracks().length > 0 || 
                       remoteStream?.getAudioTracks().length > 0;
      
      // Store local stream
      if (localStream instanceof MediaStream) {
        this.localStreams.set(sender, localStream);
      }
      
      // Update unified call state
      this.callState.setUserState(sender, {
        status: 'active',
        audio: hasAudio,
        video: hasVideo
      });
      
      // Start stats polling if not already started
      const activeCalls = this.callState.getActiveCalls();
      if (!this.statsInterval && (activeCalls.video.size > 0 || activeCalls.audio.size > 0)) {
        this._startStatsPolling();
      }
      
      // Emit event
      this.emit('callconnected', {
        sender,
        localStream,
        remoteStream,
        type: hasVideo ? 'video' : 'audio'
      });
      
      // Use stream displays if provided
      if (hasVideo && this.videoDisplay && typeof this.videoDisplay.setStreams === 'function') {
        this.videoDisplay.setStreams(sender, { localStream, remoteStream });
      } else if (hasAudio && this.audioDisplay && typeof this.audioDisplay.setStreams === 'function') {
        this.audioDisplay.setStreams(sender, { localStream, remoteStream });
      }
    }

    /**
     * Handle call ended event
     * @param {string} peerName - Name of the peer
     * @private
     */
    _handleCallEnded(peerName) {
      // Clear timeouts
      const pendingCall = this.pendingCalls.get(peerName);
      if (pendingCall && pendingCall.timeoutId) {
        clearTimeout(pendingCall.timeoutId);
      }
      this.pendingCalls.delete(peerName);
      
      const outgoingCall = this.outgoingCalls.get(peerName);
      if (outgoingCall && outgoingCall.timeoutId) {
        clearTimeout(outgoingCall.timeoutId);
      }
      this.outgoingCalls.delete(peerName);
      
      // Update unified call state
      this.callState.setUserState(peerName, {
        status: 'inactive',
        audio: false,
        video: false
      });
      
      this.localStreams.delete(peerName);
      this.latencyMetrics.delete(peerName);
      
      // Stop stats polling if no active calls
      const activeCalls = this.callState.getActiveCalls();
      if (activeCalls.video.size === 0 && activeCalls.audio.size === 0) {
        this._stopStatsPolling();
        // Reset mute states
        this.muteState = { mic: false, speakers: false, video: false };
      }
      
      // Emit event
      this.emit('callended', { peerName });
    }

    /**
     * Handle call timeout
     * @param {string} peerName - Name of the peer
     * @param {string} direction - 'incoming' or 'outgoing'
     * @private
     */
    _handleCallTimeout(peerName, direction) {
      // Clear pending/outgoing call
      this.pendingCalls.delete(peerName);
      this.outgoingCalls.delete(peerName);
      
      // End call with RTC client
      if (this.rtcClient && this.rtcClient.endCallWithUser) {
        try {
          this.rtcClient.endCallWithUser(peerName);
        } catch (err) {
          console.warn(`Error ending timed out call:`, err);
        }
      }
      
      // Update unified call state
      this.callState.setUserState(peerName, {
        status: 'inactive',
        audio: false,
        video: false
      });
      
      this.localStreams.delete(peerName);
      this.latencyMetrics.delete(peerName);
      
      // Stop ringing if ringer is provided
      if (this.ringer && typeof this.ringer.stop === 'function') {
        this.ringer.stop();
      }
      
      // Emit event
      this.emit('calltimeout', { peerName, direction });
      
      // Use callUI if provided
      if (this.callUI && typeof this.callUI.showMissedCallNotification === 'function') {
        this.callUI.showMissedCallNotification(peerName, direction);
      }
      
      // Clean up stream displays
      if (this.videoDisplay && typeof this.videoDisplay.removeStreams === 'function') {
        this.videoDisplay.removeStreams(peerName);
      }
      if (this.audioDisplay && typeof this.audioDisplay.removeStreams === 'function') {
        this.audioDisplay.removeStreams(peerName);
      }
    }

    /**
     * Handle user disconnection
     * @param {string} user - Name of the user
     * @private
     */
    _handleDisconnectedFromUser(user) {
      const userState = this.callState.getUserState(user);
      const hasActiveOrPendingCall = userState && (userState.status === 'active' || userState.status === 'pending');
      const hasOutgoingCall = this.outgoingCalls.has(user);
      
      if (hasActiveOrPendingCall || hasOutgoingCall) {
        // End call with disconnected user
        if (this.rtcClient && this.rtcClient.endCallWithUser) {
          try {
            this.rtcClient.endCallWithUser(user);
          } catch (err) {
            console.warn(`Error ending call with disconnected user:`, err);
          }
        }
        
        this._handleCallEnded(user);
      }
    }

    /**
     * Start a call with a user
     * @param {string} user - Name of the user to call
     * @param {string} type - 'audio' or 'video'
     * @returns {Promise} Promise that resolves when call starts
     */
    async startCall(user, type) {
      if (!this.rtcClient || !this.rtcClient.callUser) {
        throw new Error('RTC client not available or does not support callUser');
      }
      
      const callInfo = type === 'audio' 
        ? { video: false, audio: true }
        : { video: true, audio: true };
      
      // Create cancel function
      let timeoutId = null;
      const cancelCall = (reason = 'cancelled') => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.outgoingCalls.delete(user);
        if (this.rtcClient && this.rtcClient.endCallWithUser) {
          try {
            this.rtcClient.endCallWithUser(user);
          } catch (err) {
            console.error(`Error canceling call:`, err);
          }
        }
        this.emit('callcancelled', { user, reason });
      };
      
      // Set up timeout
      timeoutId = setTimeout(() => {
        this._handleCallTimeout(user, 'outgoing');
      }, this.options.callTimeout);
      
      // Track outgoing call
      this.outgoingCalls.set(user, {
        type,
        cancelFn: cancelCall,
        timeoutId
      });
      
      try {
        // Start the call - callUser returns {start, end} promises
        const { start, end } = this.rtcClient.callUser(user, callInfo);
        
        // Await the start promise to get the streams
        const streamResult = await start;
        
        // Clear timeout if call started successfully
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        // If streamResult contains streams, handle them
        if (streamResult && (streamResult.localStream || streamResult.remoteStream)) {
          this._handleCallConnected(user, streamResult);
        }
        
        // Emit event
        this.emit('callstarted', { user, type });
        
        // Return the stream result and end promise
        return { ...streamResult, end };
      } catch (err) {
        // Clear timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        this.outgoingCalls.delete(user);
        
        // Check if call was rejected
        if (err === "Call rejected" || err?.message === "Call rejected") {
          this.emit('callrejected', { user });
        } else {
          this.emit('callerror', { user, error: err });
        }
        
        throw err;
      }
    }

    /**
     * End a call with a user
     * @param {string} user - Name of the user
     */
    endCall(user) {
      if (this.rtcClient && this.rtcClient.endCallWithUser) {
        try {
          this.rtcClient.endCallWithUser(user);
        } catch (err) {
          console.error(`Error ending call:`, err);
        }
      }
      
      // Cleanup will happen via callended event
    }

    /**
     * End all active calls
     */
    endAllCalls() {
      const activeCalls = this.callState.getActiveCalls();
      const pendingCalls = this.callState.getPendingCalls();
      const allUsers = new Set([...activeCalls.video, ...activeCalls.audio, ...pendingCalls, ...this.outgoingCalls.keys()]);
      for (const user of allUsers) {
        this.endCall(user);
      }
    }

    /**
     * Set microphone mute state
     * @param {boolean} muted - Whether microphone is muted
     */
    setMicMuted(muted) {
      this.muteState.mic = muted;
      
      // Update all local streams
      for (const [user, stream] of this.localStreams.entries()) {
        if (stream && stream instanceof MediaStream) {
          const audioTracks = stream.getAudioTracks();
          audioTracks.forEach(track => {
            track.enabled = !muted;
          });
        }
      }
      
      this.emit('mutechanged', { ...this.muteState });
    }

    /**
     * Set speakers mute state
     * @param {boolean} muted - Whether speakers are muted
     */
    setSpeakersMuted(muted) {
      this.muteState.speakers = muted;
      
      // Note: Speakers muting requires UI to handle remote audio/video elements
      // This just tracks the state and emits event
      this.emit('mutechanged', { ...this.muteState });
      this.emit('speakersmutechanged', { muted });
    }

    /**
     * Set video hidden state
     * @param {boolean} hidden - Whether video is hidden
     */
    setVideoHidden(hidden) {
      this.muteState.video = hidden;
      
      // Update all local streams
      for (const [user, stream] of this.localStreams.entries()) {
        if (stream && stream instanceof MediaStream) {
          const videoTracks = stream.getVideoTracks();
          videoTracks.forEach(track => {
            track.enabled = !hidden;
          });
        }
      }
      
      // Use videoController if provided
      if (this.videoController && typeof this.videoController.setVideoHidden === 'function') {
        this.videoController.setVideoHidden(hidden, this.localStreams);
      }
      
      this.emit('mutechanged', { ...this.muteState });
    }

    /**
     * Get current mute state
     * @returns {Object} Mute state {mic: boolean, speakers: boolean, video: boolean}
     */
    getMuteState() {
      return { ...this.muteState };
    }

    /**
     * Get active calls
     * @returns {Object} {audio: Set, video: Set}
     */
    getActiveCalls() {
      // Use unified call state as source of truth
      return this.callState.getActiveCalls();
    }

    /**
     * Get pending incoming calls
     * @returns {Set} Set of user names with pending incoming calls
     */
    getPendingCalls() {
      // Use unified call state as source of truth
      return this.callState.getPendingCalls();
    }

    /**
     * Get call state for a user
     * @param {string} user - User name
     * @returns {Object|null} State object {status: string, audio: boolean, video: boolean} or null
     */
    getUserCallState(user) {
      return this.callState.getUserState(user);
    }

    /**
     * Get all call states
     * @returns {Map} Map of user -> state
     */
    getAllCallStates() {
      return this.callState.getAllStates();
    }

    /**
     * Get latency metrics for a user
     * @param {string} user - User name
     * @returns {Object|null} Metrics {rtt, packetLoss, jitter} or null
     */
    getMetrics(user) {
      return this.latencyMetrics.get(user) || null;
    }

    /**
     * Get all latency metrics
     * @returns {Map} Map of user -> metrics
     */
    getAllMetrics() {
      return new Map(this.latencyMetrics);
    }

    /**
     * Start polling connection statistics
     * @private
     */
    _startStatsPolling() {
      if (this.statsInterval) {
        return;
      }
      
      this.statsInterval = setInterval(() => {
        this._collectConnectionStats();
      }, this.options.statsPollInterval);
      
      // Collect initial stats
      this._collectConnectionStats();
    }

    /**
     * Stop polling connection statistics
     * @private
     */
    _stopStatsPolling() {
      if (this.statsInterval) {
        clearInterval(this.statsInterval);
        this.statsInterval = null;
      }
    }

    /**
     * Collect connection statistics from active calls
     * @private
     */
    async _collectConnectionStats() {
      if (!this.rtcClient || !this.rtcClient.rtcConnections) {
        return;
      }
      
      const activeCalls = this.callState.getActiveCalls();
      const activeCallUsers = new Set([...activeCalls.video, ...activeCalls.audio]);
      
      for (const user of activeCallUsers) {
        const connection = this.rtcClient.rtcConnections[user];
        if (!connection) {
          continue;
        }
        
        try {
          const streamConnection = connection.streamConnection;
          if (streamConnection && streamConnection.connectionState === 'connected') {
            const stats = await streamConnection.getStats();
            
            let rtt = null;
            let packetLoss = null;
            let jitter = null;
            
            // Parse stats
            for (const [id, report] of stats.entries()) {
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                if (report.currentRoundTripTime !== undefined) {
                  rtt = report.currentRoundTripTime * 1000; // Convert to ms
                }
              }
              
              if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
                if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                  const totalPackets = report.packetsLost + report.packetsReceived;
                  if (totalPackets > 0) {
                    packetLoss = (report.packetsLost / totalPackets) * 100;
                  }
                }
                if (report.jitter !== undefined) {
                  jitter = report.jitter * 1000; // Convert to ms
                }
              }
              
              if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
                if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                  const totalPackets = report.packetsLost + report.packetsReceived;
                  if (totalPackets > 0) {
                    const videoPacketLoss = (report.packetsLost / totalPackets) * 100;
                    if (packetLoss === null) {
                      packetLoss = videoPacketLoss;
                    }
                  }
                }
              }
            }
            
            // Store metrics
            this.latencyMetrics.set(user, { rtt, packetLoss, jitter });
            
            // Emit event
            this.emit('metricsupdated', { user, metrics: { rtt, packetLoss, jitter } });
          }
        } catch (err) {
          console.warn(`Error collecting stats for ${user}:`, err);
        }
      }
    }

    /**
     * Cleanup and destroy the manager
     */
    destroy() {
      // Stop stats polling
      this._stopStatsPolling();
      
      // End all calls
      this.endAllCalls();
      
      // Clear all state
      this.pendingCalls.clear();
      this.outgoingCalls.clear();
      this.localStreams.clear();
      this.latencyMetrics.clear();
      
      // Clear unified call state
      this.callState.clear();
      
      // Remove event listeners
      if (this.rtcClient && this.rtcClient.off) {
        this.rtcClient.off('call', this._handleIncomingCall);
        this.rtcClient.off('callconnected', this._handleCallConnected);
        this.rtcClient.off('callended', this._handleCallEnded);
      }
      
      // Remove all event listeners
      this.removeAllListeners();
    }
  }

  /**
   * ChatManager - Platform-agnostic chat message and state management
   * 
   * This class manages chat-related business logic without any UI dependencies.
   * It tracks messages, active users, and provides a clean API for chat operations.
   * 
   * Usage:
   *   import { ChatManager } from './chat-manager.js';
   *   import { EventEmitter } from './event-emitter.js';
   *   
   *   const chatManager = new ChatManager(rtcClient);
   *   chatManager.on('message', ({data, sender, timestamp}) => { ... });
   *   chatManager.on('userconnected', (user) => { ... });
   *   chatManager.on('userdisconnected', (user) => { ... });
   *   
   *   // Send a message
   *   chatManager.sendMessage('Hello!');
   * 
   * Features:
   * - Message history tracking
   * - Active user management
   * - User color assignment
   * - Event-driven architecture
   * 
   * @module chat-manager
   */


  class ChatManager extends EventEmitter {
    /**
     * Create a new ChatManager instance
     * @param {Object} rtcClient - RTC client instance (MQTTRTCClient or similar)
     * @param {Object} options - Configuration options
     * @param {string} options.primaryUserColor - Color for primary user messages (default: 'lightblue')
     * @param {Array<string>} options.userColors - Array of colors for other users
     * @param {ChatUIInterface} options.chatUI - Optional chat UI component implementing ChatUIInterface
     * @param {NotificationInterface} options.notifications - Optional notification component
     */
    constructor(rtcClient, options = {}) {
      super();
      
      this.rtcClient = rtcClient;
      this.options = {
        primaryUserColor: options.primaryUserColor || 'lightblue',
        userColors: options.userColors || [
          'lightcoral',
          'lightseagreen',
          'lightsalmon',
          'lightgreen',
        ],
        ...options
      };
      
      // Optional UI components
      this.chatUI = options.chatUI || null;
      this.notifications = options.notifications || null;
      
      // State tracking
      this.history = [];
      this.activeUsers = [];
      this.userColors = [...this.options.userColors];
      this.name = options.name || '?';
      
      // Bind methods
      this._handleChatMessage = this._handleChatMessage.bind(this);
      this._handleUserConnected = this._handleUserConnected.bind(this);
      this._handleUserDisconnected = this._handleUserDisconnected.bind(this);
      
      // Setup RTC client event listeners if available
      if (rtcClient) {
        this._setupRTCEventListeners();
      }
    }

    /**
     * Setup event listeners on RTC client
     * @private
     */
    _setupRTCEventListeners() {
      if (this.rtcClient.on) {
        this.rtcClient.on('chat', this._handleChatMessage);
        
        // Check if this is a SignedMQTTRTCClient (has validation events)
        // For SignedMQTTRTCClient, we should wait for validation before adding users
        // For regular MQTTRTCClient, we can add users immediately on connectedtopeer
        // Detection: check if validatedPeers property exists (more reliable than constructor.name)
        const isSignedClient = this.rtcClient && 
                              (this.rtcClient.validatedPeers !== undefined || 
                               (this.rtcClient.on && typeof this.rtcClient.on === 'function'));
        
        // Also check if validation event is available by trying to listen
        // For now, we'll listen to both events and handle appropriately
        
        // Always listen to validation event if available (for SignedMQTTRTCClient)
        // This won't cause issues for regular clients that don't emit it
        this.rtcClient.on('validation', (peerName, trusted) => {
          console.log('ChatManager: Received validation event for', peerName, 'trusted:', trusted);
          // Add user after validation if not already added
          if (!this.activeUsers.includes(peerName)) {
            console.log('ChatManager: Adding validated user', peerName);
            this._handleUserConnected(peerName);
          } else {
            console.log('ChatManager: User', peerName, 'already in activeUsers');
          }
        });
        
        // For connectedtopeer: only add users if NOT using SignedMQTTRTCClient
        // (SignedMQTTRTCClient will add via validation event instead)
        this.rtcClient.on('connectedtopeer', (peerName) => {
          // Only add immediately if this is NOT a signed client
          // For signed clients, wait for validation event
          if (!isSignedClient) {
            console.log('ChatManager: Adding user on connectedtopeer (non-signed client)', peerName);
            this._handleUserConnected(peerName);
          } else {
            console.log('ChatManager: Received connectedtopeer for', peerName, '(waiting for validation)');
          }
        });
        
        this.rtcClient.on('disconnectedfrompeer', this._handleUserDisconnected);
      }
    }

    /**
     * Handle chat message from RTC client
     * @param {string} message - Message content
     * @param {string} sender - Sender name
     * @private
     */
    _handleChatMessage(message, sender) {
      const timestamp = Date.now();
      const messageData = {
        data: message,
        sender,
        timestamp
      };
      
      // Add to history
      this.history.push(messageData);
      
      // Emit event - UI should listen to this event, not use direct displayMessage call
      this.emit('message', messageData);
      
      // Don't call chatUI.displayMessage directly - let the event listener handle it
      // This prevents duplicate message display
    }

    /**
     * Handle user connected event
     * @param {string} user - User name
     * @private
     */
    _handleUserConnected(user) {
      if (!this.activeUsers.includes(user)) {
        this.activeUsers.push(user);
        
        // Emit event
        this.emit('userconnected', { user });
        
        // Play connection sound if notifications provided
        if (this.notifications && typeof this.notifications.ping === 'function') {
          this.notifications.ping().catch(err => {
            console.debug('Could not play connection ping:', err);
          });
        }
        
        // Use chatUI if provided
        if (this.chatUI && typeof this.chatUI.updateActiveUsers === 'function') {
          this.chatUI.updateActiveUsers([...this.activeUsers]);
        }
      }
    }

    /**
     * Handle user disconnected event
     * @param {string} user - User name
     * @private
     */
    _handleUserDisconnected(user) {
      const index = this.activeUsers.indexOf(user);
      if (index !== -1) {
        // Get user's color before removing
        const oldColor = this.userColors[index % this.userColors.length];
        
        // Remove user
        this.activeUsers.splice(index, 1);
        
        // Recycle color
        this.userColors = this.userColors.filter((color) => color !== oldColor).concat([oldColor]);
        
        // Emit event
        this.emit('userdisconnected', { user });
        
        // Use chatUI if provided
        if (this.chatUI && typeof this.chatUI.updateActiveUsers === 'function') {
          this.chatUI.updateActiveUsers([...this.activeUsers]);
        }
      }
    }

    /**
     * Send a chat message
     * @param {string} message - Message to send (optional if chatUI provides input)
     */
    sendMessage(message) {
      // Get message from chatUI if not provided
      if (!message && this.chatUI && typeof this.chatUI.getMessageInput === 'function') {
        message = this.chatUI.getMessageInput();
      }
      
      if (!message) {
        throw new Error('Message is required');
      }
      
      if (!this.rtcClient) {
        throw new Error('RTC client not available');
      }
      
      if (this.rtcClient.sendRTCChat) {
        this.rtcClient.sendRTCChat(message);
        
        // Clear input if chatUI provides it
        if (this.chatUI && typeof this.chatUI.clearMessageInput === 'function') {
          this.chatUI.clearMessageInput();
        }
      } else {
        throw new Error('RTC client does not support sendRTCChat');
      }
    }

    /**
     * Get user color for a user
     * @param {string} user - User name
     * @returns {string} Color string
     */
    getUserColor(user) {
      if (user === this.name + "( You )") {
        return this.options.primaryUserColor;
      }
      const index = this.activeUsers.indexOf(user);
      if (index !== -1) {
        return this.userColors[index % this.userColors.length];
      }
      return this.options.primaryUserColor;
    }

    /**
     * Get message history
     * @returns {Array} Array of message objects
     */
    getHistory() {
      return [...this.history];
    }

    /**
     * Set message history
     * @param {Array} history - Array of message objects
     */
    setHistory(history) {
      this.history = [...history];
      this.emit('historyupdated', { history: this.history });
    }

    /**
     * Get active users
     * @returns {Array} Array of user names
     */
    getActiveUsers() {
      return [...this.activeUsers];
    }

    /**
     * Set user name
     * @param {string} name - User name
     */
    setName(name) {
      this.name = name;
      this.emit('namechanged', { name });
    }

    /**
     * Get user name
     * @returns {string} User name
     */
    getName() {
      return this.name;
    }

    /**
     * Cleanup and destroy the manager
     */
    destroy() {
      // Clear state
      this.history = [];
      this.activeUsers = [];
      this.userColors = [...this.options.userColors];
      
      // Remove event listeners
      if (this.rtcClient && this.rtcClient.off) {
        this.rtcClient.off('chat', this._handleChatMessage);
        this.rtcClient.off('connectedtopeer', this._handleUserConnected);
        this.rtcClient.off('disconnectedfrompeer', this._handleUserDisconnected);
      }
      
      // Remove all event listeners
      this.removeAllListeners();
    }
  }

  /**
   * RTCVideoChat - Core logic for managing video streams and calls
   * 
   * This class manages MediaStream objects and call lifecycle without any UI dependencies.
   * It provides callbacks for UI updates, making it easy to integrate with any UI framework.
   * 
   * Note: This is a legacy component. New code should use CallManager instead.
   * 
   * Usage:
   *   import { RTCVideoChat } from './rtc-video-chat.js';
   *   
   *   const videoChat = new RTCVideoChat(rtcClient, {
   *     setLocalSrc: (stream) => { // update local video element
   *     },
   *     setRemoteSrc: (stream, peerName) => { // update remote video element
   *     },
   *     hide: () => { // hide video UI
   *     },
   *     show: () => { // show video UI
   *     }
   *   });
   * 
   * @module rtc-video-chat
   */

  class RTCVideoChat {
    /**
     * Create a new RTCVideoChat instance
     * @param {Object} rtc - RTC client instance
     * @param {Function} setLocalSrc - Callback to set local video source
     * @param {Function} setRemoteSrc - Callback to set remote video source
     * @param {Function} hide - Callback to hide video UI
     * @param {Function} show - Callback to show video UI
     */
    constructor(rtc, setLocalSrc, setRemoteSrc, hide, show) {
      this.setLocalSrc = setLocalSrc;
      this.setRemoteSrc = setRemoteSrc;

      this.accept = this.accept.bind(this);
      this.close = this.close.bind(this);
      this.closeCall = this.closeCall.bind(this);
      this.endCall = this.endCall.bind(this);
      this.setStreamCount = this.setStreamCount.bind(this);

      this._rtc = null;
      if (rtc) {
        this.rtc = rtc;
      }
      this.pendingNames = [];

      this.localStream = null;
      this.remoteStreams = {};

      if (hide) {
        this.hide = hide;
      }
      if (show) {
        this.show = show;
      }
    }

    get rtc() {
      if (!this._rtc) {
        throw new Error("RTC not set");
      }
      return this._rtc;
    }

    set rtc(rtc) {
      this._rtc = rtc;
      rtc.on('callconnected', this.accept);
      rtc.on('calldisconnected', this.endCall);
    }

    get name() {
      return this.rtc.name;
    }

    call(peerName, promise = 'end') {
      this.pendingNames.push(peerName);
      let { start, end } = this.rtc.callUser(peerName);
      end = end.then(() => {
        this.close(peerName);
      });
      if (promise === 'end') {
        return end;
      }
      return start;
    }

    endCall(peerName = 'all') {
      if (peerName === 'all') {
        for (let name of Object.keys(this.remoteStreams)) {
          this.endCall(name);
        }
      }
      if (this.remoteStreams[peerName]) {
        this.rtc.endCallWithUser(peerName);
      }
      this.closeCall(peerName);
    }

    accept(name, streams) {
      if (streams instanceof Promise) {
        streams.then(streams => this.accept(name, streams));
        return;
      }
      if (this.pendingNames.includes(name)) {
        this.pendingNames = this.pendingNames.filter(n => n !== name);
      }

      if (!this.localStream) {
        this.localStream = streams.localStream;
        this.setLocalSrc(this.localStream);
      }
      this.setRemoteSrc(streams.remoteStream, name);
      this.remoteStreams[name] = streams.remoteStream;
      this.setStreamCount(Object.keys(this.remoteStreams).length);
    }

    closeCall(peerName) {
      this.pendingNames = this.pendingNames.filter(name => name !== peerName);
      this.setRemoteSrc(null, peerName);
      let rs = this.remoteStreams[peerName];
      if (rs) {
        try {
          rs.getTracks().forEach(track => track.stop());
        } catch (e) {
          // Ignore errors when stopping tracks
        }
        delete this.remoteStreams[peerName];
        this.setStreamCount(Object.keys(this.remoteStreams).length);
      }
    }

    setStreamCount(count) {
      if (!count) {
        if (this.localStream) {
          try {
            this.localStream.getTracks().forEach(track => track.stop());
          } catch (e) {
            // Ignore errors when stopping tracks
          }
          this.setLocalSrc(null);
          this.localStream = null;
        }
        this.setLocalSrc(null);
        this.localStream = null;
        this.hide();
      } else {
        this.show();
      }
    }

    hide() {
      // Override in subclass or via constructor
    }

    show() {
      // Override in subclass or via constructor
    }

    close() {
      // End all streams
      this.endCall();
    }
  }

  /**
   * ChatUIInterface - Interface for chat UI components
   * 
   * This interface defines the minimum methods a chat UI component must implement
   * to work with ChatManager. All methods are optional - implement only what you need.
   * 
   * Configuration options (via UIConfigInterface):
   * - allowRoomChange: boolean - Whether room changes are allowed (default: true)
   * - showRoom: boolean - Whether to show room name (default: true)
   * - baseTopic: string - Base MQTT topic prefix (default: '')
   * - currentRoom: string - Current room name (default: '')
   * - callModes: 'audio' | 'video' | 'both' - Which call types to expose (default: 'both')
   * - callTimeout: number - Call timeout in milliseconds (default: 15000)
   * - videoDisplayComponent: class - Optional custom video display component
   * - primaryUserColor: string - Color for primary user (default: 'lightblue')
   * - userColors: Array<string> - Colors for other users
   * - ringerVolume: number - Ringtone volume 0-1 (default: 0.3)
   * - notificationVolume: number - Notification volume 0-1 (default: 0.2)
   * 
   * @interface ChatUIInterface
   */
  class ChatUIInterface {
    /**
     * Get configuration for this UI component
     * @returns {Object} Configuration object
     */
    getConfig() {
      throw new Error('getConfig must be implemented or use UIConfigInterface.getDefaultConfig()');
    }
    /**
     * Display a chat message
     * @param {Object} messageData - {data: string, sender: string, timestamp: number}
     */
    displayMessage(messageData) {
      throw new Error('displayMessage must be implemented');
    }

    /**
     * Update the active users display
     * @param {Array<string>} users - List of active user names
     */
    updateActiveUsers(users) {
      throw new Error('updateActiveUsers must be implemented');
    }

    /**
     * Get the current message input value
     * @returns {string} Current input value
     */
    getMessageInput() {
      throw new Error('getMessageInput must be implemented');
    }

    /**
     * Clear the message input
     */
    clearMessageInput() {
      throw new Error('clearMessageInput must be implemented');
    }

    /**
     * Enable or disable the message input
     * @param {boolean} enabled - Whether input should be enabled
     */
    setInputEnabled(enabled) {
      throw new Error('setInputEnabled must be implemented');
    }
  }

  /**
   * CallUIInterface - Interface for call UI components
   * 
   * This interface defines the minimum methods a call UI component must implement
   * to work with CallManager. All methods are optional - implement only what you need.
   * 
   * @interface CallUIInterface
   */
  class CallUIInterface {
    /**
     * Display an incoming call prompt
     * @param {string} peerName - Name of the caller
     * @param {Object} callInfo - {video: boolean, audio: boolean}
     * @returns {Promise<boolean>} Promise that resolves to true to accept, false to reject
     */
    showIncomingCallPrompt(peerName, callInfo) {
      throw new Error('showIncomingCallPrompt must be implemented');
    }

    /**
     * Hide/remove the incoming call prompt
     * @param {string} peerName - Name of the caller
     */
    hideIncomingCallPrompt(peerName) {
      // Optional - no-op by default
    }

    /**
     * Display a missed call notification
     * @param {string} peerName - Name of the peer
     * @param {string} direction - 'incoming' or 'outgoing'
     */
    showMissedCallNotification(peerName, direction) {
      // Optional - no-op by default
    }

    /**
     * Display a call declined notification
     * @param {string} peerName - Name of the peer who declined
     */
    showCallDeclinedNotification(peerName) {
      // Optional - no-op by default
    }

    /**
     * Update call button states
     * @param {Object} state - {inCall: boolean, callType: string|null, isOutgoing: boolean}
     */
    updateCallButtonStates(state) {
      // Optional - no-op by default
    }
  }

  /**
   * StreamDisplayInterface - Interface for audio/video stream display components
   * 
   * This interface defines the minimum methods a stream display component must implement
   * to work with CallManager for displaying media streams.
   * 
   * @interface StreamDisplayInterface
   */
  class StreamDisplayInterface {
    /**
     * Set streams for a user
     * @param {string} user - User name
     * @param {Object} streams - {localStream: MediaStream, remoteStream: MediaStream}
     */
    setStreams(user, streams) {
      throw new Error('setStreams must be implemented');
    }

    /**
     * Remove streams for a user
     * @param {string} user - User name
     */
    removeStreams(user) {
      throw new Error('removeStreams must be implemented');
    }

    /**
     * Show the stream display
     */
    show() {
      // Optional - no-op by default
    }

    /**
     * Hide the stream display
     */
    hide() {
      // Optional - no-op by default
    }
  }

  /**
   * AudioControllerInterface - Interface for audio control components
   * 
   * This interface defines methods for controlling audio streams (mute mic, mute speakers).
   * Implement this if you want to provide audio controls.
   * 
   * @interface AudioControllerInterface
   */
  class AudioControllerInterface {
    /**
     * Mute or unmute the microphone
     * @param {boolean} muted - Whether to mute (true) or unmute (false)
     * @param {Map<string, MediaStream>} localStreams - Map of user -> local MediaStream
     */
    setMicMuted(muted, localStreams) {
      // Optional - no-op by default
    }

    /**
     * Mute or unmute the speakers
     * @param {boolean} muted - Whether to mute (true) or unmute (false)
     * @param {Map<string, HTMLMediaElement>} remoteAudioElements - Map of user -> audio element
     */
    setSpeakersMuted(muted, remoteAudioElements) {
      // Optional - no-op by default
    }

    /**
     * Get current mic mute state
     * @returns {boolean} Whether mic is muted
     */
    isMicMuted() {
      return false;
    }

    /**
     * Get current speakers mute state
     * @returns {boolean} Whether speakers are muted
     */
    isSpeakersMuted() {
      return false;
    }
  }

  /**
   * VideoControllerInterface - Interface for video control components
   * 
   * This interface defines methods for controlling video streams (hide/show video).
   * Implement this if you want to provide video controls.
   * 
   * @interface VideoControllerInterface
   */
  class VideoControllerInterface {
    /**
     * Hide or show video
     * @param {boolean} hidden - Whether to hide (true) or show (false) video
     * @param {Map<string, MediaStream>} localStreams - Map of user -> local MediaStream
     */
    setVideoHidden(hidden, localStreams) {
      // Optional - no-op by default
    }

    /**
     * Get current video hidden state
     * @returns {boolean} Whether video is hidden
     */
    isVideoHidden() {
      return false;
    }
  }

  /**
   * VideoInterface - Interface for video element components
   * 
   * This interface defines methods for video elements that display MediaStreams.
   * This allows for custom video implementations (e.g., custom HTML elements,
   * React components, Canvas-based rendering, etc.)
   * 
   * @interface VideoInterface
   */
  class VideoInterface {
    /**
     * Set the video source (MediaStream)
     * @param {MediaStream|null} stream - MediaStream to display, or null to clear
     */
    setStream(stream) {
      throw new Error('setStream must be implemented');
    }

    /**
     * Get the current video source
     * @returns {MediaStream|null} Current stream or null
     */
    getStream() {
      throw new Error('getStream must be implemented');
    }

    /**
     * Show the video element
     */
    show() {
      // Optional - no-op by default
    }

    /**
     * Hide the video element
     */
    hide() {
      // Optional - no-op by default
    }

    /**
     * Set muted state
     * @param {boolean} muted - Whether video should be muted
     */
    setMuted(muted) {
      // Optional - no-op by default
    }

    /**
     * Get muted state
     * @returns {boolean} Whether video is muted
     */
    isMuted() {
      return false;
    }

    /**
     * Set autoplay
     * @param {boolean} autoplay - Whether video should autoplay
     */
    setAutoplay(autoplay) {
      // Optional - no-op by default
    }

    /**
     * Set playsinline (for mobile)
     * @param {boolean} playsinline - Whether video should play inline
     */
    setPlaysinline(playsinline) {
      // Optional - no-op by default
    }

    /**
     * Get the underlying element (for DOM manipulation if needed)
     * @returns {HTMLElement|null} The underlying element
     */
    getElement() {
      return null;
    }

    /**
     * Cleanup and destroy the video element
     */
    destroy() {
      // Optional - no-op by default
    }
  }

  /**
   * RingerInterface - Interface for ringtone/audio notification components
   * 
   * This interface defines methods for playing ringtones (e.g., for incoming calls).
   * Implement this if you want to provide custom ringtone behavior.
   * 
   * @interface RingerInterface
   */
  class RingerInterface {
    /**
     * Start playing the ringtone
     * @returns {Promise} Promise that resolves when ringtone starts
     */
    start() {
      throw new Error('start must be implemented');
    }

    /**
     * Stop playing the ringtone
     */
    stop() {
      throw new Error('stop must be implemented');
    }

    /**
     * Check if ringtone is currently playing
     * @returns {boolean} Whether ringtone is playing
     */
    isRinging() {
      return false;
    }
  }

  /**
   * NotificationInterface - Interface for notification components
   * 
   * This interface defines methods for showing notifications (e.g., connection sounds, alerts).
   * Implement this if you want to provide custom notification behavior.
   * 
   * @interface NotificationInterface
   */
  class NotificationInterface {
    /**
     * Play a ping/connection sound
     * @returns {Promise} Promise that resolves when sound plays
     */
    ping() {
      // Optional - no-op by default
      return Promise.resolve();
    }

    /**
     * Play a beep sound
     * @returns {Promise} Promise that resolves when sound plays
     */
    beep() {
      // Optional - no-op by default
      return Promise.resolve();
    }

    /**
     * Show a visual notification (e.g., browser notification)
     * @param {string} title - Notification title
     * @param {Object} options - Notification options {body, icon, etc.}
     * @returns {Promise} Promise that resolves when notification is shown
     */
    showNotification(title, options = {}) {
      // Optional - no-op by default
      return Promise.resolve();
    }
  }

  /**
   * StorageInterface - Interface for storage adapters
   * 
   * This interface defines methods for persistent storage (e.g., localStorage, IndexedDB).
   * Note: This is already implemented as StorageAdapter, but included here for completeness.
   * 
   * @interface StorageInterface
   */
  class StorageInterface {
    /**
     * Get an item from storage
     * @param {string} key - Storage key
     * @returns {string|null} Stored value or null
     */
    getItem(key) {
      throw new Error('getItem must be implemented');
    }

    /**
     * Set an item in storage
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     */
    setItem(key, value) {
      throw new Error('setItem must be implemented');
    }

    /**
     * Remove an item from storage
     * @param {string} key - Storage key
     */
    removeItem(key) {
      throw new Error('removeItem must be implemented');
    }
  }

  /**
   * UIConfigInterface - Configuration options for UI components
   * 
   * This interface defines standard configuration options that all UI implementations
   * should support. This ensures consistency across different UI implementations.
   * 
   * @interface UIConfigInterface
   */
  class UIConfigInterface {
    /**
     * Get the default configuration
     * @returns {Object} Default configuration object
     */
    static getDefaultConfig() {
      return {
        // Room/Name configuration
        allowRoomChange: true,
        showRoom: true,
        baseTopic: '',
        currentRoom: '',
        
        // Call configuration
        callModes: 'both', // 'audio' | 'video' | 'both'
        callTimeout: 15000, // milliseconds
        
        // Component configuration
        videoDisplayComponent: null, // Optional custom video display component class
        
        // User configuration
        primaryUserColor: 'lightblue',
        userColors: [
          'lightcoral',
          'lightseagreen',
          'lightsalmon',
          'lightgreen',
        ],
        
        // Audio configuration
        ringerVolume: 0.3,
        notificationVolume: 0.2,
      };
    }

    /**
     * Validate configuration
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validated configuration with defaults applied
     */
    static validateConfig(config = {}) {
      const defaults = this.getDefaultConfig();
      const validated = { ...defaults };
      
      // Validate and apply provided config
      if (typeof config.allowRoomChange === 'boolean') {
        validated.allowRoomChange = config.allowRoomChange;
      }
      
      if (typeof config.showRoom === 'boolean') {
        validated.showRoom = config.showRoom;
      }
      
      if (typeof config.baseTopic === 'string') {
        validated.baseTopic = config.baseTopic;
      }
      
      if (typeof config.currentRoom === 'string') {
        validated.currentRoom = config.currentRoom;
      }
      
      if (['audio', 'video', 'both'].includes(config.callModes)) {
        validated.callModes = config.callModes;
      }
      
      if (typeof config.callTimeout === 'number' && config.callTimeout > 0) {
        validated.callTimeout = config.callTimeout;
      }
      
      if (config.videoDisplayComponent !== undefined) {
        validated.videoDisplayComponent = config.videoDisplayComponent;
      }
      
      if (typeof config.primaryUserColor === 'string') {
        validated.primaryUserColor = config.primaryUserColor;
      }
      
      if (Array.isArray(config.userColors)) {
        validated.userColors = config.userColors;
      }
      
      if (typeof config.ringerVolume === 'number' && config.ringerVolume >= 0 && config.ringerVolume <= 1) {
        validated.ringerVolume = config.ringerVolume;
      }
      
      if (typeof config.notificationVolume === 'number' && config.notificationVolume >= 0 && config.notificationVolume <= 1) {
        validated.notificationVolume = config.notificationVolume;
      }
      
      return validated;
    }
  }

  /**
   * PluginAdapter - Base class for creating plugin adapters
   * 
   * This class provides a convenient way to create adapters that implement
   * multiple interfaces. It provides default no-op implementations for all
   * interface methods, so you only need to override what you need.
   * 
   * Usage:
   *   import { PluginAdapter, UIConfigInterface } from './core/index.js';
   *   
   *   class MyChatAdapter extends PluginAdapter {
   *     constructor(config = {}) {
   *       super();
   *       this.config = UIConfigInterface.validateConfig(config);
   *     }
   *     
   *     getConfig() {
   *       return this.config;
   *     }
   *     
   *     displayMessage({data, sender, timestamp}) {
   *       // Implement only what you need
   *     }
   *   }
   * 
   * @class PluginAdapter
   */

  class PluginAdapter {
    constructor(config = {}) {
      // Store validated config
      this.config = UIConfigInterface.validateConfig(config);
    }
    
    /**
     * Get configuration for this adapter
     * @returns {Object} Configuration object
     */
    getConfig() {
      return this.config;
    }
    // ChatUIInterface methods
    displayMessage(messageData) {}
    updateActiveUsers(users) {}
    getMessageInput() { return ''; }
    clearMessageInput() {}
    setInputEnabled(enabled) {}
    
    // CallUIInterface methods
    showIncomingCallPrompt(peerName, callInfo) { return Promise.resolve(true); }
    hideIncomingCallPrompt(peerName) {}
    showMissedCallNotification(peerName, direction) {}
    showCallDeclinedNotification(peerName) {}
    updateCallButtonStates(state) {}
    
    // StreamDisplayInterface methods
    setStreams(user, streams) {}
    removeStreams(user) {}
    show() {}
    hide() {}
    
    // AudioControllerInterface methods
    setMicMuted(muted, localStreams) {}
    setSpeakersMuted(muted, remoteAudioElements) {}
    isMicMuted() { return false; }
    isSpeakersMuted() { return false; }
    
    // VideoControllerInterface methods
    setVideoHidden(hidden, localStreams) {}
    isVideoHidden() { return false; }
    
    // VideoInterface methods
    setStream(stream) {}
    getStream() { return null; }
    show() {}
    hide() {}
    setMuted(muted) {}
    isMuted() { return false; }
    setAutoplay(autoplay) {}
    setPlaysinline(playsinline) {}
    getElement() { return null; }
    destroy() {}
    
    // RingerInterface methods
    start() {}
    stop() {}
    isRinging() { return false; }
    
    // NotificationInterface methods
    ping() { return Promise.resolve(); }
    beep() { return Promise.resolve(); }
    showNotification(title, options = {}) { return Promise.resolve(); }
    
    // StorageInterface methods
    getItem(key) { return null; }
    setItem(key, value) {}
    removeItem(key) {}
  }

  /**
   * StateManager - Simple state management for UI components
   * 
   * Manages mutable state separate from configuration.
   * Configuration is immutable, state can change.
   * 
   * Usage:
   *   import { StateManager } from './state-manager.js';
   *   
   *   const state = new StateManager({
   *     currentRoom: '',
   *     name: '?'
   *   });
   *   
   *   state.set('currentRoom', 'newRoom');
   *   const room = state.get('currentRoom');
   *   state.on('change', (key, value) => { ... });
   * 
   * @class StateManager
   */


  class StateManager extends EventEmitter {
    /**
     * Create a new StateManager instance
     * @param {Object} initialState - Initial state values
     */
    constructor(initialState = {}) {
      super();
      this._state = { ...initialState };
    }

    /**
     * Get a state value
     * @param {string} key - State key
     * @returns {*} State value
     */
    get(key) {
      return this._state[key];
    }

    /**
     * Set a state value
     * @param {string} key - State key
     * @param {*} value - State value
     */
    set(key, value) {
      const oldValue = this._state[key];
      if (oldValue !== value) {
        this._state[key] = value;
        this.emit('change', { key, value, oldValue });
        this.emit(`change:${key}`, { value, oldValue });
      }
    }

    /**
     * Get all state
     * @returns {Object} Copy of all state
     */
    getAll() {
      return { ...this._state };
    }

    /**
     * Set multiple state values at once
     * @param {Object} updates - Object with key-value pairs
     */
    setMultiple(updates) {
      Object.keys(updates).forEach(key => {
        this.set(key, updates[key]);
      });
    }

    /**
     * Reset state to initial values
     * @param {Object} newInitialState - Optional new initial state
     */
    reset(newInitialState = null) {
      if (newInitialState) {
        this._state = { ...newInitialState };
      } else {
        // Reset to constructor initial state (would need to store it)
        this._state = {};
      }
      this.emit('reset', { state: this.getAll() });
    }
  }

  exports.AudioControllerInterface = AudioControllerInterface;
  exports.BaseMQTTRTCClient = BaseMQTTRTCClient;
  exports.CallManager = CallManager;
  exports.CallUIInterface = CallUIInterface;
  exports.ChatManager = ChatManager;
  exports.ChatUIInterface = ChatUIInterface;
  exports.ConfigPresets = ConfigPresets;
  exports.DeferredPromise = DeferredPromise;
  exports.EventEmitter = EventEmitter;
  exports.Keys = Keys;
  exports.LocalStorageAdapter = LocalStorageAdapter;
  exports.MQTTLoader = MQTTLoader;
  exports.MQTTRTCClient = MQTTRTCClient;
  exports.MemoryAdapter = MemoryAdapter;
  exports.NotificationInterface = NotificationInterface;
  exports.Peer = Peer;
  exports.PluginAdapter = PluginAdapter;
  exports.PromisefulMQTTRTCClient = PromisefulMQTTRTCClient;
  exports.RTCConfig = RTCConfig;
  exports.RTCConnection = RTCConnection;
  exports.RTCVideoChat = RTCVideoChat;
  exports.RingerInterface = RingerInterface;
  exports.SignedMQTTRTCClient = SignedMQTTRTCClient;
  exports.StateManager = StateManager;
  exports.StorageAdapter = StorageAdapter;
  exports.StorageInterface = StorageInterface;
  exports.StreamDisplayInterface = StreamDisplayInterface;
  exports.TabManager = TabManager;
  exports.UIConfigInterface = UIConfigInterface;
  exports.VideoControllerInterface = VideoControllerInterface;
  exports.VideoInterface = VideoInterface;
  exports.deepMerge = deepMerge;
  exports.isObject = isObject;

  return exports;

})({});
//# sourceMappingURL=rtchat-core.js.map
