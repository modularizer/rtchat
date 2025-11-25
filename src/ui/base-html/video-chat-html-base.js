/**
 * VideoChatHTMLElementBase - HTMLElement-based base for video chat component
 * 
 * This class extends UIComponentBase (which extends HTMLElement) and implements
 * the VideoChatBase contract. This allows concrete implementations to
 * extend this class and get both HTMLElement functionality and the abstract contract.
 * 
 * @extends UIComponentBase
 * @implements VideoChatBase
 */

import { UIComponentBase } from '../../core/interfaces/ui-component-base.js';
import { VideoChatBase } from '../../core/interfaces/video-chat-base.js';
import { RTCVideoChat } from '../../core/rtc-video-chat.js';

export class VideoChatHTMLElementBase extends UIComponentBase {
  /**
   * Create a new VideoChatHTMLElementBase instance
   * @param {Object} rtc - RTC client instance
   * @param {Object} options - Configuration options
   */
  constructor(rtc, options = {}) {
    super(options);
    
    // Initialize abstract base functionality
    // Initialize properties from VideoChatBase
    this.rtc = rtc;
    
    // Store window reference
    this._window = this.options.window;
    this._assignToWindow = this.options.assignToWindow;
    
    // Note: RTCVideoChat initialization should be done in subclass
    // after shadow DOM is set up, so callbacks can access DOM elements
    // Subclasses should call _initializeRTCVideoChat() after setting up DOM
  }
  
  /**
   * Initialize RTCVideoChat with callbacks
   * Should be called by subclasses after DOM is set up
   * @protected
   */
  _initializeRTCVideoChat(rtc) {
    // Bind methods
    this.setLocalSrc = this.setLocalSrc.bind(this);
    this.setRemoteSrc = this.setRemoteSrc.bind(this);
    this.hide = this.hide.bind(this);
    this.show = this.show.bind(this);
    this.resize = this.resize.bind(this);
    
    // Initialize RTCVideoChat with callbacks
    this.rtcVC = new RTCVideoChat(rtc,
      this.setLocalSrc,
      this.setRemoteSrc,
      this.hide,
      this.show
    );
    
    // Optional window assignment
    if (this._assignToWindow && this._window) {
      this._window.vc = this;
    }
    
    // Bind RTCVideoChat methods
    this.call = this.rtcVC.call.bind(this.rtcVC);
    this.endCall = this.rtcVC.endCall.bind(this.rtcVC);
    
    // Add resize listener if window is available
    if (this._window) {
      this._window.addEventListener('resize', this.resize);
    }
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
   * Handle window resize
   * Default implementation - can be overridden
   * @param {Object} window - Window object (optional, uses this._window if not provided)
   */
  resize(window = null) {
    const win = window || this._window;
    if (!win) return;
    
    // Optionally adjust the size based on the window size or other conditions
    const width = win.innerWidth;
    const height = win.innerHeight;
    
    // Get container element (must be implemented by subclass)
    const container = this._getContainer();
    if (container) {
      // Example: Adjust max-width/max-height based on conditions
      container.style.maxWidth = width > 600 ? '50vw' : '80vw';
      container.style.maxHeight = height > 600 ? '50vh' : '80vh';
    }
  }

  /**
   * Get the container element
   * Must be implemented by subclasses
   * @returns {HTMLElement|null} Container element
   * @protected
   * @abstract
   */
  _getContainer() {
    throw new Error('_getContainer must be implemented by subclass');
  }

  /**
   * Cleanup and destroy the component
   * Default implementation removes resize listener
   */
  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Remove resize listener
    if (this._window && this.resize) {
      this._window.removeEventListener('resize', this.resize);
    }
    
    // Clean up window assignment
    if (this._assignToWindow && this._window && this._window.vc === this) {
      delete this._window.vc;
    }
  }
}

