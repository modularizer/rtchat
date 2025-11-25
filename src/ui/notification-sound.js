/**
 * NotificationSound - Simple audio notifications for UI events
 * 
 * Provides short audio notifications for various UI events like:
 * - New chat connections
 * - Messages received
 * - Other notifications
 * 
 * Implements NotificationInterface for use with ChatManager and CallManager.
 * 
 * Usage:
 *   import { NotificationSound } from './notification-sound.js';
 *   import { ChatManager } from '../core/chat-manager.js';
 *   
 *   const notifications = new NotificationSound();
 *   const chatManager = new ChatManager(rtcClient, { notifications });
 *   // Notifications will automatically play for connections
 * 
 * Features:
 * - No external audio files required
 * - Uses Web Audio API
 * - Configurable volume and frequency
 * - Works in all modern browsers
 * 
 * @module notification-sound
 */

import { NotificationInterface } from '../core/interfaces/notification-interface.js';

class NotificationSound extends NotificationInterface {
  /**
   * Create a new NotificationSound instance
   * @param {Object} options - Configuration options
   * @param {number} options.volume - Sound volume (0-1, default: 0.2)
   */
  constructor(options = {}) {
    super();
    this.options = {
      volume: options.volume !== undefined ? options.volume : 0.2,
      ...options
    };
    
    this.audioContext = null;
    this._initAudioContext();
  }

  /**
   * Initialize Web Audio API context
   * @private
   */
  _initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioContext = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }

  /**
   * Resume audio context if suspended (required by some browsers)
   * @private
   */
  async _resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        // Ignore errors
      }
    }
  }

  /**
   * Play a tone
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in milliseconds
   * @param {string} type - Oscillator type ('sine', 'square', 'sawtooth', 'triangle')
   * @private
   */
  async _playTone(frequency, duration, type = 'sine') {
    if (!this.audioContext) {
      // Try to initialize if it doesn't exist
      this._initAudioContext();
      if (!this.audioContext) {
        return; // Still no audio context
      }
    }

    try {
      await this._resumeAudioContext();
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.options.volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration / 1000);
    } catch (err) {
      // Silently fail - audio might not be available
      console.debug('Could not play notification sound:', err);
    }
  }

  /**
   * Play a ping sound (short, pleasant notification)
   */
  async ping() {
    // Play a quick ascending tone
    await this._playTone(800, 50, 'sine');
    await new Promise(resolve => setTimeout(resolve, 30));
    await this._playTone(1000, 50, 'sine');
  }

  /**
   * Play a beep sound (single tone)
   * @param {number} frequency - Frequency in Hz (default: 800)
   * @param {number} duration - Duration in ms (default: 100)
   */
  async beep(frequency = 800, duration = 100) {
    await this._playTone(frequency, duration, 'sine');
  }

  /**
   * Play a chime sound (pleasant multi-tone)
   */
  async chime() {
    // Play multiple tones in quick succession
    await this._playTone(523, 80, 'sine'); // C
    await new Promise(resolve => setTimeout(resolve, 50));
    await this._playTone(659, 80, 'sine'); // E
    await new Promise(resolve => setTimeout(resolve, 50));
    await this._playTone(784, 100, 'sine'); // G
  }

  /**
   * Set volume
   * @param {number} volume - Volume (0-1)
   */
  setVolume(volume) {
    this.options.volume = Math.max(0, Math.min(1, volume));
  }
}

export { NotificationSound };


