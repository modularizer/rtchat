/**
 * MessageInputHTMLElementBase - HTMLElement-based base for message input component
 * 
 * This class extends UIComponentBase (which extends HTMLElement) and implements
 * the MessageInputBase contract. This allows concrete implementations to
 * extend this class and get both HTMLElement functionality and the abstract contract.
 * 
 * @extends UIComponentBase
 * @implements MessageInputBase
 */

import { UIComponentBase } from '../../core/interfaces/ui-component-base.js';
import { MessageInputBase } from '../../core/interfaces/message-input-base.js';

export class MessageInputHTMLElementBase extends UIComponentBase {
  /**
   * Create a new MessageInputHTMLElementBase instance
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super(config);
    
    // Initialize abstract base functionality
    // MessageInputBase doesn't require additional initialization
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
   * Default implementation dispatches custom event
   * @param {string} message - Message text
   * @protected
   */
  _onSend(message) {
    this.dispatchCustomEvent('sendmessage', { message });
  }

  /**
   * Notify that emoji button was clicked
   * Default implementation dispatches custom event
   * @protected
   */
  _onEmojiClick() {
    this.dispatchCustomEvent('emojiclick');
  }

  /**
   * Notify that clear button was clicked
   * Default implementation dispatches custom event
   * @protected
   */
  _onClearClick() {
    this.dispatchCustomEvent('clearclick');
  }
}

