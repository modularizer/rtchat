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
export { ChatHeader };

