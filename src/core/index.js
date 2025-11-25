/**
 * Core Entry Point - Cross-platform compatible core logic
 * 
 * This entry point exports only the core networking and communication logic,
 * without any UI components or browser-specific dependencies.
 * 
 * All exports are designed to work in any JavaScript environment (browser, Node.js, React Native, etc.)
 * by using dependency injection for platform-specific APIs (storage, crypto, etc.).
 */

// Configuration
export { RTCConfig, ConfigPresets } from '../config/rtc-config.js';

// Storage adapters (abstract + implementations)
export { StorageAdapter } from '../storage/storage-adapter.js';
export { LocalStorageAdapter } from '../storage/local-storage-adapter.js';
export { MemoryAdapter } from '../storage/memory-adapter.js';

// Utilities (cross-platform)
export { EventEmitter } from '../utils/event-emitter.js';
export { DeferredPromise } from '../utils/deferred-promise.js';
export { deepMerge, isObject } from '../utils/object-utils.js';

// Core networking
export { 
  MQTTRTCClient, 
  BaseMQTTRTCClient, 
  PromisefulMQTTRTCClient,
  RTCConnection,
  Peer
} from './mqtt-rtc-client.js';

// Secure client
export { SignedMQTTRTCClient } from './signed-client.js';

// Crypto
export { Keys } from '../crypto/keys.js';

// Core utilities
export { TabManager } from './tab-manager.js';
export { MQTTLoader } from './mqtt-loader.js';

// Business logic managers (platform-agnostic)
export { CallManager } from './call-manager.js';
export { ChatManager } from './chat-manager.js';

// Legacy video chat core logic (use CallManager for new code)
export { RTCVideoChat } from './rtc-video-chat.js';

// Interfaces for UI components
export * from './interfaces/index.js';

// Plugin adapter base class
export { PluginAdapter } from './plugin-adapter.js';

// State management
export { StateManager } from './state-manager.js';

// UI Adapter documentation (see PLUGIN_ARCHITECTURE.md for usage)
export {} from './ui-adapter.js';

