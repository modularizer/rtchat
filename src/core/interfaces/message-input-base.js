/**
 * MessageInputBase - Abstract base class for message input components
 * 
 * This abstract class defines the contract for message input and controls.
 * It is implementation-agnostic and can be implemented using HTMLElement,
 * React, Vue, or any other framework.
 * 
 * @abstract
 */
export class MessageInputBase {
  /**
   * Create a new MessageInputBase instance
   * @param {Object} config - Configuration options
   * @param {string} config.callModes - Call modes ('audio' | 'video' | 'both')
   */
  constructor(config = {}) {
    if (new.target === MessageInputBase) {
      throw new Error('MessageInputBase is abstract and cannot be instantiated directly');
    }
    
    this.config = {
      callModes: config.callModes || 'both',
      ...config
    };
  }

  /**
   * Get the message input value
   * Must be implemented by subclasses
   * @returns {string} Current input value
   * @abstract
   */
  getValue() {
    throw new Error('getValue must be implemented by subclass');
  }

  /**
   * Clear the message input
   * Must be implemented by subclasses
   * @abstract
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }

  /**
   * Enable or disable the input
   * Must be implemented by subclasses
   * @param {boolean} enabled - Whether input should be enabled
   * @abstract
   */
  setEnabled(enabled) {
    throw new Error('setEnabled must be implemented by subclass');
  }

  /**
   * Notify that a message should be sent
   * Subclasses should call this when user wants to send a message
   * @param {string} message - Message text
   * @protected
   */
  _onSend(message) {
    if (this.onSend) {
      this.onSend(message);
    }
  }

  /**
   * Notify that emoji button was clicked
   * Subclasses should call this when emoji button is clicked
   * @protected
   */
  _onEmojiClick() {
    if (this.onEmojiClick) {
      this.onEmojiClick();
    }
  }

  /**
   * Notify that clear button was clicked
   * Subclasses should call this when clear button is clicked
   * @protected
   */
  _onClearClick() {
    if (this.onClearClick) {
      this.onClearClick();
    }
  }
}

