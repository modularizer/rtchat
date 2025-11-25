/**
 * CallRinger - Audio notification for incoming calls
 * 
 * Provides a ringing sound when calls are received.
 * Uses Web Audio API to generate a ringtone without requiring audio files.
 * 
 * Implements RingerInterface for use with CallManager.
 * 
 * Usage:
 *   import { CallRinger } from './call-ringer.js';
 *   import { CallManager } from '../core/call-manager.js';
 *   
 *   const ringer = new CallRinger();
 *   const callManager = new CallManager(rtcClient, { ringer });
 *   // Ringer will automatically start/stop for incoming calls
 * 
 * Features:
 * - No external audio files required
 * - Configurable ring pattern
 * - Automatic volume management
 * - Works in all modern browsers
 * 
 * @module call-ringer
 */

import { RingerInterface } from '../core/interfaces/ringer-interface.js';

class CallRinger extends RingerInterface {
  /**
   * Create a new CallRinger instance
   * @param {Object} options - Configuration options
   * @param {number} options.volume - Ring volume (0-1, default: 0.25)
   */
  constructor(options = {}) {
    super();
    this.options = {
      volume: options.volume !== undefined ? options.volume : 0.25,
      ...options
    };
    
    this.audioContext = null;
    this.oscillator1 = null;
    this.oscillator2 = null;
    this.gainNode = null;
    this.isRinging = false;
    this.ringInterval = null;
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
        console.warn('Failed to resume audio context:', e);
      }
    }
  }

  /**
   * Create and start oscillators for ringing with pleasant pattern
   * @private
   */
  _startOscillators() {
    if (!this.audioContext) {
      return;
    }

    const now = this.audioContext.currentTime;
    // Pleasant two-tone pattern: play two notes in quick succession
    const note1Duration = 0.15; // First note
    const note2Duration = 0.15; // Second note
    const totalDuration = note1Duration + note2Duration;

    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.options.volume;
    this.gainNode.connect(this.audioContext.destination);

    // First note: A4 (440 Hz) - pleasant, warm tone
    this.oscillator1 = this.audioContext.createOscillator();
    this.oscillator1.type = 'sine';
    this.oscillator1.frequency.value = 440; // A4
    this.oscillator1.connect(this.gainNode);
    
    // Second note: C#5 (554.37 Hz) - pleasant harmony
    this.oscillator2 = this.audioContext.createOscillator();
    this.oscillator2.type = 'sine';
    this.oscillator2.frequency.value = 554.37; // C#5
    
    // Create separate gain for second note to play it after first
    const gain2 = this.audioContext.createGain();
    gain2.gain.value = this.options.volume;
    gain2.connect(this.audioContext.destination);
    this.oscillator2.connect(gain2);

    // Start first note immediately
    this.oscillator1.start(now);
    this.oscillator1.stop(now + note1Duration);
    
    // Start second note after first note
    this.oscillator2.start(now + note1Duration);
    this.oscillator2.stop(now + totalDuration);
  }

  /**
   * Stop oscillators
   * @private
   */
  _stopOscillators() {
    if (this.oscillator1) {
      try {
        this.oscillator1.stop();
      } catch (e) {
        // Oscillator may already be stopped
      }
      this.oscillator1 = null;
    }
    if (this.oscillator2) {
      try {
        this.oscillator2.stop();
      } catch (e) {
        // Oscillator may already be stopped
      }
      this.oscillator2 = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  /**
   * Start ringing
   */
  async start() {
    if (this.isRinging) {
      return; // Already ringing
    }

    if (!this.audioContext) {
      // Try to initialize audio context if it doesn't exist
      this._initAudioContext();
      if (!this.audioContext) {
        console.warn('Web Audio API not available, cannot play ringtone');
        return;
      }
    }

    try {
      await this._resumeAudioContext();
      this.isRinging = true;

      // Start the ring pattern
      this._ringPattern();
    } catch (err) {
      console.warn('Could not start ringtone (may require user interaction):', err);
      // Still mark as ringing so we can try again
      this.isRinging = true;
      this._ringPattern();
    }
  }

  /**
   * Stop ringing
   */
  stop() {
    if (!this.isRinging) {
      return;
    }

    this.isRinging = false;
    
    // Clear interval
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }

    // Stop oscillators
    this._stopOscillators();
  }

  /**
   * Ring pattern: play pleasant two-tone pattern, pause, repeat
   * @private
   */
  _ringPattern() {
    if (!this.isRinging) {
      return;
    }

    // Start oscillators (they'll stop themselves)
    this._startOscillators();

    // Schedule next ring after pattern completes + pause
    // Pattern is ~0.3 seconds, pause is 0.7 seconds = 1 second total cycle
    this.ringInterval = setTimeout(() => {
      if (this.isRinging) {
        // Clean up any remaining oscillators
        this._stopOscillators();
        // Start next ring
        this._ringPattern();
      }
    }, 1000); // 1 second cycle: 0.3s ring + 0.7s pause
  }

  /**
   * Check if currently ringing
   * @returns {boolean} True if ringing
   */
  isRinging() {
    return this.isRinging;
  }

  /**
   * Getter for ringing state (alternative accessor)
   * @returns {boolean} True if ringing
   */
  get ringing() {
    return this.isRinging;
  }

  /**
   * Set ring volume
   * @param {number} volume - Volume (0-1)
   */
  setVolume(volume) {
    this.options.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.options.volume;
    }
  }
}

export { CallRinger };

