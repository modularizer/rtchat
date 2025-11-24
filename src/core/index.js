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

