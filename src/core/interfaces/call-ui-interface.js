/**
 * CallUIInterface - Interface for call UI components
 * 
 * This interface defines the minimum methods a call UI component must implement
 * to work with CallManager. All methods are optional - implement only what you need.
 * 
 * @interface CallUIInterface
 */
export class CallUIInterface {
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

