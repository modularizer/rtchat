var RTChatUI = (function (exports) {
  'use strict';

  var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
  /**
   * ChatBox - A Web Component for displaying and managing chat messages
   * 
   * This custom HTML element provides a complete chat interface with:
   * - Message display with chat bubbles (color-coded by user)
   * - Active user list with visual indicators
   * - Message input with keyboard shortcuts (Enter to send)
   * - Room and name configuration
   * - Integration with RTC clients for peer-to-peer messaging
   * 
   * Usage:
   *   <chat-box></chat-box>
   *   <script>
   *     import { LocalStorageAdapter } from './storage/local-storage-adapter.js';
   *     const chatBox = document.querySelector('chat-box');
   *     chatBox.storage = new LocalStorageAdapter(); // Optional: inject storage
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
   * 
   * Events:
   * - Receives 'chat' events from RTC client
   * - Receives 'connectedtopeer' and 'disconnectedfrompeer' events
   * 
   * @class ChatBox
   * @extends HTMLElement
   */
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

      this.name = "?";
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
        <div id="chat-body">
          <div id="active-users"></div>
          <div id="messages"></div>
          <div id="input-container" style="display: flex; align-items: center; gap: 5px;">
            <button id="call-button" style="display: none;color:green">&#x260E;</button>
            <button id="end-call-button" style="display: none;color:red">&#x260E;</button>
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
      this.callButton = this.shadowRoot.getElementById('call-button');
      this.endCallButton = this.shadowRoot.getElementById('end-call-button');
      this.chatBody = this.shadowRoot.getElementById('chat-body');
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
      });
      
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
          }else {
              this.name = this.chatName.value;
          }
      }).bind(this));


      this.sendMessage = this.sendMessage.bind(this);

      this.inputMessage.addEventListener('keydown', (e) => {
          if (e.key === "Enter" && !e.ctrlKey){
              this.sendMessage();
          }
          e.stopPropagation();
      });

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
      
      // Disable inputs if no one else is in the room
      this.updateInputState();
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


  }
  customElements.define('chat-box', ChatBox);

  /**
   * Video Chat Components - WebRTC video calling interface
   * 
   * Provides video calling functionality with local and remote video streams.
   * Consists of two classes:
   * - RTCVideoChat: Core logic for managing video streams and calls
   * - BasicVideoChat: Web Component UI for displaying video
   * 
   * Usage:
   *   import { BasicVideoChat } from './video-chat.js';
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
   * RTCVideoChat (Core Logic):
   * - Manages MediaStream objects (local and remote)
   * - Handles call lifecycle (start, accept, end)
   * - Integrates with RTC client for signaling
   * - Provides callbacks for UI updates (setLocalSrc, setRemoteSrc, hide, show)
   * 
   * BasicVideoChat (Web Component):
   * - Custom element: <video-chat></video-chat>
   * - Displays video elements with proper styling
   * - Handles window resizing (via injected window object)
   * - Auto-hides when no active calls
   * 
   * Integration:
   * The video chat automatically receives 'callconnected' events from the RTC client
   * and displays the video streams. It also handles 'calldisconnected' events.
   * 
   * @module video-chat
   */

  class RTCVideoChat  {
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
      call(peerName, promise='end') {
          this.pendingNames.push(peerName);
          let {start, end} = this.rtc.callUser(peerName);
          end = end.then((() => {
              this.close(peerName);
          }).bind(this));
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
          if (this.remoteStreams[peerName]){
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
          if (rs){
              try {
                  rs.getTracks().forEach(track => track.stop());
              }catch{}
              delete this.remoteStreams[peerName];
              this.setStreamCount(Object.keys(this.remoteStreams).length);
          }
      }
      setStreamCount(count) {
          if (!count) {
              if (this.localStream) {
                  try{
                      this.localStream.getTracks().forEach(track => track.stop());
                  }catch{}
                  this.setLocalSrc(null);
                  this.localStream = null;
              }
              this.setLocalSrc(null);
              this.localStream = null;
              this.hide();
          }else {
              this.show();
          }
      }
      hide() {

      }
      show() {

      }
      close() {
          // end the streams
          this.endCall();
      }
  }


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

  // Preset configurations
  const ConfigPresets = {
    // Default - balanced for most use cases
    default: () => new RTCConfig({}),
    
    // High performance - multiple STUN servers, optimized settings
    performance: () => new RTCConfig({
      webrtc: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceTransportPolicy: 'all'
      },
      connection: {
        autoReconnect: true,
        reconnectDelay: 500
      }
    }),
    
    // Privacy-focused - custom STUN/TURN servers
    privacy: (customServers) => new RTCConfig({
      webrtc: {
        iceServers: customServers || [
          // User should provide their own servers
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    }),
    
    // Development - local MQTT broker
    development: (localBroker = 'ws://localhost:1883') => new RTCConfig({
      mqtt: {
        broker: localBroker
      },
      debug: true
    }),
    
    // Production - optimized for production use
    production: () => new RTCConfig({
      compression: { enabled: true },
      history: { maxLength: 500 },
      connection: {
        autoReconnect: true,
        maxReconnectAttempts: 10
      },
      debug: false
    })
  };

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
              return conn && conn.peerConnection.connectionState === "connected";
            });
            
            if (!hasActiveConnections || announcementCount < 5) {
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
                  return conn && conn.peerConnection.connectionState === "connected";
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
              console.log("Received MQTT message on " + this.topic  + " subtopic " + subtopic + " from " + payload.sender, payload.data);
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
      
      console.log("Sending message to " + this.topic + " subtopic " + subtopic, data);
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
          console.log("Received notice that someone else connected:" + payload.sender, payload, payload.data);
          
          // Check if we're already connected and the connection is healthy
          const existingConnection = this.rtcConnections[payload.sender];
          if (existingConnection) {
              const connectionState = existingConnection.peerConnection.connectionState;
              const iceConnectionState = existingConnection.peerConnection.iceConnectionState;
              
              // If connection is healthy, ignore this connect message (likely a periodic announcement)
              if (connectionState === "connected" && 
                  (iceConnectionState === "connected" || iceConnectionState === "completed")) {
                  console.log("Already connected to " + payload.sender + ", ignoring connect message");
                  this.knownUsers[payload.sender] = payload.data; // Update user info
                  return;
              }
              
              // Connection exists but is broken, disconnect it
              if (connectionState === "failed" || connectionState === "closed" ||
                  iceConnectionState === "failed" || iceConnectionState === "closed") {
                  console.warn("Connection to " + payload.sender + " is broken, disconnecting");
                  this.disconnectFromUser(payload.sender);
              } else {
                  // Connection is in progress (connecting, etc.), don't interfere
                  console.log("Connection to " + payload.sender + " is in progress (" + connectionState + "), ignoring");
                  this.knownUsers[payload.sender] = payload.data; // Update user info
                  return;
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
          callStartPromise = this.rtcConnections[user].startCall(localStream).then(remoteStream => {
              return {localStream, remoteStream};
          });
      }else {
          callInfo = callInfo || {video: true, audio: true};
          callStartPromise = navigator.mediaDevices.getUserMedia(callInfo).then(localStream => {
              return this.rtcConnections[user].startCall(localStream).then(remoteStream => {
                  return {localStream, remoteStream};
              });
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
              if (r){
                  return navigator.mediaDevices.getUserMedia(callInfo)
              }else {
                  return Promise.reject("Call rejected");
              }
          })
      }
    }
    oncallended(user){
      console.log("Call ended with " + user);
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
          let streamInfo = {video: true, audio: true};//TODO: read from stream
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
              console.warn("Wrong state " + this.peerConnection.signalingState);
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
              this.mqttClient.callFromUser(this.target, {video: true, audio: true}, this.initiatedCall, this.callPromises).then(stream => {
                  if (!this.streamConnection){
                      this.streamConnection = this._makeStreamConnection(stream);
                  }
                  return this.streamConnection;
              }).catch(e => {
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
              console.log("Sending stream ice", this, event.candidate);
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
              setTimeout(()=> {this.trustOrChallenge.bind(this)(peerName);}, 1000);
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
                      this.onValidatedPeer(peerName, true);
                      this.validatedPeers.push(peerName);
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
                  this.validatedPeers.push(peerName);
                  console.log("Validated peers", this.validatedPeers);
                  this.onValidatedPeer(peerName);

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
          super();
          config = config || {};
          
          // Check for auto-config from URL parameters (when ?add=true)
          if (this._autoConfig) {
              config = { ...config, ...this._autoConfig };
              delete this._autoConfig;
          }

          // Configure room display and editability
          this.showRoom = config.showRoom !== false; // Default: true
          this.allowRoomChange = config.allowRoomChange !== false; // Default: true

          if (!config.showRoomInput){
              this.chatRoomBox.style.display = "none";
          }
          this.prompt = this.prompt.bind(this);
          this.notify = this.notify.bind(this);
          this.connectionrequest = this.connectionrequest.bind(this);
          this._activeConnectionPrompts = new Map(); // Track active prompts by peer name
          // Use defaultRoom from config if provided, otherwise localStorage, otherwise 'chat'
          let topic = config.topic || localStorage.getItem('topic') || 'chat';
          // If topic is an object, extract the room
          if (typeof topic === 'object' && topic.room) {
              topic = topic.room;
          }
          this.chatRoom.value = topic;
          this.chatRoom.addEventListener('change', () => {
              localStorage.setItem('topic', this.chatRoom.value);
              this.connectRTC(config);
          });
          
          // Listen for room change events from ChatBox
          this.addEventListener('roomchange', (e) => {
              const newRoom = e.detail.room;
              localStorage.setItem('topic', newRoom);
              this.connectRTC(config);
          });
          
          this.connectRTC = this.connectRTC.bind(this);
          this.connectRTC(config);
          this.vc = new VC(this.rtc);
          this.vc.hide();
          this.chatVideo.appendChild(this.vc);
          this.lastValidated = "";

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
          this.incomingCalls = {};
          this.rtc.on('call', (peerName, info, promises) => {
              return this.prompt(`Accept call from ${peerName}`).then(answer => {
                  this.callButton.style.display = "none";
                  this.endCallButton.style.display = "block";
                  return answer
              });
          });

          this.rtc.on('validation', (peerName, trusted) => {
              if (trusted) {
                  this.notify(`Trusted ${peerName}`);
              } else {
                  this.notify(`Validated ${peerName}`);
              }
              this.callButton.style.display = "block";
              //set help text to show the last validated peer
              this.lastValidated = peerName;
              this.callButton.title = `Call ${this.lastValidated}`;

          });
          this.rtc.on('callended', ()=>{
              this.callButton.style.display = "block";
              this.endCallButton.style.display = "none";
          });
          this.callButton.onclick = () => {
              this.callButton.style.display = "none";
              this.endCallButton.style.display = "block";
              this.vc.call(this.lastValidated);
          };
          this.endCallButton.onclick = () => {
              this.vc.endCall();
          };
          this.rtc.on('validationfailure', (peerName, message) => {
              this.notify(`Validation failed for ${peerName}`);
          });
      }
      notify(message) {
          let el = document.createElement('div');
          el.innerHTML = message;
          el.style.color = 'gray';
          el.style.fontSize = '0.8em';
          this.messagesEl.appendChild(el);
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
          this.messagesEl.appendChild(el);
          
          // Return both the promise and the element for tracking
          return {
              promise: promise,
              element: el
          };
      }
  }

  window.RTChat = RTChat;
  window.SignedMQTTRTCClient = SignedMQTTRTCClient;

  customElements.define('rtc-hat', RTChat);

  // Get script URL - works for both ES modules and IIFE bundles
  function getScriptUrl() {
      // For ES modules
      if (typeof ({ url: (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('rtchat-ui.js', document.baseURI).href) }) !== 'undefined' && (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('rtchat-ui.js', document.baseURI).href)) {
          return (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('rtchat-ui.js', document.baseURI).href);
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
          
          const chatElement = document.createElement('rtc-hat');
          // Apply config if any parameters were provided
          if (Object.keys(config).length > 0) {
              // Store config in element for RTChat constructor to read
              chatElement._autoConfig = config;
          }
          document.body.appendChild(chatElement);
      });
  }

  /**
   * Memory Storage Adapter - In-memory storage for testing or server-side use
   */


  class MemoryAdapter extends StorageAdapter {
    constructor() {
      super();
      this.data = {};
    }
    
    getItem(key) {
      return this.data[key] || null;
    }
    
    setItem(key, value) {
      this.data[key] = String(value);
    }
    
    removeItem(key) {
      delete this.data[key];
    }
    
    clear() {
      this.data = {};
    }
    
    key(index) {
      const keys = Object.keys(this.data);
      return keys[index] || null;
    }
    
    get length() {
      return Object.keys(this.data).length;
    }
  }

  exports.BaseMQTTRTCClient = BaseMQTTRTCClient;
  exports.BasicVideoChat = BasicVideoChat;
  exports.ChatBox = ChatBox;
  exports.ConfigPresets = ConfigPresets;
  exports.DeferredPromise = DeferredPromise;
  exports.EventEmitter = EventEmitter;
  exports.Keys = Keys;
  exports.LocalStorageAdapter = LocalStorageAdapter;
  exports.MQTTLoader = MQTTLoader;
  exports.MQTTRTCClient = MQTTRTCClient;
  exports.MemoryAdapter = MemoryAdapter;
  exports.Peer = Peer;
  exports.PromisefulMQTTRTCClient = PromisefulMQTTRTCClient;
  exports.RTCConfig = RTCConfig;
  exports.RTCConnection = RTCConnection;
  exports.RTCVideoChat = RTCVideoChat;
  exports.RTChat = RTChat;
  exports.SignedMQTTRTCClient = SignedMQTTRTCClient;
  exports.StorageAdapter = StorageAdapter;
  exports.TabManager = TabManager;
  exports.deepMerge = deepMerge;
  exports.isObject = isObject;

  return exports;

})({});
//# sourceMappingURL=rtchat-ui.js.map
