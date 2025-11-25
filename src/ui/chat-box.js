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

import { VideoStreamDisplay } from './video-stream-display.js';
import { AudioStreamDisplay } from './audio-stream-display.js';
import { CallRinger } from './call-ringer.js';
import { NotificationSound } from './notification-sound.js';
import { CallManagement } from './call-management.js';
import { CallManager } from '../core/call-manager.js';
import { ChatManager } from '../core/chat-manager.js';
import { UIConfigInterface } from '../core/interfaces/ui-config-interface.js';
import { StateManager } from '../core/state-manager.js';
import { PluginAdapter } from '../core/plugin-adapter.js';
import { ChatUIInterface } from '../core/interfaces/chat-ui-interface.js';
import { CallUIInterface } from '../core/interfaces/call-ui-interface.js';
import { StreamDisplayInterface } from '../core/interfaces/stream-display-interface.js';
import { RingerInterface } from '../core/interfaces/ringer-interface.js';
import { NotificationInterface } from '../core/interfaces/notification-interface.js';
import { ChatHeader } from './components/chat-header.js';
import { ActiveUsersList } from './components/active-users-list.js';
import { MessagesComponent } from './components/messages-component.js';
import { MessageInput } from './components/message-input.js';

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
            <button id="audio-call-button" class="call-button audio-call" title="Start audio call">Start Audio Call</button>
            <button id="video-call-button" class="call-button video-call" title="Start video call">Start Video Call</button>
          </div>
          <div id="call-info-container"></div>
          <div id="call-controls-container">
            <span id="call-controls-label">Call Controls:</span>
            <button id="call-mute-mic-btn" class="call-control-button" title="Toggle microphone on/off">Mic</button>
            <button id="call-mute-speakers-btn" class="call-control-button" title="Toggle speakers on/off">Speakers</button>
            <button id="call-video-toggle-btn" class="call-control-button" title="Toggle camera on/off">Camera</button>
            <button id="end-call-button" class="call-control-button end-call" title="End call" style="background-color: #f44336; color: white;">End</button>
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
      const cssUrl = new URL('./chat-box.css', import.meta.url).href;
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
    this.activeVideoCalls = new Set(); // Track active video calls
    this.activeAudioCalls = new Set(); // Track active audio calls
    this.localStreams = new Map(); // Track local streams for mute control
    this.pendingCalls = new Map(); // Track pending incoming calls
    this.pinnedAudioCallMessage = null; // Reference to pinned audio call message element
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
    const audioButtonVisible = this.audioCallButton ? this.audioCallButton.classList.contains('visible') : false;
    const videoButtonVisible = this.videoCallButton ? this.videoCallButton.classList.contains('visible') : false;
    
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
    // Note: end call button should always be in call-controls-container, not call-buttons-container
    if (buttonsContainer && buttonsContainer.children.length === 0) {
      // Recreate the buttons (but NOT the end call button - it belongs in call-controls-container)
      if (this.audioCallButton && !buttonsContainer.contains(this.audioCallButton)) {
        buttonsContainer.appendChild(this.audioCallButton);
      }
      if (this.videoCallButton && !buttonsContainer.contains(this.videoCallButton)) {
        buttonsContainer.appendChild(this.videoCallButton);
      }
      // End call button should NOT be added here - it belongs in call-controls-container
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
    
    // Immediately update UI state (don't wait for events)
    // Get current state after ending calls
    const activeCalls = this.callManager.getActiveCalls();
    const hasActiveCalls = activeCalls.video.size > 0 || activeCalls.audio.size > 0;
    
    // Reset call type
    this.activeCallType = null;
    
    // Update button states
    this._updateCallButtonStates(hasActiveCalls);
    this._updateCallButtonVisibility();
    
    // Hide video container if no active calls
    if (!hasActiveCalls) {
      if (this.chatVideo) {
        this.chatVideo.classList.remove('visible');
      }
      if (this.videoDisplay && this.videoDisplay.container) {
        this.videoDisplay.hide();
      }
    }
    
    // Update CallManagement UI state immediately
    if (this.callManagement && typeof this.callManagement._updateFromCallManager === 'function') {
      this.callManagement._updateFromCallManager();
    }
    
    // Also update call controls visibility
    this._updateCallControlsVisibility();
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
    // Note: end call button should always be in call-controls-container, not call-buttons-container
    if (buttonsContainer && buttonsContainer.children.length === 0) {
      // Recreate the buttons (but NOT the end call button - it belongs in call-controls-container)
      if (this.audioCallButton && !buttonsContainer.contains(this.audioCallButton)) {
        buttonsContainer.appendChild(this.audioCallButton);
      }
      if (this.videoCallButton && !buttonsContainer.contains(this.videoCallButton)) {
        buttonsContainer.appendChild(this.videoCallButton);
      }
      // End call button should NOT be added here - it belongs in call-controls-container
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
    
    // Listen to speakers mute changes to actually mute/unmute audio elements
    this.callManager.on('speakersmutechanged', ({muted}) => {
      this.isSpeakersMuted = muted;
      
      // Mute/unmute all remote audio elements (speakers)
      if (this.audioDisplay && this.audioDisplay.activeStreams) {
        for (const [peerName, streamData] of Object.entries(this.audioDisplay.activeStreams)) {
          if (streamData && streamData.container) {
            const remoteAudio = streamData.container.querySelector('.audio-stream-element[data-type="remote"]');
            if (remoteAudio) {
              remoteAudio.muted = muted;
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
              remoteVideo.muted = muted;
            }
          }
        }
      }
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
      // Audio call info is handled by CallManagement, not messages
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
    console.log("ChatBox._handleCallEnded: Handling call ended for " + peerName);
    
    // Stop ringing if call ends (including cancelled calls)
    if (this.ringer && typeof this.ringer.stop === 'function') {
      this.ringer.stop();
    }
    
    // Cleanup streams
    this.videoDisplay.removeStreams(peerName);
    this.audioDisplay.removeStreams(peerName);
    
    // Get current state from CallManager (state is already updated when event fires)
    const activeCalls = this.callManager ? this.callManager.getActiveCalls() : {audio: new Set(), video: new Set()};
    const pendingCalls = this.callManager ? this.callManager.getPendingCalls() : new Set();
    const hasActiveCalls = activeCalls.video.size > 0 || activeCalls.audio.size > 0;
    const hasPendingCalls = pendingCalls.size > 0;
    
    console.log("ChatBox._handleCallEnded: State after call ended - active:", activeCalls, "pending:", pendingCalls);
    
    // Hide video container if no active video calls
    if (activeCalls.video.size === 0) {
      if (this.chatVideo) {
        this.chatVideo.classList.remove('visible');
      }
      // Also hide the video display container directly
      if (this.videoDisplay && this.videoDisplay.container) {
        this.videoDisplay.hide();
      }
    }
    
    // Update pinned audio call message
    this._updatePinnedAudioCallMessage();
    
    // Reset call type
    this.activeCallType = null;
    
    // Update call controls visibility (this will hide controls if no active calls)
    this._updateCallControlsVisibility();
    
    // Update button states based on actual call state (will show start buttons if no active calls)
    this._updateCallButtonStates(hasActiveCalls);
    
    // Update button visibility to restore start call buttons if no active calls AND no pending calls
    this._updateCallButtonVisibility();
    
    // CRITICAL: Update CallManagement UI - this should hide controls and info containers
    // Always update state from CallManager to ensure UI is in correct state
    if (this.callManagement && typeof this.callManagement._updateFromCallManager === 'function') {
      console.log("ChatBox._handleCallEnded: Updating CallManagement UI");
      this.callManagement._updateFromCallManager();
    }
    
    // Ensure call management container is visible so users can start new calls
    // Even when there are no active calls, the container should be visible for start call buttons
    if (this.callManagementContainer) {
      this.callManagementContainer.classList.remove('hidden');
      this.callManagementContainer.style.display = 'flex';
    }
    
    // Also ensure video container is hidden if no active calls
    if (!hasActiveCalls && this.chatVideo) {
      this.chatVideo.classList.remove('visible');
      if (this.videoDisplay && this.videoDisplay.container) {
        this.videoDisplay.hide();
      }
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
    // Get active audio calls from CallManager if available, otherwise use local state
    const activeCalls = this.callManager ? this.callManager.getActiveCalls() : {audio: new Set(), video: new Set()};
    const hasAudioCalls = activeCalls.audio.size > 0;
    
    if (hasAudioCalls) {
      // Create or update pinned message
      if (!this.pinnedAudioCallMessage) {
        this.pinnedAudioCallMessage = document.createElement('div');
        this.pinnedAudioCallMessage.id = 'pinned-audio-call-message';
        this.pinnedAudioCallMessage.className = 'pinned-audio-call';
        
        // Insert at the top of messages
        const messagesEl = this.messagesComponent ? this.messagesComponent.shadowRoot?.querySelector('#messages') || this.messagesComponent : null;
        if (messagesEl && messagesEl.firstChild) {
          messagesEl.insertBefore(this.pinnedAudioCallMessage, messagesEl.firstChild);
        } else if (messagesEl) {
          messagesEl.appendChild(this.pinnedAudioCallMessage);
        }
      }
      
      // Update message content with list of active audio calls
      const callList = Array.from(activeCalls.audio).join(', ');
      const callCount = activeCalls.audio.size;
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
      // Audio call info is handled by CallManagement, not messages
      // Show call controls
      this._updateCallControlsVisibility();
    } else {
      console.warn('Call connected but no video or audio tracks detected for', sender);
    }
  }


}
customElements.define('chat-box', ChatBox);

export { ChatBox };