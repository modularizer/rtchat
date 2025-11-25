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
import { UIConfigInterface } from './interfaces/ui-config-interface.js';

export class PluginAdapter {
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

