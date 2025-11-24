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
export function getDefaults() {
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
      connectionTimeout: 30000
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
    // BACKWARD COMPATIBILITY
    // ============================================================================
    
    /**
     * Auto-load flag (for backward compatibility)
     * - If false, client won't automatically connect
     * - Must call client.load() manually
     * - Default: true (auto-connect)
     */
    load: true
  };
}

