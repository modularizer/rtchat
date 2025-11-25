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
 * @extends UIComponentBase
 */

import { UIComponentBase } from '../../core/interfaces/ui-component-base.js';

class MessageInput extends UIComponentBase {
  constructor(config = {}) {
    super({
      callModes: config.callModes || 'both', // 'audio' | 'video' | 'both'
      ...config
    });
    
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
    this.inputContainer = this.queryRoot('.input-container');
    this.inputMessage = this.queryRoot('#input-message');
    this.emojiButton = this.queryRoot('#emoji-button');
    this.clearButton = this.queryRoot('#clear-button');
  }
  
  /**
   * Initialize the component
   * @protected
   */
  _initialize() {
    // Component is ready after shadow DOM is set up
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
        this.dispatchCustomEvent('emojiclick');
      });
    }
    
    // Clear button
    if (this.clearButton) {
      this.clearButton.addEventListener('click', () => {
        this.dispatchCustomEvent('clearclick');
      });
    }
    
    // Call buttons are now in the call-management section, not here
  }
  
  _onSend() {
    const message = this.inputMessage.value.trim();
    if (message) {
      this.dispatchCustomEvent('sendmessage', { message });
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

if (!customElements.get('message-input')) {
  customElements.define('message-input', MessageInput);
}
export { MessageInput };

