/**
 * VideoChatBase - Abstract base class for video chat components
 * 
 * This abstract class defines the contract for video chat functionality
 * including local/remote video stream management and call controls.
 * It is implementation-agnostic and can be implemented using HTMLElement,
 * React, Vue, or any other framework.
 * 
 * @abstract
 */
export class VideoChatBase {
  /**
   * Create a new VideoChatBase instance
   * @param {Object} rtc - RTC client instance
   * @param {Object} options - Configuration options
   * @param {Object} options.window - Window object (for resize handling)
   * @param {boolean} options.assignToWindow - Whether to assign to window.vc
   */
  constructor(rtc, options = {}) {
    if (new.target === VideoChatBase) {
      throw new Error('VideoChatBase is abstract and cannot be instantiated directly');
    }
    
    this.rtc = rtc;
    this.options = {
      window: options.window || (typeof window !== 'undefined' ? window : null),
      assignToWindow: options.assignToWindow !== false,
      ...options
    };
  }

  /**
   * Set the local video source (MediaStream)
   * Must be implemented by subclasses
   * @param {MediaStream|null} src - MediaStream to display, or null to clear
   * @abstract
   */
  setLocalSrc(src) {
    throw new Error('setLocalSrc must be implemented by subclass');
  }

  /**
   * Set the remote video source (MediaStream)
   * Must be implemented by subclasses
   * @param {MediaStream|null} src - MediaStream to display, or null to clear
   * @abstract
   */
  setRemoteSrc(src) {
    throw new Error('setRemoteSrc must be implemented by subclass');
  }

  /**
   * Show the video chat UI
   * Must be implemented by subclasses
   * @abstract
   */
  show() {
    throw new Error('show must be implemented by subclass');
  }

  /**
   * Hide the video chat UI
   * Must be implemented by subclasses
   * @abstract
   */
  hide() {
    throw new Error('hide must be implemented by subclass');
  }

  /**
   * Start a call with a peer
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer to call
   * @returns {Promise} Promise that resolves when call is started
   * @abstract
   */
  call(peerName) {
    throw new Error('call must be implemented by subclass');
  }

  /**
   * End a call with a peer
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer
   * @abstract
   */
  endCall(peerName) {
    throw new Error('endCall must be implemented by subclass');
  }

  /**
   * Handle window resize
   * Optional - no-op by default
   * @param {Object} window - Window object
   */
  resize(window) {
    // Optional - no-op by default
  }

  /**
   * Cleanup and destroy the component
   * Optional - no-op by default
   */
  destroy() {
    // Optional - no-op by default
  }
}

