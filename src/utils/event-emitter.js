/**
 * EventEmitter - Simple event system for RTChat
 * 
 * Provides on, off, emit methods for event-driven architecture
 */

export class EventEmitter {
  constructor() {
    this.events = {};
  }
  
  on(event, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);
    
    // Return unsubscribe function
    return () => this.off(event, handler);
  }
  
  off(event, handler) {
    if (!this.events[event]) {
      return;
    }
    this.events[event] = this.events[event].filter(h => h !== handler);
  }
  
  emit(event, ...args) {
    if (!this.events[event]) {
      return;
    }
    // Create a copy to avoid issues if handlers modify the array
    const handlers = [...this.events[event]];
    handlers.forEach(handler => {
      try {
        handler(...args);
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e);
      }
    });
  }
  
  once(event, handler) {
    const wrappedHandler = (...args) => {
      handler(...args);
      this.off(event, wrappedHandler);
    };
    return this.on(event, wrappedHandler);
  }
  
  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
  
  listenerCount(event) {
    return this.events[event] ? this.events[event].length : 0;
  }
}

