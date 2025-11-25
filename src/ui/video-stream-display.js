/**
 * VideoStreamDisplay - Standalone component for displaying WebRTC video streams in chat
 * 
 * HTMLElement-based implementation that extends VideoStreamDisplayBase,
 * which provides the abstract contract for video stream display.
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
import { VideoStreamDisplayBase } from '../core/interfaces/video-stream-display-base.js';

class VideoStreamDisplay extends VideoStreamDisplayBase {
  /**
   * Create a new VideoStreamDisplay instance
   * @param {HTMLElement} container - Container element to append video elements to
   * @param {Object} options - Configuration options
   * @param {string} options.localVideoSize - Size of local video overlay (default: '30%')
   * @param {string} options.localVideoPosition - Position of local video (default: 'top-right')
   * @param {class} options.VideoClass - Video class implementing VideoInterface (default: VideoElement)
   */
  constructor(container, options = {}) {
    super(container, {
      localVideoSize: options.localVideoSize || '30%',
      localVideoPosition: options.localVideoPosition || 'top-right',
      VideoClass: options.VideoClass || VideoElement,
      ...options
    });
    
    this.VideoClass = this.options.VideoClass;
    
    // Validate VideoClass implements VideoInterface
    if (!this.VideoClass || typeof this.VideoClass !== 'function') {
      throw new Error('VideoClass must be a class implementing VideoInterface');
    }
    
    this._setupStyles();
  }

  /**
   * Set up CSS styles for video elements
   * Implements VideoStreamDisplayBase._setupStyles
   * @protected
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
   * Implements VideoStreamDisplayBase.setStreams and StreamDisplayInterface.setStreams
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
   * Implements VideoStreamDisplayBase._createVideoContainer
   * @param {string} peerName - Name of the peer
   * @returns {Object} Object with container, remoteVideo, and localVideo
   * @protected
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

  // _setupTrackEndHandlers is inherited from VideoStreamDisplayBase

  /**
   * Remove video streams for a peer
   * Implements VideoStreamDisplayBase.removeStreams and StreamDisplayInterface.removeStreams
   * @param {string} peerName - Name of the peer
   */
  removeStreams(peerName) {
    const streamData = this.activeStreams[peerName];
    if (!streamData) {
      return;
    }

    // Stop all tracks using base class helper
    if (streamData.streams) {
      this._stopStreamTracks(streamData.streams.local);
      this._stopStreamTracks(streamData.streams.remote);
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

  // removeAllStreams, hasActiveStreams, getActivePeers, show, and hide
  // are inherited from VideoStreamDisplayBase
}

export { VideoStreamDisplay };

