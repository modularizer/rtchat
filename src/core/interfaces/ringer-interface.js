/**
 * RingerInterface - Interface for ringtone/audio notification components
 * 
 * This interface defines methods for playing ringtones (e.g., for incoming calls).
 * Implement this if you want to provide custom ringtone behavior.
 * 
 * @interface RingerInterface
 */
export class RingerInterface {
  /**
   * Start playing the ringtone
   * @returns {Promise} Promise that resolves when ringtone starts
   */
  start() {
    throw new Error('start must be implemented');
  }

  /**
   * Stop playing the ringtone
   */
  stop() {
    throw new Error('stop must be implemented');
  }

  /**
   * Check if ringtone is currently playing
   * @returns {boolean} Whether ringtone is playing
   */
  isRinging() {
    return false;
  }
}

