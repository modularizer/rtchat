/**
 * MessagesComponent - Component for displaying chat messages
 * 
 * Supports:
 * - Messages from sender (own messages)
 * - Messages from others
 * - Custom message components
 * 
 * @class MessagesComponent
 * @extends UIComponentBase
 */

import { UIComponentBase } from '../../core/interfaces/ui-component-base.js';

class MessagesComponent extends UIComponentBase {
  constructor(config = {}) {
    super({
      primaryUserColor: config.primaryUserColor || 'lightblue',
      userColors: config.userColors || ['lightcoral', 'lightseagreen', 'lightsalmon', 'lightgreen'],
      ...config
    });
    
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
    
    this.messagesEl = this.queryRoot('.messages');
    this.userColorMap = new Map(); // Map<user, color>
  }
  
  /**
   * Initialize the component
   * @protected
   */
  _initialize() {
    // Component is ready after shadow DOM is set up
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
      messageEl.style.backgroundColor = this.getConfig('primaryUserColor');
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
    if (!user) return this.getConfig('userColors')[0];
    
    if (!this.userColorMap.has(user)) {
      const index = this.userColorMap.size;
      const userColors = this.getConfig('userColors');
      const color = userColors[index % userColors.length];
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
export { MessagesComponent };

