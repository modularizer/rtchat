/**
 * ActiveUsersList - Component for displaying active users with colored chips
 * 
 * @class ActiveUsersList
 * @extends HTMLElement
 */
class ActiveUsersList extends HTMLElement {
  constructor(config = {}) {
    super();
    
    this.config = {
      userColors: config.userColors || ['lightcoral', 'lightseagreen', 'lightsalmon', 'lightgreen'],
      ...config
    };
    
    this.attachShadow({ mode: 'open' });
    
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
    
    this.activeUsersEl = this.shadowRoot.querySelector('.active-users');
    this.userColorMap = new Map(); // Map<user, color>
  }
  
  /**
   * Update the list of active users
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
        userColor = this.config.userColors[index % this.config.userColors.length];
      }
      
      bubble.style.backgroundColor = userColor;
      bubble.textContent = user;
      bubble.title = user;
      
      bubble.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('userclick', {
          detail: { user },
          bubbles: true,
          composed: true
        }));
      });
      
      this.activeUsersEl.appendChild(bubble);
    });
  }
  
  /**
   * Get color for a user (for consistency)
   * @param {string} user - User name
   * @returns {string} Color
   */
  getUserColor(user) {
    if (!this.userColorMap.has(user)) {
      const index = this.userColorMap.size;
      const color = this.config.userColors[index % this.config.userColors.length];
      this.userColorMap.set(user, color);
    }
    return this.userColorMap.get(user);
  }
  
  /**
   * Clear the user list
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

