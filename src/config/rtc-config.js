/**
 * RTCConfig - Configuration management for RTChat
 * 
 * Centralized configuration system with validation, normalization, and presets.
 * Uses nested configuration format with validation and presets.
 */

import { getDefaults } from './defaults.js';
import { deepMerge } from '../utils/object-utils.js';

export class RTCConfig {
  // Static defaults object - single source of truth
  static getDefaults() {
    return getDefaults();
  }
  
  constructor(userConfig = {}) {
    // Normalize user config (handle common string formats)
    const normalized = this.normalizeUserConfig(userConfig);
    
    // Get defaults from separate file and merge with user config
    const defaults = getDefaults();
    this.config = deepMerge(defaults, normalized);
    
    // Apply computed defaults (functions that need instance context)
    this.applyComputedDefaults();
    
    // Validate configuration
    this.validate();
    
    // Normalize values (e.g., convert single STUN to array)
    this.normalize();
  }
  
  normalizeUserConfig(userConfig) {
    const normalized = { ...userConfig };
    
    // Handle topic as string -> topic.room
    if (typeof userConfig.topic === 'string') {
      normalized.topic = { room: userConfig.topic };
    }
    
    return normalized;
  }
  
  applyComputedDefaults() {
    // Apply defaults that require instance methods (only for dynamic values that can't be in static defaults)
    // These are values that depend on runtime context (localStorage, window.location, etc.)
    if (!this.config.name) {
      this.config.name = this.getDefaultName();
    }
    
    if (!this.config.topic.room) {
      this.config.topic.room = this.getDefaultRoom();
    }
    
    // iceServers is now in the defaults dictionary, so deepMerge will handle it automatically
    // Only need to handle explicit null/empty array cases
    if (this.config.webrtc.iceServers === null || 
        (Array.isArray(this.config.webrtc.iceServers) && this.config.webrtc.iceServers.length === 0)) {
      // User explicitly wants to use defaults, copy from defaults
      this.config.webrtc.iceServers = [...getDefaults().webrtc.iceServers];
    }
  }
  
  getDefaultName() {
    // Try localStorage, then generate
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem('rtchat_name') || localStorage.getItem('name');
        if (stored && !stored.startsWith('anon')) {
          return stored;
        }
      } catch (e) {
        // localStorage might not be available
      }
    }
    return `User #${Math.floor(Math.random() * 1000)}`;
  }
  
  getDefaultRoom() {
    // Auto-detect from URL if in browser
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      const pathname = window.location.pathname
        .replace(/rtchat\/?/, '')
        .replace(/index\.html$/, '')
        .replace(/\.html$/, '')
        .replace(/[^a-zA-Z0-9]/g, '');
      
      // Skip localhost/127.0.0.1 for room name
      if (!['localhost', '127.0.0.1'].includes(hostname)) {
        return hostname + pathname;
      }
      return pathname || 'default';
    }
    return 'default';
  }
  
  validate() {
    // Validate name
    if (this.config.name) {
      if (this.config.name.includes('(') || this.config.name.includes(')') || this.config.name.includes('|')) {
        throw new Error('Name cannot contain (, ), or |');
      }
      if (this.config.name !== this.config.name.trim()) {
        throw new Error('Name cannot have leading or trailing spaces');
      }
    }
    
    // Validate MQTT broker URL
    if (this.config.mqtt.broker) {
      try {
        new URL(this.config.mqtt.broker);
      } catch (e) {
        throw new Error(`Invalid MQTT broker URL: ${this.config.mqtt.broker}`);
      }
    }
    
    // Validate ICE servers
    if (this.config.webrtc.iceServers) {
      if (!Array.isArray(this.config.webrtc.iceServers)) {
        // Will be normalized to array, but check if it's a valid string
        if (typeof this.config.webrtc.iceServers !== 'string') {
          throw new Error('iceServers must be an array or string');
        }
      }
    }
  }
  
  normalize() {
    // Ensure ICE servers is always an array
    if (!Array.isArray(this.config.webrtc.iceServers)) {
      const server = this.config.webrtc.iceServers;
      if (typeof server === 'string') {
        this.config.webrtc.iceServers = [{ urls: server }];
      } else if (server && server.urls) {
        this.config.webrtc.iceServers = [server];
      } else {
        // Use defaults from defaults file
        this.config.webrtc.iceServers = [...getDefaults().webrtc.iceServers];
      }
    }
    
    // Convert string URLs to object format
    this.config.webrtc.iceServers = this.config.webrtc.iceServers.map(server => {
      if (typeof server === 'string') {
        return { urls: server };
      }
      return server;
    });
    
    // Ensure topic separator is applied correctly
    if (this.config.topic.separator && !this.config.topic.room.includes(this.config.topic.separator)) {
      // Separator will be used when constructing full topic
    }
  }
  
  // Getters for easy access
  get name() { return this.config.name; }
  get broker() { return this.config.mqtt.broker; }
  get iceServers() { return this.config.webrtc.iceServers; }
  get topic() { 
    const sep = this.config.topic.separator || '/';
    return `${this.config.topic.base}${sep}${this.config.topic.room}`;
  }
  get baseTopic() { return this.config.topic.base; }
  get room() { return this.config.topic.room; }
  
  // Get full config object
  getConfig() {
    return this.config;
  }
  
  // Update specific config values
  update(updates) {
    const normalized = this.normalizeUserConfig(updates);
    this.config = deepMerge(this.config, normalized);
    this.applyComputedDefaults();
    this.validate();
    this.normalize();
  }
}

// Preset configurations
export const ConfigPresets = {
  // Default - balanced for most use cases
  default: () => new RTCConfig({}),
  
  // High performance - multiple STUN servers, optimized settings
  performance: () => new RTCConfig({
    webrtc: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceTransportPolicy: 'all'
    },
    connection: {
      autoReconnect: true,
      reconnectDelay: 500
    }
  }),
  
  // Privacy-focused - custom STUN/TURN servers
  privacy: (customServers) => new RTCConfig({
    webrtc: {
      iceServers: customServers || [
        // User should provide their own servers
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    }
  }),
  
  // Development - local MQTT broker
  development: (localBroker = 'ws://localhost:1883') => new RTCConfig({
    mqtt: {
      broker: localBroker
    },
    debug: true
  }),
  
  // Production - optimized for production use
  production: () => new RTCConfig({
    compression: { enabled: true },
    history: { maxLength: 500 },
    connection: {
      autoReconnect: true,
      maxReconnectAttempts: 10
    },
    debug: false
  })
};

