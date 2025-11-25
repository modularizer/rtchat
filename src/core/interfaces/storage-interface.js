/**
 * StorageInterface - Interface for storage adapters
 * 
 * This interface defines methods for persistent storage (e.g., localStorage, IndexedDB).
 * Note: This is already implemented as StorageAdapter, but included here for completeness.
 * 
 * @interface StorageInterface
 */
export class StorageInterface {
  /**
   * Get an item from storage
   * @param {string} key - Storage key
   * @returns {string|null} Stored value or null
   */
  getItem(key) {
    throw new Error('getItem must be implemented');
  }

  /**
   * Set an item in storage
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   */
  setItem(key, value) {
    throw new Error('setItem must be implemented');
  }

  /**
   * Remove an item from storage
   * @param {string} key - Storage key
   */
  removeItem(key) {
    throw new Error('removeItem must be implemented');
  }
}

