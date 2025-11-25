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
export { BasicVideoChat } from './video-chat.js';
export { VideoStreamDisplay } from './video-stream-display.js';
export { AudioStreamDisplay } from './audio-stream-display.js';
export { CallRinger } from './call-ringer.js';
export { NotificationSound } from './notification-sound.js';
export { CallManagement } from './call-management.js';

// Vanilla adapter (combines core + UI)
export { RTChat } from '../adapters/vanilla/rtchat.js';

// Re-export core for convenience (but prefer importing from rtchat-core.js separately)
export * from '../core/index.js';

