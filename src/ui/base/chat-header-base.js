/**
 * ChatHeaderBase - Abstract base class for chat header components
 * 
 * This abstract class defines the contract for chat header functionality
 * including room and name management. It is implementation-agnostic and
 * can be implemented using HTMLElement, React, Vue, or any other framework.
 * 
 * @abstract
 */
export class ChatHeaderBase {
  /**
   * Create a new ChatHeaderBase instance
   * @param {Object} config - Configuration options
   * @param {boolean} config.allowRoomChange - Whether room changes are allowed
   * @param {boolean} config.showRoom - Whether to show room name
   * @param {string} config.baseTopic - Base MQTT topic prefix
   * @param {string} config.currentRoom - Current room name
   * @param {string} config.primaryUserColor - Primary user color
   */
  constructor(config = {}) {
    if (new.target === ChatHeaderBase) {
      throw new Error('ChatHeaderBase is abstract and cannot be instantiated directly');
    }
    
    this.config = {
      allowRoomChange: config.allowRoomChange !== false,
      showRoom: config.showRoom !== false,
      baseTopic: config.baseTopic || '',
      currentRoom: config.currentRoom || '',
      primaryUserColor: config.primaryUserColor || 'lightblue',
      ...config
    };
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
   * Optional - no-op by default
   * @param {boolean} collapsible - Whether header should be collapsible
   */
  setCollapsible(collapsible) {
    // Optional - no-op by default
  }

  /**
   * Notify that room name changed
   * Subclasses should call this when room name changes
   * @param {string} room - New room name
   * @protected
   */
  _onRoomChange(room) {
    if (this.onRoomChange) {
      this.onRoomChange(room);
    }
  }

  /**
   * Notify that user name changed
   * Subclasses should call this when user name changes
   * @param {string} name - New user name
   * @protected
   */
  _onNameChange(name) {
    if (this.onNameChange) {
      this.onNameChange(name);
    }
  }
}

