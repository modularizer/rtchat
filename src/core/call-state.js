/**
 * CallState - Platform-agnostic, UI-agnostic call state management
 * 
 * This module provides a structured way to track call state per user.
 * State can be: inactive, active, or pending
 * Each state can have audio and/or video capabilities.
 * 
 * Usage:
 *   import { CallState } from './call-state.js';
 *   
 *   const callState = new CallState();
 *   callState.setUserState('user1', {status: 'active', audio: true, video: true});
 *   const state = callState.getUserState('user1');
 *   // {status: 'active', audio: true, video: true}
 * 
 * @module call-state
 */

class CallState {
  /**
   * Create a new CallState instance
   */
  constructor() {
    // Map<user, {status: 'inactive'|'active'|'pending', audio: boolean, video: boolean}>
    this._userStates = new Map();
  }

  /**
   * Set call state for a user
   * @param {string} user - User name
   * @param {Object} state - State object {status: string, audio: boolean, video: boolean}
   */
  setUserState(user, state) {
    if (!user) {
      throw new Error('User name is required');
    }
    
    const normalizedState = {
      status: state.status || 'inactive',
      audio: state.audio === true,
      video: state.video === true
    };
    
    // Validate status
    if (!['inactive', 'active', 'pending'].includes(normalizedState.status)) {
      throw new Error(`Invalid status: ${normalizedState.status}. Must be 'inactive', 'active', or 'pending'`);
    }
    
    this._userStates.set(user, normalizedState);
  }

  /**
   * Get call state for a user
   * @param {string} user - User name
   * @returns {Object|null} State object {status: string, audio: boolean, video: boolean} or null if not found
   */
  getUserState(user) {
    if (!user) {
      return null;
    }
    const state = this._userStates.get(user);
    return state ? { ...state } : null;
  }

  /**
   * Get all users with a specific status
   * @param {string} status - Status to filter by ('inactive', 'active', or 'pending')
   * @returns {Array<string>} Array of user names
   */
  getUsersByStatus(status) {
    if (!['inactive', 'active', 'pending'].includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be 'inactive', 'active', or 'pending'`);
    }
    
    const users = [];
    for (const [user, state] of this._userStates.entries()) {
      if (state.status === status) {
        users.push(user);
      }
    }
    return users;
  }

  /**
   * Get all active calls (grouped by audio/video)
   * @returns {Object} {audio: Set<string>, video: Set<string>}
   */
  getActiveCalls() {
    const audio = new Set();
    const video = new Set();
    
    for (const [user, state] of this._userStates.entries()) {
      if (state.status === 'active') {
        if (state.audio) {
          audio.add(user);
        }
        if (state.video) {
          video.add(user);
        }
      }
    }
    
    return { audio, video };
  }

  /**
   * Get all pending calls
   * @returns {Set<string>} Set of user names with pending calls
   */
  getPendingCalls() {
    return new Set(this.getUsersByStatus('pending'));
  }

  /**
   * Get all users with active or pending calls
   * @returns {Set<string>} Set of user names
   */
  getActiveOrPendingCalls() {
    const users = new Set();
    for (const [user, state] of this._userStates.entries()) {
      if (state.status === 'active' || state.status === 'pending') {
        users.add(user);
      }
    }
    return users;
  }

  /**
   * Check if a user has an active call
   * @param {string} user - User name
   * @returns {boolean} True if user has an active call
   */
  hasActiveCall(user) {
    const state = this.getUserState(user);
    return state && state.status === 'active';
  }

  /**
   * Check if a user has a pending call
   * @param {string} user - User name
   * @returns {boolean} True if user has a pending call
   */
  hasPendingCall(user) {
    const state = this.getUserState(user);
    return state && state.status === 'pending';
  }

  /**
   * Remove state for a user
   * @param {string} user - User name
   */
  removeUser(user) {
    this._userStates.delete(user);
  }

  /**
   * Clear all states
   */
  clear() {
    this._userStates.clear();
  }

  /**
   * Get all states (for debugging/inspection)
   * @returns {Map} Map of user -> state
   */
  getAllStates() {
    return new Map(this._userStates);
  }
}

export { CallState };

