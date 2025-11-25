var RTChat = (function (exports) {
  'use strict';

  var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
  /**
   * VideoInterface - Interface for video element components
   * 
   * This interface defines methods for video elements that display MediaStreams.
   * This allows for custom video implementations (e.g., custom HTML elements,
   * React components, Canvas-based rendering, etc.)
   * 
   * @interface VideoInterface
   */
  class VideoInterface {
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

  /**
   * AudioStreamDisplay - Standalone component for displaying WebRTC audio streams in chat
   * 
   * A modular component that manages audio elements for multiple peer connections.
   * Can be used independently or integrated into other components like ChatBox.
   * 
   * Usage:
   *   import { AudioStreamDisplay } from './audio-stream-display.js';
   *   
   *   const audioDisplay = new AudioStreamDisplay(containerElement);
   *   audioDisplay.setStreams('peerName', { localStream, remoteStream });
   *   audioDisplay.removeStreams('peerName');
   * 
   * Features:
   * - Multiple peer support (one audio element per peer)
   * - Automatic stream management
   * - Cleanup on stream end
   * - Visual indicators for active audio calls
   * - Optional visual waveform or status display
   * 
   * @module audio-stream-display
   */

  class AudioStreamDisplay {
    /**
     * Create a new AudioStreamDisplay instance
     * @param {HTMLElement} container - Container element to append audio elements to
     * @param {Object} options - Configuration options
     * @param {boolean} options.showVisualIndicator - Show visual indicator for active calls (default: true)
     * @param {boolean} options.showWaveform - Show audio waveform visualization (default: false)
     */
    constructor(container, options = {}) {
      if (!container) {
        throw new Error('AudioStreamDisplay requires a container element');
      }
      
      this.container = container;
      this.options = {
        showVisualIndicator: options.showVisualIndicator !== false,
        showWaveform: options.showWaveform || false,
        ...options
      };
      
      this.activeStreams = {}; // Track streams by peer name
      this._setupStyles();
    }

    /**
     * Set up CSS styles for audio elements
     * @private
     */
    _setupStyles() {
      // Get the root node (handles shadow DOM)
      const root = this.container.getRootNode ? this.container.getRootNode() : document;
      
      // Check if styles already exist in the root
      if (root.querySelector && root.querySelector('style[data-audio-stream-display]')) {
        return;
      }

      const style = document.createElement('style');
      style.setAttribute('data-audio-stream-display', 'true');
      style.textContent = `
      .audio-stream-container {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        margin-bottom: 5px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 5px;
        border-left: 3px solid #4CAF50;
      }
      .audio-stream-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #4CAF50;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .audio-stream-label {
        font-size: 0.9em;
        color: #333;
        flex: 1;
      }
      .audio-stream-controls {
        display: flex;
        gap: 5px;
      }
      .audio-stream-mute-btn {
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 3px;
        background: white;
        cursor: pointer;
        font-size: 0.8em;
      }
      .audio-stream-mute-btn:hover {
        background: #f0f0f0;
      }
      .audio-stream-mute-btn.muted {
        background: #ffebee;
        border-color: #f44336;
      }
      .audio-stream-element {
        display: none; /* Hide audio element, we just use it for playback */
      }
    `;
      
      // Insert styles into the appropriate location
      if (root instanceof ShadowRoot) {
        root.appendChild(style);
      } else if (root === document || root === document.documentElement) {
        document.head.appendChild(style);
      } else {
        try {
          if (root.appendChild) {
            root.appendChild(style);
          } else {
            document.head.appendChild(style);
          }
        } catch (e) {
          document.head.appendChild(style);
        }
      }
    }

    /**
     * Set audio streams for a peer
     * @param {string} peerName - Name of the peer
     * @param {Object} streams - Stream objects
     * @param {MediaStream} streams.localStream - Local media stream (optional for audio-only)
     * @param {MediaStream} streams.remoteStream - Remote media stream
     */
    setStreams(peerName, { localStream, remoteStream }) {
      if (!peerName) {
        throw new Error('peerName is required');
      }

      // Get or create audio container for this peer
      let audioContainer = this.activeStreams[peerName]?.container;
      
      if (!audioContainer) {
        audioContainer = this._createAudioContainer(peerName);
        this.container.appendChild(audioContainer);
        
        // Initialize tracking
        if (!this.activeStreams[peerName]) {
          this.activeStreams[peerName] = {
            container: audioContainer,
            streams: {},
            trackEndHandlers: [],
            muted: false
          };
        } else {
          this.activeStreams[peerName].container = audioContainer;
        }
      }

      // Get audio elements
      const remoteAudio = audioContainer.querySelector('.audio-stream-element[data-type="remote"]');
      const localAudio = audioContainer.querySelector('.audio-stream-element[data-type="local"]');

      // Set streams
      if (remoteStream && remoteAudio) {
        remoteAudio.srcObject = remoteStream;
        // Ensure audio plays
        remoteAudio.play().catch(err => {
          console.warn('Could not play remote audio:', err);
        });
      }
      if (localStream && localAudio) {
        localAudio.srcObject = localStream;
        localAudio.muted = true; // Always mute local audio to avoid feedback
        // Ensure audio plays (even though muted)
        localAudio.play().catch(err => {
          console.warn('Could not play local audio:', err);
        });
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
     * Create an audio container element for a peer
     * @param {string} peerName - Name of the peer
     * @returns {HTMLElement} Audio container element
     * @private
     */
    _createAudioContainer(peerName) {
      const container = document.createElement('div');
      container.className = 'audio-stream-container';
      container.setAttribute('data-peer', peerName);

      // Visual indicator
      if (this.options.showVisualIndicator) {
        const indicator = document.createElement('div');
        indicator.className = 'audio-stream-indicator';
        container.appendChild(indicator);
      }

      // Label
      const label = document.createElement('div');
      label.className = 'audio-stream-label';
      label.textContent = `🔊 ${peerName}`;
      container.appendChild(label);

      // Controls
      const controls = document.createElement('div');
      controls.className = 'audio-stream-controls';
      
      // Mute button
      const muteBtn = document.createElement('button');
      muteBtn.className = 'audio-stream-mute-btn';
      muteBtn.textContent = 'Mute';
      muteBtn.onclick = () => this._toggleMute(peerName);
      controls.appendChild(muteBtn);
      
      container.appendChild(controls);

      // Create remote audio element (hidden, for playback)
      const remoteAudio = document.createElement('audio');
      remoteAudio.className = 'audio-stream-element';
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute('data-peer', peerName);
      remoteAudio.setAttribute('data-type', 'remote');

      // Create local audio element (hidden, usually muted)
      const localAudio = document.createElement('audio');
      localAudio.className = 'audio-stream-element';
      localAudio.autoplay = true;
      localAudio.muted = true; // Always mute local audio
      localAudio.setAttribute('data-peer', peerName);
      localAudio.setAttribute('data-type', 'local');

      container.appendChild(remoteAudio);
      container.appendChild(localAudio);

      return container;
    }

    /**
     * Toggle mute for a peer's audio
     * @param {string} peerName - Name of the peer
     * @private
     */
    _toggleMute(peerName) {
      const streamData = this.activeStreams[peerName];
      if (!streamData) return;

      const remoteAudio = streamData.container.querySelector('.audio-stream-element[data-type="remote"]');
      if (!remoteAudio) return;

      streamData.muted = !streamData.muted;
      remoteAudio.muted = streamData.muted;

      const muteBtn = streamData.container.querySelector('.audio-stream-mute-btn');
      if (muteBtn) {
        muteBtn.textContent = streamData.muted ? 'Unmute' : 'Mute';
        muteBtn.classList.toggle('muted', streamData.muted);
      }
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

      // Setup new handlers
      const handleTrackEnd = () => {
        console.log(`Audio stream track ended for ${peerName}`);
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
     * Remove audio streams for a peer
     * @param {string} peerName - Name of the peer
     */
    removeStreams(peerName) {
      const streamData = this.activeStreams[peerName];
      if (!streamData) {
        return;
      }

      // Stop all tracks
      if (streamData.streams) {
        if (streamData.streams.local) {
          streamData.streams.local.getTracks().forEach(track => {
            track.stop();
          });
        }
        if (streamData.streams.remote) {
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

      // Clear audio elements
      const remoteAudio = streamData.container?.querySelector('.audio-stream-element[data-type="remote"]');
      const localAudio = streamData.container?.querySelector('.audio-stream-element[data-type="local"]');

      if (remoteAudio) {
        remoteAudio.srcObject = null;
      }
      if (localAudio) {
        localAudio.srcObject = null;
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
     * Remove all audio streams
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
     * Show the audio container
     */
    show() {
      if (this.hasActiveStreams()) {
        this.container.style.display = 'block';
      }
    }

    /**
     * Hide the audio container
     */
    hide() {
      this.container.style.display = 'none';
    }
  }

  /**
   * RingerInterface - Interface for ringtone/audio notification components
   * 
   * This interface defines methods for playing ringtones (e.g., for incoming calls).
   * Implement this if you want to provide custom ringtone behavior.
   * 
   * @interface RingerInterface
   */
  class RingerInterface {
    /**
     * Start playing the ringtone
     * @returns {Promise} Promise that resolves when ringtone starts
     */
    start() {
      throw new Error('start must be implemented');
    }

    /**
     * Stop playing the ringtone
     */
    stop() {
      throw new Error('stop must be implemented');
    }

    /**
     * Check if ringtone is currently playing
     * @returns {boolean} Whether ringtone is playing
     */
    isRinging() {
      return false;
    }
  }

  /**
   * CallRinger - Audio notification for incoming calls
   * 
   * Provides a ringing sound when calls are received.
   * Uses Web Audio API to generate a ringtone without requiring audio files.
   * 
   * Implements RingerInterface for use with CallManager.
   * 
   * Usage:
   *   import { CallRinger } from './call-ringer.js';
   *   import { CallManager } from '../core/call-manager.js';
   *   
   *   const ringer = new CallRinger();
   *   const callManager = new CallManager(rtcClient, { ringer });
   *   // Ringer will automatically start/stop for incoming calls
   * 
   * Features:
   * - No external audio files required
   * - Configurable ring pattern
   * - Automatic volume management
   * - Works in all modern browsers
   * 
   * @module call-ringer
   */


  class CallRinger extends RingerInterface {
    /**
     * Create a new CallRinger instance
     * @param {Object} options - Configuration options
     * @param {number} options.volume - Ring volume (0-1, default: 0.25)
     */
    constructor(options = {}) {
      super();
      this.options = {
        volume: options.volume !== undefined ? options.volume : 0.25,
        ...options
      };
      
      this.audioContext = null;
      this.oscillator1 = null;
      this.oscillator2 = null;
      this.gainNode = null;
      this.isRinging = false;
      this.ringInterval = null;
      this._initAudioContext();
    }

    /**
     * Initialize Web Audio API context
     * @private
     */
    _initAudioContext() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioContext = new AudioContext();
        }
      } catch (e) {
        console.warn('Web Audio API not supported:', e);
      }
    }

    /**
     * Resume audio context if suspended (required by some browsers)
     * @private
     */
    async _resumeAudioContext() {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch (e) {
          console.warn('Failed to resume audio context:', e);
        }
      }
    }

    /**
     * Create and start oscillators for ringing with pleasant pattern
     * @private
     */
    _startOscillators() {
      if (!this.audioContext) {
        return;
      }

      const now = this.audioContext.currentTime;
      // Pleasant two-tone pattern: play two notes in quick succession
      const note1Duration = 0.15; // First note
      const note2Duration = 0.15; // Second note
      const totalDuration = note1Duration + note2Duration;

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.options.volume;
      this.gainNode.connect(this.audioContext.destination);

      // First note: A4 (440 Hz) - pleasant, warm tone
      this.oscillator1 = this.audioContext.createOscillator();
      this.oscillator1.type = 'sine';
      this.oscillator1.frequency.value = 440; // A4
      this.oscillator1.connect(this.gainNode);
      
      // Second note: C#5 (554.37 Hz) - pleasant harmony
      this.oscillator2 = this.audioContext.createOscillator();
      this.oscillator2.type = 'sine';
      this.oscillator2.frequency.value = 554.37; // C#5
      
      // Create separate gain for second note to play it after first
      const gain2 = this.audioContext.createGain();
      gain2.gain.value = this.options.volume;
      gain2.connect(this.audioContext.destination);
      this.oscillator2.connect(gain2);

      // Start first note immediately
      this.oscillator1.start(now);
      this.oscillator1.stop(now + note1Duration);
      
      // Start second note after first note
      this.oscillator2.start(now + note1Duration);
      this.oscillator2.stop(now + totalDuration);
    }

    /**
     * Stop oscillators
     * @private
     */
    _stopOscillators() {
      if (this.oscillator1) {
        try {
          this.oscillator1.stop();
        } catch (e) {
          // Oscillator may already be stopped
        }
        this.oscillator1 = null;
      }
      if (this.oscillator2) {
        try {
          this.oscillator2.stop();
        } catch (e) {
          // Oscillator may already be stopped
        }
        this.oscillator2 = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
    }

    /**
     * Start ringing
     */
    async start() {
      if (this.isRinging) {
        return; // Already ringing
      }

      if (!this.audioContext) {
        // Try to initialize audio context if it doesn't exist
        this._initAudioContext();
        if (!this.audioContext) {
          console.warn('Web Audio API not available, cannot play ringtone');
          return;
        }
      }

      try {
        await this._resumeAudioContext();
        this.isRinging = true;

        // Start the ring pattern
        this._ringPattern();
      } catch (err) {
        console.warn('Could not start ringtone (may require user interaction):', err);
        // Still mark as ringing so we can try again
        this.isRinging = true;
        this._ringPattern();
      }
    }

    /**
     * Stop ringing
     */
    stop() {
      if (!this.isRinging) {
        return;
      }

      this.isRinging = false;
      
      // Clear interval
      if (this.ringInterval) {
        clearInterval(this.ringInterval);
        this.ringInterval = null;
      }

      // Stop oscillators
      this._stopOscillators();
    }

    /**
     * Ring pattern: play pleasant two-tone pattern, pause, repeat
     * @private
     */
    _ringPattern() {
      if (!this.isRinging) {
        return;
      }

      // Start oscillators (they'll stop themselves)
      this._startOscillators();

      // Schedule next ring after pattern completes + pause
      // Pattern is ~0.3 seconds, pause is 0.7 seconds = 1 second total cycle
      this.ringInterval = setTimeout(() => {
        if (this.isRinging) {
          // Clean up any remaining oscillators
          this._stopOscillators();
          // Start next ring
          this._ringPattern();
        }
      }, 1000); // 1 second cycle: 0.3s ring + 0.7s pause
    }

    /**
     * Check if currently ringing
     * @returns {boolean} True if ringing
     */
    isRinging() {
      return this.isRinging;
    }

    /**
     * Getter for ringing state (alternative accessor)
     * @returns {boolean} True if ringing
     */
    get ringing() {
      return this.isRinging;
    }

    /**
     * Set ring volume
     * @param {number} volume - Volume (0-1)
     */
    setVolume(volume) {
      this.options.volume = Math.max(0, Math.min(1, volume));
      if (this.gainNode) {
        this.gainNode.gain.value = this.options.volume;
      }
    }
  }

  /**
   * NotificationInterface - Interface for notification components
   * 
   * This interface defines methods for showing notifications (e.g., connection sounds, alerts).
   * Implement this if you want to provide custom notification behavior.
   * 
   * @interface NotificationInterface
   */
  class NotificationInterface {
    /**
     * Play a ping/connection sound
     * @returns {Promise} Promise that resolves when sound plays
     */
    ping() {
      // Optional - no-op by default
      return Promise.resolve();
    }

    /**
     * Play a beep sound
     * @returns {Promise} Promise that resolves when sound plays
     */
    beep() {
      // Optional - no-op by default
      return Promise.resolve();
    }

    /**
     * Show a visual notification (e.g., browser notification)
     * @param {string} title - Notification title
     * @param {Object} options - Notification options {body, icon, etc.}
     * @returns {Promise} Promise that resolves when notification is shown
     */
    showNotification(title, options = {}) {
      // Optional - no-op by default
      return Promise.resolve();
    }
  }

  /**
   * NotificationSound - Simple audio notifications for UI events
   * 
   * Provides short audio notifications for various UI events like:
   * - New chat connections
   * - Messages received
   * - Other notifications
   * 
   * Implements NotificationInterface for use with ChatManager and CallManager.
   * 
   * Usage:
   *   import { NotificationSound } from './notification-sound.js';
   *   import { ChatManager } from '../core/chat-manager.js';
   *   
   *   const notifications = new NotificationSound();
   *   const chatManager = new ChatManager(rtcClient, { notifications });
   *   // Notifications will automatically play for connections
   * 
   * Features:
   * - No external audio files required
   * - Uses Web Audio API
   * - Configurable volume and frequency
   * - Works in all modern browsers
   * 
   * @module notification-sound
   */


  class NotificationSound extends NotificationInterface {
    /**
     * Create a new NotificationSound instance
     * @param {Object} options - Configuration options
     * @param {number} options.volume - Sound volume (0-1, default: 0.2)
     */
    constructor(options = {}) {
      super();
      this.options = {
        volume: options.volume !== undefined ? options.volume : 0.2,
        ...options
      };
      
      this.audioContext = null;
      this._initAudioContext();
    }

    /**
     * Initialize Web Audio API context
     * @private
     */
    _initAudioContext() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioContext = new AudioContext();
        }
      } catch (e) {
        console.warn('Web Audio API not supported:', e);
      }
    }

    /**
     * Resume audio context if suspended (required by some browsers)
     * @private
     */
    async _resumeAudioContext() {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch (e) {
          // Ignore errors
        }
      }
    }

    /**
     * Play a tone
     * @param {number} frequency - Frequency in Hz
     * @param {number} duration - Duration in milliseconds
     * @param {string} type - Oscillator type ('sine', 'square', 'sawtooth', 'triangle')
     * @private
     */
    async _playTone(frequency, duration, type = 'sine') {
      if (!this.audioContext) {
        // Try to initialize if it doesn't exist
        this._initAudioContext();
        if (!this.audioContext) {
          return; // Still no audio context
        }
      }

      try {
        await this._resumeAudioContext();
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.options.volume, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration / 1000);
      } catch (err) {
        // Silently fail - audio might not be available
        console.debug('Could not play notification sound:', err);
      }
    }

    /**
     * Play a ping sound (short, pleasant notification)
     */
    async ping() {
      // Play a quick ascending tone
      await this._playTone(800, 50, 'sine');
      await new Promise(resolve => setTimeout(resolve, 30));
      await this._playTone(1000, 50, 'sine');
    }

    /**
     * Play a beep sound (single tone)
     * @param {number} frequency - Frequency in Hz (default: 800)
     * @param {number} duration - Duration in ms (default: 100)
     */
    async beep(frequency = 800, duration = 100) {
      await this._playTone(frequency, duration, 'sine');
    }

    /**
     * Play a chime sound (pleasant multi-tone)
     */
    async chime() {
      // Play multiple tones in quick succession
      await this._playTone(523, 80, 'sine'); // C
      await new Promise(resolve => setTimeout(resolve, 50));
      await this._playTone(659, 80, 'sine'); // E
      await new Promise(resolve => setTimeout(resolve, 50));
      await this._playTone(784, 100, 'sine'); // G
    }

    /**
     * Set volume
     * @param {number} volume - Volume (0-1)
     */
    setVolume(volume) {
      this.options.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * CallManagement - UI component for displaying call controls and information
   * 
   * This is a pure UI component that displays call state from CallManager.
   * It does not manage any state itself - all state comes from CallManager.
   * 
   * This component provides a dedicated UI section for call management, separate from
   * the chat messages area. It displays:
   * - Active call information (who you're calling with)
   * - Call controls (mute mic, mute speakers, video toggle)
   * - Latency metrics (RTT, packet loss, jitter)
   * 
   * Usage:
   *   import { CallManager } from '../core/call-manager.js';
   *   import { CallManagement } from './call-management.js';
   *   
   *   const callManager = new CallManager(rtcClient);
   *   const callMgmt = new CallManagement(containerElement, callManager);
   *   
   *   // CallManagement automatically subscribes to CallManager events
   *   // and updates the UI accordingly
   */

  class CallManagement {
    /**
     * Create a new CallManagement instance
     * @param {HTMLElement} container - Container element for the call management UI
     * @param {CallManager} callManager - CallManager instance to read state from
     * @param {Object} options - Configuration options
     */
    constructor(container, callManager, options = {}) {
      if (!callManager) {
        throw new Error('CallManager is required');
      }
      
      this.container = container;
      this.callManager = callManager;
      this.options = {
        showMetrics: options.showMetrics !== false, // Default: true
        ...options
      };
      
      this._setupUI();
      this._setupEventListeners();
      this._setupCallManagerListeners();
      
      // Initial render from current state
      this._updateFromCallManager();
    }

    /**
     * Setup the UI structure
     * @private
     */
    _setupUI() {
      // Check if call-buttons-container already exists (from ChatBox template)
      const existingButtonsContainer = this.container.querySelector('#call-buttons-container');
      
      // Only set innerHTML if call-buttons-container doesn't exist
      // This preserves the call buttons that ChatBox adds
      if (!existingButtonsContainer) {
        this.container.innerHTML = `
        <div id="call-buttons-container"></div>
        <div id="call-info-container"></div>
        <div id="call-controls-container">
          <span style="font-weight: bold; margin-right: 8px;">Call Controls:</span>
          <button id="call-mute-mic-btn" class="call-control-button" title="Mute/Unmute microphone">Mute Mic</button>
          <button id="call-mute-speakers-btn" class="call-control-button" title="Mute/Unmute speakers">Mute Speakers</button>
          <button id="call-video-toggle-btn" class="call-control-button" title="Hide/Show video" style="display: none;">Hide Video</button>
          <span id="call-metrics"></span>
        </div>
      `;
      } else {
        // Preserve existing buttons, just add our containers if they don't exist
        if (!this.container.querySelector('#call-info-container')) {
          const infoContainer = document.createElement('div');
          infoContainer.id = 'call-info-container';
          existingButtonsContainer.after(infoContainer);
        }
        if (!this.container.querySelector('#call-controls-container')) {
          const controlsContainer = document.createElement('div');
          controlsContainer.id = 'call-controls-container';
          controlsContainer.innerHTML = `
          <span style="font-weight: bold; margin-right: 8px;">Call Controls:</span>
          <button id="call-mute-mic-btn" class="call-control-button" title="Mute/Unmute microphone">Mute Mic</button>
          <button id="call-mute-speakers-btn" class="call-control-button" title="Mute/Unmute speakers">Mute Speakers</button>
          <button id="call-video-toggle-btn" class="call-control-button" title="Hide/Show video" style="display: none;">Hide Video</button>
          <span id="call-metrics"></span>
        `;
          this.container.appendChild(controlsContainer);
        }
      }
      
      this.callInfoContainer = this.container.querySelector('#call-info-container');
      this.callControlsContainer = this.container.querySelector('#call-controls-container');
      this.muteMicBtn = this.container.querySelector('#call-mute-mic-btn');
      this.muteSpeakersBtn = this.container.querySelector('#call-mute-speakers-btn');
      this.videoToggleBtn = this.container.querySelector('#call-video-toggle-btn');
      this.metricsSpan = this.container.querySelector('#call-metrics');
      
      this.callInfoItems = new Map(); // Map<user, HTMLElement>
      this.incomingCallPrompts = new Map(); // Map<user, {element: HTMLElement, resolve: Function}>
    }

    /**
     * Setup event listeners for control buttons
     * @private
     */
    _setupEventListeners() {
      if (this.muteMicBtn) {
        this.muteMicBtn.addEventListener('click', () => {
          const currentState = this.callManager.getMuteState();
          this.callManager.setMicMuted(!currentState.mic);
        });
      }
      
      if (this.muteSpeakersBtn) {
        this.muteSpeakersBtn.addEventListener('click', () => {
          const currentState = this.callManager.getMuteState();
          this.callManager.setSpeakersMuted(!currentState.speakers);
        });
      }
      
      if (this.videoToggleBtn) {
        this.videoToggleBtn.addEventListener('click', () => {
          const currentState = this.callManager.getMuteState();
          this.callManager.setVideoHidden(!currentState.video);
        });
      }
    }

    /**
     * Setup listeners for CallManager events
     * @private
     */
    _setupCallManagerListeners() {
      // Listen to mute state changes
      this.callManager.on('mutechanged', () => {
        this._updateButtonStates();
      });
      
      // Listen to call state changes
      this.callManager.on('callconnected', () => {
        this._updateFromCallManager();
      });
      
      this.callManager.on('callended', () => {
        this._updateFromCallManager();
      });
      
      // Listen to metrics updates
      this.callManager.on('metricsupdated', () => {
        this._updateMetrics();
      });
    }

    /**
     * Update UI from CallManager state
     * @private
     */
    _updateFromCallManager() {
      const activeCalls = this.callManager.getActiveCalls();
      this._updateVisibility(activeCalls.audio, activeCalls.video);
      this._updateCallInfo(activeCalls.audio, activeCalls.video);
      this._updateButtonStates();
      this._updateMetrics();
    }

    /**
     * @deprecated Use CallManager directly. This method is kept for backward compatibility.
     * Set active calls (reads from CallManager)
     * @param {Set|Array} audioCalls - Set or array of users in audio calls
     * @param {Set|Array} videoCalls - Set or array of users in video calls
     */
    setActiveCalls(audioCalls, videoCalls) {
      // This is now a no-op - state comes from CallManager
      // Kept for backward compatibility
      this._updateFromCallManager();
    }

    /**
     * @deprecated Use CallManager directly. This method is kept for backward compatibility.
     * Set mute state (reads from CallManager)
     * @param {Object} state - Mute state object {mic: boolean, speakers: boolean, video: boolean}
     */
    setMuteState(state) {
      // This is now a no-op - state comes from CallManager
      // Kept for backward compatibility
      this._updateButtonStates();
    }

    /**
     * @deprecated Use CallManager directly. This method is kept for backward compatibility.
     * Set latency metrics for a user (reads from CallManager)
     * @param {string} user - User name
     * @param {Object} metrics - Metrics object {rtt: number, packetLoss: number, jitter: number}
     */
    setMetrics(user, metrics) {
      // This is now a no-op - state comes from CallManager
      // Kept for backward compatibility
      this._updateMetrics();
    }

    /**
     * @deprecated Use CallManager directly. This method is kept for backward compatibility.
     * Clear metrics for a user
     * @param {string} user - User name
     */
    clearMetrics(user) {
      // This is now a no-op - state comes from CallManager
      // Kept for backward compatibility
      this._updateMetrics();
    }

    /**
     * @deprecated Use CallManager directly. This method is kept for backward compatibility.
     * Clear all metrics
     */
    clearAllMetrics() {
      // This is now a no-op - state comes from CallManager
      // Kept for backward compatibility
      this._updateMetrics();
    }

    /**
     * Update visibility of the call management section
     * @private
     */
    _updateVisibility(audioCalls, videoCalls) {
      const hasActiveCalls = audioCalls.size > 0 || videoCalls.size > 0;
      if (hasActiveCalls) {
        this.container.classList.add('active');
      } else {
        this.container.classList.remove('active');
      }
    }

    /**
     * Show an incoming call prompt
     * @param {string} peerName - Name of the caller
     * @param {Object} callInfo - {video: boolean, audio: boolean}
     * @returns {Promise<boolean>} Promise that resolves to true to accept, false to reject
     */
    showIncomingCallPrompt(peerName, callInfo) {
      console.log('CallManagement.showIncomingCallPrompt called', { peerName, callInfo, container: this.container });
      
      // Remove any existing prompt for this user
      this.hideIncomingCallPrompt(peerName);
      
      // Ensure call-management container is visible
      if (this.container) {
        this.container.style.display = 'flex';
        this.container.classList.add('active');
      }
      
      // Get the call-buttons-container
      const buttonsContainer = this.container ? this.container.querySelector('#call-buttons-container') : null;
      console.log('buttonsContainer found:', !!buttonsContainer, { container: this.container, buttonsContainer });
      
      if (!buttonsContainer) {
        console.error('call-buttons-container not found in container:', this.container);
        return Promise.resolve(false);
      }
      
      // Create prompt element
      const promptElement = document.createElement('div');
      promptElement.className = 'incoming-call-prompt';
      promptElement.style.cssText = `
      padding: 12px;
      margin: 8px 0;
      background-color: #4CAF50;
      color: white;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      width: 100%;
      box-sizing: border-box;
    `;
      
      const callType = callInfo.video ? 'video' : 'audio';
      const callTypeIcon = callInfo.video ? '📹' : '🔊';
      promptElement.innerHTML = `
      <div style="font-weight: bold; font-size: 1.1em;">
        ${callTypeIcon} Incoming ${callType} call from ${peerName}
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="accept-call-btn" style="
          padding: 8px 16px;
          background-color: white;
          color: #4CAF50;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">Accept</button>
        <button class="reject-call-btn" style="
          padding: 8px 16px;
          background-color: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">Reject</button>
      </div>
    `;
      
      // Create promise for accept/reject
      let resolvePrompt;
      const promptPromise = new Promise((resolve) => {
        resolvePrompt = resolve;
      });
      
      // Set up button handlers
      const acceptBtn = promptElement.querySelector('.accept-call-btn');
      const rejectBtn = promptElement.querySelector('.reject-call-btn');
      
      acceptBtn.addEventListener('click', () => {
        this.hideIncomingCallPrompt(peerName);
        resolvePrompt(true);
      });
      
      rejectBtn.addEventListener('click', () => {
        this.hideIncomingCallPrompt(peerName);
        resolvePrompt(false);
      });
      
      // Store prompt
      this.incomingCallPrompts.set(peerName, {
        element: promptElement,
        resolve: resolvePrompt
      });
      
      // Clear the buttons container and add the prompt
      console.log('Clearing buttonsContainer and adding prompt', { buttonsContainer, promptElement });
      buttonsContainer.innerHTML = '';
      buttonsContainer.appendChild(promptElement);
      console.log('Prompt added to buttonsContainer', { buttonsContainerHTML: buttonsContainer.innerHTML.substring(0, 100) });
      
      return promptPromise;
    }
    
    /**
     * Hide/remove an incoming call prompt
     * @param {string} peerName - Name of the caller
     */
    hideIncomingCallPrompt(peerName) {
      const prompt = this.incomingCallPrompts.get(peerName);
      if (prompt) {
        const buttonsContainer = this.container.querySelector('#call-buttons-container');
        if (prompt.element && prompt.element.parentNode) {
          prompt.element.parentNode.removeChild(prompt.element);
        }
        this.incomingCallPrompts.delete(peerName);
        
        // If no more prompts, restore buttons (ChatBox will handle showing the right ones)
        if (this.incomingCallPrompts.size === 0 && buttonsContainer) {
          // ChatBox will restore the buttons via _updateCallButtonVisibility
          // We just need to clear the container so it can be repopulated
          buttonsContainer.innerHTML = '';
        }
      }
    }

    /**
     * Show a missed call notification
     * @param {string} peerName - Name of the peer
     * @param {string} direction - 'incoming' or 'outgoing'
     */
    showMissedCallNotification(peerName, direction) {
      const buttonsContainer = this.container.querySelector('#call-buttons-container');
      if (!buttonsContainer) {
        return;
      }
      
      const message = direction === 'incoming'
        ? `Missed call from ${peerName}`
        : `${peerName} missed your call`;
      
      const notificationEl = document.createElement('div');
      notificationEl.className = 'missed-call-notification';
      notificationEl.style.cssText = `
      padding: 8px 12px;
      margin: 4px 0;
      background-color: #ff9800;
      color: white;
      border-radius: 4px;
      font-size: 0.9em;
      text-align: center;
    `;
      notificationEl.textContent = message;
      
      // Add to call-info-container (not buttons container, as that's for controls)
      if (this.callInfoContainer) {
        this.callInfoContainer.appendChild(notificationEl);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          if (notificationEl.parentNode) {
            notificationEl.parentNode.removeChild(notificationEl);
          }
        }, 5000);
      }
    }

    /**
     * Show a call declined notification
     * @param {string} peerName - Name of the peer who declined
     */
    showCallDeclinedNotification(peerName) {
      const buttonsContainer = this.container.querySelector('#call-buttons-container');
      if (!buttonsContainer) {
        return;
      }
      
      const notificationEl = document.createElement('div');
      notificationEl.className = 'call-declined-notification';
      notificationEl.style.cssText = `
      padding: 8px 12px;
      margin: 4px 0;
      background-color: #f44336;
      color: white;
      border-radius: 4px;
      font-size: 0.9em;
      text-align: center;
    `;
      notificationEl.textContent = `${peerName} declined your call`;
      
      // Add to call-info-container (not buttons container, as that's for controls)
      if (this.callInfoContainer) {
        this.callInfoContainer.appendChild(notificationEl);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          if (notificationEl.parentNode) {
            notificationEl.parentNode.removeChild(notificationEl);
          }
        }, 5000);
      }
    }

    /**
     * Update call info display (list of active calls)
     * @private
     */
    _updateCallInfo(audioCalls, videoCalls) {
      if (!this.callInfoContainer) {
        return;
      }
      
      // Remove existing call info items (but keep incoming call prompts)
      for (const [user, item] of this.callInfoItems.entries()) {
        if (item && item.parentNode) {
          item.parentNode.removeChild(item);
        }
      }
      this.callInfoItems.clear();
      
      // Add audio call info (only if not also a video call)
      for (const user of audioCalls) {
        if (!videoCalls.has(user)) {
          const infoItem = document.createElement('div');
          infoItem.className = 'call-info-item';
          infoItem.textContent = `🔊 Audio call with ${user}`;
          // Insert after incoming call prompts
          const prompts = Array.from(this.incomingCallPrompts.values());
          if (prompts.length > 0 && prompts[0].element && prompts[0].element.nextSibling) {
            this.callInfoContainer.insertBefore(infoItem, prompts[0].element.nextSibling);
          } else {
            this.callInfoContainer.appendChild(infoItem);
          }
          this.callInfoItems.set(user, infoItem);
        }
      }
      
      // Add video call info
      for (const user of videoCalls) {
        const infoItem = document.createElement('div');
        infoItem.className = 'call-info-item';
        infoItem.textContent = `📹 Video call with ${user}`;
        // Insert after incoming call prompts
        const prompts = Array.from(this.incomingCallPrompts.values());
        if (prompts.length > 0 && prompts[0].element && prompts[0].element.nextSibling) {
          this.callInfoContainer.insertBefore(infoItem, prompts[0].element.nextSibling);
        } else {
          this.callInfoContainer.appendChild(infoItem);
        }
        this.callInfoItems.set(user, infoItem);
      }
    }

    /**
     * Update button states based on mute state from CallManager
     * @private
     */
    _updateButtonStates() {
      const muteState = this.callManager.getMuteState();
      const activeCalls = this.callManager.getActiveCalls();
      const hasVideoCalls = activeCalls.video.size > 0;
      
      if (this.muteMicBtn) {
        this.muteMicBtn.textContent = muteState.mic ? 'Unmute Mic' : 'Mute Mic';
        this.muteMicBtn.title = muteState.mic ? 'Unmute microphone' : 'Mute microphone';
        this.muteMicBtn.classList.toggle('active', muteState.mic);
      }
      
      if (this.muteSpeakersBtn) {
        this.muteSpeakersBtn.textContent = muteState.speakers ? 'Unmute Speakers' : 'Mute Speakers';
        this.muteSpeakersBtn.title = muteState.speakers ? 'Unmute speakers' : 'Mute speakers';
        this.muteSpeakersBtn.classList.toggle('active', muteState.speakers);
      }
      
      if (this.videoToggleBtn) {
        this.videoToggleBtn.style.display = hasVideoCalls ? 'inline-block' : 'none';
        this.videoToggleBtn.textContent = muteState.video ? 'Show Video' : 'Hide Video';
        this.videoToggleBtn.title = muteState.video ? 'Show video' : 'Hide video';
        this.videoToggleBtn.classList.toggle('active', muteState.video);
      }
    }

    /**
     * Update metrics display from CallManager
     * @private
     */
    _updateMetrics() {
      if (!this.metricsSpan || !this.options.showMetrics) {
        return;
      }
      
      const activeCalls = this.callManager.getActiveCalls();
      const activeCallUsers = new Set([...activeCalls.audio, ...activeCalls.video]);
      const allMetrics = this.callManager.getAllMetrics();
      
      if (activeCallUsers.size === 0) {
        this.metricsSpan.textContent = '';
        return;
      }
      
      // Collect metrics for all active calls
      const metrics = [];
      for (const user of activeCallUsers) {
        const userMetrics = allMetrics.get(user);
        if (userMetrics) {
          const parts = [];
          if (userMetrics.rtt !== null && userMetrics.rtt !== undefined) {
            parts.push(`${Math.round(userMetrics.rtt)}ms`);
          }
          if (userMetrics.packetLoss !== null && userMetrics.packetLoss !== undefined && userMetrics.packetLoss > 0) {
            parts.push(`Loss: ${userMetrics.packetLoss.toFixed(1)}%`);
          }
          if (userMetrics.jitter !== null && userMetrics.jitter !== undefined) {
            parts.push(`Jitter: ${Math.round(userMetrics.jitter)}ms`);
          }
          
          if (parts.length > 0) {
            const displayName = activeCallUsers.size > 1 ? user : '';
            metrics.push(`${displayName}${displayName ? ': ' : ''}${parts.join(', ')}`);
          }
        }
      }
      
      if (metrics.length > 0) {
        this.metricsSpan.textContent = `📊 ${metrics.join(' | ')}`;
      } else {
        this.metricsSpan.textContent = '📊 Connecting...';
      }
    }
  }

  /**
   * EventEmitter - Simple event system for RTChat
   * 
   * Provides on, off, emit methods for event-driven architecture
   */

  class EventEmitter {
    constructor() {
      this.events = {};
    }
    
    on(event, handler) {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(handler);
      
      // Return unsubscribe function
      return () => this.off(event, handler);
    }
    
    off(event, handler) {
      if (!this.events[event]) {
        return;
      }
      this.events[event] = this.events[event].filter(h => h !== handler);
    }
    
    emit(event, ...args) {
      if (!this.events[event]) {
        return;
      }
      // Create a copy to avoid issues if handlers modify the array
      const handlers = [...this.events[event]];
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (e) {
          console.error(`Error in event handler for ${event}:`, e);
        }
      });
    }
    
    once(event, handler) {
      const wrappedHandler = (...args) => {
        handler(...args);
        this.off(event, wrappedHandler);
      };
      return this.on(event, wrappedHandler);
    }
    
    removeAllListeners(event) {
      if (event) {
        delete this.events[event];
      } else {
        this.events = {};
      }
    }
    
    listenerCount(event) {
      return this.events[event] ? this.events[event].length : 0;
    }
  }

  /**
   * CallState - Platform-agnostic, UI-agnostic call state management
   * 
   * This module provides a structured way to track call state per user.
   * State can be: inactive, active, or pending
   * Each state can have audio and/or video capabilities.
   * 
   * Usage:
   *   import { CallState } from './call-state.js';
   *   
   *   const callState = new CallState();
   *   callState.setUserState('user1', {status: 'active', audio: true, video: true});
   *   const state = callState.getUserState('user1');
   *   // {status: 'active', audio: true, video: true}
   * 
   * @module call-state
   */

  class CallState {
    /**
     * Create a new CallState instance
     */
    constructor() {
      // Map<user, {status: 'inactive'|'active'|'pending', audio: boolean, video: boolean}>
      this._userStates = new Map();
    }

    /**
     * Set call state for a user
     * @param {string} user - User name
     * @param {Object} state - State object {status: string, audio: boolean, video: boolean}
     */
    setUserState(user, state) {
      if (!user) {
        throw new Error('User name is required');
      }
      
      const normalizedState = {
        status: state.status || 'inactive',
        audio: state.audio === true,
        video: state.video === true
      };
      
      // Validate status
      if (!['inactive', 'active', 'pending'].includes(normalizedState.status)) {
        throw new Error(`Invalid status: ${normalizedState.status}. Must be 'inactive', 'active', or 'pending'`);
      }
      
      this._userStates.set(user, normalizedState);
    }

    /**
     * Get call state for a user
     * @param {string} user - User name
     * @returns {Object|null} State object {status: string, audio: boolean, video: boolean} or null if not found
     */
    getUserState(user) {
      if (!user) {
        return null;
      }
      const state = this._userStates.get(user);
      return state ? { ...state } : null;
    }

    /**
     * Get all users with a specific status
     * @param {string} status - Status to filter by ('inactive', 'active', or 'pending')
     * @returns {Array<string>} Array of user names
     */
    getUsersByStatus(status) {
      if (!['inactive', 'active', 'pending'].includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be 'inactive', 'active', or 'pending'`);
      }
      
      const users = [];
      for (const [user, state] of this._userStates.entries()) {
        if (state.status === status) {
          users.push(user);
        }
      }
      return users;
    }

    /**
     * Get all active calls (grouped by audio/video)
     * @returns {Object} {audio: Set<string>, video: Set<string>}
     */
    getActiveCalls() {
      const audio = new Set();
      const video = new Set();
      
      for (const [user, state] of this._userStates.entries()) {
        if (state.status === 'active') {
          if (state.audio) {
            audio.add(user);
          }
          if (state.video) {
            video.add(user);
          }
        }
      }
      
      return { audio, video };
    }

    /**
     * Get all pending calls
     * @returns {Set<string>} Set of user names with pending calls
     */
    getPendingCalls() {
      return new Set(this.getUsersByStatus('pending'));
    }

    /**
     * Get all users with active or pending calls
     * @returns {Set<string>} Set of user names
     */
    getActiveOrPendingCalls() {
      const users = new Set();
      for (const [user, state] of this._userStates.entries()) {
        if (state.status === 'active' || state.status === 'pending') {
          users.add(user);
        }
      }
      return users;
    }

    /**
     * Check if a user has an active call
     * @param {string} user - User name
     * @returns {boolean} True if user has an active call
     */
    hasActiveCall(user) {
      const state = this.getUserState(user);
      return state && state.status === 'active';
    }

    /**
     * Check if a user has a pending call
     * @param {string} user - User name
     * @returns {boolean} True if user has a pending call
     */
    hasPendingCall(user) {
      const state = this.getUserState(user);
      return state && state.status === 'pending';
    }

    /**
     * Remove state for a user
     * @param {string} user - User name
     */
    removeUser(user) {
      this._userStates.delete(user);
    }

    /**
     * Clear all states
     */
    clear() {
      this._userStates.clear();
    }

    /**
     * Get all states (for debugging/inspection)
     * @returns {Map} Map of user -> state
     */
    getAllStates() {
      return new Map(this._userStates);
    }
  }

  /**
   * CallManager - Platform-agnostic call state and business logic management
   * 
   * This class manages all call-related business logic without any UI dependencies.
   * It tracks call state, manages mute states, handles timeouts, and collects statistics.
   * 
   * Usage:
   *   import { CallManager } from './call-manager.js';
   *   import { EventEmitter } from './event-emitter.js';
   *   
   *   const callManager = new CallManager(rtcClient);
   *   callManager.on('callstarted', (user, type) => { ... });
   *   callManager.on('callended', (user) => { ... });
   *   callManager.on('mutechanged', ({mic, speakers, video}) => { ... });
   *   
   *   // Start a call
   *   await callManager.startCall(user, 'audio');
   *   
   *   // Mute/unmute
   *   callManager.setMicMuted(true);
   *   callManager.setSpeakersMuted(true);
   *   callManager.setVideoHidden(true);
   * 
   * Features:
   * - Call state tracking (active calls, pending calls, outgoing calls)
   * - Mute state management (mic, speakers, video)
   * - Call timeout handling
   * - Connection statistics collection
   * - Event-driven architecture
   * 
   * @module call-manager
   */


  class CallManager extends EventEmitter {
    /**
     * Create a new CallManager instance
     * @param {Object} rtcClient - RTC client instance (MQTTRTCClient or similar)
     * @param {Object} options - Configuration options
     * @param {number} options.callTimeout - Call timeout in milliseconds (default: 15000)
     * @param {number} options.statsPollInterval - Stats polling interval in milliseconds (default: 2000)
     * @param {CallUIInterface} options.callUI - Optional call UI component implementing CallUIInterface
     * @param {StreamDisplayInterface} options.videoDisplay - Optional video display component
     * @param {StreamDisplayInterface} options.audioDisplay - Optional audio display component
     * @param {AudioControllerInterface} options.audioController - Optional audio controller
     * @param {VideoControllerInterface} options.videoController - Optional video controller
     * @param {RingerInterface} options.ringer - Optional ringtone component
     * @param {NotificationInterface} options.notifications - Optional notification component
     */
    constructor(rtcClient, options = {}) {
      super();
      
      this.rtcClient = rtcClient;
      this.options = {
        callTimeout: options.callTimeout || 15000,
        statsPollInterval: options.statsPollInterval || 2000,
        ...options
      };
      
      // Optional UI components
      this.callUI = options.callUI || null;
      this.videoDisplay = options.videoDisplay || null;
      this.audioDisplay = options.audioDisplay || null;
      this.audioController = options.audioController || null;
      this.videoController = options.videoController || null;
      this.ringer = options.ringer || null;
      this.notifications = options.notifications || null;
      
      // Unified call state tracking (platform-agnostic, UI-agnostic)
      this.callState = new CallState();
      
      // Additional metadata tracking (not part of core state)
      this.pendingCalls = new Map(); // Map<user, {callInfo, promises, timeoutId, promptElement}>
      this.outgoingCalls = new Map(); // Map<user, {type, cancelFn, timeoutId}>
      this.localStreams = new Map(); // Map<user, MediaStream>
      
      // Mute state
      this.muteState = {
        mic: false,
        speakers: false,
        video: false
      };
      
      // Statistics
      this.statsInterval = null;
      this.latencyMetrics = new Map(); // Map<user, {rtt, packetLoss, jitter}>
      
      // Bind methods
      this._handleIncomingCall = this._handleIncomingCall.bind(this);
      this._handleCallConnected = this._handleCallConnected.bind(this);
      this._handleCallEnded = this._handleCallEnded.bind(this);
      
      // Setup RTC client event listeners if available
      if (rtcClient) {
        this._setupRTCEventListeners();
      }
    }

    /**
     * Setup event listeners on RTC client
     * @private
     */
    _setupRTCEventListeners() {
      if (this.rtcClient.on) {
        this.rtcClient.on('call', this._handleIncomingCall);
        this.rtcClient.on('callconnected', this._handleCallConnected);
        this.rtcClient.on('callended', this._handleCallEnded);
        this.rtcClient.on('disconnectedfrompeer', (user) => {
          this._handleDisconnectedFromUser(user);
        });
      }
    }

    /**
     * Handle incoming call from RTC client
     * @param {string} peerName - Name of the peer calling
     * @param {Object} callInfo - Call information {video: boolean, audio: boolean}
     * @param {Object} promises - Call promises {start: Promise, end: Promise}
     * @returns {Promise} Promise that resolves to acceptance result
     * @private
     */
    _handleIncomingCall(peerName, callInfo, promises) {
      console.log('CallManager._handleIncomingCall called', { peerName, callInfo, hasRinger: !!this.ringer });
      
      // Set up timeout for unanswered call
      const timeoutId = setTimeout(() => {
        this._handleCallTimeout(peerName, 'incoming');
      }, this.options.callTimeout);
      
      // Track pending call
      this.pendingCalls.set(peerName, {
        callInfo,
        promises,
        timeoutId,
        promptElement: null // UI can set this
      });
      
      // Update unified call state
      this.callState.setUserState(peerName, {
        status: 'pending',
        audio: callInfo.audio !== false, // Default to true if not specified
        video: callInfo.video === true
      });
      
      // Start ringing if ringer is provided
      if (this.ringer && typeof this.ringer.start === 'function') {
        console.log('Starting ringtone...');
        this.ringer.start().catch(err => {
          console.error('Could not start ringtone:', err);
        });
      } else {
        console.warn('No ringer available or ringer.start is not a function', { 
          hasRinger: !!this.ringer, 
          ringerType: this.ringer ? typeof this.ringer : 'undefined',
          hasStart: this.ringer ? typeof this.ringer.start : 'N/A'
        });
      }
      
      // Emit event for UI to handle
      this.emit('incomingcall', {
        peerName,
        callInfo,
        promises,
        timeoutId
      });
      
      // Use callUI if provided, otherwise auto-accept
      if (this.callUI && typeof this.callUI.showIncomingCallPrompt === 'function') {
        return this.callUI.showIncomingCallPrompt(peerName, callInfo);
      }
      
      // Default: auto-accept
      return Promise.resolve(true);
    }

    /**
     * Handle call connected event
     * @param {string} sender - Name of the peer
     * @param {Object} streams - Stream objects {localStream, remoteStream}
     * @private
     */
    _handleCallConnected(sender, {localStream, remoteStream}) {
      // Clear timeout
      const pendingCall = this.pendingCalls.get(sender);
      if (pendingCall && pendingCall.timeoutId) {
        clearTimeout(pendingCall.timeoutId);
        pendingCall.timeoutId = null;
      }
      this.pendingCalls.delete(sender);
      
      // Stop ringing if ringer is provided
      if (this.ringer && typeof this.ringer.stop === 'function') {
        this.ringer.stop();
      }
      
      // Determine call type
      const hasVideo = localStream?.getVideoTracks().length > 0 || 
                       remoteStream?.getVideoTracks().length > 0;
      const hasAudio = localStream?.getAudioTracks().length > 0 || 
                       remoteStream?.getAudioTracks().length > 0;
      
      // Store local stream
      if (localStream instanceof MediaStream) {
        this.localStreams.set(sender, localStream);
      }
      
      // Update unified call state
      this.callState.setUserState(sender, {
        status: 'active',
        audio: hasAudio,
        video: hasVideo
      });
      
      // Start stats polling if not already started
      const activeCalls = this.callState.getActiveCalls();
      if (!this.statsInterval && (activeCalls.video.size > 0 || activeCalls.audio.size > 0)) {
        this._startStatsPolling();
      }
      
      // Emit event
      this.emit('callconnected', {
        sender,
        localStream,
        remoteStream,
        type: hasVideo ? 'video' : 'audio'
      });
      
      // Use stream displays if provided
      if (hasVideo && this.videoDisplay && typeof this.videoDisplay.setStreams === 'function') {
        this.videoDisplay.setStreams(sender, { localStream, remoteStream });
      } else if (hasAudio && this.audioDisplay && typeof this.audioDisplay.setStreams === 'function') {
        this.audioDisplay.setStreams(sender, { localStream, remoteStream });
      }
    }

    /**
     * Handle call ended event
     * @param {string} peerName - Name of the peer
     * @private
     */
    _handleCallEnded(peerName) {
      // Clear timeouts
      const pendingCall = this.pendingCalls.get(peerName);
      if (pendingCall && pendingCall.timeoutId) {
        clearTimeout(pendingCall.timeoutId);
      }
      this.pendingCalls.delete(peerName);
      
      const outgoingCall = this.outgoingCalls.get(peerName);
      if (outgoingCall && outgoingCall.timeoutId) {
        clearTimeout(outgoingCall.timeoutId);
      }
      this.outgoingCalls.delete(peerName);
      
      // Update unified call state
      this.callState.setUserState(peerName, {
        status: 'inactive',
        audio: false,
        video: false
      });
      
      this.localStreams.delete(peerName);
      this.latencyMetrics.delete(peerName);
      
      // Stop stats polling if no active calls
      const activeCalls = this.callState.getActiveCalls();
      if (activeCalls.video.size === 0 && activeCalls.audio.size === 0) {
        this._stopStatsPolling();
        // Reset mute states
        this.muteState = { mic: false, speakers: false, video: false };
      }
      
      // Emit event
      this.emit('callended', { peerName });
    }

    /**
     * Handle call timeout
     * @param {string} peerName - Name of the peer
     * @param {string} direction - 'incoming' or 'outgoing'
     * @private
     */
    _handleCallTimeout(peerName, direction) {
      // Clear pending/outgoing call
      this.pendingCalls.delete(peerName);
      this.outgoingCalls.delete(peerName);
      
      // End call with RTC client
      if (this.rtcClient && this.rtcClient.endCallWithUser) {
        try {
          this.rtcClient.endCallWithUser(peerName);
        } catch (err) {
          console.warn(`Error ending timed out call:`, err);
        }
      }
      
      // Update unified call state
      this.callState.setUserState(peerName, {
        status: 'inactive',
        audio: false,
        video: false
      });
      
      this.localStreams.delete(peerName);
      this.latencyMetrics.delete(peerName);
      
      // Stop ringing if ringer is provided
      if (this.ringer && typeof this.ringer.stop === 'function') {
        this.ringer.stop();
      }
      
      // Emit event
      this.emit('calltimeout', { peerName, direction });
      
      // Use callUI if provided
      if (this.callUI && typeof this.callUI.showMissedCallNotification === 'function') {
        this.callUI.showMissedCallNotification(peerName, direction);
      }
      
      // Clean up stream displays
      if (this.videoDisplay && typeof this.videoDisplay.removeStreams === 'function') {
        this.videoDisplay.removeStreams(peerName);
      }
      if (this.audioDisplay && typeof this.audioDisplay.removeStreams === 'function') {
        this.audioDisplay.removeStreams(peerName);
      }
    }

    /**
     * Handle user disconnection
     * @param {string} user - Name of the user
     * @private
     */
    _handleDisconnectedFromUser(user) {
      const userState = this.callState.getUserState(user);
      const hasActiveOrPendingCall = userState && (userState.status === 'active' || userState.status === 'pending');
      const hasOutgoingCall = this.outgoingCalls.has(user);
      
      if (hasActiveOrPendingCall || hasOutgoingCall) {
        // End call with disconnected user
        if (this.rtcClient && this.rtcClient.endCallWithUser) {
          try {
            this.rtcClient.endCallWithUser(user);
          } catch (err) {
            console.warn(`Error ending call with disconnected user:`, err);
          }
        }
        
        this._handleCallEnded(user);
      }
    }

    /**
     * Start a call with a user
     * @param {string} user - Name of the user to call
     * @param {string} type - 'audio' or 'video'
     * @returns {Promise} Promise that resolves when call starts
     */
    async startCall(user, type) {
      if (!this.rtcClient || !this.rtcClient.callUser) {
        throw new Error('RTC client not available or does not support callUser');
      }
      
      const callInfo = type === 'audio' 
        ? { video: false, audio: true }
        : { video: true, audio: true };
      
      // Create cancel function
      let timeoutId = null;
      const cancelCall = (reason = 'cancelled') => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.outgoingCalls.delete(user);
        if (this.rtcClient && this.rtcClient.endCallWithUser) {
          try {
            this.rtcClient.endCallWithUser(user);
          } catch (err) {
            console.error(`Error canceling call:`, err);
          }
        }
        this.emit('callcancelled', { user, reason });
      };
      
      // Set up timeout
      timeoutId = setTimeout(() => {
        this._handleCallTimeout(user, 'outgoing');
      }, this.options.callTimeout);
      
      // Track outgoing call
      this.outgoingCalls.set(user, {
        type,
        cancelFn: cancelCall,
        timeoutId
      });
      
      try {
        // Start the call - callUser returns {start, end} promises
        const { start, end } = this.rtcClient.callUser(user, callInfo);
        
        // Await the start promise to get the streams
        const streamResult = await start;
        
        // Clear timeout if call started successfully
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        // If streamResult contains streams, handle them
        if (streamResult && (streamResult.localStream || streamResult.remoteStream)) {
          this._handleCallConnected(user, streamResult);
        }
        
        // Emit event
        this.emit('callstarted', { user, type });
        
        // Return the stream result and end promise
        return { ...streamResult, end };
      } catch (err) {
        // Clear timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        this.outgoingCalls.delete(user);
        
        // Check if call was rejected
        if (err === "Call rejected" || err?.message === "Call rejected") {
          this.emit('callrejected', { user });
        } else {
          this.emit('callerror', { user, error: err });
        }
        
        throw err;
      }
    }

    /**
     * End a call with a user
     * @param {string} user - Name of the user
     */
    endCall(user) {
      if (this.rtcClient && this.rtcClient.endCallWithUser) {
        try {
          this.rtcClient.endCallWithUser(user);
        } catch (err) {
          console.error(`Error ending call:`, err);
        }
      }
      
      // Cleanup will happen via callended event
    }

    /**
     * End all active calls
     */
    endAllCalls() {
      const activeCalls = this.callState.getActiveCalls();
      const pendingCalls = this.callState.getPendingCalls();
      const allUsers = new Set([...activeCalls.video, ...activeCalls.audio, ...pendingCalls, ...this.outgoingCalls.keys()]);
      for (const user of allUsers) {
        this.endCall(user);
      }
    }

    /**
     * Set microphone mute state
     * @param {boolean} muted - Whether microphone is muted
     */
    setMicMuted(muted) {
      this.muteState.mic = muted;
      
      // Update all local streams
      for (const [user, stream] of this.localStreams.entries()) {
        if (stream && stream instanceof MediaStream) {
          const audioTracks = stream.getAudioTracks();
          audioTracks.forEach(track => {
            track.enabled = !muted;
          });
        }
      }
      
      this.emit('mutechanged', { ...this.muteState });
    }

    /**
     * Set speakers mute state
     * @param {boolean} muted - Whether speakers are muted
     */
    setSpeakersMuted(muted) {
      this.muteState.speakers = muted;
      
      // Note: Speakers muting requires UI to handle remote audio/video elements
      // This just tracks the state and emits event
      this.emit('mutechanged', { ...this.muteState });
      this.emit('speakersmutechanged', { muted });
    }

    /**
     * Set video hidden state
     * @param {boolean} hidden - Whether video is hidden
     */
    setVideoHidden(hidden) {
      this.muteState.video = hidden;
      
      // Update all local streams
      for (const [user, stream] of this.localStreams.entries()) {
        if (stream && stream instanceof MediaStream) {
          const videoTracks = stream.getVideoTracks();
          videoTracks.forEach(track => {
            track.enabled = !hidden;
          });
        }
      }
      
      // Use videoController if provided
      if (this.videoController && typeof this.videoController.setVideoHidden === 'function') {
        this.videoController.setVideoHidden(hidden, this.localStreams);
      }
      
      this.emit('mutechanged', { ...this.muteState });
    }

    /**
     * Get current mute state
     * @returns {Object} Mute state {mic: boolean, speakers: boolean, video: boolean}
     */
    getMuteState() {
      return { ...this.muteState };
    }

    /**
     * Get active calls
     * @returns {Object} {audio: Set, video: Set}
     */
    getActiveCalls() {
      // Use unified call state as source of truth
      return this.callState.getActiveCalls();
    }

    /**
     * Get pending incoming calls
     * @returns {Set} Set of user names with pending incoming calls
     */
    getPendingCalls() {
      // Use unified call state as source of truth
      return this.callState.getPendingCalls();
    }

    /**
     * Get call state for a user
     * @param {string} user - User name
     * @returns {Object|null} State object {status: string, audio: boolean, video: boolean} or null
     */
    getUserCallState(user) {
      return this.callState.getUserState(user);
    }

    /**
     * Get all call states
     * @returns {Map} Map of user -> state
     */
    getAllCallStates() {
      return this.callState.getAllStates();
    }

    /**
     * Get latency metrics for a user
     * @param {string} user - User name
     * @returns {Object|null} Metrics {rtt, packetLoss, jitter} or null
     */
    getMetrics(user) {
      return this.latencyMetrics.get(user) || null;
    }

    /**
     * Get all latency metrics
     * @returns {Map} Map of user -> metrics
     */
    getAllMetrics() {
      return new Map(this.latencyMetrics);
    }

    /**
     * Start polling connection statistics
     * @private
     */
    _startStatsPolling() {
      if (this.statsInterval) {
        return;
      }
      
      this.statsInterval = setInterval(() => {
        this._collectConnectionStats();
      }, this.options.statsPollInterval);
      
      // Collect initial stats
      this._collectConnectionStats();
    }

    /**
     * Stop polling connection statistics
     * @private
     */
    _stopStatsPolling() {
      if (this.statsInterval) {
        clearInterval(this.statsInterval);
        this.statsInterval = null;
      }
    }

    /**
     * Collect connection statistics from active calls
     * @private
     */
    async _collectConnectionStats() {
      if (!this.rtcClient || !this.rtcClient.rtcConnections) {
        return;
      }
      
      const activeCalls = this.callState.getActiveCalls();
      const activeCallUsers = new Set([...activeCalls.video, ...activeCalls.audio]);
      
      for (const user of activeCallUsers) {
        const connection = this.rtcClient.rtcConnections[user];
        if (!connection) {
          continue;
        }
        
        try {
          const streamConnection = connection.streamConnection;
          if (streamConnection && streamConnection.connectionState === 'connected') {
            const stats = await streamConnection.getStats();
            
            let rtt = null;
            let packetLoss = null;
            let jitter = null;
            
            // Parse stats
            for (const [id, report] of stats.entries()) {
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                if (report.currentRoundTripTime !== undefined) {
                  rtt = report.currentRoundTripTime * 1000; // Convert to ms
                }
              }
              
              if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
                if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                  const totalPackets = report.packetsLost + report.packetsReceived;
                  if (totalPackets > 0) {
                    packetLoss = (report.packetsLost / totalPackets) * 100;
                  }
                }
                if (report.jitter !== undefined) {
                  jitter = report.jitter * 1000; // Convert to ms
                }
              }
              
              if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
                if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                  const totalPackets = report.packetsLost + report.packetsReceived;
                  if (totalPackets > 0) {
                    const videoPacketLoss = (report.packetsLost / totalPackets) * 100;
                    if (packetLoss === null) {
                      packetLoss = videoPacketLoss;
                    }
                  }
                }
              }
            }
            
            // Store metrics
            this.latencyMetrics.set(user, { rtt, packetLoss, jitter });
            
            // Emit event
            this.emit('metricsupdated', { user, metrics: { rtt, packetLoss, jitter } });
          }
        } catch (err) {
          console.warn(`Error collecting stats for ${user}:`, err);
        }
      }
    }

    /**
     * Cleanup and destroy the manager
     */
    destroy() {
      // Stop stats polling
      this._stopStatsPolling();
      
      // End all calls
      this.endAllCalls();
      
      // Clear all state
      this.pendingCalls.clear();
      this.outgoingCalls.clear();
      this.localStreams.clear();
      this.latencyMetrics.clear();
      
      // Clear unified call state
      this.callState.clear();
      
      // Remove event listeners
      if (this.rtcClient && this.rtcClient.off) {
        this.rtcClient.off('call', this._handleIncomingCall);
        this.rtcClient.off('callconnected', this._handleCallConnected);
        this.rtcClient.off('callended', this._handleCallEnded);
      }
      
      // Remove all event listeners
      this.removeAllListeners();
    }
  }

  /**
   * ChatManager - Platform-agnostic chat message and state management
   * 
   * This class manages chat-related business logic without any UI dependencies.
   * It tracks messages, active users, and provides a clean API for chat operations.
   * 
   * Usage:
   *   import { ChatManager } from './chat-manager.js';
   *   import { EventEmitter } from './event-emitter.js';
   *   
   *   const chatManager = new ChatManager(rtcClient);
   *   chatManager.on('message', ({data, sender, timestamp}) => { ... });
   *   chatManager.on('userconnected', (user) => { ... });
   *   chatManager.on('userdisconnected', (user) => { ... });
   *   
   *   // Send a message
   *   chatManager.sendMessage('Hello!');
   * 
   * Features:
   * - Message history tracking
   * - Active user management
   * - User color assignment
   * - Event-driven architecture
   * 
   * @module chat-manager
   */


  class ChatManager extends EventEmitter {
    /**
     * Create a new ChatManager instance
     * @param {Object} rtcClient - RTC client instance (MQTTRTCClient or similar)
     * @param {Object} options - Configuration options
     * @param {string} options.primaryUserColor - Color for primary user messages (default: 'lightblue')
     * @param {Array<string>} options.userColors - Array of colors for other users
     * @param {ChatUIInterface} options.chatUI - Optional chat UI component implementing ChatUIInterface
     * @param {NotificationInterface} options.notifications - Optional notification component
     */
    constructor(rtcClient, options = {}) {
      super();
      
      this.rtcClient = rtcClient;
      this.options = {
        primaryUserColor: options.primaryUserColor || 'lightblue',
        userColors: options.userColors || [
          'lightcoral',
          'lightseagreen',
          'lightsalmon',
          'lightgreen',
        ],
        ...options
      };
      
      // Optional UI components
      this.chatUI = options.chatUI || null;
      this.notifications = options.notifications || null;
      
      // State tracking
      this.history = [];
      this.activeUsers = [];
      this.userColors = [...this.options.userColors];
      this.name = options.name || '?';
      
      // Bind methods
      this._handleChatMessage = this._handleChatMessage.bind(this);
      this._handleUserConnected = this._handleUserConnected.bind(this);
      this._handleUserDisconnected = this._handleUserDisconnected.bind(this);
      
      // Setup RTC client event listeners if available
      if (rtcClient) {
        this._setupRTCEventListeners();
      }
    }

    /**
     * Setup event listeners on RTC client
     * @private
     */
    _setupRTCEventListeners() {
      if (this.rtcClient.on) {
        this.rtcClient.on('chat', this._handleChatMessage);
        
        // Check if this is a SignedMQTTRTCClient (has validation events)
        // For SignedMQTTRTCClient, we should wait for validation before adding users
        // For regular MQTTRTCClient, we can add users immediately on connectedtopeer
        // Detection: check if validatedPeers property exists (more reliable than constructor.name)
        const isSignedClient = this.rtcClient && 
                              (this.rtcClient.validatedPeers !== undefined || 
                               (this.rtcClient.on && typeof this.rtcClient.on === 'function'));
        
        // Also check if validation event is available by trying to listen
        // For now, we'll listen to both events and handle appropriately
        
        // Always listen to validation event if available (for SignedMQTTRTCClient)
        // This won't cause issues for regular clients that don't emit it
        this.rtcClient.on('validation', (peerName, trusted) => {
          console.log('ChatManager: Received validation event for', peerName, 'trusted:', trusted);
          // Add user after validation if not already added
          if (!this.activeUsers.includes(peerName)) {
            console.log('ChatManager: Adding validated user', peerName);
            this._handleUserConnected(peerName);
          } else {
            console.log('ChatManager: User', peerName, 'already in activeUsers');
          }
        });
        
        // For connectedtopeer: only add users if NOT using SignedMQTTRTCClient
        // (SignedMQTTRTCClient will add via validation event instead)
        this.rtcClient.on('connectedtopeer', (peerName) => {
          // Only add immediately if this is NOT a signed client
          // For signed clients, wait for validation event
          if (!isSignedClient) {
            console.log('ChatManager: Adding user on connectedtopeer (non-signed client)', peerName);
            this._handleUserConnected(peerName);
          } else {
            console.log('ChatManager: Received connectedtopeer for', peerName, '(waiting for validation)');
          }
        });
        
        this.rtcClient.on('disconnectedfrompeer', this._handleUserDisconnected);
      }
    }

    /**
     * Handle chat message from RTC client
     * @param {string} message - Message content
     * @param {string} sender - Sender name
     * @private
     */
    _handleChatMessage(message, sender) {
      const timestamp = Date.now();
      const messageData = {
        data: message,
        sender,
        timestamp
      };
      
      // Add to history
      this.history.push(messageData);
      
      // Emit event - UI should listen to this event, not use direct displayMessage call
      this.emit('message', messageData);
      
      // Don't call chatUI.displayMessage directly - let the event listener handle it
      // This prevents duplicate message display
    }

    /**
     * Handle user connected event
     * @param {string} user - User name
     * @private
     */
    _handleUserConnected(user) {
      if (!this.activeUsers.includes(user)) {
        this.activeUsers.push(user);
        
        // Emit event
        this.emit('userconnected', { user });
        
        // Play connection sound if notifications provided
        if (this.notifications && typeof this.notifications.ping === 'function') {
          this.notifications.ping().catch(err => {
            console.debug('Could not play connection ping:', err);
          });
        }
        
        // Use chatUI if provided
        if (this.chatUI && typeof this.chatUI.updateActiveUsers === 'function') {
          this.chatUI.updateActiveUsers([...this.activeUsers]);
        }
      }
    }

    /**
     * Handle user disconnected event
     * @param {string} user - User name
     * @private
     */
    _handleUserDisconnected(user) {
      const index = this.activeUsers.indexOf(user);
      if (index !== -1) {
        // Get user's color before removing
        const oldColor = this.userColors[index % this.userColors.length];
        
        // Remove user
        this.activeUsers.splice(index, 1);
        
        // Recycle color
        this.userColors = this.userColors.filter((color) => color !== oldColor).concat([oldColor]);
        
        // Emit event
        this.emit('userdisconnected', { user });
        
        // Use chatUI if provided
        if (this.chatUI && typeof this.chatUI.updateActiveUsers === 'function') {
          this.chatUI.updateActiveUsers([...this.activeUsers]);
        }
      }
    }

    /**
     * Send a chat message
     * @param {string} message - Message to send (optional if chatUI provides input)
     */
    sendMessage(message) {
      // Get message from chatUI if not provided
      if (!message && this.chatUI && typeof this.chatUI.getMessageInput === 'function') {
        message = this.chatUI.getMessageInput();
      }
      
      if (!message) {
        throw new Error('Message is required');
      }
      
      if (!this.rtcClient) {
        throw new Error('RTC client not available');
      }
      
      if (this.rtcClient.sendRTCChat) {
        this.rtcClient.sendRTCChat(message);
        
        // Clear input if chatUI provides it
        if (this.chatUI && typeof this.chatUI.clearMessageInput === 'function') {
          this.chatUI.clearMessageInput();
        }
      } else {
        throw new Error('RTC client does not support sendRTCChat');
      }
    }

    /**
     * Get user color for a user
     * @param {string} user - User name
     * @returns {string} Color string
     */
    getUserColor(user) {
      if (user === this.name + "( You )") {
        return this.options.primaryUserColor;
      }
      const index = this.activeUsers.indexOf(user);
      if (index !== -1) {
        return this.userColors[index % this.userColors.length];
      }
      return this.options.primaryUserColor;
    }

    /**
     * Get message history
     * @returns {Array} Array of message objects
     */
    getHistory() {
      return [...this.history];
    }

    /**
     * Set message history
     * @param {Array} history - Array of message objects
     */
    setHistory(history) {
      this.history = [...history];
      this.emit('historyupdated', { history: this.history });
    }

    /**
     * Get active users
     * @returns {Array} Array of user names
     */
    getActiveUsers() {
      return [...this.activeUsers];
    }

    /**
     * Set user name
     * @param {string} name - User name
     */
    setName(name) {
      this.name = name;
      this.emit('namechanged', { name });
    }

    /**
     * Get user name
     * @returns {string} User name
     */
    getName() {
      return this.name;
    }

    /**
     * Cleanup and destroy the manager
     */
    destroy() {
      // Clear state
      this.history = [];
      this.activeUsers = [];
      this.userColors = [...this.options.userColors];
      
      // Remove event listeners
      if (this.rtcClient && this.rtcClient.off) {
        this.rtcClient.off('chat', this._handleChatMessage);
        this.rtcClient.off('connectedtopeer', this._handleUserConnected);
        this.rtcClient.off('disconnectedfrompeer', this._handleUserDisconnected);
      }
      
      // Remove all event listeners
      this.removeAllListeners();
    }
  }

  /**
   * UIConfigInterface - Configuration options for UI components
   * 
   * This interface defines standard configuration options that all UI implementations
   * should support. This ensures consistency across different UI implementations.
   * 
   * @interface UIConfigInterface
   */
  class UIConfigInterface {
    /**
     * Get the default configuration
     * @returns {Object} Default configuration object
     */
    static getDefaultConfig() {
      return {
        // Room/Name configuration
        allowRoomChange: true,
        showRoom: true,
        baseTopic: '',
        currentRoom: '',
        
        // Call configuration
        callModes: 'both', // 'audio' | 'video' | 'both'
        callTimeout: 15000, // milliseconds
        
        // Component configuration
        videoDisplayComponent: null, // Optional custom video display component class
        
        // User configuration
        primaryUserColor: 'lightblue',
        userColors: [
          'lightcoral',
          'lightseagreen',
          'lightsalmon',
          'lightgreen',
        ],
        
        // Audio configuration
        ringerVolume: 0.3,
        notificationVolume: 0.2,
      };
    }

    /**
     * Validate configuration
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validated configuration with defaults applied
     */
    static validateConfig(config = {}) {
      const defaults = this.getDefaultConfig();
      const validated = { ...defaults };
      
      // Validate and apply provided config
      if (typeof config.allowRoomChange === 'boolean') {
        validated.allowRoomChange = config.allowRoomChange;
      }
      
      if (typeof config.showRoom === 'boolean') {
        validated.showRoom = config.showRoom;
      }
      
      if (typeof config.baseTopic === 'string') {
        validated.baseTopic = config.baseTopic;
      }
      
      if (typeof config.currentRoom === 'string') {
        validated.currentRoom = config.currentRoom;
      }
      
      if (['audio', 'video', 'both'].includes(config.callModes)) {
        validated.callModes = config.callModes;
      }
      
      if (typeof config.callTimeout === 'number' && config.callTimeout > 0) {
        validated.callTimeout = config.callTimeout;
      }
      
      if (config.videoDisplayComponent !== undefined) {
        validated.videoDisplayComponent = config.videoDisplayComponent;
      }
      
      if (typeof config.primaryUserColor === 'string') {
        validated.primaryUserColor = config.primaryUserColor;
      }
      
      if (Array.isArray(config.userColors)) {
        validated.userColors = config.userColors;
      }
      
      if (typeof config.ringerVolume === 'number' && config.ringerVolume >= 0 && config.ringerVolume <= 1) {
        validated.ringerVolume = config.ringerVolume;
      }
      
      if (typeof config.notificationVolume === 'number' && config.notificationVolume >= 0 && config.notificationVolume <= 1) {
        validated.notificationVolume = config.notificationVolume;
      }
      
      return validated;
    }
  }

  /**
   * StateManager - Simple state management for UI components
   * 
   * Manages mutable state separate from configuration.
   * Configuration is immutable, state can change.
   * 
   * Usage:
   *   import { StateManager } from './state-manager.js';
   *   
   *   const state = new StateManager({
   *     currentRoom: '',
   *     name: '?'
   *   });
   *   
   *   state.set('currentRoom', 'newRoom');
   *   const room = state.get('currentRoom');
   *   state.on('change', (key, value) => { ... });
   * 
   * @class StateManager
   */


  class StateManager extends EventEmitter {
    /**
     * Create a new StateManager instance
     * @param {Object} initialState - Initial state values
     */
    constructor(initialState = {}) {
      super();
      this._state = { ...initialState };
    }

    /**
     * Get a state value
     * @param {string} key - State key
     * @returns {*} State value
     */
    get(key) {
      return this._state[key];
    }

    /**
     * Set a state value
     * @param {string} key - State key
     * @param {*} value - State value
     */
    set(key, value) {
      const oldValue = this._state[key];
      if (oldValue !== value) {
        this._state[key] = value;
        this.emit('change', { key, value, oldValue });
        this.emit(`change:${key}`, { value, oldValue });
      }
    }

    /**
     * Get all state
     * @returns {Object} Copy of all state
     */
    getAll() {
      return { ...this._state };
    }

    /**
     * Set multiple state values at once
     * @param {Object} updates - Object with key-value pairs
     */
    setMultiple(updates) {
      Object.keys(updates).forEach(key => {
        this.set(key, updates[key]);
      });
    }

    /**
     * Reset state to initial values
     * @param {Object} newInitialState - Optional new initial state
     */
    reset(newInitialState = null) {
      if (newInitialState) {
        this._state = { ...newInitialState };
      } else {
        // Reset to constructor initial state (would need to store it)
        this._state = {};
      }
      this.emit('reset', { state: this.getAll() });
    }
  }

  /**
   * ChatHeader - Component for chat header with room and name inputs
   * 
   * @class ChatHeader
   * @extends HTMLElement
   */
  class ChatHeader extends HTMLElement {
    constructor(config = {}) {
      super();
      
      this.config = {
        allowRoomChange: config.allowRoomChange !== false,
        showRoom: config.showRoom !== false,
        baseTopic: config.baseTopic || '',
        currentRoom: config.currentRoom || '',
        primaryUserColor: config.primaryUserColor || 'lightblue',
        ...config
      };
      
      this.attachShadow({ mode: 'open' });
      
      this.shadowRoot.innerHTML = `
      <style>
        :host {
          --primary-user-color: ${this.config.primaryUserColor};
        }
        .chat-header {
          cursor: pointer;
          background-color: var(--primary-user-color);
          padding: 10px;
          font-weight: bold;
          border-top-left-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .room-display {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .room-display > span:first-child {
          margin-right: 5px;
        }
        .room-display.hidden {
          display: none;
        }
        .chat-room-box {
          display: none;
        }
        .chat-room-box.hidden {
          display: none;
        }
        .rounded {
          border-radius: 5px;
        }
        input.rounded {
          border: 1px solid #333;
          padding: 2px 5px;
        }
        #room-name {
          font-weight: normal;
          padding: 2px 5px;
          border-radius: 3px;
          width: 160px;
          border: 1px solid #333;
          background-color: white;
        }
        #chat-room {
          width: 200px;
        }
        #chat-name {
          width: 200px;
        }
      </style>
      <div class="chat-header">
        <div class="room-display">
          <span>Room:</span>
          <span id="room-prefix"></span>
          <input id="room-name" type="text" class="rounded">
        </div>
        <div id="chat-room-box" class="chat-room-box hidden">
          room: <input id="chat-room" class="rounded">
        </div>
        <div>
          Your name: <input id="chat-name" class="rounded">
        </div>
      </div>
    `;
      
      this._cacheElements();
      this._setupEventListeners();
      this._initialize();
    }
    
    _cacheElements() {
      this.roomDisplay = this.shadowRoot.querySelector('.room-display');
      this.roomPrefix = this.shadowRoot.getElementById('room-prefix');
      this.roomName = this.shadowRoot.getElementById('room-name');
      this.chatRoomBox = this.shadowRoot.getElementById('chat-room-box');
      this.chatRoom = this.shadowRoot.getElementById('chat-room');
      this.chatName = this.shadowRoot.getElementById('chat-name');
    }
    
    _setupEventListeners() {
      // Room name editing
      if (this.roomName) {
        if (this.config.allowRoomChange) {
          this.roomName.addEventListener('blur', () => this._onRoomChange());
          this.roomName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              this._onRoomChange();
            } else if (e.key === 'Escape') {
              this._cancelRoomEdit();
            }
          });
        } else {
          this.roomName.readOnly = true;
        }
        
        // Stop propagation to prevent collapsing when clicking to edit
        const stopPropagation = (e) => e.stopPropagation();
        this.roomName.addEventListener('click', stopPropagation);
        this.roomName.addEventListener('mousedown', stopPropagation);
      }
      
      // Name input
      if (this.chatName) {
        this.chatName.addEventListener('change', () => this._onNameChange());
        
        // Stop propagation to prevent collapsing when clicking to edit
        const stopPropagation = (e) => e.stopPropagation();
        this.chatName.addEventListener('click', stopPropagation);
        this.chatName.addEventListener('mousedown', stopPropagation);
      }
      
      // Stop propagation on containers
      const stopPropagation = (e) => e.stopPropagation();
      if (this.roomDisplay) {
        this.roomDisplay.addEventListener('click', stopPropagation);
        this.roomDisplay.addEventListener('mousedown', stopPropagation);
      }
    }
    
    _initialize() {
      // Set initial room visibility
      if (this.roomDisplay) {
        if (this.config.showRoom) {
          this.roomDisplay.classList.remove('hidden');
        } else {
          this.roomDisplay.classList.add('hidden');
        }
      }
      
      // Set initial room name
      if (this.roomName) {
        this.roomName.value = this.config.currentRoom || '';
      }
      
      // Set room prefix
      if (this.roomPrefix) {
        this.roomPrefix.textContent = this.config.baseTopic || '';
      }
    }
    
    _onRoomChange() {
      const newRoom = this.roomName.value.trim();
      this.dispatchEvent(new CustomEvent('roomchange', {
        detail: { room: newRoom },
        bubbles: true,
        composed: true
      }));
    }
    
    _cancelRoomEdit() {
      // Restore previous value
      if (this.roomName) {
        this.roomName.value = this.config.currentRoom || '';
      }
    }
    
    _onNameChange() {
      const newName = this.chatName.value.trim();
      this.dispatchEvent(new CustomEvent('namechange', {
        detail: { name: newName },
        bubbles: true,
        composed: true
      }));
    }
    
    // Public API
    setRoom(room) {
      if (this.roomName) {
        this.roomName.value = room;
      }
      this.config.currentRoom = room;
    }
    
    setName(name) {
      if (this.chatName) {
        this.chatName.value = name;
      }
    }
    
    setRoomPrefix(prefix) {
      if (this.roomPrefix) {
        this.roomPrefix.textContent = prefix;
      }
      this.config.baseTopic = prefix;
    }
    
    setCollapsible(collapsible) {
      if (this.shadowRoot.querySelector('.chat-header')) {
        this.shadowRoot.querySelector('.chat-header').style.cursor = collapsible ? 'pointer' : 'default';
      }
    }
  }

  customElements.define('chat-header', ChatHeader);

  /**
   * ActiveUsersList - Component for displaying active users with colored chips
   * 
   * @class ActiveUsersList
   * @extends HTMLElement
   */
  class ActiveUsersList extends HTMLElement {
    constructor(config = {}) {
      super();
      
      this.config = {
        userColors: config.userColors || ['lightcoral', 'lightseagreen', 'lightsalmon', 'lightgreen'],
        ...config
      };
      
      this.attachShadow({ mode: 'open' });
      
      this.shadowRoot.innerHTML = `
      <style>
        .active-users {
          padding: 0px 0px 0px 0px;
          margin: 0px 0px 8px 0px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
        }
        .user-bubble {
          display: inline-block;
          padding: 4px 4px;
          border-radius: 12px;
          font-size: 0.85em;
          cursor: pointer;
          color: #333;
          font-weight: 500;
          margin: 0;
          margin-block-start: 0;
          margin-block-end: 0;
          margin-inline-start: 0;
          margin-inline-end: 0;
        }
        .user-bubble:hover {
          opacity: 0.8;
        }
        .waiting-message {
          color: #666;
          font-size: 0.9em;
          font-style: italic;
          padding: 8px;
        }
      </style>
      <div class="active-users">
        <div class="waiting-message">Waiting for others to join...</div>
      </div>
    `;
      
      this.activeUsersEl = this.shadowRoot.querySelector('.active-users');
      this.userColorMap = new Map(); // Map<user, color>
    }
    
    /**
     * Update the list of active users
     * @param {Array<string>} users - List of active user names
     * @param {Function} getUserColor - Optional function to get color for a user
     */
    updateUsers(users, getUserColor = null) {
      if (!this.activeUsersEl) return;
      
      // Clear existing bubbles
      this.activeUsersEl.innerHTML = '';
      
      // Show message if no users
      if (users.length === 0) {
        const waitingMsg = document.createElement('div');
        waitingMsg.className = 'waiting-message';
        waitingMsg.textContent = 'Waiting for others to join...';
        this.activeUsersEl.appendChild(waitingMsg);
        return;
      }
      
      // Create bubbles for each user
      users.forEach((user) => {
        const bubble = document.createElement('p');
        bubble.className = 'user-bubble';
        
        // Get color for user
        let userColor;
        if (getUserColor) {
          userColor = getUserColor(user);
        } else {
          // Use index-based color assignment
          const index = users.indexOf(user);
          userColor = this.config.userColors[index % this.config.userColors.length];
        }
        
        bubble.style.backgroundColor = userColor;
        bubble.textContent = user;
        bubble.title = user;
        
        bubble.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('userclick', {
            detail: { user },
            bubbles: true,
            composed: true
          }));
        });
        
        this.activeUsersEl.appendChild(bubble);
      });
    }
    
    /**
     * Get color for a user (for consistency)
     * @param {string} user - User name
     * @returns {string} Color
     */
    getUserColor(user) {
      if (!this.userColorMap.has(user)) {
        const index = this.userColorMap.size;
        const color = this.config.userColors[index % this.config.userColors.length];
        this.userColorMap.set(user, color);
      }
      return this.userColorMap.get(user);
    }
    
    /**
     * Clear the user list
     */
    clear() {
      if (this.activeUsersEl) {
        this.activeUsersEl.innerHTML = '';
        const waitingMsg = document.createElement('div');
        waitingMsg.className = 'waiting-message';
        waitingMsg.textContent = 'Waiting for others to join...';
        this.activeUsersEl.appendChild(waitingMsg);
      }
    }
  }

  customElements.define('active-users-list', ActiveUsersList);

  /**
   * MessagesComponent - Component for displaying chat messages
   * 
   * Supports:
   * - Messages from sender (own messages)
   * - Messages from others
   * - Custom message components
   * 
   * @class MessagesComponent
   * @extends HTMLElement
   */
  class MessagesComponent extends HTMLElement {
    constructor(config = {}) {
      super();
      
      this.config = {
        primaryUserColor: config.primaryUserColor || 'lightblue',
        userColors: config.userColors || ['lightcoral', 'lightseagreen', 'lightsalmon', 'lightgreen'],
        ...config
      };
      
      this.attachShadow({ mode: 'open' });
      
      this.shadowRoot.innerHTML = `
      <style>
        .messages {
          max-height: 400px;
          overflow-y: auto;
          padding: 5px;
          margin-bottom: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .message {
          padding: 4px 8px;
          border-radius: 8px;
          max-width: 80%;
          word-wrap: break-word;
          position: relative;
          font-size: 0.85em;
        }
        .message.own-message {
          align-self: flex-end;
          color: #333;
        }
        .message.other-message {
          align-self: flex-start;
          color: #333;
        }
        .message.custom {
          align-self: stretch;
          max-width: 100%;
        }
      </style>
      <div class="messages"></div>
    `;
      
      this.messagesEl = this.shadowRoot.querySelector('.messages');
      this.userColorMap = new Map(); // Map<user, color>
    }
    
    /**
     * Append a message to the display
     * @param {Object} messageData - {data: string|HTMLElement, sender: string, timestamp: number, isOwn: boolean}
     */
    appendMessage(messageData) {
      if (!this.messagesEl) return;
      
      const { data, sender, timestamp, isOwn } = messageData;
      
      // Check if data is a custom component (HTMLElement)
      if (data instanceof HTMLElement) {
        const container = document.createElement('div');
        container.className = 'message custom';
        container.appendChild(data);
        this.messagesEl.appendChild(container);
        this._scrollToBottom();
        return;
      }
      
      // Create a message element with a chat bubble style
      const messageEl = document.createElement('div');
      messageEl.className = 'message';
      messageEl.textContent = data;
      
      // Check if it's own message or from others
      if (isOwn || sender && sender.includes('( You )')) {
        messageEl.classList.add('own-message');
        messageEl.style.backgroundColor = this.config.primaryUserColor;
      } else {
        messageEl.classList.add('other-message');
        // Get user color
        const userColor = this.getUserColor(sender);
        messageEl.style.backgroundColor = userColor;
      }
      
      // Hover effect to show timestamp
      if (timestamp) {
        messageEl.title = new Date(timestamp).toLocaleString();
      }
      
      this.messagesEl.appendChild(messageEl);
      this._scrollToBottom();
    }
    
    /**
     * Display a message (alias for appendMessage)
     * @param {Object} messageData - Message data
     */
    displayMessage(messageData) {
      this.appendMessage(messageData);
    }
    
    /**
     * Get color for a user (for consistency)
     * @param {string} user - User name
     * @returns {string} Color
     */
    getUserColor(user) {
      if (!user) return this.config.userColors[0];
      
      if (!this.userColorMap.has(user)) {
        const index = this.userColorMap.size;
        const color = this.config.userColors[index % this.config.userColors.length];
        this.userColorMap.set(user, color);
      }
      return this.userColorMap.get(user);
    }
    
    /**
     * Set user color (for consistency with external color management)
     * @param {string} user - User name
     * @param {string} color - Color
     */
    setUserColor(user, color) {
      this.userColorMap.set(user, color);
    }
    
    /**
     * Clear all messages
     */
    clear() {
      if (this.messagesEl) {
        this.messagesEl.innerHTML = '';
      }
    }
    
    /**
     * Load message history
     * @param {Array<Object>} history - Array of message objects
     */
    loadHistory(history) {
      if (!Array.isArray(history)) return;
      
      history.forEach((entry) => {
        this.appendMessage(entry);
      });
    }
    
    /**
     * Set the current user's name (for determining own messages)
     * @param {string} name - Current user's name
     */
    setCurrentUserName(name) {
      this.currentUserName = name;
    }
    
    /**
     * Scroll to bottom of messages
     * @private
     */
    _scrollToBottom() {
      if (this.messagesEl) {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      }
    }
  }

  customElements.define('messages-component', MessagesComponent);

  /**
   * MessageInput - Component for message input and controls
   * 
   * Includes:
   * - Message input field
   * - Send button (via Enter key)
   * - Emoji button
   * - Clear button
   * 
   * Note: Call buttons (Audio/Video/End) are now in the call-management section
   * 
   * @class MessageInput
   * @extends HTMLElement
   */
  class MessageInput extends HTMLElement {
    constructor(config = {}) {
      super();
      
      this.config = {
        callModes: config.callModes || 'both', // 'audio' | 'video' | 'both'
        ...config
      };
      
      this.attachShadow({ mode: 'open' });
      
      this.shadowRoot.innerHTML = `
      <style>
        .input-container {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 8px;
          border-top: 1px solid #ddd;
          background-color: #f9f9f9;
        }
        #input-message {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 0.9em;
        }
        #input-message:disabled {
          background-color: #e0e0e0;
          cursor: not-allowed;
        }
        button {
          padding: 6px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          cursor: pointer;
          background-color: white;
          font-size: 0.9em;
        }
        button:hover {
          background-color: #f0f0f0;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      </style>
      <div class="input-container">
        <input id="input-message" type="text" placeholder="Type a message...">
        <button id="emoji-button">👋</button>
        <button id="clear-button" title="Clear chat view (only clears your side, doesn't delete messages)">🗑️</button>
      </div>
    `;
      
      this._cacheElements();
      this._setupEventListeners();
    }
    
    _cacheElements() {
      this.inputContainer = this.shadowRoot.querySelector('.input-container');
      this.inputMessage = this.shadowRoot.getElementById('input-message');
      this.emojiButton = this.shadowRoot.getElementById('emoji-button');
      this.clearButton = this.shadowRoot.getElementById('clear-button');
    }
    
    _setupEventListeners() {
      // Message input - Enter to send
      if (this.inputMessage) {
        this.inputMessage.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.ctrlKey) {
            e.preventDefault();
            this._onSend();
          }
          e.stopPropagation();
        });
      }
      
      // Emoji button
      if (this.emojiButton) {
        this.emojiButton.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('emojiclick', {
            bubbles: true,
            composed: true
          }));
        });
      }
      
      // Clear button
      if (this.clearButton) {
        this.clearButton.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('clearclick', {
            bubbles: true,
            composed: true
          }));
        });
      }
      
      // Call buttons are now in the call-management section, not here
    }
    
    _onSend() {
      const message = this.inputMessage.value.trim();
      if (message) {
        this.dispatchEvent(new CustomEvent('sendmessage', {
          detail: { message },
          bubbles: true,
          composed: true
        }));
        this.clear();
      }
    }
    
    // Call buttons are now in the call-management section, not in MessageInput
    
    /**
     * Get the message input value
     * @returns {string} Message text
     */
    getValue() {
      return this.inputMessage ? this.inputMessage.value : '';
    }
    
    /**
     * Clear the message input
     */
    clear() {
      if (this.inputMessage) {
        this.inputMessage.value = '';
      }
    }
    
    /**
     * Enable or disable the input
     * @param {boolean} enabled - Whether input should be enabled
     */
    setEnabled(enabled) {
      if (this.inputMessage) {
        this.inputMessage.disabled = !enabled;
        this.inputMessage.placeholder = enabled 
          ? "Type a message..." 
          : "Waiting for others to join...";
      }
      
      if (this.emojiButton) {
        this.emojiButton.disabled = !enabled;
      }
      
      if (this.clearButton) {
        this.clearButton.disabled = !enabled;
      }
    }
    
    // Call buttons are now in the call-management section, not in MessageInput
  }

  customElements.define('message-input', MessageInput);

  /**
   * ChatBox - A Web Component for displaying and managing chat messages
   * 
   * This custom HTML element provides a complete chat interface with:
   * - Message display with chat bubbles (color-coded by user)
   * - Active user list with visual indicators
   * - Message input with keyboard shortcuts (Enter to send)
   * - Room and name configuration
   * - Integration with RTC clients for peer-to-peer messaging
   * - Audio and video calling support with configurable call modes
   * 
   * Usage:
   *   <chat-box></chat-box>
   *   <script>
   *     import { LocalStorageAdapter } from './storage/local-storage-adapter.js';
   *     import { CustomVideoDisplay } from './custom-video.js';
   *     const chatBox = document.querySelector('chat-box');
   *     chatBox.storage = new LocalStorageAdapter(); // Optional: inject storage
   *     chatBox.callModes = 'both'; // 'audio' | 'video' | 'both'
   *     chatBox.videoDisplayComponent = CustomVideoDisplay; // Optional: custom video component
   *     chatBox.rtc = myRTCClient; // Set the RTC client to enable messaging
   *   </script>
   * 
   * Features:
   * - Automatically connects to RTC client when assigned via `rtc` property
   * - Displays messages with timestamps (hover to see)
   * - Shows active users with colored bubbles
   * - Saves name to storage for persistence (uses StorageAdapter)
   * - Supports room-based chat (configure via room input)
   * - Responsive design with mobile-friendly sizing
   * - Audio and video calling with automatic stream management
   * - Configurable call modes (audio only, video only, or both)
   * - Optional custom video display component
   * 
   * Properties:
   * - callModes: 'audio' | 'video' | 'both' - Which call types to expose (default: 'both')
   * - videoDisplayComponent: Component class - Optional custom video display component
   * 
   * Events:
   * - Receives 'chat' events from RTC client
   * - Receives 'connectedtopeer' and 'disconnectedfrompeer' events
   * - Receives 'callconnected' events for audio/video calls
   * - Receives 'call' events for incoming calls (auto-accepted)
   * 
   * @class ChatBox
   * @extends HTMLElement
   */


  /**
   * ChatBox - Web Component implementing ChatUIInterface, CallUIInterface, and related interfaces
   * 
   * This component implements multiple interfaces to work with CallManager and ChatManager:
   * - ChatUIInterface: Chat message display and input handling
   * - CallUIInterface: Call prompts and notifications
   * - StreamDisplayInterface: Video/audio stream display (via VideoStreamDisplay/AudioStreamDisplay)
   * - RingerInterface: Ringtone for incoming calls (via CallRinger)
   * - NotificationInterface: Connection sounds (via NotificationSound)
   */
  class ChatBox extends HTMLElement {
    constructor(config = {}) {
      super();
      
      // Validate and store configuration from interface (immutable)
      this.config = UIConfigInterface.validateConfig(config);
      
      // Initialize state manager for mutable state
      this.state = new StateManager({
        currentRoom: this.config.currentRoom,
        baseTopic: this.config.baseTopic,
        name: '?'
      });
      
      this._rtc = null;
      this._storage = null; // Storage adapter (injected)
      // All state is now in managers - ChatBox is a pure UI component

      this.attachShadow({ mode: 'open' });
      
      // Don't set CSS custom property during construction - move to connectedCallback
      // Setting style properties during construction can cause "result must not have attributes" error
      
      // Include full CSS inline - async loading doesn't work well in bundles
      // Import the CSS as a string at build time or inline it here
      this.shadowRoot.innerHTML = `
      <style id="chat-box-styles">
        ${this._getFullCSS()}
      </style>
      <div id="chat-container">
        <chat-header id="chat-header-component"></chat-header>
        <div id="call-management">
          <div id="call-buttons-container">
            <button id="audio-call-button" class="call-button audio-call" title="Start audio call">Audio</button>
            <button id="video-call-button" class="call-button video-call" title="Start video call">Video</button>
            <button id="end-call-button" class="call-button end-call" title="End call">End</button>
          </div>
          <div id="call-info-container"></div>
          <div id="call-controls-container">
            <span id="call-controls-label">Call Controls:</span>
            <button id="call-mute-mic-btn" class="call-control-button" title="Mute/Unmute microphone">Mute Mic</button>
            <button id="call-mute-speakers-btn" class="call-control-button" title="Mute/Unmute speakers">Mute Speakers</button>
            <button id="call-video-toggle-btn" class="call-control-button hidden" title="Hide/Show video">Hide Video</button>
            <span id="call-metrics"></span>
          </div>
        </div>
        <div id="chat-video"></div>
        <div id="chat-audio"></div>
        <div id="chat-body">
          <active-users-list id="active-users-component"></active-users-list>
          <messages-component id="messages-component"></messages-component>
          <message-input id="message-input-component"></message-input>
        </div>
      </div>
    `;

      // Cache element references
      this._cacheElements();
      
      // Initialize components
      this._initializeComponents();
      
      // Setup event listeners
      this._setupEventListeners();
      
      // Initialize UI state
      this._initializeUI();
      
      // Update call button visibility based on callModes
      this._updateCallButtonVisibility();
    }

    /**
     * Called when the element is connected to the DOM
     * Safe to set style properties here
     */
    connectedCallback() {
      // Set CSS custom property for primary user color
      // This is safe to do after construction
      this.style.setProperty('--primary-user-color', this.config.primaryUserColor);
      
      // Call parent's connectedCallback if it exists
      if (super.connectedCallback) {
        super.connectedCallback();
      }
    }

    /**
     * Load CSS styles from separate file
     * @private
     */
    async _loadStyles() {
      try {
        // Fetch CSS file content
        const cssUrl = new URL('./chat-box.css', (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('rtchat.js', document.baseURI).href)).href;
        const response = await fetch(cssUrl);
        
        if (response.ok) {
          const cssText = await response.text();
          // Replace placeholder style tag with actual CSS
          const styleEl = this.shadowRoot.getElementById('chat-box-styles');
          if (styleEl) {
            styleEl.textContent = cssText;
          } else {
            // Fallback: create new style tag
            const style = document.createElement('style');
            style.textContent = cssText;
            this.shadowRoot.insertBefore(style, this.shadowRoot.firstChild);
          }
        } else {
          throw new Error('CSS file not found');
        }
      } catch (error) {
        console.warn('Could not load chat-box.css, using inline styles fallback:', error);
        // Fallback: update placeholder with minimal styles
        const styleEl = this.shadowRoot.getElementById('chat-box-styles');
        if (styleEl) {
          styleEl.textContent = this._getInlineStylesFallback();
        }
      }
    }

    /**
     * Get full CSS styles (inlined for bundle compatibility)
     * @private
     */
    _getFullCSS() {
      // Return full CSS with dynamic primary user color
      // This matches chat-box.css but with the primary color injected
      return `
      :host {
        --primary-user-color: ${this.config.primaryUserColor};
        --user-colors: lightcoral, lightseagreen, lightsalmon, lightgreen;
      }
      .rounded { border-radius: 5px; }
      .hidden { display: none !important; }
      .visible { display: block !important; }
        #chat-container {
          position: fixed;
          bottom: 0.5em;
          right: 0.5em;
          border: 1px solid #ccc;
          background-color: #f9f9f9;
          border-radius: 10px;
          min-width: 350px;
          z-index: 9999;
        }
        #chat-header {
          cursor: pointer;
        background-color: var(--primary-user-color);
          padding: 10px;
          font-weight: bold;
          border-top-left-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
      #call-management {
        display: flex;
        background-color: #f5f5f5;
        border-top: 2px solid #ddd;
        border-bottom: 2px solid #ddd;
        padding: 10px;
        flex-direction: column;
        gap: 8px;
      }
      #call-management.hidden { display: none; }
      #call-buttons-container {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .call-button {
        padding: 6px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9em;
        display: none;
        background-color: white;
      }
      .call-button.visible {
        display: inline-block;
      }
      .call-button.audio-call,
      .call-button.video-call {
        color: green;
      }
      .call-button.end-call,
      .call-button.cancel {
        color: red;
      }
      .call-button:hover {
        background-color: #f0f0f0;
      }
      #call-controls-container {
        display: none;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      #call-controls-container.active {
        display: flex;
      }
      #call-info-container {
        display: none;
      }
      #call-info-container.active {
        display: flex;
      }
      #call-controls-label {
        font-weight: bold;
        margin-right: 8px;
      }
      #call-info-container {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .call-info-item {
        font-size: 0.85em;
        padding: 5px 8px;
        border-radius: 4px;
        background-color: #e8f5e9;
        border-left: 3px solid #4caf50;
      }
      .call-control-button {
        padding: 6px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        background-color: white;
        color: orange;
        font-size: 0.9em;
      }
      .call-control-button:hover { background-color: #f0f0f0; }
      .call-control-button.active {
        background-color: #ff6b6b;
        color: white;
      }
      .call-control-button.hidden { display: none; }
      #call-metrics {
        margin-left: auto;
        font-size: 0.85em;
        color: #666;
      }
        #room-display {
          display: flex;
          align-items: center;
          gap: 2px;
        }
      #room-display > span:first-child { margin-right: 5px; }
      #room-display.hidden { display: none; }
        #room-prefix {
          color: gray;
          font-weight: normal;
        }
      #chat-header > div:last-child { margin-left: 5px; }
        #room-name {
          font-weight: normal;
          padding: 2px 5px;
          border-radius: 3px;
          width: 160px;
          border: 1px solid #333;
          background-color: white;
        }
      #chat-room-box { display: none; }
      #chat-room { width: 200px; }
      #chat-name { width: 200px; }
      #chat-video {
          max-height: 40vh;
          overflow: auto;
          display: none;
          padding: 10px;
        }
      #chat-video.visible { display: block; }
      #chat-audio {
        max-height: 20vh;
        overflow: auto;
        display: none;
        padding: 10px;
      }
      #chat-audio.visible { display: block; }
      .audio-stream-container {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        margin-bottom: 5px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 5px;
        border-left: 3px solid #4CAF50;
      }
      .audio-stream-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #4CAF50;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .audio-stream-label {
        font-size: 0.9em;
        color: #333;
        flex: 1;
      }
      .audio-stream-controls {
        display: flex;
        gap: 5px;
      }
      .audio-stream-mute-btn {
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 3px;
        background: white;
        cursor: pointer;
          font-size: 0.8em;
        }
      .audio-stream-mute-btn:hover { background: #f0f0f0; }
      .audio-stream-mute-btn.muted {
        background: #ffebee;
        border-color: #f44336;
      }
      .audio-stream-element { display: none; }
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
      .video-stream-remote { width: 100%; }
      .video-stream-local {
        position: absolute;
        width: 25%;
        max-width: 25%;
        top: 10px;
        right: 10px;
        border: 2px solid white;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        border-radius: 5px;
        background: #000;
      }
      #chat-body {
        max-height: 40vh;
        overflow: auto;
        display: none;
        padding: 10px;
      }
      #chat-body.visible { display: block; }
      #active-users { font-size: 0.8em; }
      #messages { margin-bottom: 10px; }
        #input-container {
          margin-top: 30px;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .call-button {
        display: none;
        cursor: pointer;
        padding: 5px 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background-color: white;
        font-size: 0.9em;
      }
      .call-button.visible { display: inline-block; }
      .call-button.audio-call,
      .call-button.video-call { color: green; }
      .call-button.end-call,
      .call-button.cancel { color: red; }
      #input-message {
        flex: 1;
        padding: 5px;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      #input-message:disabled {
        background-color: #f5f5f5;
        cursor: not-allowed;
      }
      #emoji-button {
        display: inline-block;
        cursor: pointer;
        padding: 5px 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background-color: white;
      }
      #emoji-button:disabled {
        background-color: #f5f5f5;
        cursor: not-allowed;
      }
      #clear-button {
        cursor: pointer;
        padding: 5px 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background-color: white;
      }
      #clear-button:disabled {
        background-color: #f5f5f5;
        cursor: not-allowed;
      }
      .message {
        padding: 5px 10px;
        margin: 5px;
        border-radius: 10px;
        max-width: 60%;
      }
      .message.own-message {
        background-color: var(--primary-user-color);
        color: white;
        margin-left: auto;
      }
      .message.other-message {
        color: black;
        margin-right: auto;
      }
      .user-bubble {
        height: 20px;
        border-radius: 5px;
        padding: 0px 5px;
        display: inline-block;
        text-align: center;
        line-height: 20px;
        color: white;
        font-size: 12px;
        cursor: pointer;
        overflow: hidden;
        white-space: nowrap;
      }
      .notification-message {
        color: #666;
        font-size: 0.85em;
        font-style: italic;
        margin-bottom: 5px;
        padding: 5px;
        border-radius: 3px;
      }
      .notification-message.missed-call {
        background-color: #fff3cd;
        border-left: 3px solid #ffc107;
      }
      .notification-message.declined-call {
        background-color: #f8d7da;
        border-left: 3px solid #dc3545;
      }
      .pinned-audio-call {
        position: sticky;
        top: 0;
        z-index: 100;
        background-color: #e3f2fd;
        border-left: 4px solid #2196F3;
        border-radius: 5px;
        padding: 8px 12px;
        margin-bottom: 10px;
        font-size: 0.9em;
        color: #1976D2;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .pinned-audio-call.hidden { display: none; }
      @media only screen and (max-width: 1000px) {
          #chat-container {
            min-width: 50vw !important;
          }
      }
    `;
    }

    /**
     * Cache all DOM element references
     * @private
     */
    _cacheElements() {
      // Cache component references
      this.chatHeaderComponent = this.shadowRoot.getElementById('chat-header-component');
      this.activeUsersComponent = this.shadowRoot.getElementById('active-users-component');
      this.messagesComponent = this.shadowRoot.getElementById('messages-component');
      this.messageInputComponent = this.shadowRoot.getElementById('message-input-component');
      
      // Cache container elements
      this.chatVideo = this.shadowRoot.getElementById('chat-video');
      this.chatAudio = this.shadowRoot.getElementById('chat-audio');
      this.chatBody = this.shadowRoot.getElementById('chat-body');
      this.callManagement = this.shadowRoot.getElementById('call-management');
      this.callManagementContainer = this.callManagement;
      
      // Cache call button elements (now in call-management section)
      this.audioCallButton = this.shadowRoot.getElementById('audio-call-button');
      this.videoCallButton = this.shadowRoot.getElementById('video-call-button');
      this.endCallButton = this.shadowRoot.getElementById('end-call-button');
      
      // For backward compatibility, expose messages and activeUsers as properties
      // that point to the component's internal elements
      this.messages = this.messagesComponent ? this.messagesComponent.shadowRoot.querySelector('.messages') : null;
      this.activeUsers = this.activeUsersComponent ? this.activeUsersComponent.shadowRoot.querySelector('.active-users') : null;
    }

    /**
     * Initialize all components
     * @private
     */
    _initializeComponents() {
      // Initialize sub-components with config
      if (this.chatHeaderComponent) {
        // ChatHeader will be initialized as a custom element automatically
        // We just need to configure it
        this.chatHeaderComponent.config = {
          allowRoomChange: this.config.allowRoomChange,
          showRoom: this.config.showRoom,
          baseTopic: this.config.baseTopic,
          currentRoom: this.config.currentRoom,
          primaryUserColor: this.config.primaryUserColor
        };
      }
      
      if (this.activeUsersComponent) {
        this.activeUsersComponent.config = {
          userColors: this.config.userColors
        };
      }
      
      if (this.messagesComponent) {
        this.messagesComponent.config = {
          primaryUserColor: this.config.primaryUserColor,
          userColors: this.config.userColors
        };
      }
      
      if (this.messageInputComponent) {
        this.messageInputComponent.config = {
          callModes: this.config.callModes
        };
      }
      
      // Initialize call management component (will be set when rtc is assigned)
      this.callManagement = null;
      
      // Initialize video stream display component (use custom from config or default)
      const VideoComponent = this.config.videoDisplayComponent || VideoStreamDisplay;
      this.videoDisplay = new VideoComponent(this.chatVideo, {
        localVideoSize: '25%',
        localVideoPosition: 'top-right'
      });
      
      // Initialize audio stream display component
      this.audioDisplay = new AudioStreamDisplay(this.chatAudio);
      
      // Initialize call ringer for incoming calls (using config)
      this.ringer = new CallRinger({ volume: this.config.ringerVolume });
      
      // Initialize notification sound for connection events (using config)
      this.notificationSound = new NotificationSound({ volume: this.config.notificationVolume });
      
      // Initialize business logic managers (will be set when rtc is assigned)
      this.callManager = null;
      this.chatManager = null;
      
      // UI state (minimal - most state is in managers)
      this.activeCallType = null;
      this.outgoingCalls = new Map(); // Track outgoing calls for cancellation
    }

    /**
     * Setup all event listeners
     * @private
     */
    _setupEventListeners() {
      // Call button handlers
      this._setupCallButtons();
      this._setupCallControls();
      
      // Setup component event listeners
      this._setupComponentEventListeners();
      
      // Listen to state changes
      this.state.on('change:currentRoom', ({value}) => {
        if (this.chatHeaderComponent) {
          this.chatHeaderComponent.setRoom(value);
        }
      });
    }
    
    /**
     * Setup event listeners for sub-components
     * @private
     */
    _setupComponentEventListeners() {
      // ChatHeader events
      if (this.chatHeaderComponent) {
        this.chatHeaderComponent.addEventListener('roomchange', (e) => {
          this.finishRoomEdit(e.detail.room);
        });
        
        this.chatHeaderComponent.addEventListener('namechange', (e) => {
          const newName = e.detail.name;
          console.log("Name changed to " + newName);
          if (this.rtc) {
            this.rtc.changeName(newName);
            this.name = this.rtc.name;
            this.chatHeaderComponent.setName(this.name);
          } else {
            this.name = newName;
          }
        });
      }
      
      // MessageInput events
      if (this.messageInputComponent) {
        this.messageInputComponent.addEventListener('sendmessage', (e) => {
          this.sendMessage(e.detail.message);
        });
        
        this.messageInputComponent.addEventListener('emojiclick', () => {
          this.sendMessage("👋");
        });
        
        this.messageInputComponent.addEventListener('clearclick', () => {
          if (this.messagesComponent) {
            this.messagesComponent.clear();
          }
        });
        
        this.messageInputComponent.addEventListener('audiocallclick', () => {
          const buttonText = this.messageInputComponent.audioCallButton?.textContent;
          if (buttonText === 'End' || buttonText === 'Cancel') {
            if (buttonText === 'Cancel') {
              // Cancel outgoing call - handled by _startCall
              this._cancelOutgoingCall('audio');
            } else {
              this._endAllCalls();
            }
          } else {
            this._startCall('audio');
          }
        });
        
        this.messageInputComponent.addEventListener('videocallclick', () => {
          const buttonText = this.messageInputComponent.videoCallButton?.textContent;
          if (buttonText === 'End' || buttonText === 'Cancel') {
            if (buttonText === 'Cancel') {
              this._cancelOutgoingCall('video');
            } else {
              this._endAllCalls();
            }
          } else {
            this._startCall('video');
          }
        });
        
        this.messageInputComponent.addEventListener('endcallclick', () => {
          this._endAllCalls();
        });
      }
      
      // Call button events (buttons are now in call-management section)
      if (this.audioCallButton) {
        this.audioCallButton.addEventListener('click', () => {
          console.log('Audio call button clicked');
          const buttonText = this.audioCallButton.textContent;
          if (buttonText === 'End' || buttonText === 'Cancel') {
            if (buttonText === 'Cancel') {
              // Cancel outgoing call
              this._endAllCalls();
            } else {
              this._endAllCalls();
            }
          } else {
            this._startCall('audio');
          }
        });
      }
      
      if (this.videoCallButton) {
        this.videoCallButton.addEventListener('click', () => {
          console.log('Video call button clicked');
          const buttonText = this.videoCallButton.textContent;
          if (buttonText === 'End' || buttonText === 'Cancel') {
            if (buttonText === 'Cancel') {
              this._endAllCalls();
            } else {
              this._endAllCalls();
            }
          } else {
            this._startCall('video');
          }
        });
      }
      
      if (this.endCallButton) {
        this.endCallButton.addEventListener('click', () => {
          console.log('End call button clicked');
          this._endAllCalls();
        });
      }
      
      // ActiveUsersList events
      if (this.activeUsersComponent) {
        this.activeUsersComponent.addEventListener('userclick', (e) => {
          alert('User: ' + e.detail.user);
        });
      }
    }

    /**
     * Cancel an outgoing call
     * @private
     */
    _cancelOutgoingCall(type) {
      // This will be handled by the call button state management
      // The actual cancellation is done in _startCall
    }

    /**
     * Initialize UI state
     * @private
     */
    _initializeUI() {
      // Set initial room visibility
      const roomDisplay = this.shadowRoot.getElementById('room-display');
      if (roomDisplay) {
        if (this.config.showRoom) {
          roomDisplay.classList.remove('hidden');
        } else {
          roomDisplay.classList.add('hidden');
        }
      }
      
      // Initially hide call management (will show when users connect)
      if (this.callManagement) {
        this.callManagement.classList.add('hidden');
      }
      
      // Initially disable inputs (no one else in room yet)
      this.updateInputState();
      
      // Show chat body
      if (this.chatBody) {
        this.chatBody.classList.add('visible');
      }
    }

    /**
     * Setup call button event handlers
     * @private
     * Note: Call buttons are now handled by MessageInput component via event listeners
     */
    _setupCallButtons() {
      // Call buttons are now handled by MessageInput component
      // Event listeners are set up in _setupComponentEventListeners()
    }

    /**
     * Setup call control buttons (mute, video toggle)
     * @private
     */
    _setupCallControls() {
      // Controls are created dynamically in the call controls message component
      // Event listeners are attached when the message is created in _updateCallControlsMessage
    }

    /**
     * Toggle microphone mute state for all active calls
     * @private
     */
    _toggleMicMute() {
      if (!this.callManager) {
        return;
      }
      
      const currentState = this.callManager.getMuteState();
      this.callManager.setMicMuted(!currentState.mic);
      // State update will come via 'mutechanged' event
    }

    /**
     * Toggle speakers mute state for all active calls
     * @private
     */
    _toggleSpeakersMute() {
      this.isSpeakersMuted = !this.isSpeakersMuted;
      
      // Mute/unmute all remote audio elements (speakers)
      if (this.audioDisplay && this.audioDisplay.activeStreams) {
        for (const [peerName, streamData] of Object.entries(this.audioDisplay.activeStreams)) {
          if (streamData && streamData.container) {
            const remoteAudio = streamData.container.querySelector('.audio-stream-element[data-type="remote"]');
            if (remoteAudio) {
              remoteAudio.muted = this.isSpeakersMuted;
            }
          }
        }
      }
      
      // Also handle video calls which may have audio
      if (this.videoDisplay && this.videoDisplay.activeStreams) {
        for (const [peerName, streamData] of Object.entries(this.videoDisplay.activeStreams)) {
          if (streamData && streamData.container) {
            const remoteVideo = streamData.container.querySelector('.video-stream-remote');
            if (remoteVideo) {
              remoteVideo.muted = this.isSpeakersMuted;
            }
          }
        }
      }
      
      // Update call management component
      if (this.callManagement) {
        this.callManagement.setMuteState({ mic: this.isMicMuted });
      }
      this._updateCallControlsMessage();
    }

    /**
     * Toggle video visibility for all active video calls
     * @private
     */
    _toggleVideo() {
      if (!this.callManager) {
        return;
      }
      
      const currentState = this.callManager.getMuteState();
      this.callManager.setVideoHidden(!currentState.video);
      // State update will come via 'mutechanged' event
    }

    /**
     * Update the call management section (separate from messages)
     * @private
     */
    _updateCallControlsMessage() {
      if (!this.callManagement || !this.callManager) {
        return;
      }
      
      // Get state from CallManager
      const activeCalls = this.callManager.getActiveCalls();
      const muteState = this.callManager.getMuteState();
      
      // Update active calls in CallManagement component
      this.callManagement.setActiveCalls(activeCalls.audio, activeCalls.video);
      
      // Update mute state
      this.callManagement.setMuteState({
        mic: muteState.mic,
        speakers: muteState.speakers,
        video: muteState.video
      });
      
      // Update metrics
      for (const user of activeCalls.audio) {
        const metrics = this.callManager.getMetrics(user);
        if (metrics) {
          this.callManagement.setMetrics(user, metrics);
        }
      }
      for (const user of activeCalls.video) {
        const metrics = this.callManager.getMetrics(user);
        if (metrics) {
          this.callManagement.setMetrics(user, metrics);
        }
      }
      
      // Show/hide call management container and its sub-sections
      const hasActiveCalls = activeCalls.video.size > 0 || activeCalls.audio.size > 0;
      const activeUsers = this.chatManager ? this.chatManager.getActiveUsers() : [];
      const hasUsers = activeUsers.length > 0;
      
      // Show/hide the entire call-management section
      if (this.callManagementContainer) {
        // Show call management if there are active calls OR active users OR pending calls
        const pendingCalls = this.callManager && typeof this.callManager.getPendingCalls === 'function'
          ? this.callManager.getPendingCalls()
          : new Set();
        const hasPendingCalls = pendingCalls.size > 0;
        
        if (hasActiveCalls || hasUsers || hasPendingCalls) {
          this.callManagementContainer.classList.remove('hidden');
          this.callManagementContainer.style.display = 'flex';
        } else {
          // Only hide if there are no calls and no users
          this.callManagementContainer.classList.add('hidden');
        }
      }
      
      // Show/hide call controls (mute buttons, etc.) - only during active calls
      const callControlsContainer = this.shadowRoot.getElementById('call-controls-container');
      const callInfoContainer = this.shadowRoot.getElementById('call-info-container');
      if (callControlsContainer) {
        if (hasActiveCalls) {
          callControlsContainer.classList.add('active');
        } else {
          callControlsContainer.classList.remove('active');
        }
      }
      if (callInfoContainer) {
        if (hasActiveCalls) {
          callInfoContainer.classList.add('active');
        } else {
          callInfoContainer.classList.remove('active');
        }
      }
    }

    /**
     * Handle call timeout (from CallManager event)
     * @param {string} peerName - Name of the peer
     * @param {string} direction - 'incoming' or 'outgoing'
     * @private
     */
    _handleCallTimeout(peerName, direction) {
      // Show missed call message
      this._showMissedCallMessage(peerName, direction);
      
      // Clean up UI streams
      this.videoDisplay.removeStreams(peerName);
      this.audioDisplay.removeStreams(peerName);
      
      // Update call controls
      this._updateCallControlsVisibility();
    }

    /**
     * Update visibility of call control buttons (mute, video toggle)
     * @private
     */
    _updateCallControlsVisibility() {
      // Now uses the call controls message component
      this._updateCallControlsMessage();
    }

    /**
     * Update call button visibility based on callModes
     * @private
     */
    _updateCallButtonVisibility() {
      // Get active users from ChatManager, not from a local property
      // Note: chatManager may not be initialized yet (called from constructor)
      const activeUsers = (this.chatManager && typeof this.chatManager.getActiveUsers === 'function') 
        ? this.chatManager.getActiveUsers() 
        : [];
      const hasUsers = activeUsers.length > 0;
      const modes = this.config.callModes;
      
      // Check if there are active calls - if so, don't show start call buttons
      const activeCalls = this.callManager ? this.callManager.getActiveCalls() : {audio: new Set(), video: new Set()};
      const hasActiveCalls = activeCalls.video.size > 0 || activeCalls.audio.size > 0;
      
      // Check if there are pending incoming calls - if so, don't show start call buttons
      const pendingCalls = this.callManager && typeof this.callManager.getPendingCalls === 'function'
        ? this.callManager.getPendingCalls()
        : new Set();
      const hasPendingCalls = pendingCalls.size > 0;
      
      // Debug logging
      const callManagementVisible = this.callManagementContainer ? !this.callManagementContainer.classList.contains('hidden') : false;
      this.audioCallButton ? this.audioCallButton.classList.contains('visible') : false;
      this.videoCallButton ? this.videoCallButton.classList.contains('visible') : false;
      
      if (this.audioCallButton) {
        const computedStyle = window.getComputedStyle(this.audioCallButton);
        console.log('Audio button state:', {
          element: this.audioCallButton,
          hasVisibleClass: this.audioCallButton.classList.contains('visible'),
          computedDisplay: computedStyle.display,
          computedVisibility: computedStyle.visibility,
          parentDisplay: this.audioCallButton.parentElement ? window.getComputedStyle(this.audioCallButton.parentElement).display : 'N/A',
          callManagementVisible: callManagementVisible,
          callManagementDisplay: this.callManagementContainer ? window.getComputedStyle(this.callManagementContainer).display : 'N/A'
        });
      }
      
      // Get the buttons container
      const buttonsContainer = this.shadowRoot.getElementById('call-buttons-container');
      
      // If there's a pending incoming call, the prompt is already shown in the container
      // Don't show start call buttons
      if (hasPendingCalls) {
        // Hide all buttons - the incoming call prompt is already in the container
        if (this.audioCallButton) {
          this.audioCallButton.classList.remove('visible');
        }
        if (this.videoCallButton) {
          this.videoCallButton.classList.remove('visible');
        }
        return;
      }
      
      // Restore buttons container if it was cleared by incoming call prompt
      if (buttonsContainer && buttonsContainer.children.length === 0) {
        // Recreate the buttons
        if (this.audioCallButton && !buttonsContainer.contains(this.audioCallButton)) {
          buttonsContainer.appendChild(this.audioCallButton);
        }
        if (this.videoCallButton && !buttonsContainer.contains(this.videoCallButton)) {
          buttonsContainer.appendChild(this.videoCallButton);
        }
        if (this.endCallButton && !buttonsContainer.contains(this.endCallButton)) {
          buttonsContainer.appendChild(this.endCallButton);
        }
      }
      
      // Hide all buttons first
      if (this.audioCallButton) {
        this.audioCallButton.classList.remove('visible');
        this.audioCallButton.style.display = '';
      }
      if (this.videoCallButton) {
        this.videoCallButton.classList.remove('visible');
        this.videoCallButton.style.display = '';
      }
      
      // Only show start call buttons if there are users AND no active calls AND no pending calls
      if (hasUsers && !hasActiveCalls && !hasPendingCalls) {
        if (modes === 'both') {
          if (this.audioCallButton) {
            this.audioCallButton.classList.add('visible');
            // Verify after adding class
            setTimeout(() => {
              const computed = window.getComputedStyle(this.audioCallButton);
              console.log('Audio button after visible class:', {
                hasVisibleClass: this.audioCallButton.classList.contains('visible'),
                computedDisplay: computed.display,
                parentVisible: this.audioCallButton.parentElement ? window.getComputedStyle(this.audioCallButton.parentElement).display : 'N/A',
                callManagementVisible: this.callManagementContainer ? !this.callManagementContainer.classList.contains('hidden') : false,
                callManagementDisplay: this.callManagementContainer ? window.getComputedStyle(this.callManagementContainer).display : 'N/A'
              });
            }, 0);
          }
          if (this.videoCallButton) {
            this.videoCallButton.classList.add('visible');
            console.log('Added visible class to video button');
          }
        } else if (modes === 'audio') {
          if (this.audioCallButton) {
            this.audioCallButton.classList.add('visible');
            console.log('Added visible class to audio button');
          }
        } else if (modes === 'video') {
          if (this.videoCallButton) {
            this.videoCallButton.classList.add('visible');
            console.log('Added visible class to video button');
          }
        }
      }
    }

    /**
     * Start a call (audio or video)
     * @param {string} type - 'audio' or 'video'
     * @private
     */
    _startCall(type) {
      console.log('_startCall called with type:', type);
      if (!this.callManager || !this.chatManager) {
        console.warn('_startCall: callManager or chatManager not initialized', {
          callManager: !!this.callManager,
          chatManager: !!this.chatManager
        });
        return;
      }
      
      const activeUsers = this.chatManager.getActiveUsers();
      if (activeUsers.length === 0) {
        console.warn('_startCall: No active users to call');
        return;
      }

      // Stop any ongoing ringing (in case we're calling while receiving)
      this.ringer.stop();

      // For now, call the first active user (could be enhanced to select user)
      const targetUser = activeUsers[0];
      console.log('Starting call to:', targetUser, 'type:', type);
      
      // Track which button was clicked
      this.activeCallType = type;
      
      // Update button states to show cancel button
      this._updateCallButtonStates(true, type, true); // true = isOutgoing
      
      // Use CallManager to start the call
      // CallManager will handle timeouts, stream management, and emit events
      this.callManager.startCall(targetUser, type)
        .then((result) => {
          console.log('Call started successfully:', result);
          // CallManager will handle the rest via events (callconnected, etc.)
        })
        .catch((err) => {
          console.error('Error starting call:', err);
          this.activeCallType = null;
          this._updateCallButtonStates(false);
        });
    }

    /**
     * End all active calls - delegates to CallManager
     * @private
     */
    _endAllCalls() {
      if (!this.callManager) {
        return;
      }

      // Stop ringing
      this.ringer.stop();

      // Delegate to CallManager
      this.callManager.endAllCalls();
      
      // UI cleanup will happen via callended events
      this.activeCallType = null;
      this._updateCallButtonStates(false);
    }

    /**
     * Update call button visibility states
     * @param {boolean} inCall - Whether currently in a call
     * @param {string} callType - 'audio' or 'video' - which button to transform into end button
     * @param {boolean} isOutgoing - Whether this is an outgoing call (not yet answered)
     * @private
     */
    _updateCallButtonStates(inCall, callType = null, isOutgoing = false) {
      // Read state from CallManager
      const activeCalls = this.callManager ? this.callManager.getActiveCalls() : {audio: new Set(), video: new Set()};
      const hasActiveCalls = activeCalls.video.size > 0 || activeCalls.audio.size > 0;
      const pendingCalls = this.callManager && typeof this.callManager.getPendingCalls === 'function'
        ? this.callManager.getPendingCalls()
        : new Set();
      const hasPendingCalls = pendingCalls.size > 0;
      const isActive = inCall || hasActiveCalls;
      const activeUsers = this.chatManager ? this.chatManager.getActiveUsers() : [];
      const hasUsers = activeUsers.length > 0;
      const modes = this.config.callModes;
      
      // Get the buttons container
      const buttonsContainer = this.shadowRoot.getElementById('call-buttons-container');
      
      // If there's a pending incoming call, don't show any buttons (prompt is shown)
      if (hasPendingCalls) {
        if (this.audioCallButton) {
          this.audioCallButton.classList.remove('visible');
        }
        if (this.videoCallButton) {
          this.videoCallButton.classList.remove('visible');
        }
        if (this.endCallButton) {
          this.endCallButton.classList.remove('visible');
        }
        return;
      }
      
      // Restore buttons container if it was cleared by incoming call prompt
      if (buttonsContainer && buttonsContainer.children.length === 0) {
        // Recreate the buttons
        if (this.audioCallButton && !buttonsContainer.contains(this.audioCallButton)) {
          buttonsContainer.appendChild(this.audioCallButton);
        }
        if (this.videoCallButton && !buttonsContainer.contains(this.videoCallButton)) {
          buttonsContainer.appendChild(this.videoCallButton);
        }
        if (this.endCallButton && !buttonsContainer.contains(this.endCallButton)) {
          buttonsContainer.appendChild(this.endCallButton);
        }
      }
      
      if (isActive && callType) {
        if (isOutgoing) {
          // Outgoing call - show "Cancel" button
          if (callType === 'audio' && this.audioCallButton) {
            this.audioCallButton.textContent = 'Cancel';
            this.audioCallButton.className = 'call-button cancel visible';
            if (this.videoCallButton) {
              this.videoCallButton.classList.remove('visible');
            }
            if (this.endCallButton) {
              this.endCallButton.classList.remove('visible');
            }
          } else if (callType === 'video' && this.videoCallButton) {
            this.videoCallButton.textContent = 'Cancel';
            this.videoCallButton.className = 'call-button cancel visible';
            if (this.audioCallButton) {
              this.audioCallButton.classList.remove('visible');
            }
            if (this.endCallButton) {
              this.endCallButton.classList.remove('visible');
            }
          }
        } else {
          // Active call - show "End" button
          if (this.endCallButton) {
            this.endCallButton.classList.add('visible');
          }
          if (this.audioCallButton) {
            this.audioCallButton.classList.remove('visible');
          }
          if (this.videoCallButton) {
            this.videoCallButton.classList.remove('visible');
          }
        }
      } else if (isActive && !callType) {
        // Use the separate end button if we don't know which button was clicked
        if (this.endCallButton) {
          this.endCallButton.classList.add('visible');
        }
        if (this.audioCallButton) {
          this.audioCallButton.classList.remove('visible');
        }
        if (this.videoCallButton) {
          this.videoCallButton.classList.remove('visible');
        }
      } else {
        // Not in a call - restore button states
        if (this.audioCallButton) {
          this.audioCallButton.textContent = 'Audio';
          this.audioCallButton.className = 'call-button audio-call';
        }
        if (this.videoCallButton) {
          this.videoCallButton.textContent = 'Video';
          this.videoCallButton.className = 'call-button video-call';
        }
        if (this.endCallButton) {
          this.endCallButton.classList.remove('visible');
        }
        
        // Show call buttons based on call modes and active users
        if (hasUsers) {
          if (modes === 'both') {
            if (this.audioCallButton) {
              this.audioCallButton.classList.add('visible');
            }
            if (this.videoCallButton) {
              this.videoCallButton.classList.add('visible');
            }
          } else if (modes === 'audio') {
            if (this.audioCallButton) {
              this.audioCallButton.classList.add('visible');
            }
          } else if (modes === 'video') {
            if (this.videoCallButton) {
              this.videoCallButton.classList.add('visible');
            }
          }
        }
      }
    }
    /**
     * ChatUIInterface implementation: Get configuration for this UI component
     * @returns {Object} Configuration object
     */
    getConfig() {
      return { ...this.config };
    }
    
    /**
     * Get or set the call timeout in milliseconds
     * @param {number} timeout - Timeout in milliseconds (default: 15000)
     * @returns {number} Current call timeout
     */
    get callTimeout() {
      return this.config.callTimeout;
    }
    
    set callTimeout(timeout) {
      if (typeof timeout === 'number' && timeout > 0) {
        this.config.callTimeout = timeout;
        // Update manager if it exists
        if (this.callManager) {
          this.callManager.options.callTimeout = timeout;
        }
      } else {
        console.warn('callTimeout must be a positive number');
      }
    }

    /**
     * Get or set the storage adapter for persistence
     * @param {StorageAdapter} adapter - Storage adapter instance
     * @returns {StorageAdapter} Current storage adapter (or fallback to localStorage)
     */
    get storage() {
      // Return injected storage or create a fallback adapter
      if (!this._storage && typeof window !== 'undefined' && window.localStorage) {
        // Fall back to localStorage directly if adapter not injected
        this._storage = {
          getItem: (key) => {
            try {
              return localStorage.getItem(key);
            } catch (e) {
              return null;
            }
          },
          setItem: (key, value) => {
            try {
              localStorage.setItem(key, value);
            } catch (e) {
              // Ignore storage errors
            }
          },
          removeItem: (key) => {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              // Ignore storage errors
            }
          }
        };
      }
      return this._storage;
    }
    set storage(adapter) {
      this._storage = adapter;
    }

    /**
     * Get or set whether room name is visible
     * @param {boolean} show - Whether to show the room name
     * @returns {boolean} Current showRoom setting
     */
    get showRoom() {
      return this.config.showRoom;
    }
    set showRoom(show) {
      this.config.showRoom = show;
      const roomDisplay = this.shadowRoot.getElementById('room-display');
      if (roomDisplay) {
        if (show) {
          roomDisplay.classList.remove('hidden');
        } else {
          roomDisplay.classList.add('hidden');
        }
      }
    }

    /**
     * Get or set whether room changes are allowed
     * @param {boolean} allow - Whether to allow room changes
     * @returns {boolean} Current allowRoomChange setting
     */
    get allowRoomChange() {
      return this.config.allowRoomChange;
    }
    set allowRoomChange(allow) {
      this.config.allowRoomChange = allow;
      // Update ChatHeader component config
      if (this.chatHeaderComponent) {
        this.chatHeaderComponent.config.allowRoomChange = allow;
        // Update the room input read-only state
        const roomInput = this.chatHeaderComponent.shadowRoot.getElementById('room-name');
        if (roomInput) {
          roomInput.readOnly = !allow;
        }
      }
    }

    /**
     * Get or set call modes ('audio' | 'video' | 'both')
     * @param {string} modes - Call modes to expose
     * @returns {string} Current call modes
     */
    get callModes() {
      return this.config.callModes;
    }
    set callModes(modes) {
      if (['audio', 'video', 'both'].includes(modes)) {
        this.config.callModes = modes;
        this._updateCallButtonVisibility();
      } else {
        console.warn('callModes must be "audio", "video", or "both"');
      }
    }

    /**
     * Get or set custom video display component class
     * @param {Function} componentClass - Custom VideoStreamDisplay-compatible component class
     * @returns {Function|null} Current video display component class
     */
    get videoDisplayComponent() {
      return this.config.videoDisplayComponent;
    }
    set videoDisplayComponent(componentClass) {
      this.config.videoDisplayComponent = componentClass;
      // Reinitialize video display if RTC is already set
      if (this._rtc && this.chatVideo) {
        const VideoComponent = componentClass || VideoStreamDisplay;
        this.videoDisplay = new VideoComponent(this.chatVideo, {
          localVideoSize: '25%',
          localVideoPosition: 'top-right'
        });
      }
    }

    get rtc(){return this._rtc}
    set rtc(rtc){
      this._rtc = rtc;
      this.name = rtc.name;
      
      // Update name in ChatHeader component
      if (this.chatHeaderComponent) {
        this.chatHeaderComponent.setName(this.name);
      }
      
      // Store base topic and extract room from full topic
      const baseTopic = rtc.baseTopic || '';
      const fullTopic = rtc.topic || '';
      
      // Update state
      this.state.set('baseTopic', baseTopic);
      
      // Extract room name from full topic (baseTopic/room or just room)
      let roomName = fullTopic;
      if (baseTopic && fullTopic.startsWith(baseTopic)) {
        // Remove base topic and separator (usually '/')
        const separator = fullTopic[baseTopic.length] || '/';
        roomName = fullTopic.substring(baseTopic.length + separator.length);
      }
      this.state.set('currentRoom', roomName);
      
      // Display prefix as text and room name in input box
      const separator = baseTopic && fullTopic.startsWith(baseTopic) 
        ? fullTopic[baseTopic.length] || '/' 
        : '';
      const prefix = baseTopic ? `${baseTopic}${separator}` : '';
      
      // Update room in ChatHeader component
      if (this.chatHeaderComponent) {
        this.chatHeaderComponent.setRoom(roomName);
        this.chatHeaderComponent.setRoomPrefix(prefix);
      }
      
      // Initialize managers with RTC client (using config and this as UI interface)
      this.callManager = new CallManager(rtc, { 
        callTimeout: this.config.callTimeout,
        callUI: this, // ChatBox implements CallUIInterface
        videoDisplay: this.videoDisplay, // VideoStreamDisplay implements StreamDisplayInterface
        audioDisplay: this.audioDisplay, // AudioStreamDisplay implements StreamDisplayInterface
        ringer: this.ringer, // CallRinger implements RingerInterface
        notifications: this.notificationSound // NotificationSound implements NotificationInterface
      });
      this.chatManager = new ChatManager(rtc, {
        name: this.name,
        primaryUserColor: this.config.primaryUserColor,
        userColors: [...this.config.userColors],
        chatUI: this, // ChatBox implements ChatUIInterface
        notifications: this.notificationSound // NotificationSound implements NotificationInterface
      });
      
      // Initialize CallManagement with CallManager
      if (this.callManagementContainer) {
        this.callManagement = new CallManagement(this.callManagementContainer, this.callManager);
      }
      
      // Subscribe to manager events (not RTC events directly)
      this._setupManagerEventListeners();
      
      // Load history from ChatManager
      const history = this.chatManager.getHistory();
      history.forEach((entry) => this.appendMessage(entry));
      
      // Update active users display
      this._updateActiveUsersDisplay();
    }
    
    /**
     * Setup event listeners for managers
     * @private
     */
    _setupManagerEventListeners() {
      // ChatManager events
      this.chatManager.on('message', ({data, sender, timestamp}) => {
        this.appendMessage({data, sender, timestamp});
      });
      
      this.chatManager.on('userconnected', ({user}) => {
        this._updateActiveUsersDisplay();
        this._updateCallButtonVisibility();
      });
      
      this.chatManager.on('userdisconnected', ({user}) => {
        this._updateActiveUsersDisplay();
        this._updateCallButtonVisibility();
      });
      
      // CallManager events
      this.callManager.on('incomingcall', ({peerName, callInfo, promises}) => {
        this._handleIncomingCall(peerName, callInfo, promises);
        // Hide start call buttons when incoming call appears
        this._updateCallButtonVisibility();
      });
      
      this.callManager.on('callconnected', ({sender, localStream, remoteStream, type}) => {
        this._handleCallConnected(sender, localStream, remoteStream, type);
      });
      
      this.callManager.on('callended', ({peerName}) => {
        // Hide any incoming call prompt when call ends
        this.hideIncomingCallPrompt(peerName);
        this._handleCallEnded(peerName);
      });
      
      this.callManager.on('calltimeout', ({peerName, direction}) => {
        // Hide incoming call prompt on timeout
        this.hideIncomingCallPrompt(peerName);
        this._handleCallTimeout(peerName, direction);
      });
      
      this.callManager.on('callrejected', ({user}) => {
        this._showCallDeclinedMessage(user);
      });
      
      this.callManager.on('mutechanged', () => {
        // CallManagement handles this automatically
      });
    }
    
    finishRoomEdit(room = null) {
      // If room is provided, use it (from ChatHeader event)
      // Otherwise, get it from ChatHeader component
      let newRoom = room;
      if (!newRoom && this.chatHeaderComponent) {
        // Get room from ChatHeader component's shadow DOM
        const roomInput = this.chatHeaderComponent.shadowRoot.getElementById('room-name');
        newRoom = roomInput ? roomInput.value.trim() : null;
      }
      
      if (!newRoom) return;
      
      const currentRoom = this.state.get('currentRoom');
      if (newRoom && newRoom !== currentRoom) {
        this.state.set('currentRoom', newRoom);
        // Update ChatHeader component
        if (this.chatHeaderComponent) {
          this.chatHeaderComponent.setRoom(newRoom);
        }
        // Dispatch event for parent to handle reconnection
        this.dispatchEvent(new CustomEvent('roomchange', {
          detail: { room: newRoom },
          bubbles: true
        }));
      }
    }
    
    cancelRoomEdit() {
      // Restore original value from state
      const currentRoom = this.state.get('currentRoom');
      if (this.chatHeaderComponent) {
        this.chatHeaderComponent.setRoom(currentRoom);
      }
    }
    /**
     * @deprecated Use ChatManager directly. Kept for backward compatibility.
     */
    receiveRTCChat(message, sender){
      // This is now handled by ChatManager events
    }
    
    /**
     * Set message history (delegates to ChatManager)
     */
    setHistory(history){
      if (this.chatManager) {
        // ChatManager manages history internally
        // Just render the messages
        history.forEach((entry) => this.appendMessage(entry));
      }
    }

    /**
     * @deprecated Use ChatManager.sendMessage() directly
     */
    send(message){
      if (this.chatManager) {
        this.chatManager.sendMessage(message);
      } else {
        console.warn("No chat manager available");
    }
    }

    toggleChat() {
      this.chatBody.classList.toggle('visible');
    }

    /**
     * ChatUIInterface implementation: Get the current message input value
     * @returns {string} Current input value
     */
    getMessageInput() {
      return this.messageInputComponent ? this.messageInputComponent.getValue() : '';
    }

    /**
     * ChatUIInterface implementation: Clear the message input
     */
    clearMessageInput() {
      if (this.messageInputComponent) {
        this.messageInputComponent.clear();
      }
    }

    /**
     * ChatUIInterface implementation: Enable or disable the message input
     * @param {boolean} enabled - Whether input should be enabled
     */
    setInputEnabled(enabled) {
      if (this.messageInputComponent) {
        this.messageInputComponent.setEnabled(enabled);
      }
    }

    sendMessage(data) {
      data = data || this.getMessageInput();
      if (this.chatManager) {
        this.chatManager.sendMessage(data);
        // Message will appear via ChatManager 'message' event
        // But we also show it immediately for better UX
        if (this.messagesComponent) {
          this.messagesComponent.appendMessage({ 
            data, 
            sender: this.name + "( You )", 
            timestamp: Date.now(),
            isOwn: true
          });
        }
      }
      this.clearMessageInput();
    }

    /**
     * ChatUIInterface implementation: Display a chat message
     * @param {Object} messageData - {data: string, sender: string, timestamp: number}
     */
    displayMessage(messageData) {
      if (this.messagesComponent) {
        const isOwn = messageData.sender && messageData.sender.includes('( You )');
        this.messagesComponent.appendMessage({
          ...messageData,
          isOwn
        });
      }
    }

    appendMessage({ data, sender, timestamp }) {
      // Delegate to MessagesComponent
      if (this.messagesComponent) {
        const isOwn = sender && sender.includes('( You )');
        this.messagesComponent.appendMessage({ data, sender, timestamp, isOwn });
      }
    }

    /**
     * @deprecated Use ChatManager 'userconnected' event. Kept for backward compatibility.
     */
    onConnectedToUser(user) {
      // This is now handled by ChatManager events
      // But we still need to update UI
      this._updateActiveUsersDisplay();
    }
    
    /**
     * ChatUIInterface implementation: Update the active users display
     * @param {Array<string>} users - List of active user names
     */
    updateActiveUsers(users) {
      if (this.activeUsersComponent) {
        const getUserColor = this.chatManager 
          ? (user) => this.chatManager.getUserColor(user)
          : null;
        this.activeUsersComponent.updateUsers(users, getUserColor);
      }
      
      // Enable inputs when someone connects
      this.updateInputState();
      
      // Show call-management section when users connect
      const hasUsers = users.length > 0;
      const activeCalls = this.callManager ? this.callManager.getActiveCalls() : {audio: new Set(), video: new Set()};
      const hasActiveCalls = activeCalls.video.size > 0 || activeCalls.audio.size > 0;
      const pendingCalls = this.callManager && typeof this.callManager.getPendingCalls === 'function'
        ? this.callManager.getPendingCalls()
        : new Set();
      const hasPendingCalls = pendingCalls.size > 0;
      
      if (this.callManagementContainer) {
        if (hasUsers || hasActiveCalls || hasPendingCalls) {
          this.callManagementContainer.classList.remove('hidden');
          this.callManagementContainer.style.display = 'flex';
          console.log('Call management section shown, hasUsers:', hasUsers, 'hasActiveCalls:', hasActiveCalls, 'hasPendingCalls:', hasPendingCalls);
        } else {
          this.callManagementContainer.classList.add('hidden');
          console.log('Call management section hidden');
        }
      } else {
        console.warn('callManagementContainer not found!');
      }
      
      // Update call button visibility
      this._updateCallButtonVisibility();
    }

    /**
     * Update active users display from ChatManager
     * @private
     */
    _updateActiveUsersDisplay() {
      if (!this.chatManager) {
        return;
      }
      
      // Delegate to interface method
      const activeUsers = this.chatManager ? this.chatManager.getActiveUsers() : [];
      console.log('ChatBox: Updating active users display with', activeUsers);
      this.updateActiveUsers(activeUsers);
    }


    /**
     * @deprecated Use ChatManager 'userdisconnected' event. Kept for backward compatibility.
     */
    onDisconnectedFromUser(user) {
      // This is now handled by ChatManager events
      // But we still need to update UI
      this._updateActiveUsersDisplay();
      
      // CallManager handles ending calls when users disconnect
      // Just update UI
      this._updateCallButtonStates(false);
    }
    
    updateInputState() {
      const activeUsers = this.chatManager ? this.chatManager.getActiveUsers() : [];
      const hasOtherUsers = activeUsers.length > 0;
      this.setInputEnabled(hasOtherUsers);
    }

    /**
     * CallUIInterface implementation: Display an incoming call prompt
     * @param {string} peerName - Name of the caller
     * @param {Object} callInfo - {video: boolean, audio: boolean}
     * @returns {Promise<boolean>} Promise that resolves to true to accept, false to reject
     */
    showIncomingCallPrompt(peerName, callInfo) {
      console.log('Incoming call from', peerName, 'callInfo:', callInfo);
      
      // Display prompt in CallManagement component
      if (this.callManagement && typeof this.callManagement.showIncomingCallPrompt === 'function') {
        return this.callManagement.showIncomingCallPrompt(peerName, callInfo);
      }
      
      // Fallback: auto-accept if CallManagement not available
      return Promise.resolve(true);
    }

    /**
     * CallUIInterface implementation: Hide/remove the incoming call prompt
     * @param {string} peerName - Name of the caller
     */
    hideIncomingCallPrompt(peerName) {
      // Hide prompt in CallManagement component
      if (this.callManagement && typeof this.callManagement.hideIncomingCallPrompt === 'function') {
        this.callManagement.hideIncomingCallPrompt(peerName);
      }
    }

    /**
     * CallUIInterface implementation: Display a missed call notification
     * @param {string} peerName - Name of the peer
     * @param {string} direction - 'incoming' or 'outgoing'
     */
    showMissedCallNotification(peerName, direction) {
      // Show in call management, not messages
      if (this.callManagement && typeof this.callManagement.showMissedCallNotification === 'function') {
        this.callManagement.showMissedCallNotification(peerName, direction);
      }
    }

    /**
     * CallUIInterface implementation: Display a call declined notification
     * @param {string} peerName - Name of the peer who declined
     */
    showCallDeclinedNotification(peerName) {
      // Show in call management, not messages
      if (this.callManagement && typeof this.callManagement.showCallDeclinedNotification === 'function') {
        this.callManagement.showCallDeclinedNotification(peerName);
      }
    }

    /**
     * CallUIInterface implementation: Update call button states
     * @param {Object} state - {inCall: boolean, callType: string|null, isOutgoing: boolean}
     */
    updateCallButtonStates(state) {
      this._updateCallButtonStates(
        state.inCall, 
        state.callType || null, 
        state.isOutgoing || false
      );
    }

    /**
     * Handle incoming call from CallManager
     * @private
     */
    _handleIncomingCall(peerName, callInfo, promises) {
      // Delegate to interface method
      return this.showIncomingCallPrompt(peerName, callInfo);
    }
    
    /**
     * @deprecated Use _handleIncomingCall via CallManager events. Kept for backward compatibility.
     */
    onIncomingCall(peerName, callInfo, promises) {
      // This is now handled by CallManager events
      return this._handleIncomingCall(peerName, callInfo, promises);
    }
    
    /**
     * Handle call connected from CallManager
     * @private
     */
    _handleCallConnected(sender, localStream, remoteStream, type) {
      console.log(`${type} call connected with ${sender}`);
      
      // Stop ringing
      this.ringer.stop();
      
      // Hide incoming call prompt if it exists
      this.hideIncomingCallPrompt(sender);
      
      // Only set streams if they are valid MediaStream objects
      if (type === 'audio') {
        if (localStream instanceof MediaStream || remoteStream instanceof MediaStream) {
          this.audioDisplay.setStreams(sender, { localStream, remoteStream });
        }
        // Update pinned audio call message
        this._updatePinnedAudioCallMessage();
      } else {
        // Video call
        if (localStream instanceof MediaStream || remoteStream instanceof MediaStream) {
          this.videoDisplay.setStreams(sender, { localStream, remoteStream });
          // Show video container
          if (this.chatVideo) {
            this.chatVideo.classList.add('visible');
            console.log('Video container displayed');
          }
        } else {
          console.warn(`Invalid streams for video call:`, { localStream, remoteStream });
        }
      }
      
      // Show call controls
      this._updateCallControlsVisibility();
      
      // Update button states
      this._updateCallButtonStates(true, type);
    }
    
    /**
     * @deprecated Use _handleCallConnected via CallManager events. Kept for backward compatibility.
     */
    onCallConnected(sender, localStream, remoteStream, type) {
      // This is now handled by CallManager events
      this._handleCallConnected(sender, localStream, remoteStream, type);
    }
    
    /**
     * Handle call ended from CallManager
     * @private
     */
    _handleCallEnded(peerName) {
      // Stop ringing if call ends (including cancelled calls)
      if (this.ringer && typeof this.ringer.stop === 'function') {
        this.ringer.stop();
      }
      
      // Cleanup streams
      this.videoDisplay.removeStreams(peerName);
      this.audioDisplay.removeStreams(peerName);
      
      // Get current state from CallManager
      const activeCalls = this.callManager ? this.callManager.getActiveCalls() : {audio: new Set(), video: new Set()};
      const hasActiveCalls = activeCalls.video.size > 0 || activeCalls.audio.size > 0;
      
      // Hide video container if no active video calls
      if (activeCalls.video.size === 0 && this.chatVideo) {
        this.chatVideo.classList.remove('visible');
        console.log('Video container hidden');
      }
      
      // Update pinned audio call message
      this._updatePinnedAudioCallMessage();
      
      // Reset call type
      this.activeCallType = null;
      
      // Update call controls visibility (this will hide controls if no active calls)
      this._updateCallControlsVisibility();
      
      // Update button states based on actual call state (will show start buttons if no active calls)
      this._updateCallButtonStates(hasActiveCalls);
      
      // Update button visibility to restore start call buttons if no active calls
      this._updateCallButtonVisibility();
      
      // Update CallManagement UI
      if (this.callManagement && typeof this.callManagement._updateFromCallManager === 'function') {
        this.callManagement._updateFromCallManager();
      }
    }
    
    /**
     * @deprecated Use _handleCallEnded via CallManager events. Kept for backward compatibility.
     */
    onCallEnded(peerName) {
      // This is now handled by CallManager events
      this._handleCallEnded(peerName);
    }
    
    /**
     * Legacy onIncomingCall implementation (kept for reference)
     * @deprecated
     */
    _legacyOnIncomingCall(peerName, callInfo, promises) {
      // Set up timeout for unanswered incoming call
      let timeoutId = setTimeout(() => {
        console.log(`Incoming call from ${peerName} timed out after ${this.config.callTimeout}ms`);
        // Stop ringing
        this.ringer.stop();
        // Show missed call message
        this._showMissedCallMessage(peerName, 'incoming');
        // Remove pending call
        const pendingCall = this.pendingCalls.get(peerName);
        if (pendingCall) {
          // Remove prompt if it exists
          if (pendingCall.promptElement) {
            try {
              pendingCall.promptElement.remove();
            } catch (err) {
              console.warn('Could not remove prompt element:', err);
            }
          }
          this.pendingCalls.delete(peerName);
        }
        // Properly end the call to stop streams on both sides
        if (this._rtc) {
          try {
            this._rtc.endCallWithUser(peerName);
          } catch (err) {
            console.warn('Error ending timed out call:', err);
          }
        }
        // Clean up any streams that might have started
        this.videoDisplay.removeStreams(peerName);
        this.audioDisplay.removeStreams(peerName);
        this.activeVideoCalls.delete(peerName);
        this.activeAudioCalls.delete(peerName);
        this.localStreams.delete(peerName);
        
        // Update call controls visibility (will remove if no active calls)
        this._updateCallControlsVisibility();
      }, this.config.callTimeout);
      
      // Track pending call with timeout ID
      this.pendingCalls.set(peerName, { callInfo, promises, timeoutId });
      
      // Auto-accept calls (could be made configurable)
      // The RTC client expects this handler to return a Promise that resolves to true to accept
      // The actual stream handling will happen in the 'callconnected' event
      // Also listen to the start promise to stop ringing when call connects
      promises.start.then(({ localStream, remoteStream }) => {
        // Clear timeout since call was answered
        const pendingCall = this.pendingCalls.get(peerName);
        if (pendingCall && pendingCall.timeoutId) {
          clearTimeout(pendingCall.timeoutId);
          pendingCall.timeoutId = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        // Stop ringing when call is answered
        this.ringer.stop();
        this.pendingCalls.delete(peerName);
        console.log(`Call start promise resolved for ${peerName}`);
      }).catch(err => {
        // Clear timeout from pendingCalls
        const pendingCall = this.pendingCalls.get(peerName);
        if (pendingCall && pendingCall.timeoutId) {
          clearTimeout(pendingCall.timeoutId);
          pendingCall.timeoutId = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        // Stop ringing if call is rejected or fails
        this.ringer.stop();
        this.pendingCalls.delete(peerName);
        console.error(`Call start promise rejected for ${peerName}:`, err);
      });
      
      // Return Promise.resolve(true) to accept the call
      // The RTC client will then get media and fire 'callconnected' event
      return Promise.resolve(true);
    }

    onCallEnded(peerName) {
      // Stop ringing if call ends (including cancelled calls)
      this.ringer.stop();
      
      // Get pending call info before deleting
      const pendingCall = this.pendingCalls.get(peerName);
      
      // Remove pending call
      this.pendingCalls.delete(peerName);
      
      // Clean up outgoing call if it exists
      const outgoingCall = this.outgoingCalls.get(peerName);
      if (outgoingCall) {
        // Clear timeout if it exists
        if (outgoingCall.timeoutId) {
          clearTimeout(outgoingCall.timeoutId);
        }
        this.outgoingCalls.delete(peerName);
      }
      
      // If there was a pending call with a prompt element, remove it
      if (pendingCall && pendingCall.promptElement) {
        try {
          pendingCall.promptElement.remove();
        } catch (err) {
          console.warn('Could not remove prompt element:', err);
        }
      }
      
      // Cleanup streams
      this.videoDisplay.removeStreams(peerName);
      this.audioDisplay.removeStreams(peerName);
      this.activeVideoCalls.delete(peerName);
      this.activeAudioCalls.delete(peerName);
      this.localStreams.delete(peerName);
      
      // Update pinned audio call message
      this._updatePinnedAudioCallMessage();
      
      // Update call controls visibility
      this._updateCallControlsVisibility();
      
      // Reset call type
      this.activeCallType = null;
      
      // Update button states
      this._updateCallButtonStates(false);
    }

    /**
     * Show a missed call notification message
     * @param {string} peerName - Name of the peer
     * @param {string} direction - 'incoming' or 'outgoing'
     * @private
     * @deprecated Use showMissedCallNotification which delegates to CallManagement
     */
    _showMissedCallMessage(peerName, direction) {
      // Delegate to CallManagement (not messages)
      this.showMissedCallNotification(peerName, direction);
    }

    /**
     * Show a call declined notification message
     * @param {string} peerName - Name of the peer who declined
     * @private
     * @deprecated Use showCallDeclinedNotification which delegates to CallManagement
     */
    _showCallDeclinedMessage(peerName) {
      // Delegate to CallManagement (not messages)
      this.showCallDeclinedNotification(peerName);
    }

    /**
     * Update or remove the pinned audio call message
     * @private
     */
    _updatePinnedAudioCallMessage() {
      const hasAudioCalls = this.activeAudioCalls.size > 0;
      
      if (hasAudioCalls) {
        // Create or update pinned message
        if (!this.pinnedAudioCallMessage) {
          this.pinnedAudioCallMessage = document.createElement('div');
          this.pinnedAudioCallMessage.id = 'pinned-audio-call-message';
          this.pinnedAudioCallMessage.className = 'pinned-audio-call';
          
          // Insert at the top of messages
          const messagesEl = this.messages;
          if (messagesEl && messagesEl.firstChild) {
            messagesEl.insertBefore(this.pinnedAudioCallMessage, messagesEl.firstChild);
          } else if (messagesEl) {
            messagesEl.appendChild(this.pinnedAudioCallMessage);
          }
        }
        
        // Update message content with list of active audio calls
        const callList = Array.from(this.activeAudioCalls).join(', ');
        const callCount = this.activeAudioCalls.size;
        this.pinnedAudioCallMessage.textContent = `🔊 Audio call active${callCount > 1 ? 's' : ''} with: ${callList}`;
        this.pinnedAudioCallMessage.classList.remove('hidden');
      } else {
        // Remove pinned message if no audio calls
        if (this.pinnedAudioCallMessage) {
          try {
            this.pinnedAudioCallMessage.remove();
          } catch (err) {
            // Element may have already been removed
          }
          this.pinnedAudioCallMessage = null;
        }
      }
    }

    onCallConnected(sender, {localStream, remoteStream}) {
      // Stop ringing when call connects
      this.ringer.stop();
      
      // Clear timeout from pending calls
      const pendingCall = this.pendingCalls.get(sender);
      if (pendingCall && pendingCall.timeoutId) {
        clearTimeout(pendingCall.timeoutId);
      }
      this.pendingCalls.delete(sender);
      
      console.log('Call connected event with', sender, { 
        localStream, 
        remoteStream,
        localVideoTracks: localStream?.getVideoTracks().length,
        localAudioTracks: localStream?.getAudioTracks().length,
        remoteVideoTracks: remoteStream?.getVideoTracks().length,
        remoteAudioTracks: remoteStream?.getAudioTracks().length
      });
      
      // Determine call type based on stream tracks
      const hasVideo = localStream?.getVideoTracks().length > 0 || 
                       remoteStream?.getVideoTracks().length > 0;
      const hasAudio = localStream?.getAudioTracks().length > 0 || 
                       remoteStream?.getAudioTracks().length > 0;
      
      console.log('Call type detection:', { hasVideo, hasAudio, sender });
      
      // Determine call type for button transformation
      const callType = hasVideo ? 'video' : (hasAudio ? 'audio' : null);
      if (callType) {
        this.activeCallType = callType;
      }
      
      // Update button states to show end call button
      this._updateCallButtonStates(true, callType);
      
      if (hasVideo) {
        // Video call (includes audio)
        console.log('Setting up video call for', sender);
        this.activeVideoCalls.add(sender);
        this.videoDisplay.setStreams(sender, { localStream, remoteStream });
        // Store local stream for mute/video control
        if (localStream instanceof MediaStream) {
          this.localStreams.set(sender, localStream);
        }
        
        // Ensure video container is visible
        if (this.chatVideo) {
          this.chatVideo.classList.add('visible');
          console.log('Video container displayed');
        }
        // Show call controls
        this._updateCallControlsVisibility();
      } else if (hasAudio) {
        // Audio-only call
        console.log('Setting up audio call for', sender);
        this.activeAudioCalls.add(sender);
        this.audioDisplay.setStreams(sender, { localStream, remoteStream });
        // Store local stream for mute control
        if (localStream instanceof MediaStream) {
          this.localStreams.set(sender, localStream);
        }
        // Update pinned audio call message
        this._updatePinnedAudioCallMessage();
        // Show call controls
        this._updateCallControlsVisibility();
      } else {
        console.warn('Call connected but no video or audio tracks detected for', sender);
      }
    }


  }
  customElements.define('chat-box', ChatBox);

  /**
   * Default Configuration Values for RTChat
   * 
   * This file contains all default configuration values with detailed documentation.
   * These defaults are used when creating an RTCConfig instance.
   */

  /**
   * Get the default configuration object
   * @returns {Object} Default configuration object
   */
  function getDefaults() {
    return {
      // ============================================================================
      // IDENTITY CONFIGURATION
      // ============================================================================
      
      /**
       * User's display name
       * - If null, will be auto-generated or loaded from storage
       * - Auto-generated format: "User #123"
       * - Saved to storage for persistence (unless starts with "anon" or "User #")
       * - Cannot contain: (, ), |, or leading/trailing spaces
       */
      name: null,
      
      /**
       * Additional user information to share with peers
       * - Sent during connection handshake
       * - Can include publicKeyString, custom metadata, etc.
       * - Used by peers to make connection decisions
       */
      userInfo: {},
      
      // ============================================================================
      // MQTT CONFIGURATION
      // ============================================================================
      
      mqtt: {
        /**
         * MQTT broker WebSocket URL
         * - Used for signaling (connection establishment)
         * - Format: wss://[username]:[password]@[host]:[port]
         * - Default: Public cloud.shiftr.io broker (no auth required)
         * - Only used briefly for signaling, then direct WebRTC takes over
         */
        broker: 'wss://public:public@public.cloud.shiftr.io',
        
        /**
         * MQTT client ID
         * - Unique identifier for this MQTT connection
         * - If null, auto-generated as: baseTopic + name
         * - Should be unique to avoid connection conflicts
         */
        clientId: null,
        
        /**
         * MQTT username (if broker requires authentication)
         * - Used for authenticated MQTT brokers
         * - Can also be included in broker URL
         */
        username: null,
        
        /**
         * MQTT password (if broker requires authentication)
         * - Used for authenticated MQTT brokers
         * - Can also be included in broker URL
         */
        password: null,
        
        /**
         * Reconnection delay in milliseconds
         * - How long to wait before attempting to reconnect to MQTT broker
         * - Used when connection is lost
         */
        reconnectPeriod: 1000,
        
        /**
         * Connection timeout in milliseconds
         * - Maximum time to wait for MQTT connection to establish
         * - Throws error if connection not established within this time
         */
        connectTimeout: 30000
      },
      
      // ============================================================================
      // WEBRTC CONFIGURATION
      // ============================================================================
      
      webrtc: {
        /**
         * ICE (Interactive Connectivity Establishment) servers
         * - Array of STUN/TURN servers for NAT traversal
         * - STUN: Discovers public IP/port (free, public servers available)
         * - TURN: Relays traffic if direct connection fails (usually requires credentials)
         * - Format: [{ urls: 'stun:server:port' }, { urls: 'turn:server:port', username: 'user', credential: 'pass' }]
         * - Multiple servers provide redundancy and better connection success
         * - Default: Multiple Google STUN servers for reliability
         */
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        
        /**
         * ICE transport policy
         * - 'all': Try both STUN and TURN servers (recommended)
         * - 'relay': Only use TURN servers (more expensive, but works behind strict firewalls)
         * - Use 'relay' if you have TURN servers and want to ensure connectivity
         */
        iceTransportPolicy: 'all',
        
        /**
         * Bundle policy for RTP streams
         * - 'balanced': Balance between compatibility and performance (recommended)
         * - 'max-compat': Maximum compatibility (may use more bandwidth)
         * - 'max-bundle': Maximum bundling (better performance, less compatibility)
         */
        bundlePolicy: 'balanced',
        
        /**
         * RTCP muxing policy
         * - 'require': Require RTCP muxing (recommended, more efficient)
         * - 'negotiate': Allow non-muxed RTCP (for compatibility with older implementations)
         */
        rtcpMuxPolicy: 'require'
      },
      
      // ============================================================================
      // TOPIC/ROOM CONFIGURATION
      // ============================================================================
      
      topic: {
        /**
         * Base topic prefix for MQTT
         * - All messages are published to: baseTopic + separator + room
         * - Used to namespace different applications/instances
         * - Default: 'mrtchat'
         */
        base: 'mrtchat',
        
        /**
         * Room/channel identifier
         * - If null, auto-detected from URL (hostname + pathname)
         * - Users in the same room can discover and connect to each other
         * - Can be any string (sanitized to alphanumeric)
         * - Examples: 'lobby', 'game-room-1', 'private-chat'
         */
        room: null,
        
        /**
         * Separator between base topic and room
         * - Used when constructing full topic: base + separator + room
         * - Default: '/'
         * - Example: 'mrtchat/lobby'
         */
        separator: '/'
      },
      
      // ============================================================================
      // DEPENDENCY INJECTION
      // ============================================================================
      
      /**
       * Storage adapter instance
       * - If null, uses LocalStorageAdapter (browser) or falls back to memory
       * - Allows swapping storage implementations for testing or custom storage
       * - Must implement: getItem(key), setItem(key, value), removeItem(key)
       * - See: src/storage/storage-adapter.js
       */
      storage: null,
      
      /**
       * Crypto API instance
       * - If null, uses window.crypto (browser Web Crypto API)
       * - Allows injecting mock crypto for testing
       * - Must implement: subtle.generateKey(), subtle.sign(), subtle.verify()
       */
      crypto: null,
      
      /**
       * MQTT library instance
       * - If null, auto-loads from CDN (mqtt.js)
       * - Allows injecting custom MQTT library or pre-loaded instance
       * - Must implement: connect(url, options), on('connect'), on('message'), publish()
       */
      mqttLibrary: null,
      
      // ============================================================================
      // COMPRESSION CONFIGURATION
      // ============================================================================
      
      compression: {
        /**
         * Enable message compression
         * - Reduces bandwidth usage for large messages
         * - Uses LZ-String by default
         * - Only compresses messages above threshold
         */
        enabled: true,
        
        /**
         * Compression library to use
         * - 'lz-string': LZ-String (default, good balance)
         * - 'pako': Pako (zlib, better compression, larger library)
         * - 'none': No compression
         */
        library: 'lz-string',
        
        /**
         * Minimum message size to compress (in bytes)
         * - Messages smaller than this are sent uncompressed
         * - Compression has overhead, so small messages aren't worth compressing
         * - Default: 100 bytes
         */
        threshold: 100
      },
      
      // ============================================================================
      // CONNECTION BEHAVIOR
      // ============================================================================
      
      connection: {
        /**
         * Automatically connect to MQTT on client creation
         * - If false, must call client.load() manually
         * - Useful for delayed connection or testing
         */
        autoConnect: true,
        
        /**
         * Automatically reconnect if connection is lost
         * - Attempts to reconnect with exponential backoff
         * - Set to false to handle reconnection manually
         */
        autoReconnect: true,
        
        /**
         * Maximum number of reconnection attempts
         * - Infinity: Keep trying forever (default)
         * - Number: Stop after N attempts
         * - Useful for limiting reconnection attempts
         */
        maxReconnectAttempts: Infinity,
        
        /**
         * Delay between reconnection attempts (milliseconds)
         * - Initial delay before first reconnection attempt
         * - May increase with exponential backoff
         */
        reconnectDelay: 1000,
        
        /**
         * Connection timeout (milliseconds)
         * - Maximum time to wait for initial connection
         * - Throws error if not connected within this time
         */
        connectionTimeout: 30000,
        
        /**
         * Automatically accept all peer connection requests
         * - If true, bypasses connection prompts and accepts all requests
         * - Only applies to SignedMQTTRTCClient (MQTTRTCClient always auto-accepts)
         * - When false, prompts user based on trust levels
         * - Useful for testing, public demos, or trusted environments
         */
        autoAcceptConnections: false
      },
      
      // ============================================================================
      // HISTORY/LOGGING
      // ============================================================================
      
      history: {
        /**
         * Enable message history tracking
         * - Tracks all MQTT messages sent/received
         * - Useful for debugging and message replay
         * - Disable to save memory in production
         */
        enabled: true,
        
        /**
         * Maximum number of messages to keep in history
         * - Older messages are removed when limit is reached
         * - Set to 0 to disable history (saves memory)
         * - Default: 1000 messages
         */
        maxLength: 1000
      },
      
      // ============================================================================
      // TAB MANAGEMENT
      // ============================================================================
      
      tabs: {
        /**
         * Enable multi-tab management
         * - Tracks multiple browser tabs/windows for the same session
         * - Adds tab ID to username to distinguish tabs
         * - Disable if you don't need multi-tab support
         */
        enabled: true,
        
        /**
         * Polling interval for tab keep-alive (milliseconds)
         * - How often to update the "last seen" timestamp
         * - Lower values = more responsive, but more storage writes
         * - Default: 250ms
         */
        pollInterval: 250,
        
        /**
         * Tab timeout (seconds)
         * - Tabs not seen for this long are considered closed
         * - Used to clean up stale tab entries
         * - Default: 300 seconds (5 minutes)
         */
        timeout: 300
      },
      
      // ============================================================================
      // DEBUG/LOGGING
      // ============================================================================
      
      /**
       * Enable debug logging
       * - Logs detailed information about connections, messages, etc.
       * - Useful for development and troubleshooting
       * - Disable in production for better performance
       */
      debug: false,
      
      /**
       * Custom logger function
       * - If provided, used instead of console.log/error
       * - Signature: (level: string, message: string, ...args: any[]) => void
       * - Allows integration with custom logging systems
       * - If null, uses console methods
       */
      logger: null,
      
      // ============================================================================
      // CONNECTION LOADING
      // ============================================================================
      
      /**
       * Auto-load flag
       * - If false, client won't automatically connect
       * - Must call client.load() manually
       * - Default: true (auto-connect)
       */
      load: true
    };
  }

  /**
   * Object Utilities - Helper functions for object manipulation
   * 
   * Provides utilities for deep merging objects and type checking.
   */

  /**
   * Check if a value is a plain object (not array, null, or other types)
   * @param {*} item - Value to check
   * @returns {boolean} True if item is a plain object
   */
  function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Deep merge two objects recursively
   * 
   * Merges source into target, creating a new object. Nested objects are merged
   * recursively rather than being replaced entirely.
   * 
   * @param {Object} target - Target object to merge into
   * @param {Object} source - Source object to merge from
   * @returns {Object} New merged object (target is not modified)
   * 
   * @example
   * const merged = deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 }, e: 4 });
   * // Result: { a: 1, b: { c: 2, d: 3 }, e: 4 }
   */
  function deepMerge(target, source) {
    const output = { ...target };
    
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  /**
   * RTCConfig - Configuration management for RTChat
   * 
   * Centralized configuration system with validation, normalization, and presets.
   * Uses nested configuration format with validation and presets.
   */


  class RTCConfig {
    // Static defaults object - single source of truth
    static getDefaults() {
      return getDefaults();
    }
    
    constructor(userConfig = {}) {
      // Normalize user config (handle common string formats)
      const normalized = this.normalizeUserConfig(userConfig);
      
      // Get defaults from separate file and merge with user config
      const defaults = getDefaults();
      this.config = deepMerge(defaults, normalized);
      
      // Apply computed defaults (functions that need instance context)
      this.applyComputedDefaults();
      
      // Validate configuration
      this.validate();
      
      // Normalize values (e.g., convert single STUN to array)
      this.normalize();
    }
    
    normalizeUserConfig(userConfig) {
      const normalized = { ...userConfig };
      
      // Handle topic as string -> topic.room
      if (typeof userConfig.topic === 'string') {
        normalized.topic = { room: userConfig.topic };
      }
      
      return normalized;
    }
    
    applyComputedDefaults() {
      // Apply defaults that require instance methods (only for dynamic values that can't be in static defaults)
      // These are values that depend on runtime context (localStorage, window.location, etc.)
      if (!this.config.name) {
        this.config.name = this.getDefaultName();
      }
      
      if (!this.config.topic.room) {
        this.config.topic.room = this.getDefaultRoom();
      }
      
      // iceServers is now in the defaults dictionary, so deepMerge will handle it automatically
      // Only need to handle explicit null/empty array cases
      if (this.config.webrtc.iceServers === null || 
          (Array.isArray(this.config.webrtc.iceServers) && this.config.webrtc.iceServers.length === 0)) {
        // User explicitly wants to use defaults, copy from defaults
        this.config.webrtc.iceServers = [...getDefaults().webrtc.iceServers];
      }
    }
    
    getDefaultName() {
      // Try localStorage, then generate
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const stored = localStorage.getItem('rtchat_name') || localStorage.getItem('name');
          if (stored && !stored.startsWith('anon')) {
            return stored;
          }
        } catch (e) {
          // localStorage might not be available
        }
      }
      return `User #${Math.floor(Math.random() * 1000)}`;
    }
    
    getDefaultRoom() {
      // Auto-detect from URL if in browser
      if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname
          .replace(/rtchat\/?/, '')
          .replace(/index\.html$/, '')
          .replace(/\.html$/, '')
          .replace(/[^a-zA-Z0-9]/g, '');
        
        // Skip localhost/127.0.0.1 for room name
        if (!['localhost', '127.0.0.1'].includes(hostname)) {
          return hostname + pathname;
        }
        return pathname || 'default';
      }
      return 'default';
    }
    
    validate() {
      // Validate name
      if (this.config.name) {
        if (this.config.name.includes('(') || this.config.name.includes(')') || this.config.name.includes('|')) {
          throw new Error('Name cannot contain (, ), or |');
        }
        if (this.config.name !== this.config.name.trim()) {
          throw new Error('Name cannot have leading or trailing spaces');
        }
      }
      
      // Validate MQTT broker URL
      if (this.config.mqtt.broker) {
        try {
          new URL(this.config.mqtt.broker);
        } catch (e) {
          throw new Error(`Invalid MQTT broker URL: ${this.config.mqtt.broker}`);
        }
      }
      
      // Validate ICE servers
      if (this.config.webrtc.iceServers) {
        if (!Array.isArray(this.config.webrtc.iceServers)) {
          // Will be normalized to array, but check if it's a valid string
          if (typeof this.config.webrtc.iceServers !== 'string') {
            throw new Error('iceServers must be an array or string');
          }
        }
      }
    }
    
    normalize() {
      // Ensure ICE servers is always an array
      if (!Array.isArray(this.config.webrtc.iceServers)) {
        const server = this.config.webrtc.iceServers;
        if (typeof server === 'string') {
          this.config.webrtc.iceServers = [{ urls: server }];
        } else if (server && server.urls) {
          this.config.webrtc.iceServers = [server];
        } else {
          // Use defaults from defaults file
          this.config.webrtc.iceServers = [...getDefaults().webrtc.iceServers];
        }
      }
      
      // Convert string URLs to object format
      this.config.webrtc.iceServers = this.config.webrtc.iceServers.map(server => {
        if (typeof server === 'string') {
          return { urls: server };
        }
        return server;
      });
      
      // Ensure topic separator is applied correctly
      if (this.config.topic.separator && !this.config.topic.room.includes(this.config.topic.separator)) ;
    }
    
    // Getters for easy access
    get name() { return this.config.name; }
    get broker() { return this.config.mqtt.broker; }
    get iceServers() { return this.config.webrtc.iceServers; }
    get topic() { 
      const sep = this.config.topic.separator || '/';
      return `${this.config.topic.base}${sep}${this.config.topic.room}`;
    }
    get baseTopic() { return this.config.topic.base; }
    get room() { return this.config.topic.room; }
    
    // Get full config object
    getConfig() {
      return this.config;
    }
    
    // Update specific config values
    update(updates) {
      const normalized = this.normalizeUserConfig(updates);
      this.config = deepMerge(this.config, normalized);
      this.applyComputedDefaults();
      this.validate();
      this.normalize();
    }
  }

  /**
   * Storage Adapter - Abstract base class for storage operations
   * 
   * This is an abstract class that must be extended. It defines the interface
   * for storage operations, allowing swapping between localStorage, memory storage,
   * or custom implementations for better testability and flexibility.
   * 
   * @abstract
   * @class StorageAdapter
   * 
   * @example
   * // Extend this class to create a custom storage adapter
   * class MyStorageAdapter extends StorageAdapter {
   *   constructor() {
   *     super(); // Required
   *     // Initialize your storage
   *   }
   *   
   *   getItem(key) {
   *     // Implement getItem
   *   }
   *   
   *   // ... implement other methods
   * }
   */
  class StorageAdapter {
    constructor() {
      // Prevent direct instantiation of abstract class
      if (this.constructor === StorageAdapter) {
        throw new Error('StorageAdapter is an abstract class and cannot be instantiated directly. Extend it instead.');
      }
    }
    
    /**
     * Get an item from storage by key
     * @abstract
     * @param {string} key - The key to retrieve
     * @returns {string|null} The value associated with the key, or null if not found
     */
    getItem(key) {
      throw new Error('getItem must be implemented by subclass');
    }
    
    /**
     * Set an item in storage
     * @abstract
     * @param {string} key - The key to store
     * @param {string} value - The value to store
     */
    setItem(key, value) {
      throw new Error('setItem must be implemented by subclass');
    }
    
    /**
     * Remove an item from storage
     * @abstract
     * @param {string} key - The key to remove
     */
    removeItem(key) {
      throw new Error('removeItem must be implemented by subclass');
    }
    
    /**
     * Clear all items from storage
     * @abstract
     */
    clear() {
      throw new Error('clear must be implemented by subclass');
    }
    
    /**
     * Get the key at the specified index
     * @abstract
     * @param {number} index - The index of the key to retrieve
     * @returns {string|null} The key at the index, or null if not found
     */
    key(index) {
      throw new Error('key must be implemented by subclass');
    }
    
    /**
     * Get the number of items in storage
     * @abstract
     * @returns {number} The number of items
     */
    get length() {
      throw new Error('length must be implemented by subclass');
    }
  }

  /**
   * LocalStorage Adapter - Browser localStorage implementation
   */


  class LocalStorageAdapter extends StorageAdapter {
    constructor() {
      super();
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage is not available in this environment');
      }
      this.storage = window.localStorage;
    }
    
    getItem(key) {
      try {
        return this.storage.getItem(key);
      } catch (e) {
        console.warn('localStorage.getItem failed:', e);
        return null;
      }
    }
    
    setItem(key, value) {
      try {
        this.storage.setItem(key, value);
      } catch (e) {
        console.warn('localStorage.setItem failed:', e);
        // Handle quota exceeded or other errors
        if (e.name === 'QuotaExceededError') {
          throw new Error('Storage quota exceeded');
        }
      }
    }
    
    removeItem(key) {
      try {
        this.storage.removeItem(key);
      } catch (e) {
        console.warn('localStorage.removeItem failed:', e);
      }
    }
    
    clear() {
      try {
        this.storage.clear();
      } catch (e) {
        console.warn('localStorage.clear failed:', e);
      }
    }
    
    key(index) {
      try {
        return this.storage.key(index);
      } catch (e) {
        console.warn('localStorage.key failed:', e);
        return null;
      }
    }
    
    get length() {
      try {
        return this.storage.length;
      } catch (e) {
        return 0;
      }
    }
  }

  /**
   * Tab Manager - Manages multiple tabs/windows for the same session
   * 
   * Uses storage adapter to track active tabs and assign unique IDs
   */

  class TabManager {
    constructor(storage, config) {
      this.storage = storage;
      this.config = config;
      this.tabID = null;
      this.interval = null;
      this.initialize();
    }
    
    initialize() {
      if (!this.config.tabs.enabled) {
        this.tabID = null;
        return;
      }
      
      // Find the id of all the tabs open
      let existingTabs = JSON.parse(this.storage.getItem('tabs') || '[]');
      
      const timeNow = Date.now();
      const timeout = this.config.tabs.timeout * 1000; // Convert to milliseconds
      
      // Clean up stale tabs
      for (let existingTabID of existingTabs) {
        const ts = this.storage.getItem("tabpoll_" + existingTabID);
        if (ts) {
          const lastUpdateTime = new Date(1 * ts);
          if ((lastUpdateTime == "Invalid Date") || ((timeNow - lastUpdateTime) > timeout)) {
            this.storage.removeItem("tabpoll_" + existingTabID);
            existingTabs = existingTabs.filter(v => v !== existingTabID);
            this.storage.setItem('tabs', JSON.stringify(existingTabs));
          }
        } else {
          this.storage.removeItem("tabpoll_" + existingTabID);
          existingTabs = existingTabs.filter(v => v !== existingTabID);
          this.storage.setItem('tabs', JSON.stringify(existingTabs));
        }
      }
      
      existingTabs = JSON.parse(this.storage.getItem('tabs') || '[]');
      
      const maxTabID = existingTabs.length ? (Math.max(...existingTabs)) : -1;
      const minTabID = existingTabs.length ? (Math.min(...existingTabs)) : -1;
      this.tabID = (minTabID < 10) ? (maxTabID + 1) : 0;
      existingTabs.push(this.tabID);
      this.storage.setItem('tabs', JSON.stringify(existingTabs));
      
      // Start polling to keep tab alive
      this.storage.setItem("tabpoll_" + this.tabID, Date.now().toString());
      this.interval = setInterval(() => {
        this.storage.setItem("tabpoll_" + this.tabID, Date.now().toString());
      }, this.config.tabs.pollInterval);
      
      if (this.config.debug) {
        console.log("Tab ID: ", this.tabID);
      }
    }
    
    getTabID() {
      return this.tabID;
    }
    
    cleanup() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      
      if (this.tabID !== null) {
        let existingTabs = JSON.parse(this.storage.getItem('tabs') || '[]');
        existingTabs = existingTabs.filter(v => v !== this.tabID);
        this.storage.setItem('tabs', JSON.stringify(existingTabs));
        this.storage.removeItem("tabpoll_" + this.tabID);
      }
    }
  }

  /**
   * MQTT Library Loader - Handles loading MQTT and compression libraries
   */

  class MQTTLoader {
    constructor(config) {
      this.config = config;
      this.mqtt = null;
      this.compression = null;
      this.loading = false;
    }
    
    async load() {
      if (this.loading) {
        return this.waitForLoad();
      }
      
      this.loading = true;
      
      // If mqttLibrary is provided, use it
      if (this.config.mqttLibrary) {
        this.mqtt = this.config.mqttLibrary;
        this.loading = false;
        return this.mqtt;
      }
      
      // Otherwise, try to load from global or CDN
      if (typeof window !== 'undefined') {
        // Check if already loaded
        if (window.mqtt) {
          this.mqtt = window.mqtt;
          this.loading = false;
          return this.mqtt;
        }
        
        // Load from CDN
        return this.loadFromCDN();
      }
      
      throw new Error('MQTT library not available and cannot be loaded');
    }
    
    loadFromCDN() {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/mqtt/dist/mqtt.min.js";
        script.onload = () => {
          if (window.mqtt) {
            this.mqtt = window.mqtt;
            this.loadCompression().then(() => {
              this.loading = false;
              resolve(this.mqtt);
            });
          } else {
            this.loading = false;
            reject(new Error('MQTT library failed to load'));
          }
        };
        script.onerror = () => {
          this.loading = false;
          reject(new Error('Failed to load MQTT library from CDN'));
        };
        document.head.appendChild(script);
      });
    }
    
    async loadCompression() {
      if (!this.config.compression.enabled) {
        return;
      }
      
      const library = this.config.compression.library;
      
      if (library === 'lz-string') {
        if (window.LZString) {
          this.compression = window.LZString;
          return;
        }
        
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js";
          script.onload = () => {
            if (window.LZString) {
              this.compression = window.LZString;
              resolve();
            } else {
              reject(new Error('LZ-String library failed to load'));
            }
          };
          script.onerror = () => {
            reject(new Error('Failed to load LZ-String library'));
          };
          document.head.appendChild(script);
        });
      }
    }
    
    getMQTT() {
      return this.mqtt;
    }
    
    getCompression() {
      return this.compression;
    }
    
    compress(data) {
      if (!this.compression || !this.config.compression.enabled) {
        return data;
      }
      
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      if (str.length < this.config.compression.threshold) {
        return data;
      }
      
      if (this.compression.compressToUint8Array) {
        return this.compression.compressToUint8Array(str);
      }
      return data;
    }
    
    decompress(data) {
      if (!this.compression || !this.config.compression.enabled) {
        return data;
      }
      
      if (this.compression.decompressFromUint8Array) {
        return this.compression.decompressFromUint8Array(data);
      }
      return data;
    }
    
    waitForLoad() {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.loading && this.mqtt) {
            clearInterval(checkInterval);
            resolve(this.mqtt);
          }
        }, 100);
      });
    }
  }

  /**
   * DeferredPromise - Promise that can be resolved/rejected externally
   */

  class DeferredPromise {
    constructor() {
      this.promise = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }
  }

  /**
   * MQTT-RTC Client Library - Core peer-to-peer communication system
   * 
   * This module provides a complete implementation for establishing peer-to-peer connections
   * using MQTT for signaling and WebRTC for direct communication. It handles connection
   * management, data channels, video/audio calls, and message passing.
   * 
   * Architecture:
   * - BaseMQTTRTCClient: Base class with MQTT and WebRTC connection logic
   * - PromisefulMQTTRTCClient: Adds promise-based APIs for async operations
   * - MQTTRTCClient: High-level client with event callbacks and peer management
   * - RTCConnection: Manages individual WebRTC peer connections
   * - Peer: Convenience wrapper for interacting with a specific peer
   * 
   * Usage:
   *   import { MQTTRTCClient } from './mqtt-rtc.js';
   *   
   *   const client = new MQTTRTCClient({
   *     name: 'MyName',
   *     topic: 'myroom',
   *     broker: 'wss://broker.example.com',
   *     stunServer: 'stun:stun.example.com:19302'
   *   });
   * 
   *   client.on('connectedtopeer', (user) => {
   *     console.log('Connected to', user);
   *   });
   * 
   *   client.on('chat', (message, sender) => {
   *     console.log(`${sender}: ${message}`);
   *   });
   * 
   *   // Send a message to all connected peers
   *   client.sendRTCChat('Hello everyone!');
   * 
   *   // Get a peer object for direct interaction
   *   const peer = client.getPeer('OtherUser');
   *   peer.dm('Private message');
   *   peer.ask('What is 2+2?').then(answer => console.log(answer));
   * 
   * Features:
   * - Automatic connection establishment via MQTT signaling
   * - WebRTC data channels for messaging
   * - Video/audio calling support
   * - Question/answer system for RPC-like communication
   * - Ping/pong for connection health checks
   * - Tab ID management for multiple tabs
   * - Message compression using LZ-String
   * - Connection history tracking
   * 
   * Configuration:
   * - broker: MQTT broker URL (default: public cloud.shiftr.io)
   * - stunServer: STUN server for NAT traversal (default: Google STUN)
   * - baseTopic: Base MQTT topic prefix (default: 'mrtchat')
   * - topic: Room/channel identifier (auto-derived from URL by default)
   * - name: User identifier (auto-generated if not provided)
   * 
   * @module mqtt-rtc
   */




  //______________________________________________________________________________________________________________________



  // EventEmitter is now imported above

  class BaseMQTTRTCClient extends EventEmitter {
    constructor(userConfig){
      super(); // Initialize EventEmitter
      userConfig = userConfig || {};
      
      // Use RTCConfig system (always available now)
      const config = userConfig instanceof RTCConfig ? userConfig : new RTCConfig(userConfig);
      const configObj = config.getConfig();
      
      // Initialize storage adapter
      const storage = userConfig.storage || new LocalStorageAdapter();
      
      // Initialize tab manager
      let tabManager = null;
      if (configObj.tabs.enabled) {
        tabManager = new TabManager(storage, configObj);
      }
      
      // Initialize MQTT loader
      const mqttLoader = new MQTTLoader(configObj);
      
      // Set properties from config
      const tabIDValue = tabManager ? tabManager.getTabID() : null;
      this.name = configObj.name + (tabIDValue ? ('(' + tabIDValue + ')') : '');
      this.userInfo = configObj.userInfo || {};
      this.mqttBroker = configObj.mqtt.broker;
      this.iceServers = configObj.webrtc.iceServers;
      this.baseTopic = configObj.topic.base;
      this.topic = config.topic;
      this.config = config;
      this.storage = storage;
      this.tabManager = tabManager;
      this.mqttLoader = mqttLoader;
      this.maxHistoryLength = configObj.history.maxLength;
      
      // Save name to storage if not anonymous
      if (!configObj.name.startsWith("anon") && !configObj.name.startsWith("User #")) {
        storage.setItem("name", configObj.name);
        storage.setItem("rtchat_name", configObj.name);
      }
      
      // Load flag
      const load = userConfig.load !== false;

      // bind methods to this
      // MQTT methods
      this.load = this.load.bind(this);
      this._onMQTTConnect = this._onMQTTConnect.bind(this);
      this.onConnectedToMQTT = this.onConnectedToMQTT.bind(this);
      this._onMQTTMessage = this._onMQTTMessage.bind(this);
      this.onMQTTMessage = this.onMQTTMessage.bind(this);
      this.beforeunload = this.beforeunload.bind(this);
      this.postPubliclyToMQTTServer = this.postPubliclyToMQTTServer.bind(this);
      for (let [k, v] of Object.entries(this.mqttHandlers)){
          this.mqttHandlers[k] = v.bind(this);
      }
      this.changeName = this.changeName.bind(this);
      this.recordNameChange = this.recordNameChange.bind(this);
      this.onNameChange = this.onNameChange.bind(this);


      // RTC connection methods
      this.shouldConnectToUser = this.shouldConnectToUser.bind(this);
      this.connectToUser = this.connectToUser.bind(this);
      this.connectionToUser = this.connectionToUser.bind(this);
      this.connectionsToUsers = this.connectionsToUsers.bind(this);
      this.disconnectFromUser = this.disconnectFromUser.bind(this);
      this.onConnectedToUser = this.onConnectedToUser.bind(this);
      this.onDisconnectedFromUser = this.onDisconnectedFromUser.bind(this);
      this.onrtcdisconnectedFromUser = this.onrtcdisconnectedFromUser.bind(this);

      // RTC send/receive methods
      this.callUser = this.callUser.bind(this);
      this.callFromUser = this.callFromUser.bind(this);
      this.acceptCallFromUser = this.acceptCallFromUser.bind(this);
      this.oncallconnected = this.oncallconnected.bind(this);
      this.isConnectedToUser = this.isConnectedToUser.bind(this);

      this.sendOverRTC = this.sendOverRTC.bind(this);
      this.onrtcmessage = this.onrtcmessage.bind(this);
      this.onrtcerror = this.onrtcerror.bind(this);

      // initialize state tracking variables
      this.rtcConnections = {};
      this.knownUsers = {};
      this.pendingIceCandidates = {};


      this.mqttHistory = [];
      this.announceInterval = null; // For periodic announcements

      // load the MQTT client
      if (load){
          this.load();
      }
      
      // Optional window.rtc assignment (can be disabled via config)
      const assignToWindow = userConfig.assignToWindow !== false;
      
      if (assignToWindow && typeof window !== 'undefined') {
        if (window.rtc){
          let old = window.rtc;
          console.warn("RTC already exists. Saving old RTC object to window.rtc.old,", old);
          old.name;
          window.rtc = {
              oldName: old,
              name: this
          };
        }else {
          window.rtc = this;
        }
      }
    }
    //________________________________________________________ MQTT BASICS _______________________________________________
    async load(){
      // Use MQTTLoader (always available now)
      await this.mqttLoader.load();
      const mqtt = this.mqttLoader.getMQTT();
      if (!mqtt) {
        throw new Error('MQTT library not available');
      }
      
      const configObj = this.config.getConfig();
      const clientId = configObj.mqtt?.clientId || (this.baseTopic + this.name);
      const mqttOptions = {
        clientId: clientId,
        username: configObj.mqtt.username,
        password: configObj.mqtt.password,
        reconnectPeriod: configObj.mqtt.reconnectPeriod,
        connectTimeout: configObj.mqtt.connectTimeout
      };
      
      this.client = mqtt.connect(this.mqttBroker, mqttOptions);
      this.client.on('connect', this._onMQTTConnect.bind(this));
      this.client.on('message', this._onMQTTMessage.bind(this));
      
      if (typeof window !== 'undefined') {
        window.addEventListener("beforeunload", this.beforeunload.bind(this));
      }
    }
    _onMQTTConnect(){
      this.client.subscribe(this.topic, ((err)=>{
      if (!err) {
          console.log("subscribed to ", this.topic);
          // Send initial connect message immediately after subscription is confirmed
          // This ensures we announce our presence as soon as we're ready to receive messages
          this.postPubliclyToMQTTServer("connect", this.userInfo);
          this.onConnectedToMQTT();
          
          // Also set up periodic announcements to catch any missed connections
          // This handles race conditions when two users connect simultaneously
          // Announce every 3 seconds for the first 15 seconds, then every 30 seconds
          // Only announce if we don't have active connections (to reduce noise)
          let announcementCount = 0;
          this.announceInterval = setInterval(() => {
            // Only send periodic announcements if we have no active connections
            // This reduces unnecessary connect messages when already connected
            const hasActiveConnections = Object.keys(this.rtcConnections).some(user => {
              const conn = this.rtcConnections[user];
              return conn && conn.peerConnection && 
                     (conn.peerConnection.connectionState === "connected" || 
                      conn.peerConnection.connectionState === "completed");
            });
            
            // Only announce if no active connections (removed the "announcementCount < 5" condition)
            if (!hasActiveConnections) {
              this.postPubliclyToMQTTServer("connect", this.userInfo);
            }
            
            announcementCount++;
            // After 5 announcements (15 seconds), switch to less frequent announcements
            if (announcementCount >= 5 && this.announceInterval) {
              clearInterval(this.announceInterval);
              // Switch to less frequent announcements (every 30 seconds, only if no connections)
              this.announceInterval = setInterval(() => {
                const hasActiveConnections = Object.keys(this.rtcConnections).some(user => {
                  const conn = this.rtcConnections[user];
                  return conn && conn.peerConnection && 
                         (conn.peerConnection.connectionState === "connected" || 
                          conn.peerConnection.connectionState === "completed");
                });
                if (!hasActiveConnections) {
                  this.postPubliclyToMQTTServer("connect", this.userInfo);
                }
              }, 30000);
            }
          }, 3000);
      }else {
          console.error("Error subscribing to " + this.topic, err);
      }
      }).bind(this));


    }
      onConnectedToMQTT(){
          console.log("Connected to MQTT: " + this.topic + " as " + this.name);
          this.emit('mqttconnected', this.topic, this.name);
      }
    _onMQTTMessage(t, payloadString){
          if (t === this.topic){
              let payload;
              try{
                  // Use MQTTLoader for decompression
                  const decompressed = this.mqttLoader.decompress(payloadString);
                  payload = typeof decompressed === 'string' ? JSON.parse(decompressed) : decompressed;
              }catch(e){
                  // Fallback to uncompressed if decompression fails
                  payload = JSON.parse(payloadString);
              }
              if (payload.sender === this.name){
                  return;
              }
              let subtopic = payload.subtopic;
              payload.sent = false;
              payload.receiveTimestamp = Date.now();
              this.mqttHistory.push(payload);
              while (this.mqttHistory.length > this.maxHistoryLength){
                  this.mqttHistory.shift();
              }
              // Log removed to reduce console noise
              if (this.mqttHandlers[subtopic]){
                  this.mqttHandlers[subtopic](payload);
              }else {
                  this.onMQTTMessage(subtopic, payload.data, payload.sender, payload.timestamp);
                  console.warn("Unhandled message: " + subtopic, payload);
              }
          }
      }
    onMQTTMessage(subtopic, data, sender, timestamp){
      console.log("Received message from " + sender + " on " + subtopic, data);
      this.emit('mqttmessage', subtopic, data, sender, timestamp);
    }
    beforeunload(){
      this.postPubliclyToMQTTServer("unload", "disconnecting");
      
      // Cleanup tab manager if using new system
      if (this.tabManager) {
        this.tabManager.cleanup();
      }
    }
    
    disconnect(){
      // Cleanup connections
      for (let user of Object.keys(this.rtcConnections)) {
        this.disconnectFromUser(user);
      }
      
      // Stop periodic announcements
      if (this.announceInterval) {
        clearInterval(this.announceInterval);
        this.announceInterval = null;
      }
      
      // Cleanup MQTT client
      if (this.client) {
        this.client.end();
        this.client = null;
      }
      
      // Cleanup tab manager
      if (this.tabManager) {
        this.tabManager.cleanup();
      }
    }
    postPubliclyToMQTTServer(subtopic, data){
      let payload = {
          sender: this.name,
          timestamp: Date.now(),
          subtopic: subtopic,
          data: data
      };
      let payloadString = JSON.stringify(payload);
      payloadString.length;
      
      // Use MQTTLoader's compression if available
      if (this.mqttLoader) {
        const compressed = this.mqttLoader.compress(payloadString);
        if (compressed !== payloadString) {
          payloadString = compressed;
        }
      }
      
      // Reduce logging for frequent messages like ICE candidates
      if (subtopic === "RTCIceCandidate") {
        // Only log null candidates (end of ICE gathering) or log at debug level
        if (!data || data === null) {
          console.log("Sending message to " + this.topic + " subtopic " + subtopic + " (end of ICE gathering)");
        }
        // Otherwise, ICE candidates are sent too frequently to log each one
      } else {
        console.log("Sending message to " + this.topic + " subtopic " + subtopic, data);
      }
      this.client.publish(this.topic, payloadString);
      payload.sent = true;
      this.mqttHistory.push(payload);
      while (this.mqttHistory.length > this.maxHistoryLength){
          this.mqttHistory.shift();
      }
    }

    //____________________________________________________________________________________________________________________
    mqttHandlers = {
      connect: payload => {//connection
          // Log removed to reduce console noise
          
          // Check if we're already connected and the connection is healthy
          const existingConnection = this.rtcConnections[payload.sender];
          if (existingConnection) {
              const connectionState = existingConnection.peerConnection.connectionState;
              const iceConnectionState = existingConnection.peerConnection.iceConnectionState;
              
              // If connection is healthy, ignore this connect message (likely a periodic announcement)
              if (connectionState === "connected" && 
                  (iceConnectionState === "connected" || iceConnectionState === "completed")) {
                  // Log removed to reduce console noise
                  this.knownUsers[payload.sender] = payload.data; // Update user info
                  return;
              }
              
              // Connection exists but is broken, disconnect it
              if (connectionState === "failed" || connectionState === "closed" ||
                  iceConnectionState === "failed" || iceConnectionState === "closed") {
                  console.warn("Connection to " + payload.sender + " is broken, disconnecting");
                  this.disconnectFromUser(payload.sender);
              } else if (connectionState === "new") {
                  // Connection is in "new" state - check if it's been stuck for too long
                  // If it's been more than 10 seconds, allow a retry
                  const connectionAge = Date.now() - (existingConnection.createdAt || 0);
                  if (connectionAge > 10000) {
                      console.warn("Connection to " + payload.sender + " stuck in 'new' state for " + connectionAge + "ms, allowing retry");
                      this.disconnectFromUser(payload.sender);
                      // Fall through to create new connection
                  } else {
                      // Connection is new but not stuck yet, don't interfere
                      this.knownUsers[payload.sender] = payload.data; // Update user info
                      return;
                  }
              } else if (connectionState === "connecting") {
                  // Connection is actively connecting, don't interfere
                  this.knownUsers[payload.sender] = payload.data; // Update user info
                  return;
              } else {
                  // Other states (checking, etc.), allow retry if stuck
                  const connectionAge = Date.now() - (existingConnection.createdAt || 0);
                  if (connectionAge > 15000) {
                      console.warn("Connection to " + payload.sender + " stuck in '" + connectionState + "' state for " + connectionAge + "ms, allowing retry");
                      this.disconnectFromUser(payload.sender);
                      // Fall through to create new connection
                  } else {
                      // Connection is progressing, don't interfere
                      this.knownUsers[payload.sender] = payload.data; // Update user info
                      return;
                  }
              }
          }
          
          this.knownUsers[payload.sender] = payload.data;
          this.shouldConnectToUser(payload.sender, payload.data).then(r => {
              if (r){
                  this.connectToUser(payload.sender);
              }
          });
      },
      nameChange: payload => {//name
          this.recordNameChange(payload.data.oldName, payload.data.newName);
      },
      unload: payload => {
          this.disconnectFromUser(payload.sender);
          delete this.knownUsers[payload.sender];
      },
      RTCOffer: payload => {//rtc offer
          this.shouldConnectToUser(payload.sender, payload.data.userInfo).then(r => {
              if (r){
                  if (payload.data.offer.target != this.name){return}                if (this.rtcConnections[payload.sender]){
                      console.warn("Already have a connection to " + payload.sender + ". Closing and reopening.");
                      this.rtcConnections[payload.sender].close();
                  }
                  this.rtcConnections[payload.sender] = new RTCConnection(this, payload.sender);
                  this.rtcConnections[payload.sender].respondToOffer(payload.data.offer.localDescription);
                  let pendingIceCandidate = this.pendingIceCandidates[payload.sender];
                  if (pendingIceCandidate){
                      console.log("Found pending ice candidate for " + payload.sender);
                      this.rtcConnections[payload.sender].onReceivedIceCandidate(pendingIceCandidate);
                      delete this.pendingIceCandidates[payload.sender];
                  }
              }else {
                  console.warn("Not connecting to " + payload.sender);
                  // TODO: actually reject offer
              }
          });

      },

      RTCIceCandidate: payload => {//rtc ice candidate
          if (payload.data){
              let rtcConnection = this.rtcConnections[payload.sender]; // Using the correct connection
              if (!rtcConnection){
      //            console.error("No connection found for " + payload.sender);
                  this.pendingIceCandidates[payload.sender] = payload.data;
      //            rtcConnection = new RTCConnection(this, payload.sender);
      //            this.rtcConnections[payload.sender] = rtcConnection
              }else {
                  rtcConnection.onReceivedIceCandidate(payload.data);
              }
          }
      },
      RTCAnswer: payload => {//rtc answer
          if (payload.data.target != this.name){return}        let rtcConnection = this.rtcConnections[payload.sender]; // Using the correct connection
          if (!rtcConnection){
              console.error("No connection found for " + payload.sender);
              return
          }
          rtcConnection.receiveAnswer(payload.data.localDescription);
      }
    }
    shouldConnectToUser(user, userInfo){
      return Promise.resolve(true);
    }

    callUser(user, callInfo){
      let callStartPromise;
      if (callInfo instanceof MediaStream){
          let localStream = callInfo;
          // startCall returns a promise that resolves to {localStream, remoteStream}
          callStartPromise = this.rtcConnections[user].startCall(localStream);
      }else {
          callInfo = callInfo || {video: true, audio: true};
          callStartPromise = navigator.mediaDevices.getUserMedia(callInfo).then(localStream => {
              // startCall returns a promise that resolves to {localStream, remoteStream}
              return this.rtcConnections[user].startCall(localStream);
          });
      }
      let callEndPromise = this.rtcConnections[user].callEndPromise.promise;
      return {start: callStartPromise, end: callEndPromise};
    }
    endCallWithUser(user){
      console.log("Ending call with " + user);
      if (this.rtcConnections[user]){
          this.rtcConnections[user].endCall();
      }
    }
    callFromUser(user, callInfo, initiatedCall, promises){
      callInfo = callInfo || {video: true, audio: true};
      if (initiatedCall){
          return navigator.mediaDevices.getUserMedia(callInfo)
      }else {
          return this.acceptCallFromUser(user, callInfo, promises).then(r=> {
              if (r === false || r === null || r === undefined){
                  return Promise.reject("Call rejected");
              }
              // If acceptCallFromUser returns modified callInfo (object), use it
              // Otherwise use the original callInfo
              const mediaCallInfo = (typeof r === 'object' && r !== null && (r.video !== undefined || r.audio !== undefined)) 
                  ? r 
                  : callInfo;
              return navigator.mediaDevices.getUserMedia(mediaCallInfo)
          })
      }
    }
    oncallended(user){
      console.log("Call ended with " + user);
      // Emit the callended event so UI components can react
      this.emit('callended', user);
    }
    acceptCallFromUser(user, callInfo, promises){
       return Promise.resolve(true);
    }
    connectToUser(user){
      if (this.rtcConnections[user]){
          console.warn("Already connected to " + user);
          try{
              this.disconnectFromUser(user);
          }catch{}
          delete this.rtcConnections[user];
      }
      if (!this.connectionToUser(user)){
          this.rtcConnections[user] = new RTCConnection(this, user);
          this.rtcConnections[user].sendOffer();
          return this.rtcConnections[user];
      }
    }
    connectionToUser(user){
      let existingConnection = this.rtcConnections[user];
      if (existingConnection && existingConnection.peerConnection.connectionState === "connected"){
          return existingConnection
      }else if (existingConnection){
          console.warn("Already have a connection to " + user + " but it's not connected.", existingConnection.peerConnection.connectionState);
          if (existingConnection.peerConnection.connectionState == "failed"){
              console.warn("Connection failed. Closing and reopening.");
              this.disconnectFromUser(user);
              return null;
          }


          return existingConnection;

      }
      return null;
    }
    connectionsToUsers(users){
      users = users || Object.keys(this.rtcConnections);
      if (typeof users === "string"){
          users = [users];
      }
      return users.filter(c => this.connectionToUser(c));
    }
    get connectedUsers(){
      return this.connectionsToUsers();
    }
    disconnectFromUser(user){
      console.warn("Closing connection to " + user);
      let rtcConnection = this.rtcConnections[user];
      if (rtcConnection){
          rtcConnection.close();
          delete this.rtcConnections[user];
          console.warn("Closed connection to " + user);
      }else {
          console.warn("No connection to close to " + user);
      }
    }
    onConnectedToUser(user){
      console.log("Connected to user ", user);
      this.emit('connectedtopeer', user);
    }
    isConnectedToUser(user){
      return this.rtcConnections[user] && this.rtcConnections[user].peerConnection.connectionState === "connected";
    }
    onrtcdisconnectedFromUser(user){
      if (!this.rtcConnections[user]){
          console.warn("Already disconnected from" + user);
          return;
      }
      console.log("Disconnected from user ", user);
      delete this.rtcConnections[user];
      this.onDisconnectedFromUser(user);
    }
    onDisconnectedFromUser(user){
      console.log("Disconnected from user ", user);
      this.emit('disconnectedfrompeer', user);
    }

    changeName(newName){
      this.name;
      const tabID = this.tabManager ? this.tabManager.getTabID() : (typeof tabID !== 'undefined' ? tabID : null);
      this.name = newName + (tabID ? ('(' + tabID + ')') : '');
      
      // Use storage adapter if available, otherwise use localStorage
      if (this.storage) {
        this.storage.setItem("name", newName);
        this.storage.setItem("rtchat_name", newName);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem("name", newName);
      }
      
      this.postPubliclyToMQTTServer("nameChange", {oldName: this.name, newName});
    }
    recordNameChange(oldName, newName){
      this.knownUsers[newName] = this.knownUsers[oldName];
      delete this.knownUsers[oldName];
      this.rtcConnections[newName] = this.rtcConnections[oldName];
      delete this.rtcConnections[oldName];
      this.onNameChange(oldName, newName);
    }
      onNameChange(oldName, newName){
          console.log(oldName + " changed name to " + newName);
      }
    //____________________________________________________________________________________________________________________
    sendOverRTC(channel, data, users){
      if (!channel){ throw new Error("No channel specified") }
      if (!this.rtcHandlers[channel]){throw new Error("Unsupported RTC channel: " + channel)}
      let handler = this.rtcHandlers[channel];
      data = data || channel;
      let serializedData = data;
      if (handler && !handler.raw){
          serializedData = (handler.serializer || JSON.stringify)(data);
      }
      for (let user of this.connectionsToUsers(users)){
          if (!this.verifyUser(channel, data, user)){
              console.warn("Not connected to " + user);
              continue;
          }else {
              const sendResult = this.rtcConnections[user].send(channel, serializedData);
              // If send returns a promise (channel not ready), handle it
              if (sendResult && typeof sendResult.then === 'function') {
                  sendResult.catch(err => {
                      console.error(`Failed to send on channel ${channel} to ${user}:`, err);
                  });
              }
          }
      }
    }
    verifyUser(channel, data, user){
      return true;
    }

    //____________________________________________________________________________________________________________________
    rtcHandlers = {
      connectedViaRTC: (data, sender) => { this.onConnectedToUser(sender); },
    }

    onrtcmessage(channel, data, sender){
      let handler = this.rtcHandlers[channel];
      let deserializedData = data;
      if (handler && !handler.raw){
          deserializedData = (handler.deserializer || JSON.parse)(data);
      }
      if (handler){
          handler(deserializedData, sender);
      }else {
          console.warn("No handler found for " + channel);
      }
      // Emit generic RTC message event
      this.emit('rtcmessage', channel, deserializedData, sender);
    }
    onrtcerror(channel, error, sender){
      let handler = this.rtcHandlers[channel];
      if (handler && handler.error){
          handler.error(error, sender);
      }
    }
  }


  class RTCConnection {
      constructor(mqttClient, target){
          // Use iceServers array if available, otherwise fall back to stunServer
          const iceServers = mqttClient.iceServers || 
            (mqttClient.stunServer ? [{ urls: mqttClient.stunServer }] : 
             [{ urls: "stun:stun4.l.google.com:19302" }]);
          
          this.rtcConfiguration = { 
            iceServers: iceServers,
            iceTransportPolicy: mqttClient.config?.getConfig()?.webrtc?.iceTransportPolicy || 'all',
            bundlePolicy: mqttClient.config?.getConfig()?.webrtc?.bundlePolicy || 'balanced',
            rtcpMuxPolicy: mqttClient.config?.getConfig()?.webrtc?.rtcpMuxPolicy || 'require'
          };
          this.target = target;
          this.mqttClient = mqttClient;
          this.dataChannels = {};
          this.createdAt = Date.now(); // Track when connection was created
          this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);
          this.peerConnection.onicecandidate = this.onicecandidate.bind(this);

          this.startCall = this.startCall.bind(this);
          this.onTrack = this.onTrack.bind(this);
          this.sentOffer = false;

          this.streamChannels = ["streamice", "streamoffer", "streamanswer", "endcall"];

          this.dataChannelDeferredPromises = Object.fromEntries(Object.entries(mqttClient.rtcHandlers).map(([name, handler]) => [name, new DeferredPromise()]));
          this.streamChannels.forEach(channel => this.dataChannelDeferredPromises[channel] = new DeferredPromise());

          this.loadPromise = Promise.all(Object.values(this.dataChannelDeferredPromises).map((deferredPromise) => deferredPromise.promise));
          this.loaded = false;
          this.loadPromise.then((() => {this.loaded = true;}).bind(this));

          this.peerConnection.ondatachannel = ((event) => {
              this.registerDataChannel(event.channel);
          }).bind(this);
          this.peerConnection.oniceconnectionstatechange = (function() {
              if (this.peerConnection.iceConnectionState === 'disconnected' ||
                  this.peerConnection.iceConnectionState === 'failed' ||
                  this.peerConnection.iceConnectionState === 'closed') {
                  this.mqttClient.onDisconnectedFromUser(this.target);
              }
          }).bind(this);

          this.pendingStreamIceCandidate = null;
          this.streamConnection = null;
          this.remoteStream = null;
          this.localStream = null;
          this.sendstreamice = false;
          this.initiatedCall = false;
          this.streamConnectionPromise = new DeferredPromise();
          this.streamPromise = new DeferredPromise();
          this.callEndPromise = new DeferredPromise();
          this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};
      }
      registerDataChannel(dataChannel){
          dataChannel.onmessage = ((e) => {
              this.onmessage(e, dataChannel.label);
          }).bind(this);
          dataChannel.onerror = ((e) => {
              this.dataChannelDeferredPromises[dataChannel.label].reject(e);
              this.ondatachannelerror(e, dataChannel.label);
          }).bind(this);
          dataChannel.onopen = ((e) => {
              this.dataChannelDeferredPromises[dataChannel.label].resolve(e);
          }).bind(this);
          this.dataChannels[dataChannel.label] = dataChannel;
      }
      setupDataChannels(){
          for (let [name, dataChannelHandler] of Object.entries(this.mqttClient.rtcHandlers)){
              let dataChannel = this.peerConnection.createDataChannel(name);
              this.registerDataChannel(dataChannel);
          }
          this.streamChannels.forEach(channel => {
              let dataChannel = this.peerConnection.createDataChannel(channel);
              this.registerDataChannel(dataChannel);
          });
      }

      startCall(stream){
          this.initiatedCall = true;
          // Detect call type from stream tracks
          const hasVideo = stream.getVideoTracks().length > 0;
          const hasAudio = stream.getAudioTracks().length > 0;
          let streamInfo = {video: hasVideo, audio: hasAudio};
          this.streamConnection = this._makeStreamConnection(stream);

          this.streamConnection.createOffer()
              .then(offer => this.streamConnection.setLocalDescription(offer))
              .then(() => {
                  // Send offer via MQTT
                  this.send("streamoffer", JSON.stringify({"offer": this.streamConnection.localDescription, "streamInfo": streamInfo}));
              });

           this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};

          return this.streamPromise.promise;
      }
      _makeStreamConnection(stream){
          if (this.streamConnection){
              console.warn("Already have a stream connection");
              return;
          }
          this.localStream = stream;
          this.streamConnection = new RTCPeerConnection(this.rtcConfiguration);

          stream.getTracks().forEach(track => this.streamConnection.addTrack(track, stream));

          this.streamConnection.onicecandidate = this.onstreamicecandidate.bind(this);
          this.streamConnection.ontrack = this.onTrack;
          this.streamConnectionPromise.resolve(this.streamConnection);
          this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};
          return this.streamConnection;
      }
      onTrack(event){
          console.warn("Track event", event);
          this.remoteStream = event.streams[0];
          let d = {
              localStream: this.localStream,
              remoteStream: this.remoteStream
          };
          this.streamPromise.resolve(d);
          this.mqttClient.oncallconnected(this.target, d);
      }
      sendOffer(){
          this.setupDataChannels();
          this.peerConnection.createOffer()
            .then(offer => this.peerConnection.setLocalDescription(offer))
            .then(() => {
              // Send offer via MQTT
              console.log("Sending offer to " + this.target);
              this.mqttClient.postPubliclyToMQTTServer("RTCOffer", {userInfo: this.mqttClient.userInfo, offer: {"localDescription": this.peerConnection.localDescription, "target": this.target}});
            });
          this.sentOffer = true;
      }
      respondToOffer(offer){
          this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
                .then(() => this.peerConnection.createAnswer())
                .then(answer => this.peerConnection.setLocalDescription(answer))
                .then((answer) => {
                  // Send answer via MQTT
                  this.mqttClient.postPubliclyToMQTTServer("RTCAnswer", {
                      "localDescription": this.peerConnection.localDescription,
                      "target": this.target,
                  });
                });
      }
      receiveAnswer(answer){
          if (this.peerConnection.signalingState !== 'have-local-offer') {
              // This can happen if answer arrives after connection is established or out of order
              // It's not necessarily an error, just means we can't process this answer
              if (this.peerConnection.signalingState !== 'stable') {
                  // Only warn if it's an unexpected state (not just "stable" which is normal)
                  console.warn("Received answer in unexpected signaling state: " + this.peerConnection.signalingState);
              }
              return;
          }
          this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          // Wait for all data channels to be ready before notifying connection
          this.loadPromise.then((() => {
              this.send("connectedViaRTC", null);
              this.mqttClient.onConnectedToUser(this.target);
          }).bind(this));
      }
      send(channel, serializedData){
          let dataChannel = this.dataChannels[channel];
          if (!dataChannel){
              if (this.mqttClient.rtcHandlers[channel]){
                  console.warn("handler found for ", channel, "but no data channel");
              }
              throw new Error("No data channel for " + channel);
          }
          
          // If channel is not open, wait for it to open
          if (dataChannel.readyState !== "open"){
              if (dataChannel.readyState === "closed") {
                  throw new Error("Channel closed: " + channel);
              }
              // Channel is connecting, wait for it to open
              return new Promise((resolve, reject) => {
                  const timeout = setTimeout(() => {
                      reject(new Error(`Channel ${channel} did not open within 10 seconds`));
                  }, 10000);
                  
                  const onOpen = () => {
                      clearTimeout(timeout);
                      dataChannel.removeEventListener('open', onOpen);
                      dataChannel.removeEventListener('error', onError);
                      try {
                          dataChannel.send(serializedData);
                          resolve();
                      } catch (e) {
                          reject(e);
                      }
                  };
                  
                  const onError = (e) => {
                      clearTimeout(timeout);
                      dataChannel.removeEventListener('open', onOpen);
                      dataChannel.removeEventListener('error', onError);
                      reject(new Error(`Channel ${channel} error: ${e.message || e}`));
                  };
                  
                  dataChannel.addEventListener('open', onOpen);
                  dataChannel.addEventListener('error', onError);
              });
          }
          
          dataChannel.send(serializedData);
      }
      onmessage(event, channel){
          if (channel === "streamoffer"){
              console.log("received stream offer", event.data);
              let {offer, streamInfo} = JSON.parse(event.data);
              // Use streamInfo from the offer if available, otherwise default to video+audio
              const callInfo = streamInfo || {video: true, audio: true};
              this.mqttClient.callFromUser(this.target, callInfo, this.initiatedCall, this.callPromises).then(stream => {
                  if (!this.streamConnection){
                      this.streamConnection = this._makeStreamConnection(stream);
                  }
                  return this.streamConnection;
              }).catch(e => {
                  // If call was rejected, properly end the call
                  if (e === "Call rejected" || (typeof e === 'string' && e.includes('rejected'))) {
                      console.log(`Call rejected by ${this.target}, ending call`);
                      // End the call properly
                      this.endCall();
                  }
                  this.streamConnectionPromise.reject(e);
                  this.streamPromise.reject(e);
              }).then(streamConnection => {
                  streamConnection.setRemoteDescription(new RTCSessionDescription(offer))
                      .then(() => this.streamConnection.createAnswer())
                      .then(answer => this.streamConnection.setLocalDescription(answer))
                      .then(() => {
                          // Send answer via MQTT
                          console.log("Sending stream answer", this.streamConnection.localDescription);
                          this.send("streamanswer", JSON.stringify({"answer": this.streamConnection.localDescription}));
                          if (this.pendingStreamIceCandidate){
                              console.log("Found pending stream ice candidate");
                              this.streamConnection.addIceCandidate(new RTCIceCandidate(this.pendingStreamIceCandidate));
                              this.pendingStreamIceCandidate = null;
                          }
                      });
              });

          }else if (channel === "streamanswer"){
              console.log("received stream answer", event.data);
              let {answer} = JSON.parse(event.data);
              this.streamConnection.setRemoteDescription(new RTCSessionDescription(answer));
          }else if (channel === "streamice"){
              console.log("received stream ice", event.data);
              if (event.data){
                  if (this.streamConnection){
                      this.streamConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(event.data)));
                  }else {
                      this.pendingStreamIceCandidate = JSON.parse(event.data);
                  }
              }
          }else if (channel === "endcall"){
              this._closeCall();
          }else {
              this.mqttClient.onrtcmessage(channel, event.data, this.target);
          }
      }
      endCall(){
          this.send("endcall", null);
          this._closeCall();
      }
      _closeCall(){
          if (this.streamConnection){
              this.streamConnection.close();
              this.localStream.getTracks().forEach(track => track.stop());
              this.remoteStream.getTracks().forEach(track => track.stop());
              this.remoteStream = null;
              this.localStream = null;
          }
          this.callEndPromise.resolve();
          this.callEndPromise = new DeferredPromise();
          this.callRinging = false;
          this.initiatedCall = false;
          this.streamConnection = null;
          this.pendingStreamIceCandidate = null;
          this.streamConnectionPromise = new DeferredPromise();
          this.streamPromise = new DeferredPromise();
          this.callEndPromise = new DeferredPromise();
          this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};

          this.mqttClient.oncallended(this.target);
      }

      onReceivedIceCandidate(data) {
          this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
      }

      onicecandidate(event){
  //        if (event.candidate && !this.sentice) {
  //            this.sentice = true;
              // Send ICE candidate via MQTT
              this.mqttClient.postPubliclyToMQTTServer("RTCIceCandidate", event.candidate);
  //        }
      }
      onstreamicecandidate(event){
          if (event.candidate) {
              // Send ICE candidate via RTC
              // Reduced logging - ICE candidates are sent very frequently during connection setup
              // console.log("Sending stream ice", this, event.candidate);
              this.send("streamice", JSON.stringify(event.candidate));
          }
      }
      ondatachannel(event){
          let dataChannel = event.channel;
          this.dataChannels[event.name] = dataChannel;
          dataChannel.onmessage = this.onmessage.bind(this);
      }
      ondatachannelerror(error, channelName){
          this.mqttClient.onrtcerror(channelName, error, this.target);
      }

      close(){
          if (this.closed){return}
          this.peerConnection.close();
          this.closed = true;
          this.peerConnection = null;
          this.mqttClient.onrtcdisconnectedFromUser(this.target);
      }
  }


  class PromisefulMQTTRTCClient extends BaseMQTTRTCClient {
      constructor(config){
      config = config || {};
      let {name, userInfo, questionHandlers, handlers, load} = config;
      if (load === undefined){
          load = true;
      }

      config.load = false;
      // initialize state tracking variables
      super(config);

      Object.assign(this.rtcHandlers, this.extraRTCHandlers);
      Object.assign(this.rtcHandlers, handlers || {});
      for (let [k, v] of Object.entries(this.rtcHandlers)){
          this.rtcHandlers[k] = v.bind(this);
      }

      if (questionHandlers){
          this.questionHandlers = questionHandlers;
      }else if (!this.questionHandlers){
          this.questionHandlers = {};
      }
      this.questionPromises = {};
      this.latestPings = {};
      this.questionNumber = 0;

      this.mqttConnected = new DeferredPromise();
      this.nextUserConnection = new DeferredPromise();
      this.nextUserDisconnectionPromises = {};
      this.nextDMPromises = {};
      this.nextChatPromises = {};
      this.nextQuestionPromises = {};
      this.nextAnswerPromises = {};
      this.nextPingPromises = {};
      this.nextPongPromises = {};
      this.nextMQTTMessagePromises = {};


      this.onConnectedToMQTT = this.onConnectedToMQTT.bind(this);
      this.sendRTCDM = this.sendRTCDM.bind(this);
      this.onRTCDM = this.onRTCDM.bind(this);
      this.sendRTCChat = this.sendRTCChat.bind(this);
      this.onRTCChat = this.onRTCChat.bind(this);
      this.onConnectedToUser = this.onConnectedToUser.bind(this);
      this.onDisconnectedFromUser = this.onDisconnectedFromUser.bind(this);
      this.sendRTCQuestion = this.sendRTCQuestion.bind(this);
      this.onRTCQuestion = this.onRTCQuestion.bind(this);
      this.respondToQuestion = this.respondToQuestion.bind(this);
      this.onRTCAnswer = this.onRTCAnswer.bind(this);
      this.pingEveryone = this.pingEveryone.bind(this);
      this.ping = this.ping.bind(this);
      this.receivedPing = this.receivedPing.bind(this);
      this.receivedPong = this.receivedPong.bind(this);

      this.nextUserDisconnection = this.nextUserDisconnection.bind(this);
      this.nextMQTTMessage = this.nextMQTTMessage.bind(this);
      this.nextAnswer = this.nextAnswer.bind(this);
      this.nextQuestion = this.nextQuestion.bind(this);
      this.nextChat = this.nextChat.bind(this);
      this.nextDM = this.nextDM.bind(this);
      this.nextPing = this.nextPing.bind(this);
      this.nextPong = this.nextPong.bind(this);

      this.addQuestionHandler = this.addQuestionHandler.bind(this);

      if (load){
          this.load();
      }
    }
    addQuestionHandler(name, handler){
          this.questionHandlers[name] = handler;
    }

    extraRTCHandlers = {
      dm: (data, sender) => {
          this.onRTCDM(data, sender);
          if (this.nextDMPromises["anyone"]){
              this.nextDMPromises["anyone"].resolve([data, sender]);
              delete this.nextDMPromises["anyone"];
          }
          if (this.nextDMPromises[sender]){
              this.nextDMPromises[sender].resolve(data);
              delete this.nextDMPromises[sender];
          }
      },
      chat: (data, sender) => {
          this.onRTCChat(data, sender);
          if (this.nextChatPromises["anyone"]){
              this.nextChatPromises["anyone"].resolve([data, sender]);
              delete this.nextChatPromises["anyone"];
          }
          if (this.nextChatPromises[sender]){
              this.nextChatPromises[sender].resolve(data);
              delete this.nextChatPromises[sender];
          }
      },
      question: (data, sender) => {
          this.onRTCQuestion(data, sender);
          if (this.nextQuestionPromises["anyone"]){
              this.nextQuestionPromises["anyone"].resolve([data, sender]);
              delete this.nextQuestionPromises["anyone"];
          }
          if (this.nextQuestionPromises[sender]){
              this.nextQuestionPromises[sender].resolve(data);
              delete this.nextQuestionPromises[sender];
          }

      },
      answer: (data, sender) => {
          this.onRTCAnswer(data, sender);
          if (this.nextAnswerPromises["anyone"]){
              this.nextAnswerPromises["anyone"].resolve([data, sender]);
              delete this.nextAnswerPromises["anyone"];
          }
          if (this.nextAnswerPromises[sender]){
              this.nextAnswerPromises[sender].resolve(data);
              delete this.nextAnswerPromises[sender];
          }
      },
      ping: (data, sender) => {
          this.sendOverRTC("pong", null, sender);
          this.receivedPing(sender);
          if (this.nextPingPromises["anyone"]){
              this.nextPingPromises["anyone"].resolve([data, sender]);
              delete this.nextPingPromises["anyone"];
          }
          if (this.nextPingPromises[sender]){
              this.nextPingPromises[sender].resolve(data);
              delete this.nextPingPromises[sender];
          }
      },
      pong: (data, sender) => {
          this.latestPings[sender].resolve();
          this.receivedPong(sender);
          if (this.nextPongPromises["anyone"]){
              this.nextPongPromises["anyone"].resolve([data, sender]);
              delete this.nextPongPromises["anyone"];
          }
          if (this.nextPongPromises[sender]){
              this.nextPongPromises[sender].resolve(data);
              delete this.nextPongPromises[sender];
          }
      },
    }

    onConnectedToMQTT(){
      this.mqttConnected.resolve();
      console.log("Connected to MQTT");
    }
    postPubliclyToMQTTServer(subtopic, data){
      super.postPubliclyToMQTTServer(subtopic, data);
    }
    onMQTTMessage(subtopic, data, sender, timestamp){
      console.log("Received message from " + sender + " on " + subtopic, data);
      if (this.nextMQTTMessagePromises["anysubtopic"]){
          this.nextMQTTMessagePromises["anysubtopic"].resolve([data, sender, timestamp]);
          delete this.nextMQTTMessagePromises["anysubtopic"];
      }
      if (this.nextMQTTMessagePromises[subtopic]){
          this.nextMQTTMessagePromises[subtopic].resolve([data, sender, timestamp]);
          delete this.nextMQTTMessagePromises[subtopic];
      }
      // Call parent to emit event
      super.onMQTTMessage(subtopic, data, sender, timestamp);
    }

   //__________________________________________________ RTC ______________________________________________________________
    onConnectedToUser(user){
      console.log("Connected to user ", user);
      this.nextUserConnection.resolve(user);
      this.nextUserConnection = new DeferredPromise();
    }
    onDisconnectedFromUser(user){
      console.log("Disconnected from user ", user);
      this.nextUserDisconnection.resolve(user);
      if (this.nextUserDisconnectionPromises["anyone"]){
          this.nextUserDisconnectionPromises["anyone"].resolve(user);
          delete this.nextUserDisconnectionPromises["anyone"];
      }
      if (this.nextUserDisconnectionPromises[user]){
          this.nextUserDisconnectionPromises[user].resolve(user);
          delete this.nextUserDisconnectionPromises[user];
      }
    }

    sendRTCDM(message, target){
      this.sendOverRTC("dm", message, target);
    }
    onRTCDM(message, sender){
      console.log("Received DM from " + sender, message);
    }
    nextDM(target='anyone'){
      this.nextDMPromises[target] = new DeferredPromise();
      return this.nextDMPromises[target].promise;
    }
    nextChat(target='anyone'){
      this.nextChatPromises[target] = new DeferredPromise();
      return this.nextChatPromises[target].promise;
    }
    nextQuestion(target='anyone'){
      this.nextQuestionPromises[target] = new DeferredPromise();
      return this.nextQuestionPromises[target].promise;
    }
      nextAnswer(target='anyone'){
          this.nextAnswerPromises[target] = new DeferredPromise();
          return this.nextAnswerPromises[target].promise;
      }
      nextPing(target='anyone'){
          this.nextPingPromises[target] = new DeferredPromise();
          return this.nextPingPromises[target].promise;
      }
      nextPong(target='anyone'){
          this.nextPongPromises[target] = new DeferredPromise();
          return this.nextPongPromises[target].promise;
      }
      nextUserDisconnection(target='anyone'){
          this.nextUserDisconnectionPromises[target] = new DeferredPromise();
          return this.nextUserDisconnectionPromises[target].promise;
      }
      nextMQTTMessage(subtopic='anysubtopic'){
          this.nextMQTTMessagePromises[subtopic] = new DeferredPromise();
          return this.nextMQTTMessagePromises[subtopic].promise;
      }


    sendRTCChat(message){
      this.sendOverRTC("chat", message);
    }
    onRTCChat(message, sender){
      console.log("Received chat from " + sender, message);
    }
    sendRTCQuestion(topic, content, target){
      let question = {topic, content};
      let n = this.questionNumber;
      this.questionNumber++;
      let p = new DeferredPromise();
      this.questionPromises[n] = p;
      let data = {n, question};
      this.sendOverRTC("question", data, target);
      return p.promise;
    }
    onRTCQuestion(data, sender){
      let {n, question} = data;
      let answer = this.respondToQuestion(question, sender);
      if (answer instanceof Promise){
          answer.then((a) => {
              this.sendOverRTC("answer", {n, answer: a, question}, sender);
          });
      }else {
          this.sendOverRTC("answer", {n, answer, question}, sender);
      }
    }
    respondToQuestion(question, sender){
      let {topic, content} = question;
      if (this.questionHandlers[topic]){
          return this.questionHandlers[topic](content, sender);
      }else {
          console.warn("No handler found for question " + topic);
          throw new Error("No handler found for question " + topic);
      }
    }
    onRTCAnswer(data, sender){
      let {n, answer} = data;
      if (this.questionPromises[n]){
          this.questionPromises[n].resolve(answer);
          delete this.questionPromises[n];
      }else {
          console.warn("No promise found for question " + n);
      }
    }
    pingEveryone(){
      this.latestPings = {};
      for (let user of this.connectedUsers){
          this.ping(user);
      }
      return Promise.all(Object.values(this.latestPings).map((p) => p.promise));
    }
    ping(user){
      this.latestPings[user] = new DeferredPromise();
      this.sendOverRTC("ping", "ping", users);
      return this.latestPings[user].promise;
    }
    receivedPing(sender){
      console.log("Received ping from " + sender);
    }
    receivedPong(sender){
      console.log("Received pong from " + sender);
    }



  }

  class MQTTRTCClient extends PromisefulMQTTRTCClient {
      constructor(config){
          config = config || {};
          let {name, userInfo, questionHandlers, handlers, load} = config;
          // this.knownUsers = {name: userInfo, ...} of all users, even those we're not connected to
          // this.rtcConnections = {name: rtcConnection, ...} of active connections
          // this.connectedUsers = [name, ...] of all users we're connected to
          if (load === undefined){
              load = true;
          }
          config.load = false;
          super(config);
          

          if (load){
              this.load();
          }

      }
      on(rtcevent, handler){
          // Use EventEmitter for standard events, but handle special cases
          if (rtcevent === "connectionrequest"){
              // Special case: connectionrequest sets shouldConnectToUser
              this.shouldConnectToUser = handler.bind(this);
              // Also register as event listener for consistency
              return super.on(rtcevent, handler);
          }else if (rtcevent === "call"){
              // Special case: call sets acceptCallFromUser
              this.acceptCallFromUser = handler.bind(this);
              // Also register as event listener
              return super.on(rtcevent, handler);
          }else if (rtcevent === "callended"){
              // Special case: callended sets oncallended
              this.oncallended = handler.bind(this);
              // Also register as event listener
              return super.on(rtcevent, handler);
          }else if (rtcevent === "question"){
              // Question handlers are registered via addQuestionHandler
              this.addQuestionHandler(rtcevent, handler);
              // Also emit events for consistency
              return super.on(rtcevent, handler);
          }else {
              // All other events use EventEmitter
              return super.on(rtcevent, handler);
          }
      }

      shouldConnectToUser(user, userInfo){
          return super.shouldConnectToUser(user, userInfo);
        }

      changeName(newName){
          super.changeName(newName);
      }
      onNameChange(oldName, newName){
          super.onNameChange(oldName, newName);
          this.emit('namechange', oldName, newName);
      }

      onConnectedToMQTT(){
          console.log("Connected to MQTT");
          this.emit('mqttconnected');
      }
      onConnectedToUser(user){
          console.log("Connected to user ", user);
          this.emit('connectedtopeer', user);
      }
      onDisconnectedFromUser(user){
          console.log("Disconnected from user ", user);
          this.emit('disconnectedfrompeer', user);
      }
      onRTCDM(data, sender){
          this.emit('dm', data, sender);
      }
      onRTCChat(data, sender){
          this.emit('chat', data, sender);
      }
      addQuestionHandler(name, handler){
          super.addQuestionHandler(name, handler);
      }
      oncallconnected(sender, {localStream, remoteStream}){
          this.emit('callconnected', sender, {localStream, remoteStream});
      }

      pingEveryone(){
          let start = Date.now();
          return super.pingEveryone().then(() => {
              console.log("Pinged everyone in " + (Date.now() - start) + "ms");
          });
      }
      ping(user){
          // time the ping
          let start = Date.now();
          return super.ping(user).then(() => {
              console.log("Pinged " + user + " in " + (Date.now() - start) + "ms");
          });
      }
      receivedPing(sender){
          this.emit('ping', sender);
      }

      // nextUserConnection is a promise that resolves when the client connects to a new user
      get nextDMPromise() {return this.nextDM();}
      get nextChatPromise() {return this.nextChat();}
      get nextQuestionPromise() {return this.nextQuestion();}
      get nextAnswerPromise() {return this.nextAnswer();}
      get nextPingPromise() {return this.nextPing();}
      get nextPongPromise() {return this.nextPong();}
      get nextUserDisconnectionPromise() {return this.nextUserDisconnection();}

      get connectedUsers(){
          return this.connectionsToUsers();
      }

      disconnectFromUser(user){
          super.disconnectFromUser(user);
          return this.nextUserDisconnection(user);
      }

      getPeer(user){
          return new Peer(this, user);
      }
      get peers(){
          return Object.fromEntries(Object.entries(this.connectedUsers).map(name => [name, new Peer(this, name)]));
      }
      get peerList(){
          return Object.values(this.peers);
      }
      send(data, channel = 'chat', users){
          return super.sendOverRTC(channel, data, users);
      }
  }

  class Peer{
      constructor(mqttclient, name){
          this.mqttClient = mqttclient;
          this.target = name;
      }
      dm(message){
          return this.mqttClient.sendRTCDM(message, this.target);
      }
      chat(message){
          return this.mqttClient.sendRTCChat(message);
      }
      ask(question){
          return this.mqttClient.sendRTCQuestion(question, this.target);
      }
      ping(){
          return this.mqttClient.ping(this.target);
      }

  }

  /**
   * Keys - Cryptographic key management for identity verification
   * 
   * Manages RSA-PSS key pairs for signing and verification.
   * Handles key generation, storage, and challenge/response operations.
   * 
   * @param {string} name - The name associated with these keys
   * @param {boolean|'force'} generate - Whether to generate new keys if none exist. 'force' will always generate.
   * @param {Object} dependencies - Injected dependencies
   * @param {StorageAdapter} [dependencies.storage] - Storage adapter for key persistence. Falls back to localStorage if available.
   * @param {Crypto} [dependencies.crypto] - Web Crypto API instance. Falls back to window.crypto if available.
   */

  class Keys {
    algorithm = {
      name: "RSA-PSS",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: {name: "SHA-256"},
    }
    extractable = true;
    keyUsages = ["sign", "verify"];

    constructor(name, generate=true, { storage = null, crypto = null } = {}) {
      this._name = null;
      this.name = name;
      
      // Use storage adapter if provided, otherwise fall back to localStorage
      this.storage = storage || (typeof localStorage !== 'undefined' ? {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: (key) => localStorage.removeItem(key)
      } : null);
      
      // Use crypto if provided, otherwise fall back to window.crypto
      this.crypto = crypto || (typeof window !== 'undefined' && window.crypto ? window.crypto : null);
      
      if (!this.crypto || !this.crypto.subtle) {
        throw new Error("Web Crypto API not available. Please provide a crypto instance via constructor.");
      }

      this._loadKeys = this._loadKeys.bind(this);
      this.load = this.load.bind(this);
      this.generate = this.generate.bind(this);
      this._dumpKey = this._dumpKey.bind(this);
      this._loadPrivateKey = this._loadPrivateKey.bind(this);
      this._loadPublicKey = this._loadPublicKey.bind(this);
      this.sign = this.sign.bind(this);
      this.getChallengeString = this.getChallengeString.bind(this);
      this.verify = this.verify.bind(this);
      this.savePublicKey = this.savePublicKey.bind(this);
      this.savePublicKeyString = this.savePublicKeyString.bind(this);
      this.getPublicKey = this.getPublicKey.bind(this);
      this.clearOwnKeys = this.clearOwnKeys.bind(this);
      this.clearKnownHosts = this.clearKnownHosts.bind(this);
      this.getPeerNames = this.getPeerNames.bind(this);
      this.reset = this.reset.bind(this);

      this.loadedPromise = this.load(generate);
    }
    
    load(generate=true) {
      this.loading = true;
      this.loaded = false;
      this.loadedPromise = this._loadKeys(generate).then((keys) => {
        if (!this.storage) {
          this._knownHostsStrings = {};
          this._knownHostsKeys = {};
        } else {
          this._knownHostsStrings = JSON.parse(this.storage.getItem("knownHostsStrings") || "{}");
          for (let [name, key] of Object.entries(this._knownHostsStrings)) {
            if (name.startsWith("anon")){
              delete this._knownHostsStrings[name];
            }
          }
          this._knownHostsKeys = {};
        }
        
        this._privateKey = keys.privateKey;
        this._publicKey = keys.publicKey;
        this._privateKeyString = keys.privateKeyString;
        this.publicKeyString = keys.publicKeyString;
        
        if (this.storage) {
          this.storage.setItem("privateKeyString", this._privateKeyString);
          this.storage.setItem("publicKeyString", this.publicKeyString);
        }
        
        this.loaded = true;
        this.loading = false;
        return this.publicKeyString;
      });
      return this.loadedPromise;
    }
    
    _loadKeys(generate=true) {
      if (!this.storage) {
        if (!generate) {
          throw new Error("No storage available and generate is false");
        }
        return this.generate();
      }
      
      let privateKeyString = this.storage.getItem("privateKeyString");
      let publicKeyString = this.storage.getItem("publicKeyString");
      if (generate !== 'force' && publicKeyString && privateKeyString) {
        return this._loadPrivateKey(privateKeyString).then((privateKey) => {
          return this._loadPublicKey(publicKeyString).then((publicKey) => {
            return {privateKey, publicKey, privateKeyString, publicKeyString};
          });
        })
      }
      if (!generate) {
        throw new Error("No keys found and generate is false");
      }
      return this.generate()
    }
    
    generate(){
      return this.crypto.subtle.generateKey(
        this.algorithm, this.extractable, this.keyUsages
      ).then((keys) => {
        return this._dumpKey(keys.privateKey).then(privateKeyString => {
          keys.privateKeyString = privateKeyString;
          return this._dumpKey(keys.publicKey).then(publicKeyString => {
            keys.publicKeyString = publicKeyString;
            return keys;
          });
        });
      });
    }
    
    _dumpKey(key){
      return this.crypto.subtle.exportKey("jwk", key).then(JSON.stringify);
    }
    
    _loadPrivateKey(key){
      return this.crypto.subtle.importKey("jwk", JSON.parse(key), this.algorithm, this.extractable, ["sign"])
    }
    
    _loadPublicKey(key){
      return this.crypto.subtle.importKey("jwk", JSON.parse(key), this.algorithm, this.extractable, ["verify"])
    }
    
    getChallengeString() {
      return Array.from(this.crypto.getRandomValues(new Uint8Array(32))).map(b => String.fromCharCode(b)).join('');
    }
    
    sign(challenge) {
      if (this.loading && !this._loaded) {
        return this.loadedPromise.then(() => this.sign(challenge));
      }
      return this.crypto.subtle.sign(
        {
          name: "RSA-PSS",
          saltLength: 32,
        },
        this._privateKey,
        new Uint8Array(challenge.split('').map((c) => c.charCodeAt(0))).buffer
      ).then((signature) => {
        return String.fromCharCode.apply(null, new Uint8Array(signature));
      });
    }
    
    verify(publicKeyString, signatureString, challenge) {
      return this._loadPublicKey(publicKeyString).then((publicKey) => {
        return this.crypto.subtle.verify(
          {
            name: "RSA-PSS",
            saltLength: 32,
          },
          publicKey,
          new Uint8Array(signatureString.split('').map((c) => c.charCodeAt(0))).buffer,
          new Uint8Array(challenge.split('').map((c) => c.charCodeAt(0))).buffer
        );
      });
    }
    
    getPeerNames(publicKeyString) {
      let matchingPeers = [];
      if (!this._knownHostsStrings) return matchingPeers;
      for (let [name, key] of Object.entries(this._knownHostsStrings)) {
        if (key === publicKeyString) {
          matchingPeers.push(name);
        }
      }
      return matchingPeers;
    }
    
    savePublicKey(peerName, publicKey) {
      peerName = peerName.split("|")[0].split("(")[0].trim();
      if (publicKey instanceof CryptoKey) {
        return this._dumpKey(publicKey).then((publicKeyString) => {
          this.savePublicKey(peerName, publicKeyString);
          this._knownHostsKeys[peerName] = publicKey;
          return true;
        });
      }else {
        return this.savePublicKeyString(peerName, publicKey);
      }
    }
    
    savePublicKeyString(peerName, publicKeyString) {
      peerName = peerName.split("|")[0].split("(")[0].trim();
      let matchingPeers = this.getPeerNames(publicKeyString);
      if (matchingPeers.length > 0) {
        // If the public key is already registered to this peer name, allow updating
        if (matchingPeers.includes(peerName)) {
          // Same peer, same key - no change needed, but update anyway to be safe
          this._knownHostsStrings[peerName] = publicKeyString;
          if (this.storage) {
            this.storage.setItem("knownHostsStrings", JSON.stringify(this._knownHostsStrings));
          }
          return true;
        }
        // Public key is registered to a different peer name
        console.error("Public key already registered for another peer", matchingPeers);
        throw new Error("Public key already registered for another peer");
      }
      this._knownHostsStrings[peerName] = publicKeyString;
      if (this.storage) {
        this.storage.setItem("knownHostsStrings", JSON.stringify(this._knownHostsStrings));
      }
      return true;
    }

    getPublicKey(peerName) {
      peerName = peerName.split("|")[0].split("(")[0].trim();
      let publicKey = this._knownHostsKeys?.[peerName];
      if (publicKey) { return Promise.resolve(publicKey); }
      let publicKeyString = this._knownHostsStrings?.[peerName];
      if (publicKeyString) {
        return this._loadPublicKey(publicKeyString).then((publicKey) => {
          if (!this._knownHostsKeys) this._knownHostsKeys = {};
          this._knownHostsKeys[peerName] = publicKey;
          return publicKey;
        });
      }
      return Promise.resolve(null);
    }
    
    getPublicKeyString(peerName) {
      peerName = peerName.split("|")[0].split("(")[0].trim();
      return this._knownHostsStrings?.[peerName] || null;
    }
    
    removePublicKey(peerName) {
      peerName = peerName.split("|")[0].split("(")[0].trim();
      if (this._knownHostsStrings) {
        delete this._knownHostsStrings[peerName];
      }
      if (this._knownHostsKeys) {
        delete this._knownHostsKeys[peerName];
      }
      if (this.storage) {
        this.storage.setItem("knownHostsStrings", JSON.stringify(this._knownHostsStrings || {}));
      }
    }

    get knownHosts() {
      if (!this._knownHostsStrings) return [];
      return Object.entries(this._knownHostsStrings).map(([name, key]) => {
        return name + "|" + key;
      });
    }
    
    clearOwnKeys() {
      if (this.storage) {
        this.storage.removeItem("privateKeyString");
        this.storage.removeItem("publicKeyString");
      }
      this._privateKey = null;
      this._publicKey = null;
      this._privateKeyString = null;
      this.publicKeyString = null;
    }
    
    clearKnownHosts() {
      if (this.storage) {
        this.storage.removeItem("knownHostsStrings");
      }
      this._knownHostsKeys = {};
      this._knownHostsStrings = {};
    }

    reset(){
      this.clearOwnKeys();
      this.clearKnownHosts();
    }

    get name(){return this._name}
    set name(name) {
      if (name.includes("|")) {
        throw new Error("Name cannot contain |");
      }
      this._name = name;
    }

    get identity() {
      if (!this.loaded){return null}
      let name = this.name.split("|")[0].split("(")[0].trim();
      return name + "|" + this.publicKeyString;
    }

    register(identity) {
      let [peerName, publicKeyString] = identity.split("|");
      return this.savePublicKeyString(peerName, publicKeyString);
    }
  }

  /**
   * Signed MQTT-RTC Client - Secure peer-to-peer communication with identity verification
   * 
   * Extends MQTTRTCClient with cryptographic identity verification using RSA-PSS keys.
   * Implements a challenge/response system to verify peer identities and prevent impersonation.
   * 
   * Usage:
   *   import { SignedMQTTRTCClient } from './signed-mqtt-rtc.js';
   *   
   *   const client = new SignedMQTTRTCClient({
   *     name: 'MyName',
   *     trustMode: 'moderate',  // Trust configuration
   *     generate: true          // Generate new keys if none exist
   *   });
   * 
   *   client.on('validation', (peerName, trusted) => {
   *     console.log(`Peer ${peerName} validated, trusted: ${trusted}`);
   *   });
   * 
   *   client.on('validationfailure', (peerName, message) => {
   *     console.error(`Validation failed for ${peerName}: ${message}`);
   *   });
   * 
   * Identity System:
   * - Each client generates an RSA-PSS key pair (2048-bit)
   * - Public keys are stored in localStorage (knownHostsStrings)
   * - Private keys are stored encrypted in localStorage
   * - Identity = name + "|" + publicKeyString
   * 
   * Trust Levels:
   * - reject: Do not connect
   * - promptandtrust: Prompt user, then trust if challenge passes
   * - connectandprompt: Connect first, then prompt to trust
   * - connectandtrust: Connect and automatically trust
   * 
   * Trust Modes (pre-configured trust level mappings):
   * - strict: Only auto-trust "the one and only" known peers
   * - moderate: Trust known peers and aliases, prompt for others
   * - lax: Trust most cases, prompt only for suspicious ones
   * - unsafe: Trust everyone (not recommended)
   * - rejectall: Reject all connections
   * 
   * User Categories (automatic detection):
   * - theoneandonly: Known key and name match perfectly
   * - knownwithknownaliases: Known key, but also known by other names
   * - possiblenamechange: Known key, but different name
   * - possiblesharedpubkey: Known key with multiple other names
   * - nameswapcollision: Suspicious name/key mismatch
   * - pretender: Unknown key using a known name
   * - nevermet: Completely new peer
   * 
   * Challenge/Response Flow:
   * 1. When connecting, peers exchange public keys via MQTT
   * 2. After WebRTC connection, challenge is sent via RTC
   * 3. Peer signs challenge with private key
   * 4. Signature is verified using stored public key
   * 5. If valid, peer is added to validatedPeers list
   * 
   * Methods:
   * - trust(peerName): Trust a peer and save their public key
   * - challenge(peerName): Challenge a peer to prove identity
   * - untrust(peerName): Remove trust and disconnect
   * - register(identity): Register a peer's identity (name|publicKey)
   * - reset(): Clear all keys and known hosts
   * 
   * @module signed-mqtt-rtc
   */


  let trustLevels = {
      reject: 0, // do not even connect
      promptandtrust: 1, // prompt whether to connect and then trust (assuming they pass the challenge)
      connectandprompt: 2, // connect and then prompt whether to trust
      connectandtrust: 3 // connect and trust
  };

  let suspicionLevels = {
          trusted: 0,
          nonsuspicious: 1,
          slightlyodd: 2,
          odd: 3,
          veryodd: 4
      };

  class SignedMQTTRTCClient extends MQTTRTCClient {
      constructor(userConfig) {
          userConfig = userConfig || {};
          
          // Extract config values
          const config = userConfig instanceof RTCConfig ? userConfig : new RTCConfig(userConfig);
          const configObj = config.getConfig();
          const generate = userConfig.generate !== false;
          const load = configObj.load !== false;
          const trustMode = userConfig.trustMode || configObj.trustMode || "strict";
          const name = config.name;
          const autoAcceptConnections = configObj.connection?.autoAcceptConnections ?? false;

          // Prepare config for parent (don't pass load flag, we'll handle it)
          super({ ...userConfig, load: false });
          
          // Get name from config or use the one we extracted
          const finalName = name || (this.name ? this.name.split('(')[0] : 'User');
          
          // Initialize keys with storage adapter and crypto from config
          const storage = this.storage || (typeof localStorage !== 'undefined' ? {
            getItem: (key) => localStorage.getItem(key),
            setItem: (key, value) => localStorage.setItem(key, value),
            removeItem: (key) => localStorage.removeItem(key)
          } : null);
          
          // Get crypto from config
          const crypto = configObj.crypto || (typeof window !== 'undefined' && window.crypto ? window.crypto : null);
          
          this.keys = new Keys(finalName, generate, { storage, crypto });
          this.validatedPeers = [];

          // Set up trust configuration
          if (trustMode === undefined) {trustMode = "strict";}
          if (this.trustConfigs[trustMode]){
              this.trustConfig = this.trustConfigs[trustMode];
          }else {
              this.trustConfig = trustMode;
          }
          if (!this.trustConfig || Object.keys(this.userCategories).map((category) => this.trustConfig[category]).some((level) => level === undefined)){
              throw new Error("Invalid trust mode");
          }
          this.completeUserInfo = {};

          this.shouldConnectToUser = this.shouldConnectToUser.bind(this);
          this.checkTrust = this.checkTrust.bind(this);
          this._getFullUserInfo = this._getFullUserInfo.bind(this);

          this.trust = this.trust.bind(this);
          this.register = this.register.bind(this);
          this.challenge = this.challenge.bind(this);
          this.untrust = this.untrust.bind(this);
          
          // Store auto-accept setting
          this.autoAcceptConnections = autoAcceptConnections;

          this.addQuestionHandler('identify', this._returnPublicKey.bind(this));
          this.addQuestionHandler('challenge', this._sign.bind(this));
          this.on('connectedtopeer', (peerName)=>{
              // Only validate if not already validated to prevent infinite loops
              if (!this.validatedPeers.includes(peerName)) {
                  setTimeout(()=> {this.trustOrChallenge.bind(this)(peerName);}, 1000);
              }
          });

          if (load) {
              this.keys.loadedPromise.then(() => {
                  this.userInfo.publicKeyString = this.keys.publicKeyString;
                  this.load();
              });
          }
      }
      verifyUser(channel, data, peerName) {
          console.log("Verifying user", channel, data, peerName, this.validatedPeers);
          if (["question", "answer"].includes(channel) && ["identify", "challenge"].includes(data.question.topic)) {
              return true;
          }
          return this.validatedPeers.includes(peerName);
      }

      _getFullUserInfo(peerName, userInfo) {
          let _bareName = peerName.split('|')[0].split('(')[0].trim();
          if (_bareName.startsWith("anon")) {
              return {
                  peerName: peerName,
                  bareName: _bareName,
                  userInfo: userInfo,
                  providedPubKey: false,
                  knownPubKey: false,
                  knownName: false,
                  otherNamesForPubKey: [],
                  otherPubKeyForName: null,
                  completedChallenge: false,
                  explanation: "anonymous",
                  suspiciousness: suspicionLevels.nonsuspicious,
                  category: "nevermet",
                  hint: "anon"
              }
          }
          let providedPubKey = !!userInfo.publicKeyString;
          let peerNames = providedPubKey?this.keys.getPeerNames(userInfo.publicKeyString):[];
          let _opk = this.keys.getPublicKeyString(_bareName);
          let info = {
              peerName: peerName,
              bareName: _bareName,
              userInfo: userInfo,
              providedPubKey: providedPubKey,
              knownPubKey: (peerNames.length > 0), // bool of whether the public key is known
              knownName: peerNames.includes(_bareName), // bool of whether the public key is known under the name provided
              otherNamesForPubKey: peerNames.filter((name) => name !== _bareName), // array of other names the public key is known under as well (if any)
              otherPubKeyForName: (_opk && (_opk !== userInfo.publicKeyString)) ? _opk : null, // public key string for the name provided (if different from the public key string provided)
              completedChallenge: false // bool of whether the challenge has been completed
          };
          let category = this.categorizeUser(info);
          info.explanation = category.explanation;
          info.suspiciousness = category.suspiciousness;
          info.category = category.category;

          let hint = '';
          if (info.category === 'theoneandonly'){
              hint = '';
          }else if (['knownwithknownaliases', 'possiblenamechange', 'possiblesharedpubkey'].includes(info.category)){
              hint = ` who is known as ${info.otherNamesForPubKey.join(', ')}`;
          }else if (info.category === 'nameswapcollision'){
              hint = `it appears ${info.otherNamesForPubKey[0]} (who you know) is using ${peerName}'s public key to impersonate them'`;
          }else if (info.category === 'pretender'){
              hint = ` who is pretending to be ${info.otherNamesForPubKey[0]}`;
          }else if (info.category === 'nevermet'){
              hint = ` who you have not met`;
          }
          hint = hint? ` (${hint})`: '';
          info.hint = hint;

          return info
      }

      shouldConnectToUser(peerName, userInfo) {
          console.log("Checking if we should connect to user", peerName, userInfo);
          let info = this._getFullUserInfo(peerName, userInfo);
          console.log("info", info);
          let trustLevel = this.checkTrust(info);

          info.trustLevel = trustLevel;
          info.trustLevelString = Object.keys(this.trustLevels).find((key) => this.trustLevels[key] === trustLevel);

          if (this.completeUserInfo[peerName] && this.isConnectedToUser(peerName)) {
              console.warn("Rejecting connection to " + peerName + " because we are already connected to someone with that name");
              return Promise.resolve(false);
          }
          this.completeUserInfo[peerName] = info;

          if (trustLevel === trustLevels.reject) {
              console.error("Rejecting connection to " + peerName);
              return Promise.resolve(false);
          }else if ([trustLevels.doubleprompt, trustLevels.promptandtrust].includes(trustLevel)) {
              return this.connectionrequest(peerName, info).then((connect) => {
                  if (connect) {
                      console.log("Decided to connect to " + peerName);
                  }else {
                      console.log("Decided not to connect to " + peerName);
                  }
                  return connect;
              }, (e)=> {console.log("Error in connection request", e); return false});
          }else {
              console.log("will connect to " + peerName);
              return Promise.resolve(true);
          }
      }
      trustLevels = trustLevels
      suspicionLevels = suspicionLevels
      userCategories = {
          theoneandonly: {knownPubKey: true, knownName: true, otherNamesForPubKey: false, otherPubKeyForName: false,
              explanation: "you know this person by the public key provided and don't now anyone else by this name or public key",
              suspiciousness: suspicionLevels.trusted,
              category: "theoneandonly"
          },
          knownwithknownaliases: {knownPubKey: true, knownName: true, otherNamesForPubKey: true, otherPubKeyForName: false,
              explanation: "you know this person by the public key provided, but you also know them by other names",
              suspiciousness: suspicionLevels.slightlyodd,
              category: "knownwithknownaliases"
          },
          possiblenamechange: {knownPubKey: true, knownName: false, otherNamesForPubKey: 1, otherPubKeyForName: false,
              explanation: "you recognize the public key but know it by a different name",
              suspiciousness: suspicionLevels.slightlyodd,
              category: "possiblenamechange"
          },
          possiblesharedpubkey: {knownPubKey: true, knownName: false, otherNamesForPubKey: true, otherPubKeyForName: false,
              explanation: "you recognize the public key but know it by more than one other name",
              suspiciousness: suspicionLevels.slightlyodd,
              category: "possiblesharedpubkey"
          },
          nameswapcollision: {knownPubKey: true, knownName: false, otherNamesForPubKey: true, otherPubKeyForName: true,
              explanation: "someone you know tried to change their name to the name of someone else you know",
              suspiciousness: suspicionLevels.odd,
              category: "nameswapcollision"
          },
          //___________________________________________________________________________________
          pretender: {knownPubKey: false, knownName: false, otherNamesForPubKey: false, otherPubKeyForName: true,
              explanation: "someone you don't know is using the name of someone you do know",
              suspiciousness: suspicionLevels.veryodd,
              category: "pretender"
          },
          nevermet: {knownPubKey: false, knownName: false, otherNamesForPubKey: false, otherPubKeyForName: false,
              explanation: "you don't know anyone with this pub key or name, you probably just haven't met yet",
              suspiciousness: suspicionLevels.notsuspicious,
              category: "nevermet"
          }
      }


      trustConfigs = {
          alwaysprompt: {
              theoneandonly: trustLevels.promptandtrust,
              knownwithknownaliases: trustLevels.promptandtrust,
              possiblenamechange: trustLevels.promptandtrust,
              possiblesharedpubkey: trustLevels.promptandtrust,
              nameswapcollision: trustLevels.promptandtrust,
              pretender: trustLevels.promptandtrust,
              nevermet: trustLevels.promptandtrust
          },
          strict: {
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.promptandtrust,
              possiblenamechange: trustLevels.promptandtrust,
              possiblesharedpubkey: trustLevels.promptandtrust,
              nameswapcollision: trustLevels.promptandtrust,
              pretender: trustLevels.promptandtrust,
              nevermet: trustLevels.promptandtrust
          },
          strictandquiet: {
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.reject,
              possiblenamechange: trustLevels.reject,
              possiblesharedpubkey: trustLevels.reject,
              nameswapcollision: trustLevels.reject,
              pretender: trustLevels.reject,
              nevermet: trustLevels.promptandtrust
          },
          moderate: {
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.connectandtrust,
              possiblenamechange: trustLevels.connectandtrust,
              possiblesharedpubkey: trustLevels.connectandtrust,
              nameswapcollision: trustLevels.promptandtrust,
              pretender: trustLevels.promptandtrust,
              nevermet: trustLevels.promptandtrust
          },
          moderateandquiet: {
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.connectandtrust,
              possiblenamechange: trustLevels.connectandtrust,
              possiblesharedpubkey: trustLevels.connectandtrust,
              nameswapcollision: trustLevels.reject,
              pretender: trustLevels.reject,
              nevermet: trustLevels.promptandtrust
          },
          lax: {
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.connectandtrust,
              possiblenamechange: trustLevels.connectandtrust,
              possiblesharedpubkey: trustLevels.connectandtrust,
              nameswapcollision: trustLevels.promptandtrust,
              pretender: trustLevels.promptandtrust,
              nevermet: trustLevels.connectandtrust
          },
          unsafe:{
              theoneandonly: trustLevels.connectandtrust,
              knownwithknownaliases: trustLevels.connectandtrust,
              possiblenamechange: trustLevels.connectandtrust,
              possiblesharedpubkey: trustLevels.connectandtrust,
              nameswapcollision: trustLevels.connectandtrust,
              pretender: trustLevels.connectandtrust,
              nevermet: trustLevels.connectandtrust
          },
          rejectall: {
              theoneandonly: trustLevels.reject,
              knownwithknownaliases: trustLevels.reject,
              possiblenamechange: trustLevels.reject,
              possiblesharedpubkey: trustLevels.reject,
              nameswapcollision: trustLevels.reject,
              pretender: trustLevels.reject,
              nevermet: trustLevels.reject
          }
      }
      categorizeUser(info){
          if (info.knownPubKey){// we know this pubkey
              if (info.knownName) { // we know this pubkey by this name (but maybe other names too?)
                  if (info.otherPubKeyForName) {
                      throw new Error("knownName should mean that this name matches the pubkey so therefore otherPubKeyForName should be null");
                  }else { // we don't know of any other pubkeys for this name
                      if (info.otherNamesForPubKey.length === 0) { // we don't know of any other names for this pubkey
                          return this.userCategories.theoneandonly;
                      }else { // we know of other names for this pubkey (and we know this name as well)
                          return this.userCategories.knownwithknownaliases;
                      }
                  }
              }else { // we know this pubkey but not by this name
                  if (info.otherNamesForPubKey.length === 0) {
                      throw new Error("knownPubKey should mean that this pubkey matches at least one name so if knownName is false then there should be at least one other name for this pubkey");
                  }else if (info.otherNamesForPubKey.length === 1) { // we know this pubkey by one other name
                      if (info.otherPubKeyForName) {
                          return this.userCategories.nameswapcollision; // we know this pubkey by one other name and we know another pubkey by this name : VERY SUSPICIOUS
                      }else {
                          return this.userCategories.possiblenamechange; // we know this pubkey by one other name and we don't know another pubkey by this name
                      }
                  }else {// we know this pubkey by more than one other name
                      if (info.otherPubKeyForName) {
                          return this.userCategories.nameswapcollision; // we know this pubkey by more than one other name and we know another pubkey by this name : VERY SUSPICIOUS
                      }else {
                          return this.userCategories.possiblesharedpubkey; // we know this pubkey by more than one other name and we don't know another pubkey by this name
                      }
                  }
              }
          }else {
              if (info.otherPubKeyForName) {
                  return this.userCategories.pretender;
              }else {
                  return this.userCategories.nevermet;
              }
          }
      }

      checkTrust({peerName, bareName, userInfo, providedPubKey, peerNames, knownPubKey, knownName, otherNamesForPubKey, otherPubKeyForName, completedChallenge,
          explanation, suspiciousness, category}) {
          console.log("Checking trust for " + peerName, category, this.trustConfig);
          return this.trustConfig[category];
      }
      connectionrequest(peerName, info) {
          // If auto-accept is enabled, automatically accept
          if (this.autoAcceptConnections) {
              console.log("Auto-accepting connection request from", peerName);
              return Promise.resolve(true);
          }
          
          // Otherwise, prompt whether to connect to a peer
          // This can be overridden by listening to the 'connectionrequest' event
          let answer = confirm("Do you want to connect to " + peerName + "?");
          return Promise.resolve(answer);
      }
      trustOrChallenge(peerName) {
          this.keys.getPublicKey(peerName).then((publicKey) => {
              if (!publicKey) {
                  console.log("No public key found for " + peerName);
                  let info = this.completeUserInfo[peerName];
                  
                  // If info doesn't exist, create it with default values
                  if (!info) {
                      info = this._getFullUserInfo(peerName, {});
                      const trustLevel = this.checkTrust(info);
                      info.trustLevel = trustLevel;
                      info.trustLevelString = Object.keys(this.trustLevels).find((key) => this.trustLevels[key] === trustLevel);
                      this.completeUserInfo[peerName] = info;
                  }
                  
                  const trustLevel = info.trustLevel;

                  if ([this.trustLevels.reject].includes(trustLevel)) {
                      console.error("Rejecting connection to " + peerName);
                      this.untrust(peerName);
                      return;
                  }else if ([this.trustLevels.connectandprompt].includes(trustLevel)) {
                      this.connectionrequest(peerName, info).then((connect) => {
                          if (connect) {
                              this.trust(peerName);
                          }else {
                              this.untrust(peerName);
                          }
                      });
                      return;
                  }else if ([this.trustLevels.promptandtrust, this.trustLevels.connectandtrust].includes(trustLevel)) {
                      this.trust(peerName);
                  }
              }else {
                  this.challenge(peerName);
              }
          });
      }
      _returnPublicKey(challenge, senderName) {
          console.log("Challenge received from " + senderName);
          return this.keys.sign(challenge).then((signature) => {
              let answer =  {publicKeyString: this.keys.publicKeyString, signature: signature};
              console.log("Returning public key to " + senderName, answer);
              return answer;
          });
      }
      reset(){
          this.keys.reset();
          this.validatedPeers = [];
      }
      trust(peerName){
          /* trust a peer, assuming they give you a public key they are abe to sign, save that public key to their name */
          let oldPublicKeyString = this.keys.getPublicKeyString(peerName);
          let challengeString = this.keys.getChallengeString();
          return this.sendRTCQuestion("identify", challengeString, peerName).then(({publicKeyString, signature}) => {
               if (oldPublicKeyString && (oldPublicKeyString !== publicKeyString)) {
                  console.error("Public key changed for " + peerName, oldPublicKeyString, publicKeyString);
                  throw new Error("Public key changed for " + peerName);
              }
              return this.keys.verify(publicKeyString, signature, challengeString).then((valid) => {
                  if (valid) {
                      console.log("Signature valid for " + peerName + ", trusting and saving public key");
                      // Check if this public key is already registered to a different name
                      const existingPeers = this.keys.getPeerNames(publicKeyString);
                      if (existingPeers.length > 0 && !existingPeers.includes(peerName)) {
                          // Public key is registered to a different name - update the mapping
                          console.log("Public key already registered to", existingPeers, "updating to", peerName);
                          // Remove old name mappings
                          existingPeers.forEach(oldName => {
                              delete this.keys._knownHostsStrings[oldName];
                          });
                          // Update storage after removing old mappings
                          if (this.keys.storage) {
                              this.keys.storage.setItem("knownHostsStrings", JSON.stringify(this.keys._knownHostsStrings));
                          }
                      }
                      this.keys.savePublicKeyString(peerName, publicKeyString);
                      // Only add to validatedPeers if not already there (prevent duplicates)
                      if (!this.validatedPeers.includes(peerName)) {
                          this.validatedPeers.push(peerName);
                          this.onValidatedPeer(peerName, true);
                      }
                      return true;
                  } else {
                      console.error("Signature invalid for " + peerName);
                      this.untrust(peerName);
                      this.onValidationFailed(peerName);
                      return false;
                  }
              });
          })
      }

      challenge(peerName) {
          /* challenge a peer to prove they have the private key corresponding to the public key you have saved for them */
          let publicKeyString = this.keys.getPublicKeyString(peerName);
          let challengeString = this.keys.getChallengeString();
          return this.sendRTCQuestion("challenge", challengeString, peerName).then((signature) => {
              return this.keys.verify(publicKeyString, signature, challengeString).then((valid) => {
                  console.log("Signature valid for " + peerName, valid);
                  // Only add to validatedPeers if not already there (prevent duplicates)
                  if (!this.validatedPeers.includes(peerName)) {
                      this.validatedPeers.push(peerName);
                      console.log("Validated peers", this.validatedPeers);
                      this.onValidatedPeer(peerName);
                  }

                  return valid;
              }, (err) => {
                  console.error("Error verifying signature of "+ peerName, err);
                  this.untrust(peerName);
                  this.onValidationFailed(peerName);
                  throw err;
              });
          });
      }
      on(event, callback) {
          if (event === "connectionrequest"){
              this.connectionrequest = callback;
              return super.on(event, callback);
          }else {
              return super.on(event, callback);
          }
      }

      onValidatedPeer(peerName, trusting=false) {
          if (trusting) {
              console.log("Trusting peer " + peerName + " is who they say they are.");
          }
          console.log("Peer " + peerName + " validated");
          this.emit('validation', peerName, trusting);
          // Don't emit connectedtopeer here - it causes infinite loops
          // ChatManager now listens to 'validation' events to add users after validation
      }
      onValidationFailed(peerName, message) {
          console.error("Peer " + peerName + " validation failed" + (message ? ": " + message : ""));
          this.emit('validationfailure', peerName, message);
      }
      untrust(peerName) {
          /* remove a public key from a peer */

          this.keys.removePublicKey(peerName);
          console.error("Untrusting peer " + peerName, this.validatedPeers);
          if (this.validatedPeers.includes(peerName)) {
              this.validatedPeers = this.validatedPeers.filter((name) => name !== peerName);
          }
          console.error("Disconnecting from untrusted peer " + peerName, this.validatedPeers);
          this.disconnectFromUser(peerName);
      }
      _sign(challengeString, peerName) {return this.keys.sign(challengeString);}
      register(identity) {return this.keys.register(identity);}
  }

  /**
   * RTCVideoChat - Core logic for managing video streams and calls
   * 
   * This class manages MediaStream objects and call lifecycle without any UI dependencies.
   * It provides callbacks for UI updates, making it easy to integrate with any UI framework.
   * 
   * Note: This is a legacy component. New code should use CallManager instead.
   * 
   * Usage:
   *   import { RTCVideoChat } from './rtc-video-chat.js';
   *   
   *   const videoChat = new RTCVideoChat(rtcClient, {
   *     setLocalSrc: (stream) => { // update local video element
   *     },
   *     setRemoteSrc: (stream, peerName) => { // update remote video element
   *     },
   *     hide: () => { // hide video UI
   *     },
   *     show: () => { // show video UI
   *     }
   *   });
   * 
   * @module rtc-video-chat
   */

  class RTCVideoChat {
    /**
     * Create a new RTCVideoChat instance
     * @param {Object} rtc - RTC client instance
     * @param {Function} setLocalSrc - Callback to set local video source
     * @param {Function} setRemoteSrc - Callback to set remote video source
     * @param {Function} hide - Callback to hide video UI
     * @param {Function} show - Callback to show video UI
     */
    constructor(rtc, setLocalSrc, setRemoteSrc, hide, show) {
      this.setLocalSrc = setLocalSrc;
      this.setRemoteSrc = setRemoteSrc;

      this.accept = this.accept.bind(this);
      this.close = this.close.bind(this);
      this.closeCall = this.closeCall.bind(this);
      this.endCall = this.endCall.bind(this);
      this.setStreamCount = this.setStreamCount.bind(this);

      this._rtc = null;
      if (rtc) {
        this.rtc = rtc;
      }
      this.pendingNames = [];

      this.localStream = null;
      this.remoteStreams = {};

      if (hide) {
        this.hide = hide;
      }
      if (show) {
        this.show = show;
      }
    }

    get rtc() {
      if (!this._rtc) {
        throw new Error("RTC not set");
      }
      return this._rtc;
    }

    set rtc(rtc) {
      this._rtc = rtc;
      rtc.on('callconnected', this.accept);
      rtc.on('calldisconnected', this.endCall);
    }

    get name() {
      return this.rtc.name;
    }

    call(peerName, promise = 'end') {
      this.pendingNames.push(peerName);
      let { start, end } = this.rtc.callUser(peerName);
      end = end.then(() => {
        this.close(peerName);
      });
      if (promise === 'end') {
        return end;
      }
      return start;
    }

    endCall(peerName = 'all') {
      if (peerName === 'all') {
        for (let name of Object.keys(this.remoteStreams)) {
          this.endCall(name);
        }
      }
      if (this.remoteStreams[peerName]) {
        this.rtc.endCallWithUser(peerName);
      }
      this.closeCall(peerName);
    }

    accept(name, streams) {
      if (streams instanceof Promise) {
        streams.then(streams => this.accept(name, streams));
        return;
      }
      if (this.pendingNames.includes(name)) {
        this.pendingNames = this.pendingNames.filter(n => n !== name);
      }

      if (!this.localStream) {
        this.localStream = streams.localStream;
        this.setLocalSrc(this.localStream);
      }
      this.setRemoteSrc(streams.remoteStream, name);
      this.remoteStreams[name] = streams.remoteStream;
      this.setStreamCount(Object.keys(this.remoteStreams).length);
    }

    closeCall(peerName) {
      this.pendingNames = this.pendingNames.filter(name => name !== peerName);
      this.setRemoteSrc(null, peerName);
      let rs = this.remoteStreams[peerName];
      if (rs) {
        try {
          rs.getTracks().forEach(track => track.stop());
        } catch (e) {
          // Ignore errors when stopping tracks
        }
        delete this.remoteStreams[peerName];
        this.setStreamCount(Object.keys(this.remoteStreams).length);
      }
    }

    setStreamCount(count) {
      if (!count) {
        if (this.localStream) {
          try {
            this.localStream.getTracks().forEach(track => track.stop());
          } catch (e) {
            // Ignore errors when stopping tracks
          }
          this.setLocalSrc(null);
          this.localStream = null;
        }
        this.setLocalSrc(null);
        this.localStream = null;
        this.hide();
      } else {
        this.show();
      }
    }

    hide() {
      // Override in subclass or via constructor
    }

    show() {
      // Override in subclass or via constructor
    }

    close() {
      // End all streams
      this.endCall();
    }
  }

  /**
   * BasicVideoChat - Web Component UI for displaying video
   * 
   * This is a UI component that uses RTCVideoChat (from core) for business logic.
   * It provides a Web Component interface for video calling.
   * 
   * Usage:
   *   import { BasicVideoChat } from './video-chat.js';
   *   import { RTCVideoChat } from '../core/rtc-video-chat.js';
   *   
   *   const videoChat = new BasicVideoChat(rtcClient, {
   *     window: window,        // Optional: inject window object
   *     assignToWindow: false // Optional: disable window.vc assignment
   *   });
   *   document.body.appendChild(videoChat);
   * 
   *   // Start a call
   *   videoChat.call('PeerName').then(() => {
   *     console.log('Call started');
   *   });
   * 
   *   // End a call
   *   videoChat.endCall('PeerName');
   * 
   * Features:
   * - Local video preview (small overlay)
   * - Remote video display (main view)
   * - Automatic stream management
   * - Multiple peer support
   * - Call state management
   * - Responsive layout
   * 
   * @module video-chat
   */



  class BasicVideoChat extends HTMLElement {
      constructor(rtc, options = {}) {
          super();
          
          // Inject window object or use global window
          this._window = options.window || (typeof window !== 'undefined' ? window : null);
          this._assignToWindow = options.assignToWindow !== false;
          
          this.attachShadow({ mode: 'open' });
          this.shadowRoot.innerHTML = `
            <style>
                #container {
                    position: relative;
                    width: 100%;
                    height: 100%; /* Full height of the container */
                    max-width: 50vw;
                    max-height: 50vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                #remoteVideo, #localVideo {
                    max-width: 100%;
                    height: auto; /* Maintain aspect ratio */
                }

                #remoteVideo {
                    width: 100%; /* Full width of the container */
                    max-width: 50vw;
                    max-height: 50vh;
                }

                #localVideo {
                    position: absolute;
                    width: 20%; /* Smaller size for local video */
                    top: 10px;
                    right: 10px;
                    border: 2px solid white;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                    max-height: 100%;
                }

            </style>
            <div id="container">
                <video id="remoteVideo" autoplay playsinline></video>
                <video id="localVideo" autoplay playsinline muted></video>
            </div>
        `;
          this.localVideo = this.shadowRoot.getElementById('localVideo');
          this.remoteVideo = this.shadowRoot.getElementById('remoteVideo');
          this.container = this.shadowRoot.getElementById('container');
          this.setLocalSrc = this.setLocalSrc.bind(this);
          this.setRemoteSrc = this.setRemoteSrc.bind(this);
          this.hide = this.hide.bind(this);
          this.show = this.show.bind(this);
          this.resize = this.resize.bind(this);
          
          // Add resize listener if window is available
          if (this._window) {
              this._window.addEventListener('resize', this.resize);
          }
          
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

          this.call = this.rtcVC.call.bind(this.rtcVC);
          this.endCall = this.rtcVC.endCall.bind(this.rtcVC);
          this.hide = this.rtcVC.hide.bind(this.rtcVC);
          this.show = this.rtcVC.show.bind(this.rtcVC);
          return this;
      }
      setLocalSrc(src) {
          this.localVideo.srcObject = src;
      }
      setRemoteSrc(src) {
          this.remoteVideo.srcObject = src;
      }
      hide() {
          this.container.style.display = "none";
      }
      show() {
          this.container.style.display = "flex";
      }
      resize() {
          if (!this._window) return;
          
          // Optionally adjust the size based on the window size or other conditions
          const width = this._window.innerWidth;
          const height = this._window.innerHeight;

          // Example: Adjust max-width/max-height based on conditions
          this.container.style.maxWidth = width > 600 ? '50vw' : '80vw';
          this.container.style.maxHeight = height > 600 ? '50vh' : '80vh';
      }

      // Don't forget to remove the event listener when the element is disconnected
      disconnectedCallback() {
          if (this._window) {
              this._window.removeEventListener('resize', this.resize);
          }
      }

  }

  customElements.define('video-chat', BasicVideoChat);

  /**
   * RTChat - Complete chat application with video calling and identity verification
   * 
   * This is the main entry point for the RTChat application. It combines:
   * - ChatBox: UI for text messaging
   * - SignedMQTTRTCClient: Secure RTC client with cryptographic identity verification
   * - BasicVideoChat: Video calling interface
   * 
   * Usage:
   *   <!-- Auto-add to page -->
   *   <script type="module" src="./rtchat.js?add=true"></script>
   *   
   *   <!-- Or manually create -->
   *   <rtc-hat></rtc-hat>
   *   <script type="module">
   *     import { RTChat } from './rtchat.js';
   *     const chat = document.querySelector('rtc-hat');
   *   </script>
   * 
   * Features:
   * - Text chat with room-based messaging
   * - Video/audio calling between peers
   * - Cryptographic identity verification (RSA-PSS)
   * - Trust level management (strict, moderate, lax, etc.)
   * - Connection request prompts
   * - Validation notifications
   * - Persistent room/name settings in localStorage
   * 
   * Configuration:
   *   const chat = new RTChat({
   *     showRoom: true,        // Show/hide room name in header (default: true)
   *     allowRoomChange: true, // Allow editing room name (default: true)
   *     showRoomInput: true,   // Show/hide legacy room input field
   *     topic: 'myroom',       // Chat room name
   *     trustMode: 'moderate' // Trust level: 'strict', 'moderate', 'lax', 'unsafe', etc.
   *   });
   * 
   * Trust Modes:
   * - strict: Only trust known peers, prompt for others
   * - moderate: Trust known peers and aliases, prompt for suspicious cases
   * - lax: Trust most peers, prompt only for very suspicious cases
   * - unsafe: Trust everyone (not recommended)
   * 
   * Events:
   * - 'connectionrequest': Fired when a peer wants to connect (returns Promise<boolean>)
   * - 'validation': Fired when a peer is validated (peerName, trusted)
   * - 'validationfailure': Fired when validation fails (peerName, message)
   * - 'call': Fired when receiving a call (peerName, info, promises)
   * - 'callended': Fired when a call ends
   * 
   * @module rtchat
   */



  class RTChat extends ChatBox {
      constructor(config, VC = BasicVideoChat) {
          // Must call super() first before accessing 'this'
          super(config || {});
          
          // Store config for later use (use this.config from parent, or merge with provided config)
          const providedConfig = config || {};
          this._config = { ...this.config, ...providedConfig };
          
          // Store VC for later use
          this._VC = VC;
          
          // Flag to track if we've applied auto-config
          this._autoConfigApplied = false;
          this._VC = VC;

          // Configure room display and editability
          this.showRoom = this._config.showRoom !== false; // Default: true
          this.allowRoomChange = this._config.allowRoomChange !== false; // Default: true

          // Note: chatRoomBox no longer exists - room input is now in ChatHeader component
          // The showRoomInput config is handled by ChatHeader's showRoom config
          
          this.prompt = this.prompt.bind(this);
          this.notify = this.notify.bind(this);
          this.connectionrequest = this.connectionrequest.bind(this);
          this._activeConnectionPrompts = new Map(); // Track active prompts by peer name
          
          // Use defaultRoom from config if provided, otherwise localStorage, otherwise 'chat'
          let topic = this._config.topic || localStorage.getItem('topic') || 'chat';
          // If topic is an object, extract the room
          if (typeof topic === 'object' && topic.room) {
              topic = topic.room;
          }
          
          // Set room in ChatHeader component
          if (this.chatHeaderComponent) {
              this.chatHeaderComponent.setRoom(topic);
          }
          
          // Listen for room change events from ChatHeader component
          if (this.chatHeaderComponent) {
              this.chatHeaderComponent.addEventListener('roomchange', (e) => {
                  const newRoom = e.detail.room;
                  localStorage.setItem('topic', newRoom);
                  this.connectRTC(this._config);
              });
          }
          
          // Also listen for room change events from ChatBox (backward compatibility)
          this.addEventListener('roomchange', (e) => {
              const newRoom = e.detail.room;
              localStorage.setItem('topic', newRoom);
              this.connectRTC(this._config);
          });
          
          this.connectRTC = this.connectRTC.bind(this);
          this.connectRTC(this._config);
          // Don't add BasicVideoChat if ChatBox is using VideoStreamDisplay
          // ChatBox now handles video display internally, so we skip the legacy VC component
          // this.vc = new VC(this.rtc);
          // this.vc.hide();
          // this.chatVideo.appendChild(this.vc);
          this.lastValidated = "";

      }
      
      /**
       * Called when the element is connected to the DOM
       * Use this to apply auto-config that was set before element creation
       */
      connectedCallback() {
          // Check for auto-config from URL parameters (when ?add=true)
          // Check if there's a pending config in the queue
          if (autoConfigPending.length > 0 && !this._autoConfigApplied) {
              const autoConfig = autoConfigPending.shift(); // Get and remove first pending config
              this._autoConfigApplied = true;
              
              // Merge auto-config into existing config
              Object.assign(this.config, autoConfig);
              // Also update _config for RTChat-specific properties
              this._config = { ...this._config, ...autoConfig };
              
              // Re-apply config-dependent settings
              this.showRoom = this._config.showRoom !== false;
              this.allowRoomChange = this._config.allowRoomChange !== false;
              
              // Re-initialize with new config if needed
              if (this._config.topic) {
                  let topic = this._config.topic;
                  if (typeof topic === 'object' && topic.room) {
                      topic = topic.room;
                  }
                  // Set room in ChatHeader component
                  if (this.chatHeaderComponent) {
                      this.chatHeaderComponent.setRoom(topic);
                  }
                  // Reconnect with new config
                  if (this.connectRTC) {
                      this.connectRTC(this._config);
                  }
              }
          }
          
          // Call parent's connectedCallback if it exists
          if (super.connectedCallback) {
              super.connectedCallback();
          }
      }
      
      connectRTC(config) {
          config = config || {};
          // Use topic from config if provided, otherwise localStorage, otherwise 'chat'
          let topic = config.topic || localStorage.getItem('topic') || 'chat';
          // If topic is an object, extract the room
          if (typeof topic === 'object' && topic.room) {
              topic = topic.room;
          }
          // Use new nested config format
          if (!config.topic || typeof config.topic === 'string') {
              config.topic = { room: config.topic || topic };
          } else if (!config.topic.room) {
              config.topic.room = topic;
          }
          config.trustMode = config.trustMode || 'moderate';
          this.rtc = new SignedMQTTRTCClient(config);
          this.rtc.shouldTrust = (peerName) => {return Promise.resolve(true)};
          this.rtc.on('connectionrequest', this.connectionrequest);
          // Note: Incoming calls are now handled by CallManager, not here
          // The 'call' event is handled by CallManager._handleIncomingCall which uses
          // CallUIInterface.showIncomingCallPrompt (implemented by CallManagement)
          // DO NOT add a direct 'call' event handler here - it will add prompts to messages!
          
          // Note: callended events are now handled by CallManager
          // DO NOT add cleanup here for pending calls - CallManager handles this

          this.rtc.on('validation', (peerName, trusted) => {
              if (trusted) {
                  this.notify(`Trusted ${peerName}`);
              } else {
                  this.notify(`Validated ${peerName}`);
              }
              // Update call button visibility if callButton exists (legacy support)
              if (this.callButton) {
                  this.callButton.style.display = "block";
                  this.callButton.title = `Call ${peerName}`;
              }
              //set help text to show the last validated peer
              this.lastValidated = peerName;
          });
          this.rtc.on('callended', ()=>{
              // Update button visibility if buttons exist (legacy support)
              if (this.callButton) {
                  this.callButton.style.display = "block";
              }
              if (this.endCallButton) {
                  this.endCallButton.style.display = "none";
              }
          });
          // Legacy call button handlers - only if vc exists (disabled since we're using ChatBox video display)
          // if (this.callButton && this.vc) {
          //     this.callButton.onclick = () => {
          //         this.callButton.style.display = "none";
          //         if (this.endCallButton) {
          //             this.endCallButton.style.display = "block";
          //         }
          //         this.vc.call(this.lastValidated);
          //     }
          // }
          // if (this.endCallButton && this.vc) {
          //     this.endCallButton.onclick = () => {
          //         this.vc.endCall();
          //     };
          // }
          this.rtc.on('validationfailure', (peerName, message) => {
              this.notify(`Validation failed for ${peerName}`);
          });
      }
      notify(message) {
          // Use ChatBox's cached messages element (cached as 'messages' -> this.messages)
          const messagesEl = this.messages || this.shadowRoot?.getElementById('messages');
          if (messagesEl) {
              let el = document.createElement('div');
              el.innerHTML = message;
              el.style.color = 'gray';
              el.style.fontSize = '0.8em';
              messagesEl.appendChild(el);
          } else {
              console.warn('Cannot display notification: messages element not found', message);
          }
      }

      /**
       * Show a missed call notification message
       * @param {string} peerName - Name of the peer
       * @param {string} direction - 'incoming' or 'outgoing'
       * @private
       */
      _showMissedCallMessage(peerName, direction) {
          const message = direction === 'incoming' 
              ? `Missed call from ${peerName}`
              : `${peerName} missed your call`;
          
          // Create a notification-style message element
          const messageEl = document.createElement('div');
          messageEl.style.color = '#666';
          messageEl.style.fontSize = '0.85em';
          messageEl.style.fontStyle = 'italic';
          messageEl.style.marginBottom = '5px';
          messageEl.style.padding = '5px';
          messageEl.style.backgroundColor = '#fff3cd';
          messageEl.style.borderLeft = '3px solid #ffc107';
          messageEl.style.borderRadius = '3px';
          messageEl.textContent = message;
          
          // Add to messages
          const messagesEl = this.messages || this.shadowRoot?.getElementById('messages');
          if (messagesEl) {
              messagesEl.appendChild(messageEl);
              // Auto-scroll to bottom
              messagesEl.scrollTop = messagesEl.scrollHeight;
          }
      }

      connectionrequest(peerName, info) {
          let {bareName, userInfo, providedPubKey, peerNames, knownPubKey, knownName, otherNamesForPubKey, otherPubKeyForName, completedChallenge,
          explanation, suspiciousness, category, trustLevel, trustLevelString} = info;
          console.log("connectionrequest", peerName, trustLevel, trustLevelString, explanation, info);

          // Check localStorage for auto-accept setting
          const autoAcceptEnabled = localStorage.getItem('rtchat_autoAccept') === 'true';
          if (autoAcceptEnabled) {
              console.log("Auto-accepting connection request from", peerName);
              return Promise.resolve(true);
          }

          // Remove existing prompt for this peer if it exists
          if (this._activeConnectionPrompts.has(peerName)) {
              const existingPrompt = this._activeConnectionPrompts.get(peerName);
              if (existingPrompt && existingPrompt.element && existingPrompt.element.parentNode) {
                  existingPrompt.element.remove();
              }
              // Reject the old promise
              if (existingPrompt && existingPrompt.reject) {
                  existingPrompt.reject(new Error('Replaced by new connection request'));
              }
              this._activeConnectionPrompts.delete(peerName);
          }

          // Ensure hint is defined (default to empty string if not set)
          const hint = info.hint || '';
          const promptText = `Do you want to connect to ${peerName}${hint}?`;
          
          // Create a new promise for this prompt
          let promptResolve, promptReject;
          const promptPromise = new Promise((resolve, reject) => {
              promptResolve = resolve;
              promptReject = reject;
          });
          
          // Show the prompt with three options and get the element
          const promptResult = this.prompt(promptText, true); // true = show auto-accept option
          const promptElement = promptResult.element;
          
          // Track this prompt
          this._activeConnectionPrompts.set(peerName, {
              element: promptElement,
              resolve: promptResolve,
              reject: promptReject
          });
          
          // When user responds, clean up
          promptResult.promise.then((result) => {
              this._activeConnectionPrompts.delete(peerName);
              promptResolve(result);
          }).catch((error) => {
              this._activeConnectionPrompts.delete(peerName);
              promptReject(error);
          });
          
          return promptPromise;
      }

      prompt(question, showAutoAccept = false) {
          let el = document.createElement('div');
          el.style.marginBottom = '10px';
          
          // Question text
          let questionEl = document.createElement('div');
          questionEl.innerHTML = question;
          questionEl.style.marginBottom = '8px';
          el.appendChild(questionEl);
          
          // Button container (on separate row)
          let buttonContainer = document.createElement('div');
          buttonContainer.style.display = 'flex';
          buttonContainer.style.gap = '8px';
          buttonContainer.style.flexWrap = 'wrap';
          
          let yes = document.createElement('button');
          yes.innerHTML = "Yes";
          let no = document.createElement('button');
          no.innerHTML = "No";
          
          buttonContainer.appendChild(yes);
          buttonContainer.appendChild(no);
          
          // Create promise first, then attach handlers
          let resolveFn, rejectFn;
          const promise = new Promise((resolve, reject) => {
              resolveFn = resolve;
              rejectFn = reject;
          });
          
          yes.onclick = () => {
              el.remove();
              resolveFn(true);
          };
          no.onclick = () => {
              el.remove();
              rejectFn();
          };
          
          // Add auto-accept option if requested
          if (showAutoAccept) {
              let autoAccept = document.createElement('button');
              autoAccept.innerHTML = "Auto-accept everyone";
              autoAccept.onclick = () => {
                  // Store preference in localStorage
                  localStorage.setItem('rtchat_autoAccept', 'true');
                  el.remove();
                  resolveFn(true);
              };
              buttonContainer.appendChild(autoAccept);
          }
          
          el.appendChild(buttonContainer);
          const messagesEl = this.messages || this.shadowRoot?.getElementById('messages');
          if (messagesEl) {
              messagesEl.appendChild(el);
          }
          
          // Return both the promise and the element for tracking
          return {
              promise: promise,
              element: el
          };
      }

      promptWithOptions(question, options) {
          let el = document.createElement('div');
          el.style.marginBottom = '10px';
          
          // Question text
          let questionEl = document.createElement('div');
          questionEl.innerHTML = question;
          questionEl.style.marginBottom = '8px';
          el.appendChild(questionEl);
          
          // Button container (on separate row)
          let buttonContainer = document.createElement('div');
          buttonContainer.style.display = 'flex';
          buttonContainer.style.gap = '8px';
          buttonContainer.style.flexWrap = 'wrap';
          
          // Create promise first, then attach handlers
          let resolveFn;
          const promise = new Promise((resolve, reject) => {
              resolveFn = resolve;
          });
          
          // Create buttons for each option
          options.forEach(option => {
              let btn = document.createElement('button');
              btn.innerHTML = option.text;
              btn.onclick = () => {
                  el.remove();
                  resolveFn(option.value);
              };
              buttonContainer.appendChild(btn);
          });
          
          el.appendChild(buttonContainer);
          const messagesEl = this.messages || this.shadowRoot?.getElementById('messages');
          if (messagesEl) {
              messagesEl.appendChild(el);
          }
          
          // Return both the promise and the element for tracking
          return {
              promise: promise,
              element: el
          };
      }
  }

  window.RTChat = RTChat;
  window.SignedMQTTRTCClient = SignedMQTTRTCClient;

  // Global config queue for auto-config (before element creation)
  // Store pending configs in an array - we'll match them to elements in connectedCallback
  const autoConfigPending = [];

  customElements.define('rtc-hat', RTChat);

  // Get script URL - works for both ES modules and IIFE bundles
  function getScriptUrl() {
      // For ES modules
      if (typeof ({ url: (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('rtchat.js', document.baseURI).href) }) !== 'undefined' && (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('rtchat.js', document.baseURI).href)) {
          return (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('rtchat.js', document.baseURI).href);
      }
      // For IIFE bundles (regular script tags)
      if (typeof document !== 'undefined') {
          const script = document.currentScript || 
              Array.from(document.getElementsByTagName('script')).pop();
          if (script && script.src) {
              return script.src;
          }
      }
      // Fallback
      return window.location.href;
  }

  if (['t','true','yes','y','1'].includes((new URL(getScriptUrl()).searchParams.get('add') || "").toLowerCase())) {
      window.addEventListener('load', () => {
          const urlParams = new URL(getScriptUrl()).searchParams;
          
          // Parse search parameters
          const config = {};
          
          // showRoom: default true, set to false if 'false', '0', 'no', etc.
          const showRoomParam = urlParams.get('showRoom');
          if (showRoomParam !== null) {
              config.showRoom = !['false', '0', 'no', 'n', 'f'].includes(showRoomParam.toLowerCase());
          }
          
          // editableRoom (allowRoomChange): default true, set to false if 'false', '0', 'no', etc.
          const editableRoomParam = urlParams.get('editableRoom');
          if (editableRoomParam !== null) {
              config.allowRoomChange = !['false', '0', 'no', 'n', 'f'].includes(editableRoomParam.toLowerCase());
          }
          
          // defaultRoom: set the initial room/topic
          const defaultRoomParam = urlParams.get('defaultRoom');
          if (defaultRoomParam !== null) {
              config.topic = defaultRoomParam;
          }
          
          // Store config in pending queue BEFORE creating element
          if (Object.keys(config).length > 0) {
              autoConfigPending.push(config);
          }
          
          // Create element - constructor will run immediately
          // Don't set any properties on the element during or immediately after creation
          const chatElement = document.createElement('rtc-hat');
          
          // Append to DOM - this will trigger connectedCallback which will apply the config
          document.body.appendChild(chatElement);
      });
  }

  exports.BasicVideoChat = BasicVideoChat;
  exports.RTChat = RTChat;
  exports.SignedMQTTRTCClient = SignedMQTTRTCClient;

  return exports;

})({});
//# sourceMappingURL=rtchat.js.map
