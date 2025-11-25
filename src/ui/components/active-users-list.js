/**
 * ActiveUsersList - Component for displaying active users with colored chips
 * 
 * HTMLElement-based implementation that extends ActiveUsersListHTMLElementBase,
 * which provides both HTMLElement functionality and ActiveUsersListBase contract.
 * 
 * @class ActiveUsersList
 * @extends ActiveUsersListHTMLElementBase
 */

import { ActiveUsersListHTMLElementBase } from '../base-html/active-users-list-html-base.js';

class ActiveUsersList extends ActiveUsersListHTMLElementBase {
  constructor(config = {}) {
    super({
      userColors: config.userColors || ['lightcoral', 'lightseagreen', 'lightsalmon', 'lightgreen'],
      ...config
    });
    
    this.shadowRoot.innerHTML = `
      <style>
        .active-users {
          padding: 0px 0px 0px 0px;
          margin: 0px 0px 8px 0px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
        }
        .user-bubble {
          display: inline-block;
          padding: 4px 4px;
          border-radius: 12px;
          font-size: 0.85em;
          cursor: pointer;
          color: #333;
          font-weight: 500;
          margin: 0;
          margin-block-start: 0;
          margin-block-end: 0;
          margin-inline-start: 0;
          margin-inline-end: 0;
        }
        .user-bubble:hover {
          opacity: 0.8;
        }
        .waiting-message {
          color: #666;
          font-size: 0.9em;
          font-style: italic;
          padding: 8px;
        }
      </style>
      <div class="active-users">
        <div class="waiting-message">Waiting for others to join...</div>
      </div>
    `;
    
    this.activeUsersEl = this.queryRoot('.active-users');
  }
  
  /**
   * Initialize the component
   * @protected
   */
  _initialize() {
    // Component is ready after shadow DOM is set up
  }
  
  /**
   * Update the list of active users
   * Implements ActiveUsersListBase.updateUsers
   * @param {Array<string>} users - List of active user names
   * @param {Function} getUserColor - Optional function to get color for a user
   */
  updateUsers(users, getUserColor = null) {
    if (!this.activeUsersEl) return;
    
    // Clear existing bubbles
    this.activeUsersEl.innerHTML = '';
    
    // Show message if no users
    if (users.length === 0) {
      const waitingMsg = document.createElement('div');
      waitingMsg.className = 'waiting-message';
      waitingMsg.textContent = 'Waiting for others to join...';
      this.activeUsersEl.appendChild(waitingMsg);
      return;
    }
    
    // Create bubbles for each user
    users.forEach((user) => {
      const bubble = document.createElement('p');
      bubble.className = 'user-bubble';
      
      // Get color for user
      let userColor;
      if (getUserColor) {
        userColor = getUserColor(user);
      } else {
        // Use index-based color assignment
        const index = users.indexOf(user);
        const userColors = this.getConfig('userColors') || [];
        userColor = userColors[index % userColors.length];
      }
      
      bubble.style.backgroundColor = userColor;
      bubble.textContent = user;
      bubble.title = user;
      
      bubble.addEventListener('click', () => {
        // Call base class method which dispatches event
        this._onUserClick(user);
      });
      
      this.activeUsersEl.appendChild(bubble);
    });
  }
  
  // getUserColor is inherited from ActiveUsersListHTMLElementBase
  
  /**
   * Clear the user list
   * Implements ActiveUsersListBase.clear
   */
  clear() {
    if (this.activeUsersEl) {
      this.activeUsersEl.innerHTML = '';
      const waitingMsg = document.createElement('div');
      waitingMsg.className = 'waiting-message';
      waitingMsg.textContent = 'Waiting for others to join...';
      this.activeUsersEl.appendChild(waitingMsg);
    }
  }
}

customElements.define('active-users-list', ActiveUsersList);
export { ActiveUsersList };

