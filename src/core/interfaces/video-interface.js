/**
 * VideoInterface - Interface for video element components
 * 
 * This interface defines methods for video elements that display MediaStreams.
 * This allows for custom video implementations (e.g., custom HTML elements,
 * React components, Canvas-based rendering, etc.)
 * 
 * @interface VideoInterface
 */
export class VideoInterface {
  /**
   * Set the video source (MediaStream)
   * @param {MediaStream|null} stream - MediaStream to display, or null to clear
   */
  setStream(stream) {
    throw new Error('setStream must be implemented');
  }

  /**
   * Get the current video source
   * @returns {MediaStream|null} Current stream or null
   */
  getStream() {
    throw new Error('getStream must be implemented');
  }

  /**
   * Show the video element
   */
  show() {
    // Optional - no-op by default
  }

  /**
   * Hide the video element
   */
  hide() {
    // Optional - no-op by default
  }

  /**
   * Set muted state
   * @param {boolean} muted - Whether video should be muted
   */
  setMuted(muted) {
    // Optional - no-op by default
  }

  /**
   * Get muted state
   * @returns {boolean} Whether video is muted
   */
  isMuted() {
    return false;
  }

  /**
   * Set autoplay
   * @param {boolean} autoplay - Whether video should autoplay
   */
  setAutoplay(autoplay) {
    // Optional - no-op by default
  }

  /**
   * Set playsinline (for mobile)
   * @param {boolean} playsinline - Whether video should play inline
   */
  setPlaysinline(playsinline) {
    // Optional - no-op by default
  }

  /**
   * Get the underlying element (for DOM manipulation if needed)
   * @returns {HTMLElement|null} The underlying element
   */
  getElement() {
    return null;
  }

  /**
   * Cleanup and destroy the video element
   */
  destroy() {
    // Optional - no-op by default
  }
}

