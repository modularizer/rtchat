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
    
    // Ensure container has grid class from the start
    if (this.container && !this.container.classList.contains('video-stream-display-container')) {
      this.container.classList.add('video-stream-display-container');
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
      .video-stream-display-container {
        display: grid;
        gap: 10px;
        width: 100%;
        padding: 10px;
        min-height: 300px;
      }
      /* 2 people: current layout (one main, one overlay) */
      .video-stream-display-container.count-2 {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr;
      }
      .video-stream-display-container.count-2 .video-stream-container:first-child {
        position: relative;
      }
      .video-stream-display-container.count-2 .video-stream-container:first-child .video-stream-local {
        position: absolute;
        width: 30%;
        max-width: 30%;
        top: 10px;
        right: 10px;
        border: 2px solid white;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        border-radius: 5px;
        background: #000;
        z-index: 10;
        object-fit: cover;
        aspect-ratio: 16 / 9;
      }
      /* 3 people: row of 2.5 (your video smaller, two others larger) */
      .video-stream-display-container.count-3 {
        grid-template-columns: 0.4fr 1fr 1fr;
        grid-template-rows: 1fr;
      }
      /* Ensure local video (first item) is smaller in 3-person layout */
      .video-stream-display-container.count-3 .local-video-container {
        min-width: 0;
      }
      /* 4 people: 2x2 grid */
      .video-stream-display-container.count-4 {
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
      }
      /* 5-6 people: 2x3 grid */
      .video-stream-display-container.count-5,
      .video-stream-display-container.count-6 {
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(3, 1fr);
      }
      /* 7-9 people: 3x3 grid */
      .video-stream-display-container.count-7,
      .video-stream-display-container.count-8,
      .video-stream-display-container.count-9 {
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(3, 1fr);
      }
      /* 10+ people: auto-fit grid */
      .video-stream-display-container.count-10-plus {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        grid-auto-rows: minmax(150px, 1fr);
      }
      .video-stream-container {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 5px;
        overflow: hidden;
        border: 2px solid #333;
      }
      .video-stream-container video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }
      .video-stream-remote {
        width: 100%;
        height: 100%;
      }
      /* Local video overlay - only shown for 2-person calls */
      .video-stream-local {
        display: none; /* Hidden by default, shown only for 2-person layout */
      }
      .video-stream-label {
        position: absolute;
        bottom: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 11;
        pointer-events: none;
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

    // Ensure container has grid class
    if (!this.container.classList.contains('video-stream-display-container')) {
      this.container.classList.add('video-stream-display-container');
    }

    // Get or create video container for this peer
    let streamData = this.activeStreams[peerName];
    
    if (!streamData || !streamData.container) {
      const { container, remoteVideo, localVideo, label } = this._createVideoContainer(peerName);
      this.container.appendChild(container);
      
      // Initialize tracking
      streamData = {
        container,
        remoteVideo, // VideoInterface instance
        localVideo,  // VideoInterface instance
        label,       // Label element
        streams: {},
        trackEndHandlers: []
      };
      this.activeStreams[peerName] = streamData;
    }

    // Count remote participants (excluding local video container)
    const remoteParticipants = Object.keys(this.activeStreams).filter(key => key !== '__local__');
    const participantCount = remoteParticipants.length;
    const isGroupCall = participantCount >= 2;

    // Set remote stream (always shown in grid)
    if (remoteStream && remoteStream instanceof MediaStream) {
      streamData.remoteVideo.setStream(remoteStream);
      streamData.remoteVideo.show();
      if (streamData.label) {
        streamData.label.textContent = peerName;
        streamData.label.style.display = 'block';
      }
    } else {
      streamData.remoteVideo.setStream(null);
      if (streamData.label) {
        streamData.label.style.display = 'none';
      }
    }
    
    // Handle local video stream
    // Store local stream reference (same for all peers in a call)
    if (localStream && localStream instanceof MediaStream) {
      this._localStream = localStream;
      
      if (participantCount === 2) {
        // 2-person call: show local video as overlay on first remote video
        const firstPeer = remoteParticipants[0];
        if (peerName === firstPeer) {
          streamData.localVideo.setStream(localStream);
          streamData.localVideo.show();
          if (streamData.localVideo.getElement()) {
            streamData.localVideo.getElement().style.display = 'block';
          }
        } else {
          // Hide local video overlay on second peer
          streamData.localVideo.setStream(null);
          streamData.localVideo.hide();
          if (streamData.localVideo.getElement()) {
            streamData.localVideo.getElement().style.display = 'none';
          }
        }
      } else if (participantCount >= 3) {
        // 3+ person call: show local video as separate grid item
        // Hide overlay on all remote videos
        streamData.localVideo.setStream(null);
        streamData.localVideo.hide();
        if (streamData.localVideo.getElement()) {
          streamData.localVideo.getElement().style.display = 'none';
        }
        
        // Create/update local video container as separate grid item
        this._updateLocalVideoInGrid(localStream);
      } else {
        // Single person call
        streamData.localVideo.setStream(localStream);
        streamData.localVideo.show();
      }
    } else {
      streamData.localVideo.setStream(null);
      streamData.localVideo.hide();
    }

    // Store streams for cleanup
    this.activeStreams[peerName].streams.local = localStream;
    this.activeStreams[peerName].streams.remote = remoteStream;

    // Setup track end handlers
    this._setupTrackEndHandlers(peerName, localStream, remoteStream);

    // Update grid layout based on number of participants
    this._updateGridLayout();

    // Show container if hidden
    if (this.container.style.display === 'none') {
      this.container.style.display = 'block';
    }
  }
  
  /**
   * Update local video in grid for group calls (3+ participants)
   * @param {MediaStream} localStream - Local video stream
   * @private
   */
  _updateLocalVideoInGrid(localStream) {
    const localVideoKey = '__local__';
    let localStreamData = this.activeStreams[localVideoKey];
    
    if (!localStreamData || !localStreamData.container) {
      // Create local video container
      const { container, remoteVideo, label } = this._createVideoContainer(localVideoKey);
      container.classList.add('local-video-container');
      // Insert at the beginning for 3-person layout (local video first)
      const firstChild = this.container.firstChild;
      if (firstChild) {
        this.container.insertBefore(container, firstChild);
      } else {
        this.container.appendChild(container);
      }
      
      localStreamData = {
        container,
        remoteVideo, // Use remoteVideo element for local stream in grid
        localVideo: null, // Not used for grid display
        label,
        streams: { local: localStream, remote: null },
        trackEndHandlers: []
      };
      this.activeStreams[localVideoKey] = localStreamData;
    }
    
    // Set local stream to the container
    if (localStreamData.remoteVideo) {
      localStreamData.remoteVideo.setStream(localStream);
      localStreamData.remoteVideo.show();
      if (localStreamData.label) {
        localStreamData.label.textContent = 'You';
        localStreamData.label.style.display = 'block';
      }
    }
  }

  /**
   * Update grid layout based on number of active streams
   * Supports unlimited participants with specific layouts
   * @private
   */
  _updateGridLayout() {
    // Count only remote participants (exclude local video container)
    const remoteParticipants = Object.keys(this.activeStreams).filter(key => key !== '__local__');
    const hasLocalVideoInGrid = this.activeStreams['__local__'] !== undefined;
    
    // Total count includes local video if shown separately (3+ participants)
    // For 2 participants, local is overlay so don't count it
    const totalCount = remoteParticipants.length >= 3 
      ? remoteParticipants.length + (hasLocalVideoInGrid ? 1 : 0)
      : remoteParticipants.length;
    
    // Remove all count-based layout classes
    const countClasses = Array.from(this.container.classList).filter(cls => cls.startsWith('count-'));
    countClasses.forEach(cls => this.container.classList.remove(cls));
    
    // Apply layout based on participant count
    if (totalCount === 1) {
      this.container.classList.add('count-1');
    } else if (totalCount === 2) {
      this.container.classList.add('count-2');
    } else if (totalCount === 3) {
      this.container.classList.add('count-3');
    } else if (totalCount === 4) {
      this.container.classList.add('count-4');
    } else if (totalCount === 5 || totalCount === 6) {
      this.container.classList.add(`count-${totalCount}`);
    } else if (totalCount >= 7 && totalCount <= 9) {
      this.container.classList.add(`count-${totalCount}`);
    } else if (totalCount >= 10) {
      this.container.classList.add('count-10-plus');
    }
    
    console.log(`Updated grid layout: ${totalCount} participants (${remoteParticipants.length} remote + ${hasLocalVideoInGrid && remoteParticipants.length >= 3 ? 1 : 0} local)`);
  }

  /**
   * Create a video container element for a peer
   * Implements VideoStreamDisplayBase._createVideoContainer
   * @param {string} peerName - Name of the peer
   * @returns {Object} Object with container, remoteVideo, localVideo, and label
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

    // Create label for participant name
    const label = document.createElement('div');
    label.className = 'video-stream-label';
    label.textContent = peerName;
    label.setAttribute('data-peer', peerName);
    container.appendChild(label);

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

    return { container, remoteVideo, localVideo, label };
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
    
    // If we removed a remote participant and now have < 3 participants, remove local video from grid
    const remoteParticipants = Object.keys(this.activeStreams).filter(key => key !== '__local__');
    if (remoteParticipants.length < 3 && this.activeStreams['__local__']) {
      this.removeStreams('__local__');
    }

    // Update grid layout
    this._updateGridLayout();

    // Hide container if no active streams
    if (Object.keys(this.activeStreams).length === 0) {
      this.container.style.display = 'none';
    }
  }

  // removeAllStreams, hasActiveStreams, getActivePeers, show, and hide
  // are inherited from VideoStreamDisplayBase
}

export { VideoStreamDisplay };

