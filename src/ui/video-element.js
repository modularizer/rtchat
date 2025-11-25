/**
 * VideoElement - Default HTML video element implementation of VideoInterface
 * 
 * This is the default implementation of VideoInterface using a standard HTML video element.
 * You can create custom implementations for different platforms or rendering methods.
 * 
 * Usage:
 *   import { VideoElement } from './video-element.js';
 *   
 *   const video = new VideoElement();
 *   video.setStream(myMediaStream);
 *   document.body.appendChild(video.getElement());
 * 
 * @implements VideoInterface
 */

import { VideoInterface } from '../core/interfaces/video-interface.js';

class VideoElement extends VideoInterface {
  /**
   * Create a new VideoElement instance
   * @param {Object} options - Configuration options
   * @param {boolean} options.autoplay - Whether to autoplay (default: true)
   * @param {boolean} options.playsinline - Whether to play inline on mobile (default: true)
   * @param {boolean} options.muted - Whether to start muted (default: false)
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      autoplay: options.autoplay !== false, // Default: true
      playsinline: options.playsinline !== false, // Default: true
      muted: options.muted || false, // Default: false
      ...options
    };
    
    // Create HTML video element
    this.element = document.createElement('video');
    this.element.autoplay = this.options.autoplay;
    this.element.playsinline = this.options.playsinline;
    this.element.muted = this.options.muted;
    
    // Set initial styles
    this.element.style.width = '100%';
    this.element.style.height = 'auto';
    this.element.style.display = 'block';
  }

  /**
   * Set the video source (MediaStream)
   * @param {MediaStream|null} stream - MediaStream to display, or null to clear
   */
  setStream(stream) {
    if (stream && stream instanceof MediaStream) {
      this.element.srcObject = stream;
    } else if (stream === null) {
      this.element.srcObject = null;
    } else {
      console.warn('VideoElement.setStream: Invalid stream provided', stream);
    }
  }

  /**
   * Get the current video source
   * @returns {MediaStream|null} Current stream or null
   */
  getStream() {
    return this.element.srcObject;
  }

  /**
   * Show the video element
   */
  show() {
    this.element.style.display = 'block';
  }

  /**
   * Hide the video element
   */
  hide() {
    this.element.style.display = 'none';
  }

  /**
   * Set muted state
   * @param {boolean} muted - Whether video should be muted
   */
  setMuted(muted) {
    this.element.muted = muted;
  }

  /**
   * Get muted state
   * @returns {boolean} Whether video is muted
   */
  isMuted() {
    return this.element.muted;
  }

  /**
   * Set autoplay
   * @param {boolean} autoplay - Whether video should autoplay
   */
  setAutoplay(autoplay) {
    this.element.autoplay = autoplay;
  }

  /**
   * Set playsinline (for mobile)
   * @param {boolean} playsinline - Whether video should play inline
   */
  setPlaysinline(playsinline) {
    this.element.playsinline = playsinline;
  }

  /**
   * Get the underlying element (for DOM manipulation if needed)
   * @returns {HTMLElement} The underlying video element
   */
  getElement() {
    return this.element;
  }

  /**
   * Cleanup and destroy the video element
   */
  destroy() {
    // Stop all tracks
    if (this.element.srcObject) {
      this.element.srcObject.getTracks().forEach(track => track.stop());
      this.element.srcObject = null;
    }
    
    // Remove from DOM if attached
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export { VideoElement };

