/**
 * VideoStreamDisplayBase - Abstract base class for video stream display components
 * 
 * This abstract class defines the contract for displaying video streams from
 * multiple peers. It is implementation-agnostic and can be implemented using
 * HTMLElement, React, Vue, or any other framework.
 * 
 * Implements StreamDisplayInterface contract.
 * 
 * @abstract
 * @implements StreamDisplayInterface
 */

import { StreamDisplayInterface } from './stream-display-interface.js';

export class VideoStreamDisplayBase {
  /**
   * Create a new VideoStreamDisplayBase instance
   * @param {HTMLElement|Object} container - Container element or container object
   * @param {Object} options - Configuration options
   * @param {string} options.localVideoSize - Size of local video overlay (default: '30%')
   * @param {string} options.localVideoPosition - Position of local video (default: 'top-right')
   * @param {class} options.VideoClass - Video class implementing VideoInterface (optional)
   */
  constructor(container, options = {}) {
    if (new.target === VideoStreamDisplayBase) {
      throw new Error('VideoStreamDisplayBase is abstract and cannot be instantiated directly');
    }
    
    if (!container) {
      throw new Error('VideoStreamDisplayBase requires a container');
    }
    
    this.container = container;
    this.options = {
      localVideoSize: options.localVideoSize || '30%',
      localVideoPosition: options.localVideoPosition || 'top-right',
      VideoClass: options.VideoClass,
      ...options
    };
    
    this.activeStreams = {}; // Track streams by peer name
  }

  /**
   * Set video streams for a peer
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer
   * @param {Object} streams - Stream objects
   * @param {MediaStream} streams.localStream - Local media stream
   * @param {MediaStream} streams.remoteStream - Remote media stream
   * @abstract
   */
  setStreams(peerName, { localStream, remoteStream }) {
    throw new Error('setStreams must be implemented by subclass');
  }

  /**
   * Remove video streams for a peer
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer
   * @abstract
   */
  removeStreams(peerName) {
    throw new Error('removeStreams must be implemented by subclass');
  }

  /**
   * Show the video container
   * Default implementation - can be overridden
   */
  show() {
    if (this.container && this.container.style) {
      if (this.hasActiveStreams()) {
        this.container.style.display = 'block';
      }
    }
  }

  /**
   * Hide the video container
   * Default implementation - can be overridden
   */
  hide() {
    if (this.container && this.container.style) {
      this.container.style.display = 'none';
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
   * Get list of active peer names
   * @returns {string[]} Array of peer names with active streams
   */
  getActivePeers() {
    return Object.keys(this.activeStreams);
  }

  /**
   * Remove all video streams
   * Default implementation - can be overridden
   */
  removeAllStreams() {
    const peerNames = Object.keys(this.activeStreams);
    peerNames.forEach(peerName => this.removeStreams(peerName));
  }

  /**
   * Setup track end handlers for a stream
   * Default implementation - can be overridden
   * @param {string} peerName - Name of the peer
   * @param {MediaStream} localStream - Local stream
   * @param {MediaStream} remoteStream - Remote stream
   * @protected
   */
  _setupTrackEndHandlers(peerName, localStream, remoteStream) {
    const streamData = this.activeStreams[peerName];
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
      console.log(`Stream track ended for ${peerName}`);
      this.removeStreams(peerName);
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

  /**
   * Setup CSS styles for video elements
   * Must be implemented by subclasses if styles are needed
   * @protected
   * @abstract
   */
  _setupStyles() {
    // Optional - no-op by default
  }

  /**
   * Create a video container element for a peer
   * Must be implemented by subclasses
   * @param {string} peerName - Name of the peer
   * @returns {Object} Object with container and video elements
   * @protected
   * @abstract
   */
  _createVideoContainer(peerName) {
    throw new Error('_createVideoContainer must be implemented by subclass');
  }
}

