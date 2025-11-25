/**
 * VideoStreamDisplay - Standalone component for displaying WebRTC video streams in chat
 * 
 * A modular component that manages video elements for multiple peer connections.
 * Uses VideoInterface implementations for local and remote video elements.
 * 
 * Usage:
 *   import { VideoStreamDisplay } from './video-stream-display.js';
 *   import { VideoElement } from './video-element.js';
 *   
 *   const videoDisplay = new VideoStreamDisplay(containerElement, {
 *     VideoClass: VideoElement  // Optional: custom Video implementation
 *   });
 *   videoDisplay.setStreams('peerName', { localStream, remoteStream });
 *   videoDisplay.removeStreams('peerName');
 * 
 * Features:
 * - Multiple peer support (one video container per peer)
 * - Automatic stream management
 * - Cleanup on stream end
 * - Responsive video layout
 * - Local video overlay (small preview)
 * - Remote video main display
 * - Pluggable Video implementations via VideoInterface
 * 
 * @module video-stream-display
 */

import { VideoElement } from './video-element.js';
import { VideoInterface } from '../core/interfaces/video-interface.js';

class VideoStreamDisplay {
  /**
   * Create a new VideoStreamDisplay instance
   * @param {HTMLElement} container - Container element to append video elements to
   * @param {Object} options - Configuration options
   * @param {string} options.localVideoSize - Size of local video overlay (default: '30%')
   * @param {string} options.localVideoPosition - Position of local video (default: 'top-right')
   * @param {class} options.VideoClass - Video class implementing VideoInterface (default: VideoElement)
   */
  constructor(container, options = {}) {
    if (!container) {
      throw new Error('VideoStreamDisplay requires a container element');
    }
    
    this.container = container;
    this.VideoClass = options.VideoClass || VideoElement;
    
    // Validate VideoClass implements VideoInterface
    if (!this.VideoClass || typeof this.VideoClass !== 'function') {
      throw new Error('VideoClass must be a class implementing VideoInterface');
    }
    
    this.options = {
      localVideoSize: options.localVideoSize || '30%',
      localVideoPosition: options.localVideoPosition || 'top-right',
      ...options
    };
    
    this.activeStreams = {}; // Track streams by peer name
    this._setupStyles();
  }

  /**
   * Set up CSS styles for video elements
   * @private
   */
  _setupStyles() {
    // Get the root node (handles shadow DOM)
    const root = this.container.getRootNode ? this.container.getRootNode() : document;
    
    // Check if styles already exist in the root
    if (root.querySelector && root.querySelector('style[data-video-stream-display]')) {
      return;
    }

    const style = document.createElement('style');
    style.setAttribute('data-video-stream-display', 'true');
    style.textContent = `
      .video-stream-container {
        position: relative;
        width: 100%;
        max-width: 100%;
        margin-bottom: 10px;
        background: #000;
        border-radius: 5px;
        overflow: hidden;
      }
      .video-stream-container video {
        width: 100%;
        height: auto;
        display: block;
      }
      .video-stream-remote {
        width: 100%;
      }
      .video-stream-local {
        position: absolute;
        width: ${this.options.localVideoSize || '25%'};
        max-width: ${this.options.localVideoSize || '25%'};
        top: 10px;
        right: 10px;
        border: 2px solid white;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        border-radius: 5px;
        background: #000;
        z-index: 10;
        object-fit: cover;
      }
    `;
    
    // Insert styles into the appropriate location
    // For shadow DOM, we need to add to the shadow root
    if (root instanceof ShadowRoot) {
      // Shadow DOM - add to shadow root
      root.appendChild(style);
    } else if (root === document || root === document.documentElement) {
      // Regular DOM - add to head
      document.head.appendChild(style);
    } else {
      // Fallback - try to add to root or document head
      try {
        if (root.appendChild) {
          root.appendChild(style);
        } else {
          document.head.appendChild(style);
        }
      } catch (e) {
        // If all else fails, add to document head
        document.head.appendChild(style);
      }
    }
  }

  /**
   * Set video streams for a peer
   * @param {string} peerName - Name of the peer
   * @param {Object} streams - Stream objects
   * @param {MediaStream} streams.localStream - Local media stream
   * @param {MediaStream} streams.remoteStream - Remote media stream
   */
  setStreams(peerName, { localStream, remoteStream }) {
    if (!peerName) {
      throw new Error('peerName is required');
    }

    // Get or create video container for this peer
    let streamData = this.activeStreams[peerName];
    
    if (!streamData || !streamData.container) {
      const { container, remoteVideo, localVideo } = this._createVideoContainer(peerName);
      this.container.appendChild(container);
      
      // Initialize tracking
      streamData = {
        container,
        remoteVideo, // VideoInterface instance
        localVideo,  // VideoInterface instance
        streams: {},
        trackEndHandlers: []
      };
      this.activeStreams[peerName] = streamData;
    }

    // Set streams using VideoInterface methods
    if (remoteStream && remoteStream instanceof MediaStream) {
      streamData.remoteVideo.setStream(remoteStream);
      streamData.remoteVideo.show();
    } else {
      streamData.remoteVideo.setStream(null);
    }
    
    if (localStream && localStream instanceof MediaStream) {
      streamData.localVideo.setStream(localStream);
      streamData.localVideo.show();
    } else {
      streamData.localVideo.setStream(null);
      streamData.localVideo.hide();
    }

    // Store streams for cleanup
    this.activeStreams[peerName].streams.local = localStream;
    this.activeStreams[peerName].streams.remote = remoteStream;

    // Setup track end handlers
    this._setupTrackEndHandlers(peerName, localStream, remoteStream);

    // Show container if hidden
    if (this.container.style.display === 'none') {
      this.container.style.display = 'block';
    }
  }

  /**
   * Create a video container element for a peer
   * @param {string} peerName - Name of the peer
   * @returns {HTMLElement} Video container element
   * @private
   */
  _createVideoContainer(peerName) {
    const container = document.createElement('div');
    container.className = 'video-stream-container';
    container.setAttribute('data-peer', peerName);

    // Create remote video using VideoInterface implementation
    const remoteVideo = new this.VideoClass({
      autoplay: true,
      playsinline: true,
      muted: false
    });
    const remoteVideoElement = remoteVideo.getElement();
    if (remoteVideoElement) {
      remoteVideoElement.className = 'video-stream-remote';
      remoteVideoElement.setAttribute('data-peer', peerName);
      remoteVideoElement.setAttribute('data-type', 'remote');
      container.appendChild(remoteVideoElement);
    }

    // Create local video using VideoInterface implementation
    const localVideo = new this.VideoClass({
      autoplay: true,
      playsinline: true,
      muted: true // Mute local video to avoid feedback
    });
    const localVideoElement = localVideo.getElement();
    if (localVideoElement) {
      localVideoElement.className = 'video-stream-local';
      localVideoElement.setAttribute('data-peer', peerName);
      localVideoElement.setAttribute('data-type', 'local');
      container.appendChild(localVideoElement);
    }

    return { container, remoteVideo, localVideo };
  }

  /**
   * Setup handlers for track end events
   * @param {string} peerName - Name of the peer
   * @param {MediaStream} localStream - Local stream
   * @param {MediaStream} remoteStream - Remote stream
   * @private
   */
  _setupTrackEndHandlers(peerName, localStream, remoteStream) {
    // Remove existing handlers
    if (this.activeStreams[peerName].trackEndHandlers) {
      this.activeStreams[peerName].trackEndHandlers.forEach(handler => {
        if (handler.track && handler.track.onended) {
          handler.track.onended = null;
        }
      });
    }
    this.activeStreams[peerName].trackEndHandlers = [];

    // Setup new handlers - only if streams are valid MediaStream objects
    const handleTrackEnd = () => {
      console.log(`Stream track ended for ${peerName}`);
      this.removeStreams(peerName);
    };

    if (remoteStream && remoteStream instanceof MediaStream && typeof remoteStream.getTracks === 'function') {
      remoteStream.getTracks().forEach(track => {
        track.onended = handleTrackEnd;
        this.activeStreams[peerName].trackEndHandlers.push({ track, type: 'remote' });
      });
    }
    if (localStream && localStream instanceof MediaStream && typeof localStream.getTracks === 'function') {
      localStream.getTracks().forEach(track => {
        track.onended = handleTrackEnd;
        this.activeStreams[peerName].trackEndHandlers.push({ track, type: 'local' });
      });
    }
  }

  /**
   * Remove video streams for a peer
   * @param {string} peerName - Name of the peer
   */
  removeStreams(peerName) {
    const streamData = this.activeStreams[peerName];
    if (!streamData) {
      return;
    }

    // Stop all tracks - only if streams are valid MediaStream objects
    if (streamData.streams) {
      if (streamData.streams.local && streamData.streams.local instanceof MediaStream && typeof streamData.streams.local.getTracks === 'function') {
        streamData.streams.local.getTracks().forEach(track => {
          track.stop();
        });
      }
      if (streamData.streams.remote && streamData.streams.remote instanceof MediaStream && typeof streamData.streams.remote.getTracks === 'function') {
        streamData.streams.remote.getTracks().forEach(track => {
          track.stop();
        });
      }
    }

    // Remove track end handlers
    if (streamData.trackEndHandlers) {
      streamData.trackEndHandlers.forEach(handler => {
        if (handler.track && handler.track.onended) {
          handler.track.onended = null;
        }
      });
    }

    // Clear video elements using VideoInterface methods
    if (streamData.remoteVideo && typeof streamData.remoteVideo.setStream === 'function') {
      streamData.remoteVideo.setStream(null);
      if (typeof streamData.remoteVideo.destroy === 'function') {
        streamData.remoteVideo.destroy();
      }
    }
    if (streamData.localVideo && typeof streamData.localVideo.setStream === 'function') {
      streamData.localVideo.setStream(null);
      if (typeof streamData.localVideo.destroy === 'function') {
        streamData.localVideo.destroy();
      }
    }

    // Remove container from DOM
    if (streamData.container && streamData.container.parentNode) {
      streamData.container.parentNode.removeChild(streamData.container);
    }

    // Remove from active streams
    delete this.activeStreams[peerName];

    // Hide container if no active streams
    if (Object.keys(this.activeStreams).length === 0) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Remove all video streams
   */
  removeAllStreams() {
    const peerNames = Object.keys(this.activeStreams);
    peerNames.forEach(peerName => this.removeStreams(peerName));
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
   * Show the video container
   */
  show() {
    if (this.hasActiveStreams()) {
      this.container.style.display = 'block';
    }
  }

  /**
   * Hide the video container
   */
  hide() {
    this.container.style.display = 'none';
  }
}

export { VideoStreamDisplay };

