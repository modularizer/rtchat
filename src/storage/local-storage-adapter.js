/**
 * LocalStorage Adapter - Browser localStorage implementation
 */

import { StorageAdapter } from './storage-adapter.js';

export class LocalStorageAdapter extends StorageAdapter {
  constructor() {
    super();
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('localStorage is not available in this environment');
    }
    this.storage = window.localStorage;
  }
  
  getItem(key) {
    try {
      return this.storage.getItem(key);
    } catch (e) {
      console.warn('localStorage.getItem failed:', e);
      return null;
    }
  }
  
  setItem(key, value) {
    try {
      this.storage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage.setItem failed:', e);
      // Handle quota exceeded or other errors
      if (e.name === 'QuotaExceededError') {
        throw new Error('Storage quota exceeded');
      }
    }
  }
  
  removeItem(key) {
    try {
      this.storage.removeItem(key);
    } catch (e) {
      console.warn('localStorage.removeItem failed:', e);
    }
  }
  
  clear() {
    try {
      this.storage.clear();
    } catch (e) {
      console.warn('localStorage.clear failed:', e);
    }
  }
  
  key(index) {
    try {
      return this.storage.key(index);
    } catch (e) {
      console.warn('localStorage.key failed:', e);
      return null;
    }
  }
  
  get length() {
    try {
      return this.storage.length;
    } catch (e) {
      return 0;
    }
  }
}

