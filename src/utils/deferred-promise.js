/**
 * DeferredPromise - Promise that can be resolved/rejected externally
 */

export class DeferredPromise {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

