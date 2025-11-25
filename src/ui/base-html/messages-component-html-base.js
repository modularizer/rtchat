/**
 * MessagesComponentHTMLElementBase - HTMLElement-based base for messages component
 * 
 * This class extends UIComponentBase (which extends HTMLElement) and implements
 * the MessagesComponentBase contract. This allows concrete implementations to
 * extend this class and get both HTMLElement functionality and the abstract contract.
 * 
 * @extends UIComponentBase
 * @implements MessagesComponentBase
 */

import { UIComponentBase } from '../../core/interfaces/ui-component-base.js';
import { MessagesComponentBase } from '../../core/interfaces/messages-component-base.js';

export class MessagesComponentHTMLElementBase extends UIComponentBase {
  /**
   * Create a new MessagesComponentHTMLElementBase instance
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super(config);
    
    // Initialize abstract base functionality
    // Initialize properties from MessagesComponentBase
    this.userColorMap = new Map(); // Map<user, color>
  }

  /**
   * Append a message to the display
   * Must be implemented by subclasses
   * @param {Object} messageData - Message data
   * @abstract
   */
  appendMessage(messageData) {
    throw new Error('appendMessage must be implemented by subclass');
  }

  /**
   * Display a message (alias for appendMessage)
   * Default implementation from MessagesComponentBase
   * @param {Object} messageData - Message data
   */
  displayMessage(messageData) {
    this.appendMessage(messageData);
  }

  /**
   * Get color for a user (for consistency)
   * Default implementation from MessagesComponentBase
   * @param {string} user - User name
   * @returns {string} Color
   */
  getUserColor(user) {
    if (!this.userColorMap) {
      this.userColorMap = new Map();
    }
    if (!user) return this.getConfig('userColors')[0];
    
    if (!this.userColorMap.has(user)) {
      const index = this.userColorMap.size;
      const userColors = this.getConfig('userColors') || [];
      const color = userColors[index % userColors.length];
      this.userColorMap.set(user, color);
    }
    return this.userColorMap.get(user);
  }

  /**
   * Set user color explicitly
   * @param {string} user - User name
   * @param {string} color - Color
   */
  setUserColor(user, color) {
    if (!this.userColorMap) {
      this.userColorMap = new Map();
    }
    this.userColorMap.set(user, color);
  }

  /**
   * Clear all messages
   * Must be implemented by subclasses
   * @abstract
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }

  /**
   * Load message history
   * Default implementation from MessagesComponentBase
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
   * Default implementation - can be overridden
   */
  scrollToBottom() {
    // Optional - no-op by default, subclasses should implement
  }
}

