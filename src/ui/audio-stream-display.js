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

export { AudioStreamDisplay };

