/**
 * StreamDisplayBase - Abstract base class for stream display components
 * 
 * This base class extends UIComponentBase and implements StreamDisplayInterface.
 * It provides common functionality for components that display audio/video streams.
 * 
 * Subclasses should implement:
 * - setStreams(user, streams)
 * - removeStreams(user)
 * 
 * @abstract
 * @extends UIComponentBase
 * @implements StreamDisplayInterface
 */

import { UIComponentBase } from '../../core/interfaces/ui-component-base.js';
import { StreamDisplayInterface } from '../../core/interfaces/stream-display-interface.js';

export class StreamDisplayBase extends UIComponentBase {
  /**
   * Create a new StreamDisplayBase instance
   * @param {HTMLElement} container - Container element (optional, can be set later)
   * @param {Object} config - Configuration options
   */
  constructor(container = null, config = {}) {
    super(config);
    
    this.container = container;
    this.activeStreams = {}; // Track streams by user name
    
    // If container is provided and we're not a custom element, attach to it
    if (container && !this.isConnected) {
      // For non-custom elements, we might want to append to container
      // This is handled by subclasses
    }
  }

  /**
   * Set streams for a user
   * Must be implemented by subclasses
   * @param {string} user - User name
   * @param {Object} streams - {localStream: MediaStream, remoteStream: MediaStream}
   * @abstract
   */
  setStreams(user, streams) {
    throw new Error('setStreams must be implemented by subclass');
  }

  /**
   * Remove streams for a user
   * Must be implemented by subclasses
   * @param {string} user - User name
   * @abstract
   */
  removeStreams(user) {
    throw new Error('removeStreams must be implemented by subclass');
  }

  /**
   * Show the stream display
   * Default implementation - can be overridden
   */
  show() {
    if (this.container) {
      this.container.style.display = 'block';
    } else if (this.shadowRoot) {
      const root = this.getRoot();
      if (root.style) {
        root.style.display = 'block';
      }
    }
  }

  /**
   * Hide the stream display
   * Default implementation - can be overridden
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    } else if (this.shadowRoot) {
      const root = this.getRoot();
      if (root.style) {
        root.style.display = 'none';
      }
    }
  }

  /**
   * Check if there are active streams
   * @returns {boolean} True if there are active streams
   */
  hasActiveStreams() {
    return Object.keys(this.activeStreams).length > 0;
  }

  /**
   * Get list of active user names
   * @returns {string[]} Array of user names with active streams
   */
  getActiveUsers() {
    return Object.keys(this.activeStreams);
  }

  /**
   * Remove all streams
   */
  removeAllStreams() {
    const users = Object.keys(this.activeStreams);
    users.forEach(user => this.removeStreams(user));
  }

  /**
   * Setup track end handlers for a stream
   * @param {string} user - User name
   * @param {MediaStream} localStream - Local stream
   * @param {MediaStream} remoteStream - Remote stream
   * @protected
   */
  _setupTrackEndHandlers(user, localStream, remoteStream) {
    const streamData = this.activeStreams[user];
    if (!streamData) return;

    // Remove existing handlers
    if (streamData.trackEndHandlers) {
      streamData.trackEndHandlers.forEach(handler => {
        if (handler.track && handler.track.onended) {
          handler.track.onended = null;
        }
      });
    }
    streamData.trackEndHandlers = [];

    // Setup new handlers
    const handleTrackEnd = () => {
      console.log(`Stream track ended for ${user}`);
      this.removeStreams(user);
    };

    if (remoteStream && remoteStream instanceof MediaStream && typeof remoteStream.getTracks === 'function') {
      remoteStream.getTracks().forEach(track => {
        track.onended = handleTrackEnd;
        streamData.trackEndHandlers.push({ track, type: 'remote' });
      });
    }
    if (localStream && localStream instanceof MediaStream && typeof localStream.getTracks === 'function') {
      localStream.getTracks().forEach(track => {
        track.onended = handleTrackEnd;
        streamData.trackEndHandlers.push({ track, type: 'local' });
      });
    }
  }

  /**
   * Stop all tracks in a stream
   * @param {MediaStream} stream - Media stream
   * @protected
   */
  _stopStreamTracks(stream) {
    if (stream && stream instanceof MediaStream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }
  }
}

