/**
 * UI Entry Point - Browser-specific UI components
 * 
 * This entry point exports UI components that require browser APIs (DOM, window, etc.).
 * These components are designed for use in browser environments only.
 * 
 * Note: This bundle includes the core logic as a dependency. If you only need UI components
 * and already have the core bundle loaded, import from individual files instead.
 */

// UI Components (require browser/DOM)
export { ChatBox } from './chat-box.js';
export { BasicVideoChat, RTCVideoChat } from './video-chat.js';

// Vanilla adapter (combines core + UI)
export { RTChat } from '../adapters/vanilla/rtchat.js';

// Re-export core for convenience (but prefer importing from rtchat-core.js separately)
export * from '../core/index.js';

