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
      broker: 'wss://broker.emqx.io:8084/mqtt',
      // broker: 'wss://public:public@public.cloud.shiftr.io',

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
      reconnectPeriod: 500,
      
      /**
       * Connection timeout in milliseconds
       * - Maximum time to wait for MQTT connection to establish
       * - Throws error if connection not established within this time
       */
      connectTimeout: 10000
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
      rtcpMuxPolicy: 'require',
      
      /**
       * Wait for answer timeout (milliseconds)
       * - Maximum time to wait for peer to initiate connection
       * - If peer doesn't initiate within this time, we initiate instead
       * - Lower values = faster fallback but may cause connection conflicts
       * - Higher values = more patient waiting but slower connection establishment
       * - Default: 12000ms (12 seconds)
       * - Recommended range: 3000-15000ms
       */
      waitForAnswerTimeout: 1100
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


// DEBUG: Intercept ALL getUserMedia calls to track stream creation
if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = function(constraints) {
    console.log("🎥🎤 getUserMedia CALLED with constraints:", constraints);
    console.trace("getUserMedia call stack");
    return originalGetUserMedia(constraints).then(stream => {
      console.log("🎥🎤 getUserMedia RETURNED stream with tracks:", stream.getTracks().map(t => `${t.kind}:${t.id}`).join(', '));
      // Add tracking when tracks end
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          console.log("🛑 Track ENDED:", track.kind, track.id);
        });
      });
      return stream;
    });
  };
}

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
    this.maxConnectRetries = configObj.webrtc?.maxConnectRetries || 3;
    this.connectRetryDelay = configObj.webrtc?.connectRetryDelay || 4000;
    this.waitForAnswerTimeout = configObj.webrtc?.waitForAnswerTimeout || 12000;
    this.connectingUsers = new Set();
    this.attemptedPeers = new Set();
    this.waitingForPeerInitiation = new Map(); // Track peers we're waiting to initiate (peerName -> timeoutId)
    this.sharedLocalStream = null; // Shared media stream for all connections (one-to-many)
    this.maxConnectRetries = configObj.webrtc?.maxConnectRetries || 3;
    this.connectRetryDelay = configObj.webrtc?.connectRetryDelay || 4000;


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
    console.log(`MQTT transport connected, subscribing to ${this.topic} as ${this.name}`);
    this.client.subscribe(this.topic, ((err)=>{
    if (!err) {
        console.log("subscribed to ", this.topic);
        // Send initial connect message immediately after subscription is confirmed
        // This ensures we announce our presence as soon as we're ready to receive messages
        console.log(`MQTT subscribed to ${this.topic}, listening for presence as ${this.name}`);
        setTimeout(() => {
          console.log(`MQTT connect: announcing presence as ${this.name} in ${this.topic}`);
          this.postPubliclyToMQTTServer("connect", this.userInfo);
          this.onConnectedToMQTT();
        }, 500);
        
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
  _onMQTTMessage(t, payloadData){
        if (t === this.topic){
            let payload;
            let payloadString;
            
            // Add initial validation for payloadData
            if (payloadData === null || payloadData === undefined) {
                console.error("Received null or undefined MQTT message data");
                return;
            }
            
            try{
                // Try decompression first with original data format (might be Uint8Array)
                const decompressed = this.mqttLoader.decompress(payloadData);
                
                // Check if decompression returned null/undefined
                if (decompressed === null || decompressed === undefined) {
                    console.error("Decompression returned null/undefined for data:", payloadData);
                    return;
                }
                
                // Convert decompressed data to string if it's not already
                if (typeof decompressed === 'string') {
                    payloadString = decompressed;
                } else if (decompressed instanceof Uint8Array) {
                    payloadString = new TextDecoder().decode(decompressed);
                } else if (typeof decompressed === 'object') {
                    // Already an object (decompression returned parsed JSON)
                    payload = decompressed;
                } else {
                    payloadString = String(decompressed);
                }
                
                // Parse JSON if we got a string
                if (!payload && payloadString) {
                    try {
                        payload = JSON.parse(payloadString);
                    } catch (jsonError) {
                        console.error("Failed to parse JSON from decompressed string:", jsonError, "String:", payloadString);
                        return;
                    }
                }
            }catch(e){
                // Fallback: convert to string and try to parse
                console.warn("Decompression failed, attempting fallback parsing:", e.message);
                try {
                    if (payloadData instanceof Uint8Array) {
                        payloadString = new TextDecoder().decode(payloadData);
                    } else if (typeof payloadData !== 'string') {
                        payloadString = String(payloadData);
                    } else {
                        payloadString = payloadData;
                    }
                    
                    if (!payloadString) {
                        console.error("Converted payload string is empty");
                        return;
                    }
                    
                    payload = JSON.parse(payloadString);
                } catch (parseError) {
                    console.error("Failed to parse MQTT message:", parseError, "Raw data:", payloadData, "String:", payloadString);
                    return;
                }
            }
            
            // Validate payload structure
            if (!payload || typeof payload !== 'object') {
                console.error("Invalid payload: not an object", 
                    "Payload:", payload, 
                    "Type:", typeof payload,
                    "Original data:", payloadData);
                return;
            }
            
            if (!payload.sender) {
                console.error("Invalid payload: missing sender property", 
                    "Payload:", payload,
                    "Keys:", Object.keys(payload));
                return;
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
    if (this.connectionMaintenanceInterval) {
      clearInterval(this.connectionMaintenanceInterval);
      this.connectionMaintenanceInterval = null;
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
    this.client.publish(this.topic, payloadString, { retain: false, qos: 0 });
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
        
        console.log(`MQTT connect message received from ${payload.sender}, initiating WebRTC signaling flow`);
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
            
            const weShouldInitiate = this._shouldInitiateConnection(payload.sender);
            // Connection exists but is broken, disconnect it
            if (weShouldInitiate && (connectionState === "failed" || connectionState === "closed" ||
                iceConnectionState === "failed" || iceConnectionState === "closed")) {
                console.warn("Connection to " + payload.sender + " is broken, disconnecting");
                this.disconnectFromUser(payload.sender);
            } else if (connectionState === "new") {
                // Connection is in "new" state - check if it's been stuck for too long
                // If it's been more than 10 seconds, allow a retry
                const connectionAge = Date.now() - (existingConnection.createdAt || 0);
                if (weShouldInitiate && connectionAge > 10000) {
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
                if (weShouldInitiate && connectionAge > 15000) {
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
        this.shouldConnectToUser(payload.sender, payload.data).then(shouldConnect => {
            if (!shouldConnect){
                return;
            }
            if (!this._shouldInitiateConnection(payload.sender)) {
                console.log("connect: Waiting for peer " + payload.sender + " to initiate connection");
                
                // Set up a fallback timeout: if peer doesn't initiate within waitForAnswerTimeout,
                // we'll initiate anyway to prevent hanging
                if (!this.waitingForPeerInitiation.has(payload.sender) && 
                    !this.connectionToUser(payload.sender) && 
                    !this.attemptedPeers.has(payload.sender)) {
                    
                    const fallbackTimeout = setTimeout(() => {
                        console.warn("connect: Peer " + payload.sender + " did not initiate connection within timeout. Initiating fallback connection.");
                        this.waitingForPeerInitiation.delete(payload.sender);
                        
                        // Double-check we're still not connected before initiating
                        if (!this.connectionToUser(payload.sender) && !this.attemptedPeers.has(payload.sender)) {
                            this.attemptedPeers.add(payload.sender);
                            setTimeout(() => this.attemptedPeers.delete(payload.sender), this.waitForAnswerTimeout);
                            this.connectToUser(payload.sender);
                        }
                    }, this.waitForAnswerTimeout);
                    
                    this.waitingForPeerInitiation.set(payload.sender, fallbackTimeout);
                }
                return;
            }
            
            // We should initiate - clear any waiting timeout
            const waitingTimeout = this.waitingForPeerInitiation.get(payload.sender);
            if (waitingTimeout) {
                clearTimeout(waitingTimeout);
                this.waitingForPeerInitiation.delete(payload.sender);
            }
            
            if (this.connectionToUser(payload.sender)) {
                console.log("connect: Already connected or connecting to " + payload.sender);
                return;
            }
            if (this.attemptedPeers.has(payload.sender)) {
                console.log("connect: Already attempted connection to " + payload.sender);
                return;
            }
            this.attemptedPeers.add(payload.sender);
            setTimeout(() => this.attemptedPeers.delete(payload.sender), this.waitForAnswerTimeout);
            this.connectToUser(payload.sender);
        });
    },
    nameChange: payload => {//name
        this.recordNameChange(payload.data.oldName, payload.data.newName);
    },
    unload: payload => {
        // Only disconnect if we actually have a connection to this user
        // This prevents race conditions where we receive old unload messages
        if (this.rtcConnections[payload.sender]) {
            this.disconnectFromUser(payload.sender);
        }
        delete this.knownUsers[payload.sender];
    },
    RTCOffer: payload => {//rtc offer
        this.shouldConnectToUser(payload.sender, payload.data.userInfo).then(r => {
            if (r){
                if (payload.data.offer.target != this.name){return}                
                // Clear waiting timeout since peer is initiating connection
                const waitingTimeout = this.waitingForPeerInitiation.get(payload.sender);
                if (waitingTimeout) {
                    clearTimeout(waitingTimeout);
                    this.waitingForPeerInitiation.delete(payload.sender);
                    console.log("RTCOffer: Cleared waiting timeout for " + payload.sender);
                }
                
                if (this.rtcConnections[payload.sender]){
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
        // Store as shared stream if we don't have one
        if (!this.sharedLocalStream) {
          console.log("MQTTRTCClient.callUser: Storing provided stream as sharedLocalStream");
          this.sharedLocalStream = localStream;
        }
        console.log("MQTTRTCClient.callUser: Using provided MediaStream");
        // startCall returns a promise that resolves to {localStream, remoteStream}
        callStartPromise = this.rtcConnections[user].startCall(localStream);
    }else {
        callInfo = callInfo || {video: true, audio: true};
        
        // CRITICAL: If a stream is being created (pending promise exists), wait for it
        if (this.sharedLocalStreamPromise) {
          console.log("MQTTRTCClient.callUser: ⏳ Waiting for pending shared stream creation");
          callStartPromise = this.sharedLocalStreamPromise.then(sharedStream => {
            console.log("MQTTRTCClient.callUser: ♻️ Using stream from pending promise (tracks:", sharedStream.getTracks().map(t => `${t.kind}:${t.id.substring(0,8)}`).join(', '), ")");
            return this.rtcConnections[user].startCall(sharedStream);
          });
        }
        // Reuse shared stream if it exists and matches callInfo
        else if (this.sharedLocalStream) {
          const hasVideo = this.sharedLocalStream.getVideoTracks().length > 0;
          const hasAudio = this.sharedLocalStream.getAudioTracks().length > 0;
          const matches = (callInfo.video === hasVideo || !callInfo.video) && 
                         (callInfo.audio === hasAudio || !callInfo.audio);
          if (matches) {
            console.log("MQTTRTCClient.callUser: ♻️ Reusing shared local stream (tracks:", this.sharedLocalStream.getTracks().map(t => `${t.kind}:${t.id.substring(0,8)}`).join(', '), ")");
            callStartPromise = this.rtcConnections[user].startCall(this.sharedLocalStream);
          } else {
            console.log("MQTTRTCClient.callUser: ⚠️ Shared stream doesn't match callInfo, creating new stream");
            this.sharedLocalStreamPromise = navigator.mediaDevices.getUserMedia(callInfo).then(localStream => {
              console.log("MQTTRTCClient.callUser: 🆕 Created new stream (tracks:", localStream.getTracks().map(t => `${t.kind}:${t.id.substring(0,8)}`).join(', '), ")");
              this.sharedLocalStream = localStream;
              this.sharedLocalStreamPromise = null; // Clear promise after resolution
              return localStream;
            });
            callStartPromise = this.sharedLocalStreamPromise.then(stream => {
              return this.rtcConnections[user].startCall(stream);
            });
          }
        } else {
          console.log("MQTTRTCClient.callUser: 🆕 Creating first shared local stream");
          // Create promise and store it IMMEDIATELY to prevent race condition
          this.sharedLocalStreamPromise = navigator.mediaDevices.getUserMedia(callInfo).then(localStream => {
            console.log("MQTTRTCClient.callUser: 🆕 Created first stream (tracks:", localStream.getTracks().map(t => `${t.kind}:${t.id.substring(0,8)}`).join(', '), ")");
            this.sharedLocalStream = localStream;
            this.sharedLocalStreamPromise = null; // Clear promise after resolution
            return localStream;
          });
          callStartPromise = this.sharedLocalStreamPromise.then(stream => {
            return this.rtcConnections[user].startCall(stream);
          });
        }
    }
    let callEndPromise = this.rtcConnections[user].callEndPromise.promise;
    return {start: callStartPromise, end: callEndPromise};
  }
  endCallWithUser(user){
    console.log("MQTTRTCClient.endCallWithUser: Ending call with " + user);
    console.log("MQTTRTCClient.endCallWithUser: Available connections:", Object.keys(this.rtcConnections));
    if (this.rtcConnections[user]){
        try {
            console.log("MQTTRTCClient.endCallWithUser: Calling endCall on RTCConnection for " + user);
            this.rtcConnections[user].endCall();
            console.log("MQTTRTCClient.endCallWithUser: Sent endcall message to " + user + " via RTC data channel");
        } catch (err) {
            console.warn("MQTTRTCClient.endCallWithUser: Failed to send endcall via RTC channel, trying MQTT fallback:", err);
            // Fallback: send via MQTT if RTC channel fails
            try {
                this.sendOverRTC("endcall", null, user);
                console.log("MQTTRTCClient.endCallWithUser: Sent endcall message to " + user + " via MQTT fallback");
            } catch (mqttErr) {
                console.error("MQTTRTCClient.endCallWithUser: Failed to send endcall message to " + user + " via both RTC and MQTT:", mqttErr);
            }
        }
    } else {
        console.warn("MQTTRTCClient.endCallWithUser: No RTC connection found for " + user + ", cannot send endcall message");
    }
  }
  callFromUser(user, callInfo, initiatedCall, promises){
    callInfo = callInfo || {video: true, audio: true};
    if (initiatedCall){
        // CRITICAL: If a stream is being created (pending promise exists), wait for it
        if (this.sharedLocalStreamPromise) {
          console.log("MQTTRTCClient.callFromUser: ⏳ Waiting for pending shared stream creation");
          return this.sharedLocalStreamPromise;
        }
        // Reuse shared stream if it exists
        if (this.sharedLocalStream) {
          const hasVideo = this.sharedLocalStream.getVideoTracks().length > 0;
          const hasAudio = this.sharedLocalStream.getAudioTracks().length > 0;
          const matches = (callInfo.video === hasVideo || !callInfo.video) && 
                         (callInfo.audio === hasAudio || !callInfo.audio);
          if (matches) {
            console.log("MQTTRTCClient.callFromUser: ♻️ Reusing shared local stream (tracks:", this.sharedLocalStream.getTracks().map(t => `${t.kind}:${t.id.substring(0,8)}`).join(', '), ")");
            return Promise.resolve(this.sharedLocalStream);
          }
        }
        console.log("MQTTRTCClient.callFromUser: 🆕 Creating new shared local stream");
        this.sharedLocalStreamPromise = navigator.mediaDevices.getUserMedia(callInfo).then(stream => {
          console.log("MQTTRTCClient.callFromUser: 🆕 Created stream (tracks:", stream.getTracks().map(t => `${t.kind}:${t.id.substring(0,8)}`).join(', '), ")");
          this.sharedLocalStream = stream;
          this.sharedLocalStreamPromise = null; // Clear promise after resolution
          return stream;
        });
        return this.sharedLocalStreamPromise;
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
            // CRITICAL: If a stream is being created (pending promise exists), wait for it
            if (this.sharedLocalStreamPromise) {
              console.log("MQTTRTCClient.callFromUser: ⏳ Waiting for pending shared stream creation (incoming)");
              return this.sharedLocalStreamPromise;
            }
            // Reuse shared stream if it exists
            if (this.sharedLocalStream) {
              const hasVideo = this.sharedLocalStream.getVideoTracks().length > 0;
              const hasAudio = this.sharedLocalStream.getAudioTracks().length > 0;
              const matches = (mediaCallInfo.video === hasVideo || !mediaCallInfo.video) && 
                             (mediaCallInfo.audio === hasAudio || !mediaCallInfo.audio);
              if (matches) {
                console.log("MQTTRTCClient.callFromUser: ♻️ Reusing shared local stream (incoming) (tracks:", this.sharedLocalStream.getTracks().map(t => `${t.kind}:${t.id.substring(0,8)}`).join(', '), ")");
                return Promise.resolve(this.sharedLocalStream);
              }
            }
            console.log("MQTTRTCClient.callFromUser: 🆕 Creating new shared local stream (incoming)");
            this.sharedLocalStreamPromise = navigator.mediaDevices.getUserMedia(mediaCallInfo).then(stream => {
              console.log("MQTTRTCClient.callFromUser: 🆕 Created stream (incoming) (tracks:", stream.getTracks().map(t => `${t.kind}:${t.id.substring(0,8)}`).join(', '), ")");
              this.sharedLocalStream = stream;
              this.sharedLocalStreamPromise = null; // Clear promise after resolution
              return stream;
            });
            return this.sharedLocalStreamPromise;
        })
    }
  }
  oncallended(user){
    console.log("BaseMQTTRTCClient.oncallended: Call ended with " + user);
    // Emit the callended event so UI components can react
    this.emit('callended', user);
    console.log("BaseMQTTRTCClient.oncallended: Emitted 'callended' event for " + user);
  }
  acceptCallFromUser(user, callInfo, promises){
     return Promise.resolve(true);
  }
  connectToUser(user){
    if (!user || user === this.name){
        return null;
    }
    const establishedConnection = this.connectionToUser(user);
    if (establishedConnection){
        console.log("connectToUser: Already connected or connecting to " + user);
        return establishedConnection;
    }
    if (this.rtcConnections[user]){
        console.log("connectToUser: Connection to " + user + " is still negotiating");
        return this.rtcConnections[user];
    }
    console.log(`connectToUser: Starting WebRTC offer to ${user}`);
    const rtcConnection = new RTCConnection(this, user);
    this.rtcConnections[user] = rtcConnection;
    rtcConnection.sendOffer();
    return rtcConnection;
  }
  _shouldInitiateConnection(peerName){
    if (!peerName){
        return false;
    }
    // Deterministic tie-breaker: lexicographically smaller name initiates
    // If names are identical (shouldn't happen), fall back to comparing lengths
    if (this.name === peerName){
        return this.name.length <= peerName.length;
    }
    return this.name.localeCompare(peerName) < 0;
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
    this.connectingUsers.delete(user);
    this.attemptedPeers.delete(user);
    
    // Clear any waiting timeout for this user
    const waitingTimeout = this.waitingForPeerInitiation.get(user);
    if (waitingTimeout) {
        clearTimeout(waitingTimeout);
        this.waitingForPeerInitiation.delete(user);
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
    this.connectingUsers.delete(user);
    this.attemptedPeers.delete(user);
  }

  changeName(newName){
    let oldName = this.name;
    const tabID = this.tabManager ? this.tabManager.getTabID() : null;
    this.name = newName + (tabID ? ('(' + tabID + ')') : '');
    
    // Use storage adapter if available, otherwise use localStorage
    if (this.storage) {
      this.storage.setItem("name", newName);
      this.storage.setItem("rtchat_name", newName);
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem("name", newName);
    }
    
    this.postPubliclyToMQTTServer("nameChange", {oldName: oldName, newName: this.name});
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
        this.pendingIceCandidates = []; // Store pending ICE candidates for this connection
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
        this.pendingStreamIceCandidates = []; // Array to store multiple pending ICE candidates
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
            console.log("RTCConnection.registerDataChannel: Received message on channel '" + dataChannel.label + "' from " + this.target, e.data);
            this.onmessage(e, dataChannel.label);
        }).bind(this);
        dataChannel.onerror = ((e) => {
            this.dataChannelDeferredPromises[dataChannel.label].reject(e);
            this.ondatachannelerror(e, dataChannel.label);
        }).bind(this);
        dataChannel.onopen = ((e) => {
            console.log("RTCConnection.registerDataChannel: Data channel '" + dataChannel.label + "' opened for " + this.target);
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
        if (this.streamConnection && this.streamConnection.signalingState !== "closed"){
            console.warn("startCall: stream connection already active or negotiating; returning existing promise");
            return this.streamPromise.promise;
        }
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
            console.warn("Already have a stream connection, reusing existing instance");
            return this.streamConnection;
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
        if (!this.peerConnection){
            console.error("sendOffer called but peerConnection missing");
            return;
        }
        if (this.peerConnection.signalingState !== "stable"){
            console.warn(`sendOffer: signaling state is ${this.peerConnection.signalingState}, waiting for stable state before creating offer`);
            return;
        }
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
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
            .then(() => {
                // Apply all pending ICE candidates now that remote description is set
                if (this.pendingIceCandidates && this.pendingIceCandidates.length > 0) {
                    console.log(`Applying ${this.pendingIceCandidates.length} pending ICE candidates for ${this.target}`);
                    this.pendingIceCandidates.forEach(candidate => {
                        this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                            .catch(err => {
                                console.warn('Error adding pending ICE candidate:', err);
                            });
                    });
                    this.pendingIceCandidates = [];
                }
            })
            .catch(err => {
                console.error('Error setting remote description:', err);
            });
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
                // Return null to indicate failure, don't throw (which would break the chain)
                return null;
            }).then(streamConnection => {
                // Only proceed if streamConnection exists (call was not rejected)
                if (!streamConnection) {
                    return;
                }
                streamConnection.setRemoteDescription(new RTCSessionDescription(offer))
                    .then(() => this.streamConnection.createAnswer())
                    .then(answer => this.streamConnection.setLocalDescription(answer))
                    .then(() => {
                        // Send answer via MQTT
                        console.log("Sending stream answer", this.streamConnection.localDescription);
                        this.send("streamanswer", JSON.stringify({"answer": this.streamConnection.localDescription}));
                        
                        // Apply pending ICE candidates after setting local description
                        // Note: We still need remote description to be set, so these will be applied
                        // when the remote description is set in the streamanswer handler
                        if (this.pendingStreamIceCandidate || (this.pendingStreamIceCandidates && this.pendingStreamIceCandidates.length > 0)) {
                            console.log("Found pending stream ice candidates, will apply when remote description is set");
                        }
                    })
                    .catch(err => {
                        console.error("Error setting remote description or creating answer:", err);
                    });
            });

        }else if (channel === "streamanswer"){
            console.log("received stream answer", event.data);
            let {answer} = JSON.parse(event.data);
            this.streamConnection.setRemoteDescription(new RTCSessionDescription(answer))
                .then(() => {
                    // Apply all pending ICE candidates now that remote description is set
                    if (this.pendingStreamIceCandidates && this.pendingStreamIceCandidates.length > 0) {
                        console.log(`Applying ${this.pendingStreamIceCandidates.length} pending ICE candidates`);
                        this.pendingStreamIceCandidates.forEach(candidate => {
                            try {
                                this.streamConnection.addIceCandidate(new RTCIceCandidate(candidate))
                                    .catch(err => {
                                        console.warn('Error adding pending ICE candidate:', err);
                                    });
                            } catch (err) {
                                console.warn('Error creating ICE candidate:', err);
                            }
                        });
                        this.pendingStreamIceCandidates = [];
                    }
                    // Also handle single pending candidate for backward compatibility
                    if (this.pendingStreamIceCandidate) {
                        try {
                            this.streamConnection.addIceCandidate(new RTCIceCandidate(this.pendingStreamIceCandidate))
                                .catch(err => {
                                    console.warn('Error adding pending ICE candidate:', err);
                                });
                            this.pendingStreamIceCandidate = null;
                        } catch (err) {
                            console.warn('Error creating ICE candidate:', err);
                        }
                    }
                })
                .catch(err => {
                    console.error('Error setting remote description:', err);
                });
        }else if (channel === "streamice"){
            console.log("received stream ice", event.data);
            if (event.data){
                const candidateData = JSON.parse(event.data);
                if (this.streamConnection){
                    // Check if remote description is set before adding ICE candidate
                    if (this.streamConnection.remoteDescription) {
                        // Remote description is set, safe to add ICE candidate
                        this.streamConnection.addIceCandidate(new RTCIceCandidate(candidateData))
                            .catch(err => {
                                // If it fails, store it as pending (might be a duplicate or invalid)
                                console.warn('Error adding ICE candidate, storing as pending:', err);
                                if (!this.pendingStreamIceCandidates) {
                                    this.pendingStreamIceCandidates = [];
                                }
                                this.pendingStreamIceCandidates.push(candidateData);
                            });
                    } else {
                        // Remote description not set yet, store as pending
                        console.log('Remote description not set yet, storing ICE candidate as pending');
                        if (!this.pendingStreamIceCandidates) {
                            this.pendingStreamIceCandidates = [];
                        }
                        this.pendingStreamIceCandidates.push(candidateData);
                        // Also set single pending for backward compatibility
                        this.pendingStreamIceCandidate = candidateData;
                    }
                }else {
                    // Stream connection doesn't exist yet, store as pending
                    this.pendingStreamIceCandidate = candidateData;
                    if (!this.pendingStreamIceCandidates) {
                        this.pendingStreamIceCandidates = [];
                    }
                    this.pendingStreamIceCandidates.push(candidateData);
                }
            }
        }else if (channel === "endcall"){
            console.log("RTCConnection.onmessage: Received endcall message from " + this.target);
            this._closeCall();
        }else {
            this.mqttClient.onrtcmessage(channel, event.data, this.target);
        }
    }
    endCall(){
        console.log("RTCConnection.endCall: Sending endcall message to " + this.target);
        try {
            const sendResult = this.send("endcall", null);
            // send() can return a Promise if channel is not ready
            if (sendResult && typeof sendResult.then === 'function') {
                sendResult
                    .then(() => {
                        console.log("RTCConnection.endCall: Successfully sent endcall message to " + this.target);
                    })
                    .catch((err) => {
                        console.error("RTCConnection.endCall: Failed to send endcall message (async):", err);
                    });
            } else {
                console.log("RTCConnection.endCall: Successfully sent endcall message to " + this.target);
            }
        } catch (err) {
            console.error("RTCConnection.endCall: Failed to send endcall message (sync):", err);
            // Still close the call even if send failed
        }
        this._closeCall();
    }
    _closeCall(){
        console.log("RTCConnection._closeCall: Closing call with " + this.target);
        
        // Mark this connection as closed FIRST (before checking others)
        const wasStreamConnectionActive = !!this.streamConnection;
        
        if (this.streamConnection){
            this.streamConnection.close();
            this.streamConnection = null;
            
            // Always stop remote stream tracks (they're specific to this connection)
            if (this.remoteStream){
                const remoteTracks = this.remoteStream.getTracks();
                console.log(`RTCConnection._closeCall: Stopping ${remoteTracks.length} remote track(s) for ${this.target}`);
                remoteTracks.forEach(track => track.stop());
            }
            this.remoteStream = null;
            this.localStream = null; // Clear reference from THIS connection
        } else {
            console.log(`RTCConnection._closeCall: No streamConnection for ${this.target}`);
        }
        
        // Only check for other connections if THIS connection actually had a stream
        if (wasStreamConnectionActive) {
            // Count OTHER connections that still have active streamConnections
            let otherActiveConnections = 0;
            const allConnections = [];
            if (this.mqttClient && this.mqttClient.rtcConnections) {
                for (const [user, conn] of Object.entries(this.mqttClient.rtcConnections)) {
                    const hasStreamConn = !!(conn && conn.streamConnection);
                    allConnections.push(`${user}:${hasStreamConn ? 'active' : 'inactive'}`);
                    if (user !== this.target && conn && conn.streamConnection) {
                        otherActiveConnections++;
                        console.log(`RTCConnection._closeCall: Found other active connection: ${user}`);
                    }
                }
            }
            
            console.log(`RTCConnection._closeCall: All connections: [${allConnections.join(', ')}]`);
            console.log(`RTCConnection._closeCall: ${otherActiveConnections} other active connections remain (excluding ${this.target})`);
            
            // Only stop shared stream tracks if NO other connections exist
            if (otherActiveConnections === 0) {
                if (this.mqttClient && this.mqttClient.sharedLocalStream) {
                    console.log(`RTCConnection._closeCall: ✅ Last connection closed, stopping shared stream tracks`);
                    const tracks = this.mqttClient.sharedLocalStream.getTracks();
                    console.log(`RTCConnection._closeCall: Shared stream has ${tracks.length} tracks`);
                    tracks.forEach(track => {
                        console.log(`RTCConnection._closeCall: 🛑 Stopping ${track.kind} track ${track.id} (readyState: ${track.readyState})`);
                        track.stop();
                        console.log(`RTCConnection._closeCall: ✅ Stopped ${track.kind} track ${track.id} (new readyState: ${track.readyState})`);
                    });
                    this.mqttClient.sharedLocalStream = null;
                    this.mqttClient.sharedLocalStreamPromise = null; // Also clear the promise
                    console.log(`RTCConnection._closeCall: ✅ Shared stream and promise cleared`);
                } else {
                    console.log(`RTCConnection._closeCall: No shared stream to stop`);
                }
            } else {
                console.log(`RTCConnection._closeCall: ⏸️  ${otherActiveConnections} other connections still active, keeping shared stream alive`);
            }
        }
        
        this.callEndPromise.resolve();
        this.callEndPromise = new DeferredPromise();
        this.callRinging = false;
        this.initiatedCall = false;
        this.pendingStreamIceCandidate = null;
        this.streamConnectionPromise = new DeferredPromise();
        this.streamPromise = new DeferredPromise();
        this.callEndPromise = new DeferredPromise();
        this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};

        if (this.mqttClient && this.mqttClient.oncallended){
            console.log("RTCConnection._closeCall: Calling mqttClient.oncallended for " + this.target);
            this.mqttClient.oncallended(this.target);
        } else {
            console.warn("RTCConnection._closeCall: mqttClient.oncallended is not defined!");
        }
    }

    onReceivedIceCandidate(data) {
        // Check if remote description is set before adding ICE candidate
        if (this.peerConnection.remoteDescription) {
            this.peerConnection.addIceCandidate(new RTCIceCandidate(data))
                .catch(err => {
                    // ICE candidate might be invalid or duplicate, log but don't throw
                    console.warn('Error adding ICE candidate to peer connection:', err);
                });
        } else {
            // Remote description not set yet, store as pending
            // The pending ICE candidate will be applied when the answer is received
            if (!this.pendingIceCandidates) {
                this.pendingIceCandidates = [];
            }
            this.pendingIceCandidates.push(data);
            console.log('Remote description not set, storing ICE candidate as pending');
        }
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
            // Store the original oncallended method that emits the event
            const originalOnCallEnded = this.oncallended;
            // Create a wrapper that calls the original (to emit event)
            // The handler will be called via the event listener registered below
            this.oncallended = (user) => {
                // Call the original method to emit the 'callended' event
                // This will trigger all registered event listeners including the handler
                if (originalOnCallEnded) {
                    originalOnCallEnded.call(this, user);
                }
            };
            // Register handler as event listener so it gets called when event is emitted
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
   * @param {Object} options.chatManager - Optional ChatManager instance for getting active users
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
    this.chatManager = options.chatManager || null;
    
    // Unified call state tracking (platform-agnostic, UI-agnostic)
    this.callState = new CallState();
    
    // Additional metadata tracking (not part of core state)
    this.pendingCalls = new Map(); // Map<user, {callInfo, promises, timeoutId, promptElement}>
    this.outgoingCalls = new Map(); // Map<user, {type, cancelFn, timeoutId}>
    // NOTE: We do NOT track localStreams here - they are tracked in rtcClient.rtcConnections[user].localStream
    // This is the single source of truth for streams
    
    // Group call mesh tracking - tracks which users are in the same group call
    this.groupCallMesh = new Set(); // Set of users in the current group call mesh
    this.groupCallType = null; // 'audio' or 'video' - type of the group call
    
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
      this.rtcClient.on('callended', (user) => {
        console.log("CallManager: Received 'callended' event from RTC client for " + user);
        this._handleCallEnded(user);
      });
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
    
    // Track pending call (autoAccepted flag set after we determine preference)
    this.pendingCalls.set(peerName, {
      callInfo,
      promises,
      timeoutId,
      promptElement: null,
      autoAccepted: false
    });
    
    // Update unified call state
    this.callState.setUserState(peerName, {
      status: 'pending',
      audio: callInfo.audio !== false, // Default to true if not specified
      video: callInfo.video === true
    });
    
    const shouldAutoAccept = this._shouldAutoAcceptIncomingCall(peerName, callInfo);
    const pendingEntry = this.pendingCalls.get(peerName);
    if (pendingEntry) {
      pendingEntry.autoAccepted = shouldAutoAccept;
    }
    
    if (!shouldAutoAccept) {
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
    } else {
      // Stop any ringing ASAP since we're auto-accepting
      if (this.ringer && typeof this.ringer.stop === 'function') {
        this.ringer.stop();
      }
    }
    
    // Emit event for UI to handle (even if auto-accepting, so UI can update state)
    this.emit('incomingcall', {
      peerName,
      callInfo,
      promises,
      timeoutId,
      autoAccepted: shouldAutoAccept
    });
    
    if (shouldAutoAccept) {
      console.log(`Auto-accepting incoming call from ${peerName} (already in group call)`);
      const autoPending = this.pendingCalls.get(peerName);
      if (autoPending && autoPending.timeoutId) {
        clearTimeout(autoPending.timeoutId);
        autoPending.timeoutId = null;
      }
      return Promise.resolve(true);
    }
    
    // Use callUI if provided, otherwise auto-accept
    if (this.callUI && typeof this.callUI.showIncomingCallPrompt === 'function') {
      return this.callUI.showIncomingCallPrompt(peerName, callInfo);
    }
    
    // Default: auto-accept
    return Promise.resolve(true);
  }

  /**
   * Determine whether we should auto-accept an incoming call
   * Auto-accept when we're already in a group call (mesh) or already have an active call,
   * so additional mesh connections don't re-prompt the user.
   * @param {string} peerName
   * @param {Object} callInfo
   * @returns {boolean}
   * @private
   */
  _shouldAutoAcceptIncomingCall(peerName, callInfo) {
    const activeCalls = this.callState.getActiveCalls();
    const totalActiveCalls = activeCalls.audio.size + activeCalls.video.size;
    const isAlreadyInGroupCall = this.groupCallMesh.size > 0;
    
    // Auto-accept if we already have at least one active call or if the group mesh is active.
    if (isAlreadyInGroupCall) {
      return true;
    }
    
    if (totalActiveCalls > 0) {
      return true;
    }
    
    // Default: require explicit acceptance
    return false;
  }

  /**
   * Handle call connected event
   * @param {string} sender - Name of the peer
   * @param {Object} streams - Stream objects {localStream, remoteStream}
   * @private
   */
  _handleCallConnected(sender, {localStream, remoteStream}) {
    // Clear pending-call timeout (incoming)
    const pendingCall = this.pendingCalls.get(sender);
    if (pendingCall && pendingCall.timeoutId) {
      clearTimeout(pendingCall.timeoutId);
      pendingCall.timeoutId = null;
    }
    this.pendingCalls.delete(sender);

    // Clear outgoing-call timeout (our dial)
    const outgoingCall = this.outgoingCalls.get(sender);
    if (outgoingCall && outgoingCall.timeoutId) {
      clearTimeout(outgoingCall.timeoutId);
    }
    this.outgoingCalls.delete(sender);
    
    // Stop ringing if ringer is provided
    if (this.ringer && typeof this.ringer.stop === 'function') {
      this.ringer.stop();
    }
    
    // Determine call type
    const hasVideo = localStream?.getVideoTracks().length > 0 || 
                     remoteStream?.getVideoTracks().length > 0;
    const hasAudio = localStream?.getAudioTracks().length > 0 || 
                     remoteStream?.getAudioTracks().length > 0;
    
    // NOTE: localStream is already stored in rtcClient.rtcConnections[sender].localStream
    // We don't need to store it again in CallManager
    
    // Update unified call state
    this.callState.setUserState(sender, {
      status: 'active',
      audio: hasAudio,
      video: hasVideo
    });
    
    // Check if we should add to group call mesh
    // If we're already in a group call, add them
    // OR if we now have 2+ active calls, start a group call mesh
    // OR if there are 2+ other users in the room, treat this as a group call
    const currentActiveCalls = this.callState.getActiveCalls();
    const totalActiveCalls = currentActiveCalls.audio.size + currentActiveCalls.video.size;
    const activeUsers = this._getActiveUsers();
    const hasMultipleUsers = activeUsers.length >= 2; // 2+ other users in room
    
    // Determine call type from the current call (hasVideo already determined above)
    const callType = hasVideo ? 'video' : 'audio';
    
    if (this.groupCallMesh.size > 0) {
      // Already in a group call - add new participant
      this.groupCallMesh.add(sender);
      console.log(`Added ${sender} to existing group call mesh. Current mesh:`, Array.from(this.groupCallMesh));
      
      // CRITICAL: Automatically connect to all other participants in the mesh
      // This creates the full mesh network - when B joins, B automatically calls C, D, etc.
      this._connectToOtherMeshParticipants(sender);
    } else if (totalActiveCalls >= 2 || hasMultipleUsers) {
      // We now have 2+ active calls OR 2+ users in room - this is a group call!
      // Initialize the mesh with all current participants and all active users
      this.groupCallMesh.clear();
      this.groupCallMesh.add(this.rtcClient.name); // Add ourselves
      this.groupCallMesh.add(sender); // Add the person who just connected
      
      // Add all active call participants
      currentActiveCalls.audio.forEach(user => this.groupCallMesh.add(user));
      currentActiveCalls.video.forEach(user => this.groupCallMesh.add(user));
      
      // Also add all other active users in the room (they might not be connected yet)
      activeUsers.forEach(user => {
        if (user !== this.rtcClient.name) {
          this.groupCallMesh.add(user);
        }
      });
      
      // Set group call type
      this.groupCallType = callType;
      
      console.log(`Detected group call! Initialized mesh with ${this.groupCallMesh.size} participants:`, Array.from(this.groupCallMesh));
      console.log(`Active users in room: ${activeUsers.length}, Active calls: ${totalActiveCalls}, Call type: ${callType}`);
      
      // CRITICAL: Connect ourselves to all other participants in the room
      // This ensures that when B accepts A's call, B automatically calls C
      // When C accepts A's call, C automatically calls B
      // This creates the full mesh network
      // Pass null as newParticipant since we're the one initiating the mesh connections
      this._connectToOtherMeshParticipants(null);
    }
    
    // Start stats polling if not already started
    const activeCalls = this.callState.getActiveCalls();
    if (!this.statsInterval && (activeCalls.video.size > 0 || activeCalls.audio.size > 0)) {
      this._startStatsPolling();
    }
    
    // Get shared local stream from RTC client (single source of truth)
    const sharedLocalStream = this.rtcClient?.sharedLocalStream || localStream;
    
    // Emit event
    this.emit('callconnected', {
      sender,
      localStream: sharedLocalStream,
      remoteStream,
      type: hasVideo ? 'video' : 'audio'
    });
    
    // Use stream displays if provided
    if (hasVideo && this.videoDisplay && typeof this.videoDisplay.setStreams === 'function') {
      this.videoDisplay.setStreams(sender, { localStream: sharedLocalStream, remoteStream });
    } else if (hasAudio && this.audioDisplay && typeof this.audioDisplay.setStreams === 'function') {
      this.audioDisplay.setStreams(sender, { localStream: sharedLocalStream, remoteStream });
    }
  }
  
  /**
   * Connect to all other participants in the group call mesh
   * This creates the full mesh network - everyone connects to everyone
   * @param {string} newParticipant - The participant who just joined (or null if we're initiating)
   * @private
   */
  async _connectToOtherMeshParticipants(newParticipant) {
    if (!this.groupCallType) {
      console.warn('_connectToOtherMeshParticipants called but no groupCallType set');
      return;
    }
    
    const activeCalls = this.callState.getActiveCalls();
    const allActiveParticipants = new Set([
      ...activeCalls.audio,
      ...activeCalls.video
    ]);
    
    // Build list of users we should connect to: anyone in the mesh OR currently active in the room
    const roomParticipants = this._getActiveUsers();
    const meshParticipants = Array.from(this.groupCallMesh || []);
    const potentialParticipants = new Set([
      ...roomParticipants,
      ...meshParticipants
    ]);
    
    const otherParticipants = Array.from(potentialParticipants).filter(user => {
      if (!user) return false;
      if (user === this.rtcClient?.name) return false; // Never call ourselves
      if (newParticipant && user === newParticipant) return false; // Skip the participant we just connected with
      return !allActiveParticipants.has(user); // Skip if we already have an active connection
    });
    
    if (otherParticipants.length === 0) {
      console.log('No other participants to connect to in mesh');
      return;
    }
    
    console.log(`${newParticipant || 'We'} joining group call. Connecting to other participants:`, otherParticipants);
    console.log(`Current active participants:`, Array.from(allActiveParticipants));
    console.log(`Group call mesh:`, Array.from(this.groupCallMesh));
    
    // Call all other participants in parallel
    const callInfo = this.groupCallType === 'audio' 
      ? { video: false, audio: true }
      : { video: true, audio: true };
    
    const connectionPromises = otherParticipants.map(async (participant) => {
      // Check current state for this participant
      const isAlreadyConnected = allActiveParticipants.has(participant);
      const isPending = this.pendingCalls.has(participant);
      const isOutgoing = this.outgoingCalls.has(participant);
      
      if (isAlreadyConnected) {
        console.log(`Skipping ${participant} - already connected`);
        return { participant, skipped: true };
      }
      
      // If we have stale pending/outgoing entries (for example from a previous attempt),
      // clear them so we can safely retry the connection.
      if (isPending) {
        console.log(`Clearing stale pending call for ${participant} before reconnecting`);
        const pending = this.pendingCalls.get(participant);
        if (pending?.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        this.pendingCalls.delete(participant);
      }
      
      if (isOutgoing) {
        console.log(`Cancelling stale outgoing call for ${participant} before reconnecting`);
        const outgoing = this.outgoingCalls.get(participant);
        if (outgoing?.timeoutId) {
          clearTimeout(outgoing.timeoutId);
        }
        this.outgoingCalls.delete(participant);
      }
      
      try {
        console.log(`Auto-connecting to ${participant} in mesh (from ${newParticipant || 'initiator'})`);
        const { start, end } = this.rtcClient.callUser(participant, callInfo);
        
        // Track as automatic mesh connection
        this.outgoingCalls.set(participant, {
          type: this.groupCallType,
          cancelFn: null,
          timeoutId: null,
          isMeshConnection: true
        });
        
        // Wait for connection
        const streamResult = await start;
        if (streamResult && (streamResult.localStream || streamResult.remoteStream)) {
          this._handleCallConnected(participant, streamResult);
        }
        return { participant, success: true };
      } catch (err) {
        console.warn(`Failed to auto-connect to ${participant}:`, err);
        this.outgoingCalls.delete(participant);
        return { participant, success: false, error: err };
      }
    });
    
    // Wait for all connections (but don't fail if some fail)
    const results = await Promise.allSettled(connectionPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    console.log(`Mesh connection: ${successful}/${otherParticipants.length} successful`);
  }

  /**
   * Handle call ended event from receiving "callended" message
   * Only ends the specific call, keeps other connections active
   * @param {string} peerName - Name of the peer
   * @private
   */
  _handleCallEnded(peerName) {
    console.log("CallManager._handleCallEnded: Called for " + peerName + " (receiver side - only end this call)");
    // Check if call is already ended (idempotent)
    const currentState = this.callState.getUserState(peerName);
    if (currentState && currentState.status === 'inactive') {
      // Already ended, skip
      console.log("CallManager._handleCallEnded: Call already ended for " + peerName + ", skipping");
      return;
    }
    
    // Only finalize THIS specific call (receiver side)
    this._finalizeCallClosure(peerName);
    
    // Check if there are any remaining active calls after closing this one
    const remainingActiveCalls = this.callState.getActiveCalls();
    const hasRemainingCalls = remainingActiveCalls.audio.size > 0 || remainingActiveCalls.video.size > 0;
    
    console.log("CallManager._handleCallEnded: After ending " + peerName + ", remaining calls:", {
      audio: Array.from(remainingActiveCalls.audio),
      video: Array.from(remainingActiveCalls.video),
      hasRemainingCalls
    });
    
    // Only stop stats polling if no calls remain
    // Note: RTC layer handles closing streams/stopping tracks
    if (!hasRemainingCalls) {
      this._stopStatsPolling();
      this.groupCallMesh.clear();
      this.groupCallType = null;
      console.log("CallManager._handleCallEnded: No remaining calls, released all resources");
    } else {
      console.log("CallManager._handleCallEnded: Other calls still active, keeping resources");
    }
  }

  /**
   * Handle call timeout
   * @param {string} peerName - Name of the peer
   * @param {string} direction - 'incoming' or 'outgoing'
   * @private
   */
  _handleCallTimeout(peerName, direction) {
    const pendingCall = this.pendingCalls.get(peerName);
    const wasAutoAccepted = pendingCall?.autoAccepted;
    
    // Stop ringing if ringer is provided
    if (this.ringer && typeof this.ringer.stop === 'function') {
      this.ringer.stop();
    }
    
    // End call with RTC client to send message
    if (this.rtcClient && this.rtcClient.endCallWithUser) {
      try {
        this.rtcClient.endCallWithUser(peerName);
      } catch (err) {
        console.warn(`Error ending timed out call:`, err);
      }
    }
    
    // Finalize only this specific call
    this._finalizeCallClosure(peerName);
    
    // Check if there are any remaining active calls
    const remainingActiveCalls = this.callState.getActiveCalls();
    const hasRemainingCalls = remainingActiveCalls.audio.size > 0 || remainingActiveCalls.video.size > 0;
    
    // Only release resources if no calls remain
    // Note: RTC layer handles closing streams/stopping tracks
    if (!hasRemainingCalls) {
      this._stopStatsPolling();
      this.groupCallMesh.clear();
      this.groupCallType = null;
    }
    
    // Emit timeout event for UI notifications
    this.emit('calltimeout', { peerName, direction });
    
    // Use callUI if provided (skip notifications for auto-accepted mesh calls)
    if (!wasAutoAccepted && this.callUI && typeof this.callUI.showMissedCallNotification === 'function') {
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
      
      // Finalize only this specific call
      this._finalizeCallClosure(user);
      
      // Check if there are any remaining active calls
      const remainingActiveCalls = this.callState.getActiveCalls();
      const hasRemainingCalls = remainingActiveCalls.audio.size > 0 || remainingActiveCalls.video.size > 0;
      
      // Only release resources if no calls remain
      // Note: RTC layer handles closing streams/stopping tracks
      if (!hasRemainingCalls) {
        this._stopStatsPolling();
        this.groupCallMesh.clear();
        this.groupCallType = null;
      }
    }
  }

  /**
   * Log all active tracks and their dependent streams
   * Single source of truth: rtcClient.rtcConnections
   * @private
   */
  _logActiveTracksAndStreams() {
    console.log("=== ACTIVE TRACKS AND STREAMS (Single Source: rtcConnections) ===");
    
    const allTracks = new Map(); // track.id -> {track, owners: []}
    
    // Collect from rtcConnections ONLY (single source of truth)
    if (this.rtcClient && this.rtcClient.rtcConnections) {
      for (const [user, conn] of Object.entries(this.rtcClient.rtcConnections)) {
        if (conn && conn.localStream && conn.localStream.getTracks) {
          conn.localStream.getTracks().forEach(track => {
            if (!allTracks.has(track.id)) {
              allTracks.set(track.id, { track, owners: [] });
            }
            allTracks.get(track.id).owners.push(user);
          });
        }
      }
    }
    
    console.log(`Total unique tracks: ${allTracks.size}`);
    for (const [trackId, {track, owners}] of allTracks.entries()) {
      console.log(`  Track ${track.kind} ${trackId.substring(0, 8)}... (readyState: ${track.readyState})`);
      console.log(`    - Used by rtcConnections: [${owners.join(', ')}]`);
    }
    console.log("==================================================================");
  }

  /**
   * Close a stream properly: stop its tracks only if not shared by other streams
   * CRITICAL: This is the ONLY method that should stop tracks
   * Single source of truth: rtcClient.rtcConnections
   * @param {MediaStream} stream - Stream to close
   * @param {string} streamOwner - Owner identifier (for checking if track is shared)
   * @private
   */
  _closeStream(stream, streamOwner) {
    if (!stream || typeof stream.getTracks !== 'function') {
      console.warn(`_closeStream: Invalid stream for ${streamOwner}`);
      return;
    }
    
    const tracks = stream.getTracks();
    console.log(`_closeStream: Closing stream for ${streamOwner} with ${tracks.length} track(s)`);
    
    tracks.forEach(track => {
      // Check if ANY other RTC connection uses this track (single source of truth)
      let trackShared = false;
      
      if (this.rtcClient && this.rtcClient.rtcConnections) {
        for (const [user, conn] of Object.entries(this.rtcClient.rtcConnections)) {
          if (user === streamOwner) continue; // Skip the connection we're closing
          if (conn && conn.localStream && conn.localStream.getTracks) {
            if (conn.localStream.getTracks().some(t => t.id === track.id)) {
              trackShared = true;
              console.log(`_closeStream: Track ${track.kind} ${track.id.substring(0,8)}... is shared with rtcConnection[${user}]`);
              break;
            }
          }
        }
      }
      
      // Only stop track if NOT shared
      if (!trackShared) {
        console.log(`_closeStream: Stopping ${track.kind} track ${track.id.substring(0,8)}... (readyState: ${track.readyState})`);
        try {
          track.stop();
          console.log(`_closeStream: Stopped track (new readyState: ${track.readyState})`);
        } catch (err) {
          console.warn(`_closeStream: Failed to stop track:`, err);
        }
      } else {
        console.log(`_closeStream: Keeping ${track.kind} track ${track.id.substring(0,8)}... alive (shared)`);
      }
    });
    
    // Log state after closing
    this._logActiveTracksAndStreams();
  }

  /**
   * Close the stream for a specific RTC connection
   * Single source of truth: rtcClient.rtcConnections[user].localStream
   * @param {string} user - User identifier
   * @private
   */
  _releaseLocalStreamForUser(user) {
    console.log(`_releaseLocalStreamForUser: Closing stream for ${user}`);
    this._logActiveTracksAndStreams();
    
    if (!this.rtcClient || !this.rtcClient.rtcConnections || !this.rtcClient.rtcConnections[user]) {
      console.log(`_releaseLocalStreamForUser: No RTC connection for ${user}`);
      return;
    }
    
    const conn = this.rtcClient.rtcConnections[user];
    const stream = conn.localStream;
    
    if (!stream) {
      console.log(`_releaseLocalStreamForUser: No localStream in connection for ${user}`);
      return;
    }
    
    // Remove from connection BEFORE closing (so _closeStream doesn't see it when checking)
    conn.localStream = null;
    
    // Close the stream (will check if tracks are shared and stop accordingly)
    this._closeStream(stream, user);
  }

  /**
   * Fully tear down local bookkeeping for a peer that has ended
   * @param {string} user
   * @private
   */
  _finalizeCallClosure(user) {
    if (!user) {
      return;
    }
    
    // Clear pending call timeouts
    const pendingCall = this.pendingCalls.get(user);
    if (pendingCall && pendingCall.timeoutId) {
      clearTimeout(pendingCall.timeoutId);
    }
    this.pendingCalls.delete(user);
    
    // Clear outgoing call timeouts
    const outgoingCall = this.outgoingCalls.get(user);
    if (outgoingCall && outgoingCall.timeoutId) {
      clearTimeout(outgoingCall.timeoutId);
    }
    this.outgoingCalls.delete(user);
    
    // Reset unified call state
    this.callState.setUserState(user, {
      status: 'inactive',
      audio: false,
      video: false
    });
    
    // Note: RTC layer handles closing streams/stopping tracks via endCallWithUser
    this.latencyMetrics.delete(user);
    
    // Remove from group call mesh (and clear when empty)
    if (this.groupCallMesh.has(user)) {
      this.groupCallMesh.delete(user);
      console.log(`Removed ${user} from group call mesh. Remaining:`, Array.from(this.groupCallMesh));
      if (this.groupCallMesh.size <= 1) {
        this.groupCallMesh.clear();
        this.groupCallType = null;
        console.log('Group call mesh cleared - no more participants');
      }
    }
    
    // Notify UI layers that this peer is gone
    this.emit('callended', { peerName: user });
  }

  /**
   * Close all streams from RTC connections
   * Single source of truth: rtcClient.rtcConnections
   * @private
   */
  _releaseAllLocalStreams() {
    console.log(`_releaseAllLocalStreams: Closing all RTC connection streams`);
    
    if (!this.rtcClient || !this.rtcClient.rtcConnections) {
      console.log(`_releaseAllLocalStreams: No RTC connections`);
      return;
    }
    
    // Get all users with connections
    const users = Object.keys(this.rtcClient.rtcConnections);
    console.log(`_releaseAllLocalStreams: Found ${users.length} connections`);
    
    // Close each stream individually
    for (const user of users) {
      this._releaseLocalStreamForUser(user);
    }
  }

  /**
   * Get list of active users (connected peers)
   * @returns {Array<string>} Array of user names
   * @private
   */
  _getActiveUsers() {
    let users = [];
    
    // Try to get from chatManager first
    if (this.chatManager && typeof this.chatManager.getActiveUsers === 'function') {
      users = this.chatManager.getActiveUsers();
      console.log('Got active users from chatManager:', users);
      return users;
    }
    
    // Fallback to rtcClient connectedUsers
    if (this.rtcClient && this.rtcClient.connectedUsers) {
      const connected = this.rtcClient.connectedUsers;
      users = Array.isArray(connected) ? connected : [];
      console.log('Got active users from rtcClient.connectedUsers:', users);
      return users;
    }
    
    // Last resort: get from rtcConnections
    if (this.rtcClient && this.rtcClient.rtcConnections) {
      users = Object.keys(this.rtcClient.rtcConnections).filter(user => {
        const conn = this.rtcClient.rtcConnections[user];
        return conn && conn.peerConnection && 
               (conn.peerConnection.connectionState === 'connected' || 
                conn.peerConnection.connectionState === 'completed');
      });
      console.log('Got active users from rtcConnections:', users);
      return users;
    }
    
    console.warn('No active users found!');
    return [];
  }

  /**
   * Start a group call with multiple users - creates a full mesh network
   * @param {string|Array<string>} users - 'all' to call all active users, or array of user names
   * @param {string} type - 'audio' or 'video'
   * @returns {Promise} Promise that resolves with results for all calls
   */
  async startGroupCall(users, type) {
    if (!this.rtcClient || !this.rtcClient.callUser) {
      throw new Error('RTC client not available or does not support callUser');
    }
    
    // Get target users
    let targetUsers;
    if (users === 'all') {
      targetUsers = this._getActiveUsers();
      console.log('startGroupCall: Got active users for "all":', targetUsers);
    } else if (Array.isArray(users)) {
      targetUsers = users;
      console.log('startGroupCall: Using provided user array:', targetUsers);
    } else {
      // Single user - convert to array
      targetUsers = [users];
      console.log('startGroupCall: Single user converted to array:', targetUsers);
    }
    
    if (targetUsers.length === 0) {
      console.error('startGroupCall: No users to call!');
      throw new Error('No users to call');
    }
    
    console.log(`startGroupCall: Will call ${targetUsers.length} users:`, targetUsers);
    
    // Filter out users we're already calling
    const activeCalls = this.callState.getActiveCalls();
    const pendingCalls = this.callState.getPendingCalls();
    const alreadyInCall = new Set([
      ...activeCalls.audio,
      ...activeCalls.video,
      ...pendingCalls,
      ...this.outgoingCalls.keys()
    ]);
    
    targetUsers = targetUsers.filter(user => !alreadyInCall.has(user));
    
    if (targetUsers.length === 0) {
      throw new Error('All selected users are already in a call');
    }
    
    // Initialize group call mesh - add ourselves and all target users
    this.groupCallMesh.clear();
    this.groupCallMesh.add(this.rtcClient.name); // Add ourselves
    targetUsers.forEach(user => this.groupCallMesh.add(user));
    this.groupCallType = type;
    
    console.log(`Starting group ${type} call mesh with ${targetUsers.length} users:`, targetUsers);
    console.log('Group call mesh participants:', Array.from(this.groupCallMesh));
    
    const callInfo = type === 'audio' 
      ? { video: false, audio: true }
      : { video: true, audio: true };
    
    console.log(`Calling ${targetUsers.length} users simultaneously:`, targetUsers);
    
    // Start calls to all users in parallel - call RTC client directly
    // When each user accepts, they will automatically connect to all other participants
    const callPromises = targetUsers.map(async (user) => {
      try {
        console.log(`Initiating call to ${user}...`);
        
        // Track as outgoing call
        const timeoutId = setTimeout(() => {
          this._handleCallTimeout(user, 'outgoing');
        }, this.options.callTimeout);
        
        this.outgoingCalls.set(user, {
          type,
          cancelFn: null,
          timeoutId,
          isMeshConnection: false
        });
        
        // Call RTC client directly (bypass startCall to avoid single-call assumptions)
        const { start, end } = this.rtcClient.callUser(user, callInfo);
        
        // Await the start promise to get the streams
        const streamResult = await start;
        
        // Clear timeout if call started successfully
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // If streamResult contains streams, handle them
        if (streamResult && (streamResult.localStream || streamResult.remoteStream)) {
          this._handleCallConnected(user, streamResult);
        }
        
        // Emit event
        this.emit('callstarted', { user, type });
        
        console.log(`Successfully called ${user}`);
        return { user, success: true, result: { ...streamResult, end } };
      } catch (err) {
        console.error(`Failed to call ${user}:`, err);
        
        // Clear timeout
        const outgoingCall = this.outgoingCalls.get(user);
        if (outgoingCall && outgoingCall.timeoutId) {
          clearTimeout(outgoingCall.timeoutId);
        }
        this.outgoingCalls.delete(user);
        
        // Remove from mesh if call failed
        this.groupCallMesh.delete(user);
        
        // Check if call was rejected
        if (err === "Call rejected" || err?.message === "Call rejected") {
          this._handleCallEnded(user);
          this.emit('callrejected', { user });
        } else {
          this._handleCallEnded(user);
          this.emit('callerror', { user, error: err });
        }
        
        // Don't end other calls if one fails
        return { user, success: false, error: err };
      }
    });
    
    const results = await Promise.allSettled(callPromises);
    
    // Process results
    const successful = [];
    const failed = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successful.push(result.value.user);
      } else {
        failed.push({
          user: targetUsers[index],
          error: result.status === 'fulfilled' ? result.value.error : result.reason
        });
        this.groupCallMesh.delete(targetUsers[index]);
      }
    });
    
    // Emit group call event
    this.emit('groupcallstarted', { 
      users: targetUsers, 
      type, 
      successful,
      failed,
      results 
    });
    
    return {
      successful,
      failed,
      total: targetUsers.length
    };
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
        // Only end this specific call, not all calls
        this._handleCallEnded(user);
        this.emit('callrejected', { user });
      } else {
        // For other errors, only end this specific call
        this._handleCallEnded(user);
        this.emit('callerror', { user, error: err });
      }
      
      throw err;
    }
  }

  /**
   * End a call with a user
   * This ends the specific call and sends "endcall" message to peer
   * Note: For ending all calls (button click), use endAllCalls() instead
   * @param {string} user - Name of the user
   */
  endCall(user) {
    console.log("CallManager.endCall: Ending call with " + user);
    
    // Tell RTC client to end the call and send "endcall" message to peer
    if (this.rtcClient && this.rtcClient.endCallWithUser) {
      try {
        this.rtcClient.endCallWithUser(user);
      } catch (err) {
        console.error(`Error ending call:`, err);
      }
    }
    
    // Finalize this specific call locally
    this._finalizeCallClosure(user);
    
    // Check if there are any remaining active calls
    const remainingActiveCalls = this.callState.getActiveCalls();
    const hasRemainingCalls = remainingActiveCalls.audio.size > 0 || remainingActiveCalls.video.size > 0;
    
    // Only stop stats polling if no calls remain
    // Note: RTC layer handles closing streams/stopping tracks
    if (!hasRemainingCalls) {
      this._stopStatsPolling();
      this.groupCallMesh.clear();
      this.groupCallType = null;
      console.log("CallManager.endCall: No remaining calls, released all resources");
    } else {
      console.log("CallManager.endCall: Other calls still active, keeping resources");
    }
  }

  /**
   * End all active calls (initiator side - button click)
   * Delegates to RTC layer which handles streams and tracks
   */
  endAllCalls() {
    console.log("CallManager.endAllCalls: Ending ALL calls");
    
    // Get users from call state
    const activeCalls = this.callState.getActiveCalls();
    const pendingCalls = this.callState.getPendingCalls();
    const allUsers = new Set([...activeCalls.video, ...activeCalls.audio, ...pendingCalls, ...this.outgoingCalls.keys()]);
    
    // ALSO get users from rtcConnections (source of truth for actual connections)
    if (this.rtcClient && this.rtcClient.rtcConnections) {
      for (const user of Object.keys(this.rtcClient.rtcConnections)) {
        allUsers.add(user);
      }
    }
    
    console.log("CallManager.endAllCalls: All users to end:", Array.from(allUsers));
    
    // Delegate to RTC client to end calls (it handles streams/tracks)
    for (const user of allUsers) {
      this.endCall(user);
    }
    
    console.log("CallManager.endAllCalls: Complete");
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
        // Check if stream connection exists and is in a connected state
        if (streamConnection && (streamConnection.iceConnectionState === 'connected' || streamConnection.iceConnectionState === 'completed')) {
          const stats = await streamConnection.getStats();
          
          let rtt = null;
          let packetLoss = null;
          let jitter = null;
          
          // Parse stats - WebRTC stats API structure
          for (const [id, report] of stats.entries()) {
            // Try multiple ways to get RTT
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              // currentRoundTripTime is in seconds, convert to ms
              if (report.currentRoundTripTime !== undefined && report.currentRoundTripTime > 0) {
                rtt = report.currentRoundTripTime * 1000;
              } else if (report.roundTripTime !== undefined && report.roundTripTime > 0) {
                rtt = report.roundTripTime * 1000;
              }
            }
            
            // Also check transport stats for RTT
            if (report.type === 'transport') {
              if (report.currentRoundTripTime !== undefined && report.currentRoundTripTime > 0) {
                rtt = report.currentRoundTripTime * 1000;
              } else if (report.rtt !== undefined && report.rtt > 0) {
                rtt = report.rtt * 1000;
              }
            }
            
            // Get audio stats
            if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
              if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                const totalPackets = report.packetsLost + report.packetsReceived;
                if (totalPackets > 0) {
                  packetLoss = (report.packetsLost / totalPackets) * 100;
                }
              }
              // jitter is already in seconds, convert to ms
              if (report.jitter !== undefined && report.jitter > 0) {
                jitter = report.jitter * 1000;
              }
            }
            
            // Get video stats (for packet loss if audio didn't have it)
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
          
          // Only update metrics if we got at least one valid value
          // This prevents overwriting with null values
          const currentMetrics = this.latencyMetrics.get(user) || { rtt: null, packetLoss: null, jitter: null };
          const updatedMetrics = {
            rtt: rtt !== null ? rtt : currentMetrics.rtt,
            packetLoss: packetLoss !== null ? packetLoss : currentMetrics.packetLoss,
            jitter: jitter !== null ? jitter : currentMetrics.jitter
          };
          
          // Store metrics
          this.latencyMetrics.set(user, updatedMetrics);
          
          // Emit event
          this.emit('metricsupdated', { user, metrics: updatedMetrics });
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
    // Note: RTC layer handles closing streams/stopping tracks
    this.pendingCalls.clear();
    this.outgoingCalls.clear();
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
      this._hydrateActiveUsersFromClient();
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
      const isSignedClient = this.rtcClient && Array.isArray(this.rtcClient.validatedPeers);
      
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
   * Ensure previously validated/connected peers are reflected in activeUsers.
   * Without this, users validated before ChatManager initializes would never appear active.
   * @private
   */
  _hydrateActiveUsersFromClient() {
    if (!this.rtcClient) {
      return;
    }
    
    // Signed clients expose validatedPeers
    if (Array.isArray(this.rtcClient.validatedPeers)) {
      this.rtcClient.validatedPeers.forEach((peerName) => {
        if (peerName && !this.activeUsers.includes(peerName)) {
          console.log('ChatManager: Hydrating validated peer', peerName);
          this._handleUserConnected(peerName);
        }
      });
    } else {
      // Fallback for non-signed clients
      let connected = null;
      if (typeof this.rtcClient.connectedUsers === 'function') {
        connected = this.rtcClient.connectedUsers();
      } else if (Array.isArray(this.rtcClient.connectedUsers)) {
        connected = this.rtcClient.connectedUsers;
      }
      
      if (Array.isArray(connected) && connected.length) {
        connected.forEach((peerName) => {
          if (peerName && !this.activeUsers.includes(peerName)) {
            console.log('ChatManager: Hydrating connected peer', peerName);
            this._handleUserConnected(peerName);
          }
        });
      }
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
 * UIComponentBase - Abstract base class for UI components that extend HTMLElement
 * 
 * This base class provides common functionality for all UI components:
 * - Shadow DOM setup
 * - Configuration management
 * - Lifecycle hooks
 * - Event handling utilities
 * 
 * All UI components that extend HTMLElement should extend this class.
 * 
 * @abstract
 */
class UIComponentBase extends HTMLElement {
  /**
   * Create a new UIComponentBase instance
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    super();
    
    // Store configuration
    this.config = { ...config };
    
    // Initialize shadow DOM (can be overridden)
    this._initShadowDOM();
    
    // Setup lifecycle
    this._initialized = false;
  }

  /**
   * Initialize shadow DOM (can be overridden by subclasses)
   * @protected
   */
  _initShadowDOM() {
    // Default: open shadow DOM
    // Subclasses can override to use closed shadow DOM or no shadow DOM
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Called when element is connected to DOM
   * Subclasses should override connectedCallback() and call super.connectedCallback()
   */
  connectedCallback() {
    if (!this._initialized) {
      this._initialize();
      this._initialized = true;
    }
  }

  /**
   * Called when element is disconnected from DOM
   * Subclasses should override disconnectedCallback() and call super.disconnectedCallback()
   */
  disconnectedCallback() {
    // Cleanup can be done here
  }

  /**
   * Initialize the component
   * Subclasses should override this method
   * @protected
   */
  _initialize() {
    // Override in subclasses
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} Configuration value
   */
  getConfig(key, defaultValue = undefined) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   */
  setConfig(key, value) {
    this.config[key] = value;
  }

  /**
   * Dispatch a custom event
   * @param {string} eventName - Event name
   * @param {Object} detail - Event detail object
   * @param {boolean} bubbles - Whether event bubbles (default: true)
   * @param {boolean} composed - Whether event crosses shadow DOM boundary (default: true)
   */
  dispatchCustomEvent(eventName, detail = {}, bubbles = true, composed = true) {
    this.dispatchEvent(new CustomEvent(eventName, {
      detail,
      bubbles,
      composed
    }));
  }

  /**
   * Get the root element (shadow root or this)
   * @returns {ShadowRoot|HTMLElement} Root element
   */
  getRoot() {
    return this.shadowRoot || this;
  }

  /**
   * Query selector in root
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null} Element or null
   */
  queryRoot(selector) {
    const root = this.getRoot();
    return root.querySelector ? root.querySelector(selector) : null;
  }

  /**
   * Query selector all in root
   * @param {string} selector - CSS selector
   * @returns {NodeList} Elements
   */
  queryRootAll(selector) {
    const root = this.getRoot();
    return root.querySelectorAll ? root.querySelectorAll(selector) : [];
  }
}

/**
 * StreamDisplayBase - Abstract base class for stream display components
 * 
 * This base class extends UIComponentBase and implements StreamDisplayInterface.
 * It provides common functionality for components that display audio/video streams.
 * 
 * Subclasses should implement:
 * - setStreams(user, streams)
 * - removeStreams(user)
 * 
 * @abstract
 * @extends UIComponentBase
 * @implements StreamDisplayInterface
 */


class StreamDisplayBase extends UIComponentBase {
  /**
   * Create a new StreamDisplayBase instance
   * @param {HTMLElement} container - Container element (optional, can be set later)
   * @param {Object} config - Configuration options
   */
  constructor(container = null, config = {}) {
    super(config);
    
    this.container = container;
    this.activeStreams = {}; // Track streams by user name
    
    // If container is provided and we're not a custom element, attach to it
    if (container && !this.isConnected) ;
  }

  /**
   * Set streams for a user
   * Must be implemented by subclasses
   * @param {string} user - User name
   * @param {Object} streams - {localStream: MediaStream, remoteStream: MediaStream}
   * @abstract
   */
  setStreams(user, streams) {
    throw new Error('setStreams must be implemented by subclass');
  }

  /**
   * Remove streams for a user
   * Must be implemented by subclasses
   * @param {string} user - User name
   * @abstract
   */
  removeStreams(user) {
    throw new Error('removeStreams must be implemented by subclass');
  }

  /**
   * Show the stream display
   * Default implementation - can be overridden
   */
  show() {
    if (this.container) {
      this.container.style.display = 'block';
    } else if (this.shadowRoot) {
      const root = this.getRoot();
      if (root.style) {
        root.style.display = 'block';
      }
    }
  }

  /**
   * Hide the stream display
   * Default implementation - can be overridden
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    } else if (this.shadowRoot) {
      const root = this.getRoot();
      if (root.style) {
        root.style.display = 'none';
      }
    }
  }

  /**
   * Check if there are active streams
   * @returns {boolean} True if there are active streams
   */
  hasActiveStreams() {
    return Object.keys(this.activeStreams).length > 0;
  }

  /**
   * Get list of active user names
   * @returns {string[]} Array of user names with active streams
   */
  getActiveUsers() {
    return Object.keys(this.activeStreams);
  }

  /**
   * Remove all streams
   */
  removeAllStreams() {
    const users = Object.keys(this.activeStreams);
    users.forEach(user => this.removeStreams(user));
  }

  /**
   * Setup track end handlers for a stream
   * @param {string} user - User name
   * @param {MediaStream} localStream - Local stream
   * @param {MediaStream} remoteStream - Remote stream
   * @protected
   */
  _setupTrackEndHandlers(user, localStream, remoteStream) {
    const streamData = this.activeStreams[user];
    if (!streamData) return;

    // Remove existing handlers
    if (streamData.trackEndHandlers) {
      streamData.trackEndHandlers.forEach(handler => {
        if (handler.track && handler.track.onended) {
          handler.track.onended = null;
        }
      });
    }
    streamData.trackEndHandlers = [];

    // Setup new handlers
    const handleTrackEnd = () => {
      console.log(`Stream track ended for ${user}`);
      this.removeStreams(user);
    };

    if (remoteStream && remoteStream instanceof MediaStream && typeof remoteStream.getTracks === 'function') {
      remoteStream.getTracks().forEach(track => {
        track.onended = handleTrackEnd;
        streamData.trackEndHandlers.push({ track, type: 'remote' });
      });
    }
    if (localStream && localStream instanceof MediaStream && typeof localStream.getTracks === 'function') {
      localStream.getTracks().forEach(track => {
        track.onended = handleTrackEnd;
        streamData.trackEndHandlers.push({ track, type: 'local' });
      });
    }
  }

  /**
   * Stop all tracks in a stream
   * @param {MediaStream} stream - Media stream
   * @protected
   */
  _stopStreamTracks(stream) {
    if (stream && stream instanceof MediaStream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }
  }
}

/**
 * ActiveUsersListBase - Abstract base class for active users list components
 * 
 * This abstract class defines the contract for displaying and managing
 * active users in a chat interface. It is implementation-agnostic and can
 * be implemented using HTMLElement, React, Vue, or any other framework.
 * 
 * @abstract
 */
class ActiveUsersListBase {
  /**
   * Create a new ActiveUsersListBase instance
   * @param {Object} config - Configuration options
   * @param {Array<string>} config.userColors - Array of colors for users
   */
  constructor(config = {}) {
    if (new.target === ActiveUsersListBase) {
      throw new Error('ActiveUsersListBase is abstract and cannot be instantiated directly');
    }
    
    this.config = {
      userColors: config.userColors || ['lightcoral', 'lightseagreen', 'lightsalmon', 'lightgreen'],
      ...config
    };
    
    this.userColorMap = new Map(); // Map<user, color>
  }

  /**
   * Update the list of active users
   * Must be implemented by subclasses
   * @param {Array<string>} users - List of active user names
   * @param {Function} getUserColor - Optional function to get color for a user
   * @abstract
   */
  updateUsers(users, getUserColor = null) {
    throw new Error('updateUsers must be implemented by subclass');
  }

  /**
   * Get color for a user (for consistency)
   * Default implementation - can be overridden
   * @param {string} user - User name
   * @returns {string} Color
   */
  getUserColor(user) {
    if (!this.userColorMap.has(user)) {
      const index = this.userColorMap.size;
      const userColors = this.config.userColors || [];
      const color = userColors[index % userColors.length];
      this.userColorMap.set(user, color);
    }
    return this.userColorMap.get(user);
  }

  /**
   * Set user color explicitly
   * @param {string} user - User name
   * @param {string} color - Color
   */
  setUserColor(user, color) {
    this.userColorMap.set(user, color);
  }

  /**
   * Clear the user list
   * Must be implemented by subclasses
   * @abstract
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }

  /**
   * Notify that a user was clicked
   * Subclasses should call this when a user is clicked
   * @param {string} user - User name
   * @protected
   */
  _onUserClick(user) {
    // Default implementation - subclasses can override to dispatch events
    if (this.onUserClick) {
      this.onUserClick(user);
    }
  }
}

/**
 * MessagesComponentBase - Abstract base class for messages display components
 * 
 * This abstract class defines the contract for displaying and managing
 * chat messages. It is implementation-agnostic and can be implemented
 * using HTMLElement, React, Vue, or any other framework.
 * 
 * @abstract
 */
class MessagesComponentBase {
  /**
   * Create a new MessagesComponentBase instance
   * @param {Object} config - Configuration options
   * @param {string} config.primaryUserColor - Color for primary user messages
   * @param {Array<string>} config.userColors - Array of colors for other users
   */
  constructor(config = {}) {
    if (new.target === MessagesComponentBase) {
      throw new Error('MessagesComponentBase is abstract and cannot be instantiated directly');
    }
    
    this.config = {
      primaryUserColor: config.primaryUserColor || 'lightblue',
      userColors: config.userColors || ['lightcoral', 'lightseagreen', 'lightsalmon', 'lightgreen'],
      ...config
    };
    
    this.userColorMap = new Map(); // Map<user, color>
  }

  /**
   * Append a message to the display
   * Must be implemented by subclasses
   * @param {Object} messageData - Message data
   * @param {string|HTMLElement} messageData.data - Message content (string or custom element)
   * @param {string} messageData.sender - Sender name
   * @param {number} messageData.timestamp - Timestamp
   * @param {boolean} messageData.isOwn - Whether this is the current user's message
   * @abstract
   */
  appendMessage(messageData) {
    throw new Error('appendMessage must be implemented by subclass');
  }

  /**
   * Display a message (alias for appendMessage)
   * Default implementation - can be overridden
   * @param {Object} messageData - Message data
   */
  displayMessage(messageData) {
    this.appendMessage(messageData);
  }

  /**
   * Get color for a user (for consistency)
   * Default implementation - can be overridden
   * @param {string} user - User name
   * @returns {string} Color
   */
  getUserColor(user) {
    if (!user) return this.config.userColors[0];
    
    if (!this.userColorMap.has(user)) {
      const index = this.userColorMap.size;
      const userColors = this.config.userColors || [];
      const color = userColors[index % userColors.length];
      this.userColorMap.set(user, color);
    }
    return this.userColorMap.get(user);
  }

  /**
   * Set user color explicitly
   * @param {string} user - User name
   * @param {string} color - Color
   */
  setUserColor(user, color) {
    this.userColorMap.set(user, color);
  }

  /**
   * Clear all messages
   * Must be implemented by subclasses
   * @abstract
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }

  /**
   * Load message history
   * Default implementation - can be overridden
   * @param {Array<Object>} history - Array of message objects
   */
  loadHistory(history) {
    if (!Array.isArray(history)) return;
    
    history.forEach((entry) => {
      this.appendMessage(entry);
    });
  }

  /**
   * Set the current user's name (for determining own messages)
   * @param {string} name - Current user's name
   */
  setCurrentUserName(name) {
    this.currentUserName = name;
  }

  /**
   * Scroll to bottom of messages
   * Must be implemented by subclasses if scrolling is needed
   * @abstract
   */
  scrollToBottom() {
    // Optional - no-op by default
  }
}

/**
 * MessageInputBase - Abstract base class for message input components
 * 
 * This abstract class defines the contract for message input and controls.
 * It is implementation-agnostic and can be implemented using HTMLElement,
 * React, Vue, or any other framework.
 * 
 * @abstract
 */
class MessageInputBase {
  /**
   * Create a new MessageInputBase instance
   * @param {Object} config - Configuration options
   * @param {string} config.callModes - Call modes ('audio' | 'video' | 'both')
   */
  constructor(config = {}) {
    if (new.target === MessageInputBase) {
      throw new Error('MessageInputBase is abstract and cannot be instantiated directly');
    }
    
    this.config = {
      callModes: config.callModes || 'both',
      ...config
    };
  }

  /**
   * Get the message input value
   * Must be implemented by subclasses
   * @returns {string} Current input value
   * @abstract
   */
  getValue() {
    throw new Error('getValue must be implemented by subclass');
  }

  /**
   * Clear the message input
   * Must be implemented by subclasses
   * @abstract
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }

  /**
   * Enable or disable the input
   * Must be implemented by subclasses
   * @param {boolean} enabled - Whether input should be enabled
   * @abstract
   */
  setEnabled(enabled) {
    throw new Error('setEnabled must be implemented by subclass');
  }

  /**
   * Notify that a message should be sent
   * Subclasses should call this when user wants to send a message
   * @param {string} message - Message text
   * @protected
   */
  _onSend(message) {
    if (this.onSend) {
      this.onSend(message);
    }
  }

  /**
   * Notify that emoji button was clicked
   * Subclasses should call this when emoji button is clicked
   * @protected
   */
  _onEmojiClick() {
    if (this.onEmojiClick) {
      this.onEmojiClick();
    }
  }

  /**
   * Notify that clear button was clicked
   * Subclasses should call this when clear button is clicked
   * @protected
   */
  _onClearClick() {
    if (this.onClearClick) {
      this.onClearClick();
    }
  }
}

/**
 * ChatHeaderBase - Abstract base class for chat header components
 * 
 * This abstract class defines the contract for chat header functionality
 * including room and name management. It is implementation-agnostic and
 * can be implemented using HTMLElement, React, Vue, or any other framework.
 * 
 * @abstract
 */
class ChatHeaderBase {
  /**
   * Create a new ChatHeaderBase instance
   * @param {Object} config - Configuration options
   * @param {boolean} config.allowRoomChange - Whether room changes are allowed
   * @param {boolean} config.showRoom - Whether to show room name
   * @param {string} config.baseTopic - Base MQTT topic prefix
   * @param {string} config.currentRoom - Current room name
   * @param {string} config.primaryUserColor - Primary user color
   */
  constructor(config = {}) {
    if (new.target === ChatHeaderBase) {
      throw new Error('ChatHeaderBase is abstract and cannot be instantiated directly');
    }
    
    this.config = {
      allowRoomChange: config.allowRoomChange !== false,
      showRoom: config.showRoom !== false,
      baseTopic: config.baseTopic || '',
      currentRoom: config.currentRoom || '',
      primaryUserColor: config.primaryUserColor || 'lightblue',
      ...config
    };
  }

  /**
   * Set the room name
   * Must be implemented by subclasses
   * @param {string} room - Room name
   * @abstract
   */
  setRoom(room) {
    throw new Error('setRoom must be implemented by subclass');
  }

  /**
   * Set the user name
   * Must be implemented by subclasses
   * @param {string} name - User name
   * @abstract
   */
  setName(name) {
    throw new Error('setName must be implemented by subclass');
  }

  /**
   * Set the room prefix (base topic)
   * Must be implemented by subclasses
   * @param {string} prefix - Room prefix
   * @abstract
   */
  setRoomPrefix(prefix) {
    throw new Error('setRoomPrefix must be implemented by subclass');
  }

  /**
   * Set whether the header is collapsible
   * Optional - no-op by default
   * @param {boolean} collapsible - Whether header should be collapsible
   */
  setCollapsible(collapsible) {
    // Optional - no-op by default
  }

  /**
   * Notify that room name changed
   * Subclasses should call this when room name changes
   * @param {string} room - New room name
   * @protected
   */
  _onRoomChange(room) {
    if (this.onRoomChange) {
      this.onRoomChange(room);
    }
  }

  /**
   * Notify that user name changed
   * Subclasses should call this when user name changes
   * @param {string} name - New user name
   * @protected
   */
  _onNameChange(name) {
    if (this.onNameChange) {
      this.onNameChange(name);
    }
  }
}

/**
 * CallManagementBase - Abstract base class for call management UI components
 * 
 * This abstract class defines the contract for displaying call controls,
 * call information, and handling call-related UI interactions. It is
 * implementation-agnostic and can be implemented using HTMLElement, React,
 * Vue, or any other framework.
 * 
 * @abstract
 */
class CallManagementBase {
  /**
   * Create a new CallManagementBase instance
   * @param {CallManager} callManager - CallManager instance to read state from
   * @param {Object} options - Configuration options
   * @param {boolean} options.showMetrics - Whether to show call metrics
   */
  constructor(callManager, options = {}) {
    if (new.target === CallManagementBase) {
      throw new Error('CallManagementBase is abstract and cannot be instantiated directly');
    }
    
    if (!callManager) {
      throw new Error('CallManager is required');
    }
    
    this.callManager = callManager;
    this.options = {
      showMetrics: options.showMetrics !== false, // Default: true
      ...options
    };
  }

  /**
   * Show an incoming call prompt
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the caller
   * @param {Object} callInfo - {video: boolean, audio: boolean}
   * @returns {Promise<boolean>} Promise that resolves to true to accept, false to reject
   * @abstract
   */
  showIncomingCallPrompt(peerName, callInfo) {
    throw new Error('showIncomingCallPrompt must be implemented by subclass');
  }

  /**
   * Hide/remove an incoming call prompt
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the caller
   * @abstract
   */
  hideIncomingCallPrompt(peerName) {
    throw new Error('hideIncomingCallPrompt must be implemented by subclass');
  }

  /**
   * Show a missed call notification
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer
   * @param {string} direction - 'incoming' or 'outgoing'
   * @abstract
   */
  showMissedCallNotification(peerName, direction) {
    throw new Error('showMissedCallNotification must be implemented by subclass');
  }

  /**
   * Show a call declined notification
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer who declined
   * @abstract
   */
  showCallDeclinedNotification(peerName) {
    throw new Error('showCallDeclinedNotification must be implemented by subclass');
  }

  /**
   * Update call info display (list of active calls)
   * Must be implemented by subclasses
   * @param {Set|Array} audioCalls - Set or array of users in audio calls
   * @param {Set|Array} videoCalls - Set or array of users in video calls
   * @abstract
   */
  setActiveCalls(audioCalls, videoCalls) {
    throw new Error('setActiveCalls must be implemented by subclass');
  }

  /**
   * Update mute state display
   * Must be implemented by subclasses
   * @param {Object} state - Mute state object {mic: boolean, speakers: boolean, video: boolean}
   * @abstract
   */
  setMuteState(state) {
    throw new Error('setMuteState must be implemented by subclass');
  }

  /**
   * Set latency metrics for a user
   * Must be implemented by subclasses
   * @param {string} user - User name
   * @param {Object} metrics - Metrics object {rtt: number, packetLoss: number, jitter: number}
   * @abstract
   */
  setMetrics(user, metrics) {
    throw new Error('setMetrics must be implemented by subclass');
  }

  /**
   * Clear metrics for a user
   * Optional - no-op by default
   * @param {string} user - User name
   */
  clearMetrics(user) {
    // Optional - no-op by default
  }

  /**
   * Clear all metrics
   * Optional - no-op by default
   */
  clearAllMetrics() {
    // Optional - no-op by default
  }

  /**
   * Update UI from CallManager state
   * Default implementation - can be overridden
   * @protected
   */
  _updateFromCallManager() {
    const activeCalls = this.callManager.getActiveCalls();
    const pendingCalls = this.callManager.getPendingCalls();
    const hasActiveCalls = activeCalls.audio.size > 0 || activeCalls.video.size > 0;
    const hasPendingCalls = pendingCalls.size > 0;
    
    if (!hasActiveCalls && !hasPendingCalls) {
      this._setStateInactive();
    } else if (hasPendingCalls && !hasActiveCalls) {
      this._setStatePending();
    } else if (hasActiveCalls) {
      this._setStateActive(activeCalls.audio, activeCalls.video);
    }
  }

  /**
   * Set UI to inactive state (no calls)
   * Must be implemented by subclasses
   * @protected
   * @abstract
   */
  _setStateInactive() {
    throw new Error('_setStateInactive must be implemented by subclass');
  }

  /**
   * Set UI to pending state (incoming call)
   * Must be implemented by subclasses
   * @protected
   * @abstract
   */
  _setStatePending() {
    throw new Error('_setStatePending must be implemented by subclass');
  }

  /**
   * Set UI to active state (active call)
   * Must be implemented by subclasses
   * @param {Set|Array} audioCalls - Audio calls
   * @param {Set|Array} videoCalls - Video calls
   * @protected
   * @abstract
   */
  _setStateActive(audioCalls, videoCalls) {
    throw new Error('_setStateActive must be implemented by subclass');
  }
}

/**
 * VideoChatBase - Abstract base class for video chat components
 * 
 * This abstract class defines the contract for video chat functionality
 * including local/remote video stream management and call controls.
 * It is implementation-agnostic and can be implemented using HTMLElement,
 * React, Vue, or any other framework.
 * 
 * @abstract
 */
class VideoChatBase {
  /**
   * Create a new VideoChatBase instance
   * @param {Object} rtc - RTC client instance
   * @param {Object} options - Configuration options
   * @param {Object} options.window - Window object (for resize handling)
   * @param {boolean} options.assignToWindow - Whether to assign to window.vc
   */
  constructor(rtc, options = {}) {
    if (new.target === VideoChatBase) {
      throw new Error('VideoChatBase is abstract and cannot be instantiated directly');
    }
    
    this.rtc = rtc;
    this.options = {
      window: options.window || (typeof window !== 'undefined' ? window : null),
      assignToWindow: options.assignToWindow !== false,
      ...options
    };
  }

  /**
   * Set the local video source (MediaStream)
   * Must be implemented by subclasses
   * @param {MediaStream|null} src - MediaStream to display, or null to clear
   * @abstract
   */
  setLocalSrc(src) {
    throw new Error('setLocalSrc must be implemented by subclass');
  }

  /**
   * Set the remote video source (MediaStream)
   * Must be implemented by subclasses
   * @param {MediaStream|null} src - MediaStream to display, or null to clear
   * @abstract
   */
  setRemoteSrc(src) {
    throw new Error('setRemoteSrc must be implemented by subclass');
  }

  /**
   * Show the video chat UI
   * Must be implemented by subclasses
   * @abstract
   */
  show() {
    throw new Error('show must be implemented by subclass');
  }

  /**
   * Hide the video chat UI
   * Must be implemented by subclasses
   * @abstract
   */
  hide() {
    throw new Error('hide must be implemented by subclass');
  }

  /**
   * Start a call with a peer
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer to call
   * @returns {Promise} Promise that resolves when call is started
   * @abstract
   */
  call(peerName) {
    throw new Error('call must be implemented by subclass');
  }

  /**
   * End a call with a peer
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer
   * @abstract
   */
  endCall(peerName) {
    throw new Error('endCall must be implemented by subclass');
  }

  /**
   * Handle window resize
   * Optional - no-op by default
   * @param {Object} window - Window object
   */
  resize(window) {
    // Optional - no-op by default
  }

  /**
   * Cleanup and destroy the component
   * Optional - no-op by default
   */
  destroy() {
    // Optional - no-op by default
  }
}

/**
 * VideoStreamDisplayBase - Abstract base class for video stream display components
 * 
 * This abstract class defines the contract for displaying video streams from
 * multiple peers. It is implementation-agnostic and can be implemented using
 * HTMLElement, React, Vue, or any other framework.
 * 
 * Implements StreamDisplayInterface contract.
 * 
 * @abstract
 * @implements StreamDisplayInterface
 */


class VideoStreamDisplayBase {
  /**
   * Create a new VideoStreamDisplayBase instance
   * @param {HTMLElement|Object} container - Container element or container object
   * @param {Object} options - Configuration options
   * @param {string} options.localVideoSize - Size of local video overlay (default: '30%')
   * @param {string} options.localVideoPosition - Position of local video (default: 'top-right')
   * @param {class} options.VideoClass - Video class implementing VideoInterface (optional)
   */
  constructor(container, options = {}) {
    if (new.target === VideoStreamDisplayBase) {
      throw new Error('VideoStreamDisplayBase is abstract and cannot be instantiated directly');
    }
    
    if (!container) {
      throw new Error('VideoStreamDisplayBase requires a container');
    }
    
    this.container = container;
    this.options = {
      localVideoSize: options.localVideoSize || '30%',
      localVideoPosition: options.localVideoPosition || 'top-right',
      VideoClass: options.VideoClass,
      ...options
    };
    
    this.activeStreams = {}; // Track streams by peer name
  }

  /**
   * Set video streams for a peer
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer
   * @param {Object} streams - Stream objects
   * @param {MediaStream} streams.localStream - Local media stream
   * @param {MediaStream} streams.remoteStream - Remote media stream
   * @abstract
   */
  setStreams(peerName, { localStream, remoteStream }) {
    throw new Error('setStreams must be implemented by subclass');
  }

  /**
   * Remove video streams for a peer
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer
   * @abstract
   */
  removeStreams(peerName) {
    throw new Error('removeStreams must be implemented by subclass');
  }

  /**
   * Show the video container
   * Default implementation - can be overridden
   */
  show() {
    if (this.container && this.container.style) {
      if (this.hasActiveStreams()) {
        this.container.style.display = 'block';
      }
    }
  }

  /**
   * Hide the video container
   * Default implementation - can be overridden
   */
  hide() {
    if (this.container && this.container.style) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Check if there are active streams
   * @returns {boolean} True if there are active streams
   */
  hasActiveStreams() {
    return Object.keys(this.activeStreams).length > 0;
  }

  /**
   * Get list of active peer names
   * @returns {string[]} Array of peer names with active streams
   */
  getActivePeers() {
    return Object.keys(this.activeStreams);
  }

  /**
   * Remove all video streams
   * Default implementation - can be overridden
   */
  removeAllStreams() {
    const peerNames = Object.keys(this.activeStreams);
    peerNames.forEach(peerName => this.removeStreams(peerName));
  }

  /**
   * Setup track end handlers for a stream
   * Default implementation - can be overridden
   * @param {string} peerName - Name of the peer
   * @param {MediaStream} localStream - Local stream
   * @param {MediaStream} remoteStream - Remote stream
   * @protected
   */
  _setupTrackEndHandlers(peerName, localStream, remoteStream) {
    const streamData = this.activeStreams[peerName];
    if (!streamData) return;

    // Remove existing handlers
    if (streamData.trackEndHandlers) {
      streamData.trackEndHandlers.forEach(handler => {
        if (handler.track && handler.track.onended) {
          handler.track.onended = null;
        }
      });
    }
    streamData.trackEndHandlers = [];

    // Setup new handlers
    const handleTrackEnd = () => {
      console.log(`Stream track ended for ${peerName}`);
      this.removeStreams(peerName);
    };

    if (remoteStream && remoteStream instanceof MediaStream && typeof remoteStream.getTracks === 'function') {
      remoteStream.getTracks().forEach(track => {
        track.onended = handleTrackEnd;
        streamData.trackEndHandlers.push({ track, type: 'remote' });
      });
    }
    if (localStream && localStream instanceof MediaStream && typeof localStream.getTracks === 'function') {
      localStream.getTracks().forEach(track => {
        track.onended = handleTrackEnd;
        streamData.trackEndHandlers.push({ track, type: 'local' });
      });
    }
  }

  /**
   * Stop all tracks in a stream
   * @param {MediaStream} stream - Media stream
   * @protected
   */
  _stopStreamTracks(stream) {
    if (stream && stream instanceof MediaStream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }
  }

  /**
   * Setup CSS styles for video elements
   * Must be implemented by subclasses if styles are needed
   * @protected
   * @abstract
   */
  _setupStyles() {
    // Optional - no-op by default
  }

  /**
   * Create a video container element for a peer
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer
   * @returns {Object} Object with container and video elements
   * @protected
   * @abstract
   */
  _createVideoContainer(peerName) {
    throw new Error('_createVideoContainer must be implemented by subclass');
  }
}

/**
 * ActiveUsersListHTMLElementBase - HTMLElement-based base for active users list
 * 
 * This class extends UIComponentBase (which extends HTMLElement) and implements
 * the ActiveUsersListBase contract. This allows concrete implementations to
 * extend this class and get both HTMLElement functionality and the abstract contract.
 * 
 * @extends UIComponentBase
 * @implements ActiveUsersListBase
 */


class ActiveUsersListHTMLElementBase extends UIComponentBase {
  /**
   * Create a new ActiveUsersListHTMLElementBase instance
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super(config);
    
    // Initialize abstract base functionality
    // Initialize properties from ActiveUsersListBase
    this.userColorMap = new Map(); // Map<user, color>
  }

  /**
   * Update the list of active users
   * Must be implemented by subclasses
   * @param {Array<string>} users - List of active user names
   * @param {Function} getUserColor - Optional function to get color for a user
   * @abstract
   */
  updateUsers(users, getUserColor = null) {
    throw new Error('updateUsers must be implemented by subclass');
  }

  /**
   * Get color for a user (for consistency)
   * Default implementation from ActiveUsersListBase
   * @param {string} user - User name
   * @returns {string} Color
   */
  getUserColor(user) {
    if (!this.userColorMap) {
      this.userColorMap = new Map();
    }
    if (!this.userColorMap.has(user)) {
      const index = this.userColorMap.size;
      const userColors = this.getConfig('userColors') || [];
      const color = userColors[index % userColors.length];
      this.userColorMap.set(user, color);
    }
    return this.userColorMap.get(user);
  }

  /**
   * Set user color explicitly
   * @param {string} user - User name
   * @param {string} color - Color
   */
  setUserColor(user, color) {
    if (!this.userColorMap) {
      this.userColorMap = new Map();
    }
    this.userColorMap.set(user, color);
  }

  /**
   * Clear the user list
   * Must be implemented by subclasses
   * @abstract
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }

  /**
   * Notify that a user was clicked
   * Default implementation dispatches custom event
   * @param {string} user - User name
   * @protected
   */
  _onUserClick(user) {
    this.dispatchCustomEvent('userclick', { user });
  }
}

/**
 * MessagesComponentHTMLElementBase - HTMLElement-based base for messages component
 * 
 * This class extends UIComponentBase (which extends HTMLElement) and implements
 * the MessagesComponentBase contract. This allows concrete implementations to
 * extend this class and get both HTMLElement functionality and the abstract contract.
 * 
 * @extends UIComponentBase
 * @implements MessagesComponentBase
 */


class MessagesComponentHTMLElementBase extends UIComponentBase {
  /**
   * Create a new MessagesComponentHTMLElementBase instance
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super(config);
    
    // Initialize abstract base functionality
    // Initialize properties from MessagesComponentBase
    this.userColorMap = new Map(); // Map<user, color>
  }

  /**
   * Append a message to the display
   * Must be implemented by subclasses
   * @param {Object} messageData - Message data
   * @abstract
   */
  appendMessage(messageData) {
    throw new Error('appendMessage must be implemented by subclass');
  }

  /**
   * Display a message (alias for appendMessage)
   * Default implementation from MessagesComponentBase
   * @param {Object} messageData - Message data
   */
  displayMessage(messageData) {
    this.appendMessage(messageData);
  }

  /**
   * Get color for a user (for consistency)
   * Default implementation from MessagesComponentBase
   * @param {string} user - User name
   * @returns {string} Color
   */
  getUserColor(user) {
    if (!this.userColorMap) {
      this.userColorMap = new Map();
    }
    if (!user) return this.getConfig('userColors')[0];
    
    if (!this.userColorMap.has(user)) {
      const index = this.userColorMap.size;
      const userColors = this.getConfig('userColors') || [];
      const color = userColors[index % userColors.length];
      this.userColorMap.set(user, color);
    }
    return this.userColorMap.get(user);
  }

  /**
   * Set user color explicitly
   * @param {string} user - User name
   * @param {string} color - Color
   */
  setUserColor(user, color) {
    if (!this.userColorMap) {
      this.userColorMap = new Map();
    }
    this.userColorMap.set(user, color);
  }

  /**
   * Clear all messages
   * Must be implemented by subclasses
   * @abstract
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }

  /**
   * Load message history
   * Default implementation from MessagesComponentBase
   * @param {Array<Object>} history - Array of message objects
   */
  loadHistory(history) {
    if (!Array.isArray(history)) return;
    
    history.forEach((entry) => {
      this.appendMessage(entry);
    });
  }

  /**
   * Set the current user's name (for determining own messages)
   * @param {string} name - Current user's name
   */
  setCurrentUserName(name) {
    this.currentUserName = name;
  }

  /**
   * Scroll to bottom of messages
   * Default implementation - can be overridden
   */
  scrollToBottom() {
    // Optional - no-op by default, subclasses should implement
  }
}

/**
 * MessageInputHTMLElementBase - HTMLElement-based base for message input component
 * 
 * This class extends UIComponentBase (which extends HTMLElement) and implements
 * the MessageInputBase contract. This allows concrete implementations to
 * extend this class and get both HTMLElement functionality and the abstract contract.
 * 
 * @extends UIComponentBase
 * @implements MessageInputBase
 */


class MessageInputHTMLElementBase extends UIComponentBase {
  /**
   * Create a new MessageInputHTMLElementBase instance
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super(config);
    
    // Initialize abstract base functionality
    // MessageInputBase doesn't require additional initialization
  }

  /**
   * Get the message input value
   * Must be implemented by subclasses
   * @returns {string} Current input value
   * @abstract
   */
  getValue() {
    throw new Error('getValue must be implemented by subclass');
  }

  /**
   * Clear the message input
   * Must be implemented by subclasses
   * @abstract
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }

  /**
   * Enable or disable the input
   * Must be implemented by subclasses
   * @param {boolean} enabled - Whether input should be enabled
   * @abstract
   */
  setEnabled(enabled) {
    throw new Error('setEnabled must be implemented by subclass');
  }

  /**
   * Notify that a message should be sent
   * Default implementation dispatches custom event
   * @param {string} message - Message text
   * @protected
   */
  _onSend(message) {
    this.dispatchCustomEvent('sendmessage', { message });
  }

  /**
   * Notify that emoji button was clicked
   * Default implementation dispatches custom event
   * @protected
   */
  _onEmojiClick() {
    this.dispatchCustomEvent('emojiclick');
  }

  /**
   * Notify that clear button was clicked
   * Default implementation dispatches custom event
   * @protected
   */
  _onClearClick() {
    this.dispatchCustomEvent('clearclick');
  }
}

/**
 * ChatHeaderHTMLElementBase - HTMLElement-based base for chat header component
 * 
 * This class extends UIComponentBase (which extends HTMLElement) and implements
 * the ChatHeaderBase contract. This allows concrete implementations to
 * extend this class and get both HTMLElement functionality and the abstract contract.
 * 
 * @extends UIComponentBase
 * @implements ChatHeaderBase
 */


class ChatHeaderHTMLElementBase extends UIComponentBase {
  /**
   * Create a new ChatHeaderHTMLElementBase instance
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super(config);
    
    // Initialize abstract base functionality
    // ChatHeaderBase doesn't require additional initialization
  }

  /**
   * Set the room name
   * Must be implemented by subclasses
   * @param {string} room - Room name
   * @abstract
   */
  setRoom(room) {
    throw new Error('setRoom must be implemented by subclass');
  }

  /**
   * Set the user name
   * Must be implemented by subclasses
   * @param {string} name - User name
   * @abstract
   */
  setName(name) {
    throw new Error('setName must be implemented by subclass');
  }

  /**
   * Set the room prefix (base topic)
   * Must be implemented by subclasses
   * @param {string} prefix - Room prefix
   * @abstract
   */
  setRoomPrefix(prefix) {
    throw new Error('setRoomPrefix must be implemented by subclass');
  }

  /**
   * Set whether the header is collapsible
   * Default implementation - can be overridden
   * @param {boolean} collapsible - Whether header should be collapsible
   */
  setCollapsible(collapsible) {
    // Optional - no-op by default
  }

  /**
   * Notify that room name changed
   * Default implementation dispatches custom event
   * @param {string} room - New room name
   * @protected
   */
  _onRoomChange(room) {
    this.dispatchCustomEvent('roomchange', { room });
  }

  /**
   * Notify that user name changed
   * Default implementation dispatches custom event
   * @param {string} name - New user name
   * @protected
   */
  _onNameChange(name) {
    this.dispatchCustomEvent('namechange', { name });
  }
}

/**
 * CallManagementHTMLElementBase - HTMLElement-based base for call management component
 * 
 * This class extends UIComponentBase (which extends HTMLElement) and implements
 * the CallManagementBase contract. This allows concrete implementations to
 * extend this class and get both HTMLElement functionality and the abstract contract.
 * 
 * Note: CallManagement is not a Web Component, so this base class is provided
 * for consistency, but CallManagement may not extend it directly.
 * 
 * @extends UIComponentBase
 * @implements CallManagementBase
 */


class CallManagementHTMLElementBase extends UIComponentBase {
  /**
   * Create a new CallManagementHTMLElementBase instance
   * @param {CallManager} callManager - CallManager instance to read state from
   * @param {Object} options - Configuration options
   */
  constructor(callManager, options = {}) {
    super(options);
    
    // Initialize abstract base functionality
    // Initialize properties from CallManagementBase
    if (!callManager) {
      throw new Error('CallManager is required');
    }
    this.callManager = callManager;
  }

  /**
   * Show an incoming call prompt
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the caller
   * @param {Object} callInfo - {video: boolean, audio: boolean}
   * @returns {Promise<boolean>} Promise that resolves to true to accept, false to reject
   * @abstract
   */
  showIncomingCallPrompt(peerName, callInfo) {
    throw new Error('showIncomingCallPrompt must be implemented by subclass');
  }

  /**
   * Hide/remove an incoming call prompt
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the caller
   * @abstract
   */
  hideIncomingCallPrompt(peerName) {
    throw new Error('hideIncomingCallPrompt must be implemented by subclass');
  }

  /**
   * Show a missed call notification
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer
   * @param {string} direction - 'incoming' or 'outgoing'
   * @abstract
   */
  showMissedCallNotification(peerName, direction) {
    throw new Error('showMissedCallNotification must be implemented by subclass');
  }

  /**
   * Show a call declined notification
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer who declined
   * @abstract
   */
  showCallDeclinedNotification(peerName) {
    throw new Error('showCallDeclinedNotification must be implemented by subclass');
  }

  /**
   * Update call info display (list of active calls)
   * Must be implemented by subclasses
   * @param {Set|Array} audioCalls - Set or array of users in audio calls
   * @param {Set|Array} videoCalls - Set or array of users in video calls
   * @abstract
   */
  setActiveCalls(audioCalls, videoCalls) {
    throw new Error('setActiveCalls must be implemented by subclass');
  }

  /**
   * Update mute state display
   * Must be implemented by subclasses
   * @param {Object} state - Mute state object {mic: boolean, speakers: boolean, video: boolean}
   * @abstract
   */
  setMuteState(state) {
    throw new Error('setMuteState must be implemented by subclass');
  }

  /**
   * Set latency metrics for a user
   * Must be implemented by subclasses
   * @param {string} user - User name
   * @param {Object} metrics - Metrics object {rtt: number, packetLoss: number, jitter: number}
   * @abstract
   */
  setMetrics(user, metrics) {
    throw new Error('setMetrics must be implemented by subclass');
  }

  /**
   * Clear metrics for a user
   * Optional - no-op by default
   * @param {string} user - User name
   */
  clearMetrics(user) {
    // Optional - no-op by default
  }

  /**
   * Clear all metrics
   * Optional - no-op by default
   */
  clearAllMetrics() {
    // Optional - no-op by default
  }

  /**
   * Update UI from CallManager state
   * Default implementation from CallManagementBase
   * @protected
   */
  _updateFromCallManager() {
    const activeCalls = this.callManager.getActiveCalls();
    const pendingCalls = this.callManager.getPendingCalls();
    const hasActiveCalls = activeCalls.audio.size > 0 || activeCalls.video.size > 0;
    const hasPendingCalls = pendingCalls.size > 0;
    
    if (!hasActiveCalls && !hasPendingCalls) {
      this._setStateInactive();
    } else if (hasPendingCalls && !hasActiveCalls) {
      this._setStatePending();
    } else if (hasActiveCalls) {
      this._setStateActive(activeCalls.audio, activeCalls.video);
    }
  }

  /**
   * Set UI to inactive state (no calls)
   * Must be implemented by subclasses
   * @protected
   * @abstract
   */
  _setStateInactive() {
    throw new Error('_setStateInactive must be implemented by subclass');
  }

  /**
   * Set UI to pending state (incoming call)
   * Must be implemented by subclasses
   * @protected
   * @abstract
   */
  _setStatePending() {
    throw new Error('_setStatePending must be implemented by subclass');
  }

  /**
   * Set UI to active state (active call)
   * Must be implemented by subclasses
   * @param {Set|Array} audioCalls - Audio calls
   * @param {Set|Array} videoCalls - Video calls
   * @protected
   * @abstract
   */
  _setStateActive(audioCalls, videoCalls) {
    throw new Error('_setStateActive must be implemented by subclass');
  }
}

/**
 * VideoChatHTMLElementBase - HTMLElement-based base for video chat component
 * 
 * This class extends UIComponentBase (which extends HTMLElement) and implements
 * the VideoChatBase contract. This allows concrete implementations to
 * extend this class and get both HTMLElement functionality and the abstract contract.
 * 
 * @extends UIComponentBase
 * @implements VideoChatBase
 */


class VideoChatHTMLElementBase extends UIComponentBase {
  /**
   * Create a new VideoChatHTMLElementBase instance
   * @param {Object} rtc - RTC client instance
   * @param {Object} options - Configuration options
   */
  constructor(rtc, options = {}) {
    super(options);
    
    // Initialize abstract base functionality
    // Initialize properties from VideoChatBase
    this.rtc = rtc;
    
    // Store window reference
    this._window = this.options.window;
    this._assignToWindow = this.options.assignToWindow;
    
    // Note: RTCVideoChat initialization should be done in subclass
    // after shadow DOM is set up, so callbacks can access DOM elements
    // Subclasses should call _initializeRTCVideoChat() after setting up DOM
  }
  
  /**
   * Initialize RTCVideoChat with callbacks
   * Should be called by subclasses after DOM is set up
   * @protected
   */
  _initializeRTCVideoChat(rtc) {
    // Bind methods
    this.setLocalSrc = this.setLocalSrc.bind(this);
    this.setRemoteSrc = this.setRemoteSrc.bind(this);
    this.hide = this.hide.bind(this);
    this.show = this.show.bind(this);
    this.resize = this.resize.bind(this);
    
    // Initialize RTCVideoChat with callbacks
    this.rtcVC = new RTCVideoChat(rtc,
      this.setLocalSrc,
      this.setRemoteSrc,
      this.hide,
      this.show
    );
    
    // Optional window assignment
    if (this._assignToWindow && this._window) {
      this._window.vc = this;
    }
    
    // Bind RTCVideoChat methods
    this.call = this.rtcVC.call.bind(this.rtcVC);
    this.endCall = this.rtcVC.endCall.bind(this.rtcVC);
    
    // Add resize listener if window is available
    if (this._window) {
      this._window.addEventListener('resize', this.resize);
    }
  }

  /**
   * Set the local video source (MediaStream)
   * Must be implemented by subclasses
   * @param {MediaStream|null} src - MediaStream to display, or null to clear
   * @abstract
   */
  setLocalSrc(src) {
    throw new Error('setLocalSrc must be implemented by subclass');
  }

  /**
   * Set the remote video source (MediaStream)
   * Must be implemented by subclasses
   * @param {MediaStream|null} src - MediaStream to display, or null to clear
   * @abstract
   */
  setRemoteSrc(src) {
    throw new Error('setRemoteSrc must be implemented by subclass');
  }

  /**
   * Show the video chat UI
   * Must be implemented by subclasses
   * @abstract
   */
  show() {
    throw new Error('show must be implemented by subclass');
  }

  /**
   * Hide the video chat UI
   * Must be implemented by subclasses
   * @abstract
   */
  hide() {
    throw new Error('hide must be implemented by subclass');
  }

  /**
   * Handle window resize
   * Default implementation - can be overridden
   * @param {Object} window - Window object (optional, uses this._window if not provided)
   */
  resize(window = null) {
    const win = window || this._window;
    if (!win) return;
    
    // Optionally adjust the size based on the window size or other conditions
    const width = win.innerWidth;
    const height = win.innerHeight;
    
    // Get container element (must be implemented by subclass)
    const container = this._getContainer();
    if (container) {
      // Example: Adjust max-width/max-height based on conditions
      container.style.maxWidth = width > 600 ? '50vw' : '80vw';
      container.style.maxHeight = height > 600 ? '50vh' : '80vh';
    }
  }

  /**
   * Get the container element
   * Must be implemented by subclasses
   * @returns {HTMLElement|null} Container element
   * @protected
   * @abstract
   */
  _getContainer() {
    throw new Error('_getContainer must be implemented by subclass');
  }

  /**
   * Cleanup and destroy the component
   * Default implementation removes resize listener
   */
  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Remove resize listener
    if (this._window && this.resize) {
      this._window.removeEventListener('resize', this.resize);
    }
    
    // Clean up window assignment
    if (this._assignToWindow && this._window && this._window.vc === this) {
      delete this._window.vc;
    }
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

export { ActiveUsersListBase, ActiveUsersListHTMLElementBase, AudioControllerInterface, BaseMQTTRTCClient, CallManagementBase, CallManagementHTMLElementBase, CallManager, CallUIInterface, ChatHeaderBase, ChatHeaderHTMLElementBase, ChatManager, ChatUIInterface, ConfigPresets, DeferredPromise, EventEmitter, Keys, LocalStorageAdapter, MQTTLoader, MQTTRTCClient, MemoryAdapter, MessageInputBase, MessageInputHTMLElementBase, MessagesComponentBase, MessagesComponentHTMLElementBase, NotificationInterface, Peer, PluginAdapter, PromisefulMQTTRTCClient, RTCConfig, RTCConnection, RTCVideoChat, RingerInterface, SignedMQTTRTCClient, StateManager, StorageAdapter, StorageInterface, StreamDisplayBase, StreamDisplayInterface, TabManager, UIComponentBase, UIConfigInterface, VideoChatBase, VideoChatHTMLElementBase, VideoControllerInterface, VideoInterface, VideoStreamDisplayBase, deepMerge, isObject };
//# sourceMappingURL=rtchat-core.esm.js.map
