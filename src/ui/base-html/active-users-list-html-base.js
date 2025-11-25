/**
 * ActiveUsersListHTMLElementBase - HTMLElement-based base for active users list
 * 
 * This class extends UIComponentBase (which extends HTMLElement) and implements
 * the ActiveUsersListBase contract. This allows concrete implementations to
 * extend this class and get both HTMLElement functionality and the abstract contract.
 * 
 * @extends UIComponentBase
 * @implements ActiveUsersListBase
 */

import { UIComponentBase } from '../../core/interfaces/ui-component-base.js';
import { ActiveUsersListBase } from '../../core/interfaces/active-users-list-base.js';

export class ActiveUsersListHTMLElementBase extends UIComponentBase {
  /**
   * Create a new ActiveUsersListHTMLElementBase instance
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super(config);
    
    // Initialize abstract base functionality
    // Initialize properties from ActiveUsersListBase
    this.userColorMap = new Map(); // Map<user, color>
  }

  /**
   * Update the list of active users
   * Must be implemented by subclasses
   * @param {Array<string>} users - List of active user names
   * @param {Function} getUserColor - Optional function to get color for a user
   * @abstract
   */
  updateUsers(users, getUserColor = null) {
    throw new Error('updateUsers must be implemented by subclass');
  }

  /**
   * Get color for a user (for consistency)
   * Default implementation from ActiveUsersListBase
   * @param {string} user - User name
   * @returns {string} Color
   */
  getUserColor(user) {
    if (!this.userColorMap) {
      this.userColorMap = new Map();
    }
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
   * Clear the user list
   * Must be implemented by subclasses
   * @abstract
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }

  /**
   * Notify that a user was clicked
   * Default implementation dispatches custom event
   * @param {string} user - User name
   * @protected
   */
  _onUserClick(user) {
    this.dispatchCustomEvent('userclick', { user });
  }
}

