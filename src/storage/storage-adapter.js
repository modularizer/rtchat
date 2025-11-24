/**
 * Storage Adapter - Abstract base class for storage operations
 * 
 * This is an abstract class that must be extended. It defines the interface
 * for storage operations, allowing swapping between localStorage, memory storage,
 * or custom implementations for better testability and flexibility.
 * 
 * @abstract
 * @class StorageAdapter
 * 
 * @example
 * // Extend this class to create a custom storage adapter
 * class MyStorageAdapter extends StorageAdapter {
 *   constructor() {
 *     super(); // Required
 *     // Initialize your storage
 *   }
 *   
 *   getItem(key) {
 *     // Implement getItem
 *   }
 *   
 *   // ... implement other methods
 * }
 */
export class StorageAdapter {
  constructor() {
    // Prevent direct instantiation of abstract class
    if (this.constructor === StorageAdapter) {
      throw new Error('StorageAdapter is an abstract class and cannot be instantiated directly. Extend it instead.');
    }
  }
  
  /**
   * Get an item from storage by key
   * @abstract
   * @param {string} key - The key to retrieve
   * @returns {string|null} The value associated with the key, or null if not found
   */
  getItem(key) {
    throw new Error('getItem must be implemented by subclass');
  }
  
  /**
   * Set an item in storage
   * @abstract
   * @param {string} key - The key to store
   * @param {string} value - The value to store
   */
  setItem(key, value) {
    throw new Error('setItem must be implemented by subclass');
  }
  
  /**
   * Remove an item from storage
   * @abstract
   * @param {string} key - The key to remove
   */
  removeItem(key) {
    throw new Error('removeItem must be implemented by subclass');
  }
  
  /**
   * Clear all items from storage
   * @abstract
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }
  
  /**
   * Get the key at the specified index
   * @abstract
   * @param {number} index - The index of the key to retrieve
   * @returns {string|null} The key at the index, or null if not found
   */
  key(index) {
    throw new Error('key must be implemented by subclass');
  }
  
  /**
   * Get the number of items in storage
   * @abstract
   * @returns {number} The number of items
   */
  get length() {
    throw new Error('length must be implemented by subclass');
  }
}

