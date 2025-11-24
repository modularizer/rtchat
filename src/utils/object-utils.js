/**
 * Object Utilities - Helper functions for object manipulation
 * 
 * Provides utilities for deep merging objects and type checking.
 */

/**
 * Check if a value is a plain object (not array, null, or other types)
 * @param {*} item - Value to check
 * @returns {boolean} True if item is a plain object
 */
export function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Deep merge two objects recursively
 * 
 * Merges source into target, creating a new object. Nested objects are merged
 * recursively rather than being replaced entirely.
 * 
 * @param {Object} target - Target object to merge into
 * @param {Object} source - Source object to merge from
 * @returns {Object} New merged object (target is not modified)
 * 
 * @example
 * const merged = deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 }, e: 4 });
 * // Result: { a: 1, b: { c: 2, d: 3 }, e: 4 }
 */
export function deepMerge(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

