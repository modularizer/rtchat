/**
 * Memory Storage Adapter - In-memory storage for testing or server-side use
 */

import { StorageAdapter } from './storage-adapter.js';

export class MemoryAdapter extends StorageAdapter {
  constructor() {
    super();
    this.data = {};
  }
  
  getItem(key) {
    return this.data[key] || null;
  }
  
  setItem(key, value) {
    this.data[key] = String(value);
  }
  
  removeItem(key) {
    delete this.data[key];
  }
  
  clear() {
    this.data = {};
  }
  
  key(index) {
    const keys = Object.keys(this.data);
    return keys[index] || null;
  }
  
  get length() {
    return Object.keys(this.data).length;
  }
}

