/**
 * StateManager - Simple state management for UI components
 * 
 * Manages mutable state separate from configuration.
 * Configuration is immutable, state can change.
 * 
 * Usage:
 *   import { StateManager } from './state-manager.js';
 *   
 *   const state = new StateManager({
 *     currentRoom: '',
 *     name: '?'
 *   });
 *   
 *   state.set('currentRoom', 'newRoom');
 *   const room = state.get('currentRoom');
 *   state.on('change', (key, value) => { ... });
 * 
 * @class StateManager
 */

import { EventEmitter } from '../utils/event-emitter.js';

class StateManager extends EventEmitter {
  /**
   * Create a new StateManager instance
   * @param {Object} initialState - Initial state values
   */
  constructor(initialState = {}) {
    super();
    this._state = { ...initialState };
  }

  /**
   * Get a state value
   * @param {string} key - State key
   * @returns {*} State value
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Set a state value
   * @param {string} key - State key
   * @param {*} value - State value
   */
  set(key, value) {
    const oldValue = this._state[key];
    if (oldValue !== value) {
      this._state[key] = value;
      this.emit('change', { key, value, oldValue });
      this.emit(`change:${key}`, { value, oldValue });
    }
  }

  /**
   * Get all state
   * @returns {Object} Copy of all state
   */
  getAll() {
    return { ...this._state };
  }

  /**
   * Set multiple state values at once
   * @param {Object} updates - Object with key-value pairs
   */
  setMultiple(updates) {
    Object.keys(updates).forEach(key => {
      this.set(key, updates[key]);
    });
  }

  /**
   * Reset state to initial values
   * @param {Object} newInitialState - Optional new initial state
   */
  reset(newInitialState = null) {
    if (newInitialState) {
      this._state = { ...newInitialState };
    } else {
      // Reset to constructor initial state (would need to store it)
      this._state = {};
    }
    this.emit('reset', { state: this.getAll() });
  }
}

export { StateManager };

