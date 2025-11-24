/**
 * MQTT Library Loader - Handles loading MQTT and compression libraries
 */

export class MQTTLoader {
  constructor(config) {
    this.config = config;
    this.mqtt = null;
    this.compression = null;
    this.loading = false;
  }
  
  async load() {
    if (this.loading) {
      return this.waitForLoad();
    }
    
    this.loading = true;
    
    // If mqttLibrary is provided, use it
    if (this.config.mqttLibrary) {
      this.mqtt = this.config.mqttLibrary;
      this.loading = false;
      return this.mqtt;
    }
    
    // Otherwise, try to load from global or CDN
    if (typeof window !== 'undefined') {
      // Check if already loaded
      if (window.mqtt) {
        this.mqtt = window.mqtt;
        this.loading = false;
        return this.mqtt;
      }
      
      // Load from CDN
      return this.loadFromCDN();
    }
    
    throw new Error('MQTT library not available and cannot be loaded');
  }
  
  loadFromCDN() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = "https://unpkg.com/mqtt/dist/mqtt.min.js";
      script.onload = () => {
        if (window.mqtt) {
          this.mqtt = window.mqtt;
          this.loadCompression().then(() => {
            this.loading = false;
            resolve(this.mqtt);
          });
        } else {
          this.loading = false;
          reject(new Error('MQTT library failed to load'));
        }
      };
      script.onerror = () => {
        this.loading = false;
        reject(new Error('Failed to load MQTT library from CDN'));
      };
      document.head.appendChild(script);
    });
  }
  
  async loadCompression() {
    if (!this.config.compression.enabled) {
      return;
    }
    
    const library = this.config.compression.library;
    
    if (library === 'lz-string') {
      if (window.LZString) {
        this.compression = window.LZString;
        return;
      }
      
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js";
        script.onload = () => {
          if (window.LZString) {
            this.compression = window.LZString;
            resolve();
          } else {
            reject(new Error('LZ-String library failed to load'));
          }
        };
        script.onerror = () => {
          reject(new Error('Failed to load LZ-String library'));
        };
        document.head.appendChild(script);
      });
    }
  }
  
  getMQTT() {
    return this.mqtt;
  }
  
  getCompression() {
    return this.compression;
  }
  
  compress(data) {
    if (!this.compression || !this.config.compression.enabled) {
      return data;
    }
    
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    if (str.length < this.config.compression.threshold) {
      return data;
    }
    
    if (this.compression.compressToUint8Array) {
      return this.compression.compressToUint8Array(str);
    }
    return data;
  }
  
  decompress(data) {
    if (!this.compression || !this.config.compression.enabled) {
      return data;
    }
    
    if (this.compression.decompressFromUint8Array) {
      return this.compression.decompressFromUint8Array(data);
    }
    return data;
  }
  
  waitForLoad() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.loading && this.mqtt) {
          clearInterval(checkInterval);
          resolve(this.mqtt);
        }
      }, 100);
    });
  }
}

