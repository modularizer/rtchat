/**
 * ChatHeaderHTMLElementBase - HTMLElement-based base for chat header component
 * 
 * This class extends UIComponentBase (which extends HTMLElement) and implements
 * the ChatHeaderBase contract. This allows concrete implementations to
 * extend this class and get both HTMLElement functionality and the abstract contract.
 * 
 * @extends UIComponentBase
 * @implements ChatHeaderBase
 */

import { UIComponentBase } from '../../core/interfaces/ui-component-base.js';
import { ChatHeaderBase } from '../../core/interfaces/chat-header-base.js';

export class ChatHeaderHTMLElementBase extends UIComponentBase {
  /**
   * Create a new ChatHeaderHTMLElementBase instance
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super(config);
    
    // Initialize abstract base functionality
    // ChatHeaderBase doesn't require additional initialization
  }

  /**
   * Set the room name
   * Must be implemented by subclasses
   * @param {string} room - Room name
   * @abstract
   */
  setRoom(room) {
    throw new Error('setRoom must be implemented by subclass');
  }

  /**
   * Set the user name
   * Must be implemented by subclasses
   * @param {string} name - User name
   * @abstract
   */
  setName(name) {
    throw new Error('setName must be implemented by subclass');
  }

  /**
   * Set the room prefix (base topic)
   * Must be implemented by subclasses
   * @param {string} prefix - Room prefix
   * @abstract
   */
  setRoomPrefix(prefix) {
    throw new Error('setRoomPrefix must be implemented by subclass');
  }

  /**
   * Set whether the header is collapsible
   * Default implementation - can be overridden
   * @param {boolean} collapsible - Whether header should be collapsible
   */
  setCollapsible(collapsible) {
    // Optional - no-op by default
  }

  /**
   * Notify that room name changed
   * Default implementation dispatches custom event
   * @param {string} room - New room name
   * @protected
   */
  _onRoomChange(room) {
    this.dispatchCustomEvent('roomchange', { room });
  }

  /**
   * Notify that user name changed
   * Default implementation dispatches custom event
   * @param {string} name - New user name
   * @protected
   */
  _onNameChange(name) {
    this.dispatchCustomEvent('namechange', { name });
  }
}

