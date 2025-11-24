/**
 * Main entry point for RTChat
 * 
 * Exports all public APIs and maintains backward compatibility
 */

// Export new refactored modules
export { RTCConfig, ConfigPresets } from './config/rtc-config.js';
export { StorageAdapter } from './storage/storage-adapter.js';
export { LocalStorageAdapter } from './storage/local-storage-adapter.js';
export { MemoryAdapter } from './storage/memory-adapter.js';
export { EventEmitter } from './utils/event-emitter.js';
export { DeferredPromise } from './utils/deferred-promise.js';
export { TabManager } from './core/tab-manager.js';
export { MQTTLoader } from './core/mqtt-loader.js';

// Re-export core modules
export { 
  MQTTRTCClient, 
  BaseMQTTRTCClient, 
  PromisefulMQTTRTCClient,
  RTCConnection,
  Peer,
  DeferredPromise as DeferredPromiseLegacy,
  tabID,
  defaultConfig
} from './core/mqtt-rtc-client.js';

export { SignedMQTTRTCClient } from './core/signed-client.js';

// Re-export crypto
export { Keys } from './crypto/keys.js';

// Re-export UI components
export { ChatBox } from './ui/chat-box.js';
export { BasicVideoChat, RTCVideoChat } from './ui/video-chat.js';

// Re-export vanilla adapter
export { RTChat } from './adapters/vanilla/rtchat.js';

