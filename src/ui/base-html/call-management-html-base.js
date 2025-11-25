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

import { UIComponentBase } from '../../core/interfaces/ui-component-base.js';
import { CallManagementBase } from '../../core/interfaces/call-management-base.js';

export class CallManagementHTMLElementBase extends UIComponentBase {
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

