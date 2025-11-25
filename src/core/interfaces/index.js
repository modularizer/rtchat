/**
 * Core Interfaces - Define contracts for UI components
 * 
 * These interfaces and abstract base classes define what methods UI components
 * must implement to work with the core managers. This makes it easy to create custom UIs.
 * 
 * Implementation-agnostic abstract base classes define contracts that can be
 * implemented using any framework (HTMLElement, React, Vue, etc.)
 * 
 * @module interfaces
 */

// Original interfaces
export { ChatUIInterface } from './chat-ui-interface.js';
export { CallUIInterface } from './call-ui-interface.js';
export { StreamDisplayInterface } from './stream-display-interface.js';
export { RingerInterface } from './ringer-interface.js';
export { NotificationInterface } from './notification-interface.js';
export { VideoInterface } from './video-interface.js';
export { AudioControllerInterface } from './audio-controller-interface.js';
export { VideoControllerInterface } from './video-controller-interface.js';
export { StorageInterface } from './storage-interface.js';
export { UIConfigInterface } from './ui-config-interface.js';

// Generic UI component base (for HTMLElement-based components)
export { UIComponentBase } from './ui-component-base.js';
export { StreamDisplayBase } from './stream-display-base.js';

// Implementation-agnostic abstract base classes
export { ActiveUsersListBase } from './active-users-list-base.js';
export { MessagesComponentBase } from './messages-component-base.js';
export { MessageInputBase } from './message-input-base.js';
export { ChatHeaderBase } from './chat-header-base.js';
export { CallManagementBase } from './call-management-base.js';
export { VideoChatBase } from './video-chat-base.js';
export { VideoStreamDisplayBase } from './video-stream-display-base.js';

// Re-export HTMLElement-specific base classes from base-html folder
export * from '../../ui/base-html/index.js';

