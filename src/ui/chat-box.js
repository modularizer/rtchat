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

export { ChatBox };