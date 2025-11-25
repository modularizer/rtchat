/**
 * ActiveUsersListBase - Abstract base class for active users list components
 * 
 * This abstract class defines the contract for displaying and managing
 * active users in a chat interface. It is implementation-agnostic and can
 * be implemented using HTMLElement, React, Vue, or any other framework.
 * 
 * @abstract
 */
export class ActiveUsersListBase {
  /**
   * Create a new ActiveUsersListBase instance
   * @param {Object} config - Configuration options
   * @param {Array<string>} config.userColors - Array of colors for users
   */
  constructor(config = {}) {
    if (new.target === ActiveUsersListBase) {
      throw new Error('ActiveUsersListBase is abstract and cannot be instantiated directly');
    }
    
    this.config = {
      userColors: config.userColors || ['lightcoral', 'lightseagreen', 'lightsalmon', 'lightgreen'],
      ...config
    };
    
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
   * Default implementation - can be overridden
   * @param {string} user - User name
   * @returns {string} Color
   */
  getUserColor(user) {
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
   * Clear the user list
   * Must be implemented by subclasses
   * @abstract
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }

  /**
   * Notify that a user was clicked
   * Subclasses should call this when a user is clicked
   * @param {string} user - User name
   * @protected
   */
  _onUserClick(user) {
    // Default implementation - subclasses can override to dispatch events
    if (this.onUserClick) {
      this.onUserClick(user);
    }
  }
}

