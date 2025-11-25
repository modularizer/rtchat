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

class ChatBox extends HTMLElement {
  primaryUserColor = 'lightblue';
  userColors = [
    'lightcoral',
    'lightseagreen',
    'lightsalmon',
    'lightgreen',
  ]
  constructor() {
    super();
    this._rtc = null;
    this._storage = null; // Storage adapter (injected)
    this._allowRoomChange = true; // Default: allow room changes
    this._showRoom = true; // Default: show room name
    this._baseTopic = ''; // Base MQTT topic prefix
    this._currentRoom = ''; // Current room name
    this._callModes = 'both'; // 'audio' | 'video' | 'both'
    this._videoDisplayComponent = null; // Optional custom video display component class
    this._callTimeout = 15000; // Call timeout in milliseconds (default: 15 seconds)

    this.name = "?"
    this.history = [];
    this.activeUsers = [];

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>

        .rounded {
            border-radius: 5px;
        }
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
          background-color: ${this.primaryUserColor};
          padding: 10px;
          font-weight: bold;
          border-top-left-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        #room-display {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        #room-display > span:first-child {
          margin-right: 5px;
        }
        #room-prefix {
          color: gray;
          font-weight: normal;
        }
        #chat-header > div:last-child {
          margin-left: 5px;
        }
        #room-name {
          font-weight: normal;
          padding: 2px 5px;
          border-radius: 3px;
          width: 160px;
          border: 1px solid #333;
          background-color: white;
        }
        #chat-video {
          max-height: 40vh;
          overflow: auto;
          display: none;
          padding: 10px;
        }
        #chat-audio {
          max-height: 20vh;
          overflow: auto;
          display: none;
          padding: 10px;
        }
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
          display: none;
        }
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
          width: 30%;
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
        #active-users {
          font-size: 0.8em;
        }
        #messages {
          margin-bottom: 10px;
        }
        #input-container {
          margin-top: 30px;
        }

        @media only screen and (max-width: 1000px){
          #chat-container {
            min-width: 50vw !important;
          }
        }

      </style>
      <div id="chat-container">
        <div id="chat-header">
            <div id="room-display">
                <span>Room:</span>
                <span id="room-prefix"></span>
                <input id="room-name" type="text" class="rounded">
            </div>
            <div id='chat-room-box' style="display: none;">
                room: <input id="chat-room" style="width: 200px" class="rounded">
            </div>
            <div>
                Your name: <input id="chat-name" style="width: 200px" class="rounded">
            </div>
        </div>

        <div id="chat-video"></div>
        <div id="chat-audio"></div>
        <div id="chat-body">
          <div id="active-users"></div>
          <div id="messages"></div>
          <div id="input-container" style="display: flex; align-items: center; gap: 5px;">
            <button id="audio-call-button" style="display: none;color:green" title="Start audio call">Audio</button>
            <button id="video-call-button" style="display: none;color:green" title="Start video call">Video</button>
            <button id="end-call-button" style="display: none;color:red" title="End call">End</button>
            <input id="input-message" type="text" placeholder="Type a message..." style="flex: 1;">
            <button id="emoji-button" style="display: inline-block">👋</button>
            <button id="clear-button" title="Clear chat view (only clears your side, doesn't delete messages)">🗑️</button>
          </div>
        </div>
      </div>
    `;

    // Elements
    this.chatHeader = this.shadowRoot.getElementById('chat-header');
    this.chatVideo = this.shadowRoot.getElementById('chat-video');
    this.chatAudio = this.shadowRoot.getElementById('chat-audio');
    this.audioCallButton = this.shadowRoot.getElementById('audio-call-button');
    this.videoCallButton = this.shadowRoot.getElementById('video-call-button');
    this.endCallButton = this.shadowRoot.getElementById('end-call-button');
    this.chatBody = this.shadowRoot.getElementById('chat-body');
    
    // Initialize video stream display component (use custom or default)
    const VideoComponent = this._videoDisplayComponent || VideoStreamDisplay;
    this.videoDisplay = new VideoComponent(this.chatVideo, {
      localVideoSize: '25%', // Self-view is 1/4 the size of remote video
      localVideoPosition: 'top-right'
    });
    
    // Initialize audio stream display component
    this.audioDisplay = new AudioStreamDisplay(this.chatAudio);
    
    // Initialize call ringer for incoming calls
    this.ringer = new CallRinger({ volume: 0.3 });
    
    // Initialize notification sound for connection events
    this.notificationSound = new NotificationSound({ volume: 0.2 });
    
    // Track active calls by type
    this.activeVideoCalls = new Set();
    this.activeAudioCalls = new Set();
    this.pendingCalls = new Map(); // Track pending calls to stop ringing when answered
    this.outgoingCalls = new Map(); // Track outgoing calls (before answered) - Map<user, {type, cancelFn}>
    this.activeCallType = null; // Track which type of call is active ('audio' or 'video')
    
    // Setup call button handlers
    this._setupCallButtons();
    this.chatRoom = this.shadowRoot.getElementById('chat-room');
    this.chatRoomBox = this.shadowRoot.getElementById('chat-room-box');
    this.roomPrefix = this.shadowRoot.getElementById('room-prefix');
    this.roomName = this.shadowRoot.getElementById('room-name');
    this.chatName = this.shadowRoot.getElementById('chat-name');
    this.activeUsersEl = this.shadowRoot.getElementById('active-users');
    this.messagesEl = this.shadowRoot.getElementById('messages');
    this.emojiButton = this.shadowRoot.getElementById('emoji-button');
    this.inputMessage = this.shadowRoot.getElementById('input-message');
    this.clearButton = this.shadowRoot.getElementById('clear-button');
    
    // Room name editing
    if (this._allowRoomChange) {
      this.roomName.addEventListener('blur', () => this.finishRoomEdit());
      this.roomName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.finishRoomEdit();
        } else if (e.key === 'Escape') {
          this.cancelRoomEdit();
        }
      });
    } else {
      // Make input read-only if not editable
      this.roomName.readOnly = true;
    }
    
    // Set initial visibility
    const roomDisplay = this.shadowRoot.getElementById('room-display');
    if (roomDisplay) {
      roomDisplay.style.display = this._showRoom ? 'flex' : 'none';
    }
    this.clearButton.addEventListener('click', () => {
        this.messagesEl.innerHTML = "";
    })
    
    // Initially disable inputs (no one else in room yet)
    this.updateInputState();


    this.emojiButton.addEventListener('click', ()=>{this.sendMessage("👋");});

    // Use storage adapter if available, otherwise fall back to localStorage
    const nameFromStorage = this.storage ? 
      this.storage.getItem("name") : 
      (typeof localStorage !== 'undefined' ? localStorage.getItem("name") : null);
    this.chatName.value = nameFromStorage || "?";
    this.chatName.addEventListener('change', (() => {
        console.log("Name changed to " + this.chatName.value);
        if (this.rtc){
            this.rtc.changeName(this.chatName.value);
            this.name = this.rtc.name;
            this.chatName.value = this.name;
        }else{
            this.name = this.chatName.value;
        }
    }).bind(this));


    this.sendMessage = this.sendMessage.bind(this);

    this.inputMessage.addEventListener('keydown', (e) => {
        if (e.key === "Enter" && !e.ctrlKey){
            this.sendMessage();
        }
        e.stopPropagation();
    })

    // Event listeners
    this.chatHeader.addEventListener('click', () => this.toggleChat());
    
    // Stop propagation on input fields to prevent collapsing when clicking to edit
    const stopPropagation = (e) => e.stopPropagation();
    this.roomName.addEventListener('click', stopPropagation);
    this.roomName.addEventListener('mousedown', stopPropagation);
    this.chatName.addEventListener('click', stopPropagation);
    this.chatName.addEventListener('mousedown', stopPropagation);
    
    // Stop propagation on the room display container and name container
    if (roomDisplay) {
      roomDisplay.addEventListener('click', stopPropagation);
      roomDisplay.addEventListener('mousedown', stopPropagation);
    }
    const nameContainer = this.shadowRoot.querySelector('#chat-header > div:last-child');
    if (nameContainer) {
      nameContainer.addEventListener('click', stopPropagation);
      nameContainer.addEventListener('mousedown', stopPropagation);
    }

    // Load initial history
    this.history.forEach((entry) => this.appendMessage(entry));

    this.chatBody.style.display = "block";
    
    // Update call button visibility based on callModes
    this._updateCallButtonVisibility();

  }

  /**
   * Setup call button event handlers
   * @private
   */
  _setupCallButtons() {
    // Audio call button - can transform into cancel/end button
    if (this.audioCallButton) {
      this.audioCallButton.addEventListener('click', () => {
        const buttonText = this.audioCallButton.textContent;
        if (buttonText === 'End' || buttonText === 'Cancel') {
          // Button is currently "End" or "Cancel" - end/cancel the call
          if (buttonText === 'Cancel') {
            // Cancel outgoing call
            const outgoingCall = Array.from(this.outgoingCalls.values()).find(call => call.type === 'audio');
            if (outgoingCall && outgoingCall.cancelFn) {
              outgoingCall.cancelFn();
            }
          } else {
            // End active call
            this._endAllCalls();
          }
        } else {
          // Button is "Audio" - start audio call
          this._startCall('audio');
        }
      });
    }
    
    // Video call button - can transform into cancel/end button
    if (this.videoCallButton) {
      this.videoCallButton.addEventListener('click', () => {
        const buttonText = this.videoCallButton.textContent;
        if (buttonText === 'End' || buttonText === 'Cancel') {
          // Button is currently "End" or "Cancel" - end/cancel the call
          if (buttonText === 'Cancel') {
            // Cancel outgoing call
            const outgoingCall = Array.from(this.outgoingCalls.values()).find(call => call.type === 'video');
            if (outgoingCall && outgoingCall.cancelFn) {
              outgoingCall.cancelFn();
            }
          } else {
            // End active call
            this._endAllCalls();
          }
        } else {
          // Button is "Video" - start video call
          this._startCall('video');
        }
      });
    }
    
    // End call button (fallback)
    if (this.endCallButton) {
      this.endCallButton.addEventListener('click', () => {
        this._endAllCalls();
      });
    }
  }

  /**
   * Update call button visibility based on callModes
   * @private
   */
  _updateCallButtonVisibility() {
    if (!this.audioCallButton || !this.videoCallButton) {
      return;
    }

    const modes = this._callModes;
    const hasUsers = this.activeUsers.length > 0;
    
    // Hide all buttons first
    this.audioCallButton.style.display = 'none';
    this.videoCallButton.style.display = 'none';
    
    // Show appropriate buttons based on callModes
    if (modes === 'both') {
      // Show separate audio and video buttons
      if (hasUsers) {
        this.audioCallButton.style.display = 'inline-block';
        this.videoCallButton.style.display = 'inline-block';
      }
    } else if (modes === 'audio') {
      // Show only audio button
      if (hasUsers) {
        this.audioCallButton.style.display = 'inline-block';
      }
    } else if (modes === 'video') {
      // Show only video button
      if (hasUsers) {
        this.videoCallButton.style.display = 'inline-block';
      }
    }
  }

  /**
   * Start a call (audio or video)
   * @param {string} type - 'audio' or 'video'
   * @private
   */
  _startCall(type) {
    if (!this._rtc || this.activeUsers.length === 0) {
      return;
    }

    // Stop any ongoing ringing (in case we're calling while receiving)
    this.ringer.stop();

    // For now, call the first active user (could be enhanced to select user)
    const targetUser = this.activeUsers[0];
    
    const callInfo = type === 'audio' 
      ? { video: false, audio: true }
      : { video: true, audio: true };
    
    // Track which button was clicked
    this.activeCallType = type;
    
    // Create cancel function for this outgoing call
    let timeoutId = null;
    const cancelCall = () => {
      console.log(`Canceling ${type} call to ${targetUser}`);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      this.outgoingCalls.delete(targetUser);
      try {
        this._rtc.endCallWithUser(targetUser);
      } catch (err) {
        console.error(`Error canceling call:`, err);
      }
      this.activeCallType = null;
      this._updateCallButtonStates(false);
    };
    
    // Track outgoing call
    this.outgoingCalls.set(targetUser, { type, cancelFn: cancelCall, timeoutId: null });
    
    // Update button states to show cancel button
    this._updateCallButtonStates(true, type, true); // true = isOutgoing
    
    try {
      const { start, end } = this._rtc.callUser(targetUser, callInfo);
      
      // Set up timeout for unanswered call
      timeoutId = setTimeout(() => {
        console.log(`Call to ${targetUser} timed out after ${this._callTimeout}ms`);
        // Show missed call message before canceling
        this._showMissedCallMessage(targetUser, 'outgoing');
        // Properly end the call to stop streams
        if (this._rtc) {
          try {
            this._rtc.endCallWithUser(targetUser);
          } catch (err) {
            console.warn('Error ending timed out call:', err);
          }
        }
        // Clean up streams
        this.videoDisplay.removeStreams(targetUser);
        this.audioDisplay.removeStreams(targetUser);
        this.activeVideoCalls.delete(targetUser);
        this.activeAudioCalls.delete(targetUser);
        // Call cancel function to clean up UI
        cancelCall();
      }, this._callTimeout);
      
      // Store timeout ID for cleanup
      const outgoingCall = this.outgoingCalls.get(targetUser);
      if (outgoingCall) {
        outgoingCall.timeoutId = timeoutId;
      }
      
      start.then(({ localStream, remoteStream }) => {
        console.log(`${type} call connected with ${targetUser}`, { localStream, remoteStream });
        
        // Remove from outgoing calls (now connected)
        this.outgoingCalls.delete(targetUser);
        
        // Update button states - transform clicked button into end button
        this._updateCallButtonStates(true, type);
        
        if (type === 'audio') {
          this.activeAudioCalls.add(targetUser);
          this.audioDisplay.setStreams(targetUser, { localStream, remoteStream });
        } else {
          this.activeVideoCalls.add(targetUser);
          this.videoDisplay.setStreams(targetUser, { localStream, remoteStream });
        }
      }).catch(err => {
        console.error(`Failed to start ${type} call:`, err);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.outgoingCalls.delete(targetUser);
        this.activeCallType = null;
        this._updateCallButtonStates(false);
      });
      
      end.then(() => {
        console.log(`${type} call ended with ${targetUser}`);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.outgoingCalls.delete(targetUser);
        if (type === 'audio') {
          this.activeAudioCalls.delete(targetUser);
          this.audioDisplay.removeStreams(targetUser);
        } else {
          this.activeVideoCalls.delete(targetUser);
          this.videoDisplay.removeStreams(targetUser);
        }
        this.activeCallType = null;
        this._updateCallButtonStates(false);
      });
    } catch (err) {
      console.error(`Error starting ${type} call:`, err);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.outgoingCalls.delete(targetUser);
      this.activeCallType = null;
      this._updateCallButtonStates(false);
    }
  }

  /**
   * End all active calls
   * @private
   */
  _endAllCalls() {
    if (!this._rtc) {
      return;
    }

    // Stop ringing
    this.ringer.stop();

    // End all video calls
    for (const user of this.activeVideoCalls) {
      try {
        this._rtc.endCallWithUser(user);
      } catch (err) {
        console.error(`Error ending video call with ${user}:`, err);
      }
      this.videoDisplay.removeStreams(user);
    }
    this.activeVideoCalls.clear();

    // End all audio calls
    for (const user of this.activeAudioCalls) {
      try {
        this._rtc.endCallWithUser(user);
      } catch (err) {
        console.error(`Error ending audio call with ${user}:`, err);
      }
      this.audioDisplay.removeStreams(user);
    }
    this.activeAudioCalls.clear();

    // Clear pending calls and outgoing calls
    this.pendingCalls.clear();
    this.outgoingCalls.clear();
    this.activeCallType = null;

    // Update button states
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
    const hasActiveCalls = this.activeVideoCalls.size > 0 || this.activeAudioCalls.size > 0;
    const hasOutgoingCalls = this.outgoingCalls.size > 0;
    const showEndButton = inCall || hasActiveCalls || hasOutgoingCalls;
    const showCallButtons = !showEndButton && this.activeUsers.length > 0;

    if (showEndButton && callType) {
      if (isOutgoing) {
        // Outgoing call - show "Cancel" button
        if (callType === 'audio' && this.audioCallButton) {
          this.audioCallButton.textContent = 'Cancel';
          this.audioCallButton.style.color = 'red';
          this.audioCallButton.style.display = 'inline-block';
          // Hide the other call button
          if (this.videoCallButton) {
            this.videoCallButton.style.display = 'none';
          }
          // Hide the separate end button
          if (this.endCallButton) {
            this.endCallButton.style.display = 'none';
          }
        } else if (callType === 'video' && this.videoCallButton) {
          this.videoCallButton.textContent = 'Cancel';
          this.videoCallButton.style.color = 'red';
          this.videoCallButton.style.display = 'inline-block';
          // Hide the other call button
          if (this.audioCallButton) {
            this.audioCallButton.style.display = 'none';
          }
          // Hide the separate end button
          if (this.endCallButton) {
            this.endCallButton.style.display = 'none';
          }
        }
      } else {
        // Active call - show "End" button
        if (callType === 'audio' && this.audioCallButton) {
          this.audioCallButton.textContent = 'End';
          this.audioCallButton.style.color = 'red';
          this.audioCallButton.style.display = 'inline-block';
          // Hide the other call button
          if (this.videoCallButton) {
            this.videoCallButton.style.display = 'none';
          }
          // Hide the separate end button
          if (this.endCallButton) {
            this.endCallButton.style.display = 'none';
          }
        } else if (callType === 'video' && this.videoCallButton) {
          this.videoCallButton.textContent = 'End';
          this.videoCallButton.style.color = 'red';
          this.videoCallButton.style.display = 'inline-block';
          // Hide the other call button
          if (this.audioCallButton) {
            this.audioCallButton.style.display = 'none';
          }
          // Hide the separate end button
          if (this.endCallButton) {
            this.endCallButton.style.display = 'none';
          }
        }
      }
    } else if (showEndButton && !callType) {
      // Use the separate end button if we don't know which button was clicked
      if (this.endCallButton) {
        this.endCallButton.style.display = 'inline-block';
      }
      // Hide call buttons
      if (this.audioCallButton) {
        this.audioCallButton.style.display = 'none';
      }
      if (this.videoCallButton) {
        this.videoCallButton.style.display = 'none';
      }
    } else {
      // Not in a call - restore button states
      if (this.audioCallButton) {
        this.audioCallButton.textContent = 'Audio';
        this.audioCallButton.style.color = 'green';
      }
      if (this.videoCallButton) {
        this.videoCallButton.textContent = 'Video';
        this.videoCallButton.style.color = 'green';
      }
      if (this.endCallButton) {
        this.endCallButton.style.display = 'none';
      }
      
      // Show call buttons based on call modes
      if (showCallButtons) {
        this._updateCallButtonVisibility();
      }
    }
  }
  /**
   * Get or set the call timeout in milliseconds
   * @param {number} timeout - Timeout in milliseconds (default: 15000)
   * @returns {number} Current call timeout
   */
  get callTimeout() {
    return this._callTimeout;
  }
  
  set callTimeout(timeout) {
    if (typeof timeout === 'number' && timeout > 0) {
      this._callTimeout = timeout;
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
    return this._showRoom;
  }
  set showRoom(show) {
    this._showRoom = show;
    const roomDisplay = this.shadowRoot.getElementById('room-display');
    if (roomDisplay) {
      roomDisplay.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * Get or set whether room changes are allowed
   * @param {boolean} allow - Whether to allow room changes
   * @returns {boolean} Current allowRoomChange setting
   */
  get allowRoomChange() {
    return this._allowRoomChange;
  }
  set allowRoomChange(allow) {
    this._allowRoomChange = allow;
    if (this.roomName) {
      this.roomName.readOnly = !allow;
    }
  }

  /**
   * Get or set call modes ('audio' | 'video' | 'both')
   * @param {string} modes - Call modes to expose
   * @returns {string} Current call modes
   */
  get callModes() {
    return this._callModes;
  }
  set callModes(modes) {
    this._callModes = modes;
    this._updateCallButtonVisibility();
  }

  /**
   * Get or set custom video display component class
   * @param {Function} componentClass - Custom VideoStreamDisplay-compatible component class
   * @returns {Function|null} Current video display component class
   */
  get videoDisplayComponent() {
    return this._videoDisplayComponent;
  }
  set videoDisplayComponent(componentClass) {
    this._videoDisplayComponent = componentClass;
    // Reinitialize video display if RTC is already set
    if (this._rtc && this.chatVideo) {
      const VideoComponent = componentClass || VideoStreamDisplay;
      this.videoDisplay = new VideoComponent(this.chatVideo, {
        localVideoSize: '30%'
      });
    }
  }

  get rtc(){return this._rtc}
  set rtc(rtc){
    this._rtc = rtc;
    this.send = rtc.sendRTCChat;
    this.name = rtc.name;
    this.chatName.value = this.name;
    
    // Store base topic and extract room from full topic
    this._baseTopic = rtc.baseTopic || '';
    const fullTopic = rtc.topic || '';
    
    // Extract room name from full topic (baseTopic/room or just room)
    let roomName = fullTopic;
    if (this._baseTopic && fullTopic.startsWith(this._baseTopic)) {
      // Remove base topic and separator (usually '/')
      const separator = fullTopic[this._baseTopic.length] || '/';
      roomName = fullTopic.substring(this._baseTopic.length + separator.length);
    }
    this._currentRoom = roomName;
    
    this.chatRoom.value = roomName;
    
    // Display prefix as text and room name in input box
    const separator = this._baseTopic && fullTopic.startsWith(this._baseTopic) 
      ? fullTopic[this._baseTopic.length] || '/' 
      : '';
    this.roomPrefix.textContent = this._baseTopic ? `${this._baseTopic}${separator}` : '';
    this.roomName.value = roomName;
    
    // Set read-only based on editability
    this.roomName.readOnly = !this._allowRoomChange;
    
    rtc.on('chat', this.receiveRTCChat.bind(this));
    rtc.on('connectedtopeer', this.onConnectedToUser.bind(this));
    rtc.on('disconnectedfrompeer', this.onDisconnectedFromUser.bind(this));
    rtc.on('callconnected', this.onCallConnected.bind(this));
    rtc.on('call', this.onIncomingCall.bind(this));
    rtc.on('callended', this.onCallEnded.bind(this));
//    rtc.onRTCChat = (message, sender) => {this.receive.bind(this)({data: message, sender: sender, timestamp: Date.now()})};
//    rtc.onConnectedToUser = this.onConnectedToUser.bind(this);
//    rtc.onDisconnectedFromUser = this.onDisconnectedFromUser.bind(this);
  }
  
  finishRoomEdit() {
    const newRoom = this.roomName.value.trim();
    if (newRoom && newRoom !== this._currentRoom) {
      this._currentRoom = newRoom;
      this.chatRoom.value = newRoom;
      // Dispatch event for parent to handle reconnection
      this.dispatchEvent(new CustomEvent('roomchange', {
        detail: { room: newRoom },
        bubbles: true
      }));
    }
  }
  
  cancelRoomEdit() {
    // Restore original value
    this.roomName.value = this._currentRoom;
  }
  receiveRTCChat(message, sender){
    this.receive({data: message, sender: sender, timestamp: Date.now()});
  }
  setHistory(history){
    this.history = history;
    this.history.forEach((entry) => this.appendMessage(entry));
  }

  send(message){
    console.warn("No MQTT connection");
  }
  receive({data, sender, timestamp}) {
    this.history.push({ data, sender, timestamp });
    this.appendMessage({ data, sender, timestamp });
  }

  toggleChat() {
    this.chatBody.style.display = this.chatBody.style.display === 'none' ? 'block' : 'none';
  }

  sendMessage(data) {
    data = data || this.inputMessage.value;
    this.send(data);
    this.appendMessage({ data, sender: this.name + "( You )", timestamp: new Date() });
    this.inputMessage.value = '';
  }

  appendMessage({ data, sender, timestamp }) {
        // Create a message element with a chat bubble style
        const messageEl = document.createElement('div');
        messageEl.style.padding = '5px 10px';
        messageEl.style.margin = '5px';
        messageEl.style.borderRadius = '10px';
        messageEl.style.maxWidth = '60%';
        messageEl.innerText = data;

        // Check the sender and adjust the alignment and color
        if (sender === this.name + "( You )") {
            messageEl.style.backgroundColor = this.primaryUserColor;
            messageEl.style.color = 'white';
            messageEl.style.marginLeft = 'auto';  // Aligns the bubble to the right
        } else {
            messageEl.style.backgroundColor = this.userColors[this.activeUsers.indexOf(sender)];
            messageEl.style.color = 'black';
            messageEl.style.marginRight = 'auto';  // Aligns the bubble to the left
        }

        // Hover effect to show timestamp
        messageEl.title = new Date(timestamp).toLocaleString();  // Showing timestamp on hover

        // Append the chat bubble to the messages container
        this.messagesEl.appendChild(messageEl);
    }

  onConnectedToUser(user) {
    // Play ping sound for new connection
    this.notificationSound.ping().catch(err => {
      // Silently fail - audio might not be available or require user interaction
      console.debug('Could not play connection ping:', err);
    });
    
    this.activeUsers.push(user);
    let bubble = document.createElement('p');
    bubble.style.backgroundColor = this.userColors[this.activeUsers.indexOf(user)];
//    bubble.style.width = '20px';
    bubble.style.height = '20px';
    bubble.style.borderRadius = '5px';
    bubble.style.padding = '0px 5px';
    bubble.style.display = 'inline-block';
    bubble.style.textAlign = 'center';
    bubble.style.lineHeight = '20px'; // Vertically center the text
    bubble.style.color = 'white'; // Ensuring text is visible against background
    bubble.style.fontSize = '12px'; // Smaller font size for small bubbles
    bubble.style.cursor = 'pointer'; // Change cursor on hover to indicate interactivity
    bubble.style.overflow = 'hidden'; // Prevents text from spilling out
    bubble.style.whiteSpace = 'nowrap'; // Keeps the content on a single line
    bubble.innerText = user; // Showing the first character of the username

    // Tooltip to show the full username on hover
    bubble.title = user;

    // Optionally, add event listener for further interaction
    bubble.addEventListener('click', () => {
        alert('User: ' + user);
    });

    this.activeUsersEl.appendChild(bubble);
    
    // Enable inputs when someone connects
    this.updateInputState();
    
    // Update call button visibility
    this._updateCallButtonVisibility();
}


  onDisconnectedFromUser(user) {
    try{
    let oldColor = this.userColors[this.activeUsers.indexOf(user)];

    //remove bubble
    this.activeUsersEl.removeChild(this.activeUsersEl.children[this.activeUsers.indexOf(user)]);
    //remove old color and move to end
    this.userColors = this.userColors.filter((color) => color !== oldColor).concat([oldColor]);
    this.activeUsers = this.activeUsers.filter((u) => u !== user);
    }catch{}
    
    // If this user was in a call, automatically end the call
    const wasInVideoCall = this.activeVideoCalls.has(user);
    const wasInAudioCall = this.activeAudioCalls.has(user);
    
    if (wasInVideoCall || wasInAudioCall) {
      console.log(`User ${user} disconnected during call, ending call automatically`);
      
      // Properly end the call
      if (this._rtc) {
        try {
          this._rtc.endCallWithUser(user);
        } catch (err) {
          console.warn(`Error ending call with disconnected user ${user}:`, err);
        }
      }
      
      // Cleanup streams and call tracking
      this.videoDisplay.removeStreams(user);
      this.audioDisplay.removeStreams(user);
      this.activeVideoCalls.delete(user);
      this.activeAudioCalls.delete(user);
      
      // Clean up outgoing calls
      if (this.outgoingCalls.has(user)) {
        const outgoingCall = this.outgoingCalls.get(user);
        if (outgoingCall && outgoingCall.timeoutId) {
          clearTimeout(outgoingCall.timeoutId);
        }
        this.outgoingCalls.delete(user);
      }
      
      // Reset call type if this was the only active call
      if (this.activeVideoCalls.size === 0 && this.activeAudioCalls.size === 0) {
        this.activeCallType = null;
      }
      
      // Update button states
      this._updateCallButtonStates(false);
    } else {
      // Just cleanup streams if they exist (shouldn't happen, but be safe)
      this.videoDisplay.removeStreams(user);
      this.audioDisplay.removeStreams(user);
      this.activeVideoCalls.delete(user);
      this.activeAudioCalls.delete(user);
    }
    
    // Disable inputs if no one else is in the room
    this.updateInputState();
    
    // Update call button visibility
    this._updateCallButtonVisibility();
  }
  
  updateInputState() {
    const hasOtherUsers = this.activeUsers.length > 0;
    const isDisabled = !hasOtherUsers;
    
    // Disable/enable message input
    if (this.inputMessage) {
      this.inputMessage.disabled = isDisabled;
      this.inputMessage.placeholder = isDisabled 
        ? "Waiting for others to join..." 
        : "Type a message...";
    }
    
    // Disable/enable emoji button
    if (this.emojiButton) {
      this.emojiButton.disabled = isDisabled;
    }
    
    // Disable/enable clear button
    if (this.clearButton) {
      this.clearButton.disabled = isDisabled;
    }
  }

  onIncomingCall(peerName, callInfo, promises) {
    console.log('Incoming call from', peerName, 'callInfo:', callInfo);
    
    // Start ringing (try to resume audio context first for autoplay policy)
    this.ringer.start().catch(err => {
      console.warn('Could not start ringtone (may require user interaction):', err);
    });
    
    // Set up timeout for unanswered incoming call
    let timeoutId = setTimeout(() => {
      console.log(`Incoming call from ${peerName} timed out after ${this._callTimeout}ms`);
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
    }, this._callTimeout);
    
    // Track pending call with timeout ID
    this.pendingCalls.set(peerName, { callInfo, promises, timeoutId });
    
    // Auto-accept calls (could be made configurable)
    // The RTC client expects this handler to return a Promise that resolves to true to accept
    // The actual stream handling will happen in the 'callconnected' event
    // Also listen to the start promise to stop ringing when call connects
    promises.start.then(({ localStream, remoteStream }) => {
      // Clear timeout since call was answered
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      // Stop ringing when call is answered
      this.ringer.stop();
      const pendingCall = this.pendingCalls.get(peerName);
      if (pendingCall) {
        pendingCall.timeoutId = null;
      }
      this.pendingCalls.delete(peerName);
      console.log(`Call start promise resolved for ${peerName}`);
    }).catch(err => {
      // Clear timeout
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
    if (this.messagesEl) {
      this.messagesEl.appendChild(messageEl);
      // Auto-scroll to bottom
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  onCallConnected(sender, {localStream, remoteStream}) {
    // Stop ringing when call connects
    this.ringer.stop();
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
      
      // Ensure video container is visible
      if (this.chatVideo) {
        this.chatVideo.style.display = 'block';
        console.log('Video container displayed');
      }
    } else if (hasAudio) {
      // Audio-only call
      console.log('Setting up audio call for', sender);
      this.activeAudioCalls.add(sender);
      this.audioDisplay.setStreams(sender, { localStream, remoteStream });
    } else {
      console.warn('Call connected but no video or audio tracks detected for', sender);
    }
  }


}
customElements.define('chat-box', ChatBox);

export { ChatBox };