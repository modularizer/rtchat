/**
 * ChatHeader - Component for chat header with room and name inputs
 * 
 * @class ChatHeader
 * @extends UIComponentBase
 */

import { UIComponentBase } from '../../core/interfaces/ui-component-base.js';

class ChatHeader extends UIComponentBase {
  constructor(config = {}) {
    super({
      allowRoomChange: config.allowRoomChange !== false,
      showRoom: config.showRoom !== false,
      baseTopic: config.baseTopic || '',
      currentRoom: config.currentRoom || '',
      primaryUserColor: config.primaryUserColor || 'lightblue',
      ...config
    });
    
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
  }
  
  /**
   * Initialize the component
   * @protected
   */
  _initialize() {
    // Set initial room visibility
    if (this.roomDisplay) {
      if (this.getConfig('showRoom')) {
        this.roomDisplay.classList.remove('hidden');
      } else {
        this.roomDisplay.classList.add('hidden');
      }
    }
    
    // Set initial room name
    if (this.roomName) {
      this.roomName.value = this.getConfig('currentRoom') || '';
    }
    
    // Set room prefix
    if (this.roomPrefix) {
      this.roomPrefix.textContent = this.getConfig('baseTopic') || '';
    }
  }
  
  _cacheElements() {
    this.roomDisplay = this.queryRoot('.room-display');
    this.roomPrefix = this.queryRoot('#room-prefix');
    this.roomName = this.queryRoot('#room-name');
    this.chatRoomBox = this.queryRoot('#chat-room-box');
    this.chatRoom = this.queryRoot('#chat-room');
    this.chatName = this.queryRoot('#chat-name');
  }
  
  _setupEventListeners() {
    // Header click to toggle collapse/expand
    const chatHeader = this.queryRoot('.chat-header');
    if (chatHeader) {
      chatHeader.addEventListener('click', (e) => {
        // Only trigger toggle if clicking the header itself, not its interactive children
        this.dispatchCustomEvent('togglecollapse');
      });
    }
    
    // Room name editing
    if (this.roomName) {
      if (this.getConfig('allowRoomChange')) {
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
    this.dispatchCustomEvent('roomchange', { room: newRoom });
  }
  
  _cancelRoomEdit() {
    // Restore previous value
    if (this.roomName) {
      this.roomName.value = this.getConfig('currentRoom') || '';
    }
  }
  
  _onNameChange() {
    const newName = this.chatName.value.trim();
    this.dispatchCustomEvent('namechange', { name: newName });
  }
  
  // Public API
  setRoom(room) {
    if (this.roomName) {
      this.roomName.value = room;
    }
    this.setConfig('currentRoom', room);
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
    this.setConfig('baseTopic', prefix);
  }
  
  setCollapsible(collapsible) {
    const header = this.queryRoot('.chat-header');
    if (header) {
      header.style.cursor = collapsible ? 'pointer' : 'default';
    }
  }
}

if (!customElements.get('chat-header')) {
  customElements.define('chat-header', ChatHeader);
}
export { ChatHeader };

