/**
 * Mixin Helper - Utility for combining abstract base classes with HTMLElement-based components
 * 
 * Since JavaScript doesn't support multiple inheritance, this helper allows
 * combining an abstract base class (contract) with UIComponentBase (HTMLElement).
 */

/**
 * Apply mixin to a class
 * @param {class} BaseClass - Base class to extend
 * @param {class} MixinClass - Mixin class to apply
 * @returns {class} Combined class
 */
export function applyMixin(BaseClass, MixinClass) {
  // Copy all methods from MixinClass to BaseClass prototype
  Object.getOwnPropertyNames(MixinClass.prototype).forEach(name => {
    if (name !== 'constructor') {
      BaseClass.prototype[name] = MixinClass.prototype[name];
    }
  });
  
  // Copy static methods
  Object.getOwnPropertyNames(MixinClass).forEach(name => {
    if (name !== 'prototype' && name !== 'length' && name !== 'name') {
      BaseClass[name] = MixinClass[name];
    }
  });
  
  return BaseClass;
}

/**
 * Create a class that extends both a base class and implements a mixin
 * @param {class} BaseClass - Base class (e.g., UIComponentBase)
 * @param {class} MixinClass - Mixin class (abstract base)
 * @returns {class} Combined class
 */
export function mix(BaseClass, MixinClass) {
  class Mixed extends BaseClass {
    constructor(...args) {
      super(...args);
      // Call mixin constructor if it has one
      if (MixinClass.prototype.constructor !== Object.prototype.constructor) {
        MixinClass.prototype.constructor.apply(this, args);
      }
    }
  }
  
  // Apply mixin methods
  applyMixin(Mixed, MixinClass);
  
  return Mixed;
}

