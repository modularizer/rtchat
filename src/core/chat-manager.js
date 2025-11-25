/**
 * ChatManager - Platform-agnostic chat message and state management
 * 
 * This class manages chat-related business logic without any UI dependencies.
 * It tracks messages, active users, and provides a clean API for chat operations.
 * 
 * Usage:
 *   import { ChatManager } from './chat-manager.js';
 *   import { EventEmitter } from './event-emitter.js';
 *   
 *   const chatManager = new ChatManager(rtcClient);
 *   chatManager.on('message', ({data, sender, timestamp}) => { ... });
 *   chatManager.on('userconnected', (user) => { ... });
 *   chatManager.on('userdisconnected', (user) => { ... });
 *   
 *   // Send a message
 *   chatManager.sendMessage('Hello!');
 * 
 * Features:
 * - Message history tracking
 * - Active user management
 * - User color assignment
 * - Event-driven architecture
 * 
 * @module chat-manager
 */

import { EventEmitter } from '../utils/event-emitter.js';

class ChatManager extends EventEmitter {
  /**
   * Create a new ChatManager instance
   * @param {Object} rtcClient - RTC client instance (MQTTRTCClient or similar)
   * @param {Object} options - Configuration options
   * @param {string} options.primaryUserColor - Color for primary user messages (default: 'lightblue')
   * @param {Array<string>} options.userColors - Array of colors for other users
   * @param {ChatUIInterface} options.chatUI - Optional chat UI component implementing ChatUIInterface
   * @param {NotificationInterface} options.notifications - Optional notification component
   */
  constructor(rtcClient, options = {}) {
    super();
    
    this.rtcClient = rtcClient;
    this.options = {
      primaryUserColor: options.primaryUserColor || 'lightblue',
      userColors: options.userColors || [
        'lightcoral',
        'lightseagreen',
        'lightsalmon',
        'lightgreen',
      ],
      ...options
    };
    
    // Optional UI components
    this.chatUI = options.chatUI || null;
    this.notifications = options.notifications || null;
    
    // State tracking
    this.history = [];
    this.activeUsers = [];
    this.userColors = [...this.options.userColors];
    this.name = options.name || '?';
    
    // Bind methods
    this._handleChatMessage = this._handleChatMessage.bind(this);
    this._handleUserConnected = this._handleUserConnected.bind(this);
    this._handleUserDisconnected = this._handleUserDisconnected.bind(this);
    
    // Setup RTC client event listeners if available
    if (rtcClient) {
      this._setupRTCEventListeners();
      this._hydrateActiveUsersFromClient();
    }
  }

  /**
   * Setup event listeners on RTC client
   * @private
   */
  _setupRTCEventListeners() {
    if (this.rtcClient.on) {
      this.rtcClient.on('chat', this._handleChatMessage);
      
      // Check if this is a SignedMQTTRTCClient (has validation events)
      // For SignedMQTTRTCClient, we should wait for validation before adding users
      // For regular MQTTRTCClient, we can add users immediately on connectedtopeer
      // Detection: check if validatedPeers property exists (more reliable than constructor.name)
      const isSignedClient = this.rtcClient && Array.isArray(this.rtcClient.validatedPeers);
      
      // Also check if validation event is available by trying to listen
      // For now, we'll listen to both events and handle appropriately
      
      // Always listen to validation event if available (for SignedMQTTRTCClient)
      // This won't cause issues for regular clients that don't emit it
      this.rtcClient.on('validation', (peerName, trusted) => {
        console.log('ChatManager: Received validation event for', peerName, 'trusted:', trusted);
        // Add user after validation if not already added
        if (!this.activeUsers.includes(peerName)) {
          console.log('ChatManager: Adding validated user', peerName);
          this._handleUserConnected(peerName);
        } else {
          console.log('ChatManager: User', peerName, 'already in activeUsers');
        }
      });
      
      // For connectedtopeer: only add users if NOT using SignedMQTTRTCClient
      // (SignedMQTTRTCClient will add via validation event instead)
      this.rtcClient.on('connectedtopeer', (peerName) => {
        // Only add immediately if this is NOT a signed client
        // For signed clients, wait for validation event
        if (!isSignedClient) {
          console.log('ChatManager: Adding user on connectedtopeer (non-signed client)', peerName);
          this._handleUserConnected(peerName);
        } else {
          console.log('ChatManager: Received connectedtopeer for', peerName, '(waiting for validation)');
        }
      });
      
      this.rtcClient.on('disconnectedfrompeer', this._handleUserDisconnected);
    }
  }

  /**
   * Ensure previously validated/connected peers are reflected in activeUsers.
   * Without this, users validated before ChatManager initializes would never appear active.
   * @private
   */
  _hydrateActiveUsersFromClient() {
    if (!this.rtcClient) {
      return;
    }
    
    // Signed clients expose validatedPeers
    if (Array.isArray(this.rtcClient.validatedPeers)) {
      this.rtcClient.validatedPeers.forEach((peerName) => {
        if (peerName && !this.activeUsers.includes(peerName)) {
          console.log('ChatManager: Hydrating validated peer', peerName);
          this._handleUserConnected(peerName);
        }
      });
    } else {
      // Fallback for non-signed clients
      let connected = null;
      if (typeof this.rtcClient.connectedUsers === 'function') {
        connected = this.rtcClient.connectedUsers();
      } else if (Array.isArray(this.rtcClient.connectedUsers)) {
        connected = this.rtcClient.connectedUsers;
      }
      
      if (Array.isArray(connected) && connected.length) {
        connected.forEach((peerName) => {
          if (peerName && !this.activeUsers.includes(peerName)) {
            console.log('ChatManager: Hydrating connected peer', peerName);
            this._handleUserConnected(peerName);
          }
        });
      }
    }
  }

  /**
   * Handle chat message from RTC client
   * @param {string} message - Message content
   * @param {string} sender - Sender name
   * @private
   */
  _handleChatMessage(message, sender) {
    const timestamp = Date.now();
    const messageData = {
      data: message,
      sender,
      timestamp
    };
    
    // Add to history
    this.history.push(messageData);
    
    // Emit event - UI should listen to this event, not use direct displayMessage call
    this.emit('message', messageData);
    
    // Don't call chatUI.displayMessage directly - let the event listener handle it
    // This prevents duplicate message display
  }

  /**
   * Handle user connected event
   * @param {string} user - User name
   * @private
   */
  _handleUserConnected(user) {
    if (!this.activeUsers.includes(user)) {
      this.activeUsers.push(user);
      
      // Emit event
      this.emit('userconnected', { user });
      
      // Play connection sound if notifications provided
      if (this.notifications && typeof this.notifications.ping === 'function') {
        this.notifications.ping().catch(err => {
          console.debug('Could not play connection ping:', err);
        });
      }
      
      // Use chatUI if provided
      if (this.chatUI && typeof this.chatUI.updateActiveUsers === 'function') {
        this.chatUI.updateActiveUsers([...this.activeUsers]);
      }
    }
  }

  /**
   * Handle user disconnected event
   * @param {string} user - User name
   * @private
   */
  _handleUserDisconnected(user) {
    const index = this.activeUsers.indexOf(user);
    if (index !== -1) {
      // Get user's color before removing
      const oldColor = this.userColors[index % this.userColors.length];
      
      // Remove user
      this.activeUsers.splice(index, 1);
      
      // Recycle color
      this.userColors = this.userColors.filter((color) => color !== oldColor).concat([oldColor]);
      
      // Emit event
      this.emit('userdisconnected', { user });
      
      // Use chatUI if provided
      if (this.chatUI && typeof this.chatUI.updateActiveUsers === 'function') {
        this.chatUI.updateActiveUsers([...this.activeUsers]);
      }
    }
  }

  /**
   * Send a chat message
   * @param {string} message - Message to send (optional if chatUI provides input)
   */
  sendMessage(message) {
    // Get message from chatUI if not provided
    if (!message && this.chatUI && typeof this.chatUI.getMessageInput === 'function') {
      message = this.chatUI.getMessageInput();
    }
    
    if (!message) {
      throw new Error('Message is required');
    }
    
    if (!this.rtcClient) {
      throw new Error('RTC client not available');
    }
    
    if (this.rtcClient.sendRTCChat) {
      this.rtcClient.sendRTCChat(message);
      
      // Clear input if chatUI provides it
      if (this.chatUI && typeof this.chatUI.clearMessageInput === 'function') {
        this.chatUI.clearMessageInput();
      }
    } else {
      throw new Error('RTC client does not support sendRTCChat');
    }
  }

  /**
   * Get user color for a user
   * @param {string} user - User name
   * @returns {string} Color string
   */
  getUserColor(user) {
    if (user === this.name + "( You )") {
      return this.options.primaryUserColor;
    }
    const index = this.activeUsers.indexOf(user);
    if (index !== -1) {
      return this.userColors[index % this.userColors.length];
    }
    return this.options.primaryUserColor;
  }

  /**
   * Get message history
   * @returns {Array} Array of message objects
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Set message history
   * @param {Array} history - Array of message objects
   */
  setHistory(history) {
    this.history = [...history];
    this.emit('historyupdated', { history: this.history });
  }

  /**
   * Get active users
   * @returns {Array} Array of user names
   */
  getActiveUsers() {
    return [...this.activeUsers];
  }

  /**
   * Set user name
   * @param {string} name - User name
   */
  setName(name) {
    this.name = name;
    this.emit('namechanged', { name });
  }

  /**
   * Get user name
   * @returns {string} User name
   */
  getName() {
    return this.name;
  }

  /**
   * Cleanup and destroy the manager
   */
  destroy() {
    // Clear state
    this.history = [];
    this.activeUsers = [];
    this.userColors = [...this.options.userColors];
    
    // Remove event listeners
    if (this.rtcClient && this.rtcClient.off) {
      this.rtcClient.off('chat', this._handleChatMessage);
      this.rtcClient.off('connectedtopeer', this._handleUserConnected);
      this.rtcClient.off('disconnectedfrompeer', this._handleUserDisconnected);
    }
    
    // Remove all event listeners
    this.removeAllListeners();
  }
}

export { ChatManager };


