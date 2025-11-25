/**
 * MessagesComponentBase - Abstract base class for messages display components
 * 
 * This abstract class defines the contract for displaying and managing
 * chat messages. It is implementation-agnostic and can be implemented
 * using HTMLElement, React, Vue, or any other framework.
 * 
 * @abstract
 */
export class MessagesComponentBase {
  /**
   * Create a new MessagesComponentBase instance
   * @param {Object} config - Configuration options
   * @param {string} config.primaryUserColor - Color for primary user messages
   * @param {Array<string>} config.userColors - Array of colors for other users
   */
  constructor(config = {}) {
    if (new.target === MessagesComponentBase) {
      throw new Error('MessagesComponentBase is abstract and cannot be instantiated directly');
    }
    
    this.config = {
      primaryUserColor: config.primaryUserColor || 'lightblue',
      userColors: config.userColors || ['lightcoral', 'lightseagreen', 'lightsalmon', 'lightgreen'],
      ...config
    };
    
    this.userColorMap = new Map(); // Map<user, color>
  }

  /**
   * Append a message to the display
   * Must be implemented by subclasses
   * @param {Object} messageData - Message data
   * @param {string|HTMLElement} messageData.data - Message content (string or custom element)
   * @param {string} messageData.sender - Sender name
   * @param {number} messageData.timestamp - Timestamp
   * @param {boolean} messageData.isOwn - Whether this is the current user's message
   * @abstract
   */
  appendMessage(messageData) {
    throw new Error('appendMessage must be implemented by subclass');
  }

  /**
   * Display a message (alias for appendMessage)
   * Default implementation - can be overridden
   * @param {Object} messageData - Message data
   */
  displayMessage(messageData) {
    this.appendMessage(messageData);
  }

  /**
   * Get color for a user (for consistency)
   * Default implementation - can be overridden
   * @param {string} user - User name
   * @returns {string} Color
   */
  getUserColor(user) {
    if (!user) return this.config.userColors[0];
    
    if (!this.userColorMap.has(user)) {
      const index = this.userColorMap.size;
      const userColors = this.config.userColors || [];
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
   * Default implementation - can be overridden
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
   * Must be implemented by subclasses if scrolling is needed
   * @abstract
   */
  scrollToBottom() {
    // Optional - no-op by default
  }
}

