/**
 * AudioControllerInterface - Interface for audio control components
 * 
 * This interface defines methods for controlling audio streams (mute mic, mute speakers).
 * Implement this if you want to provide audio controls.
 * 
 * @interface AudioControllerInterface
 */
export class AudioControllerInterface {
  /**
   * Mute or unmute the microphone
   * @param {boolean} muted - Whether to mute (true) or unmute (false)
   * @param {Map<string, MediaStream>} localStreams - Map of user -> local MediaStream
   */
  setMicMuted(muted, localStreams) {
    // Optional - no-op by default
  }

  /**
   * Mute or unmute the speakers
   * @param {boolean} muted - Whether to mute (true) or unmute (false)
   * @param {Map<string, HTMLMediaElement>} remoteAudioElements - Map of user -> audio element
   */
  setSpeakersMuted(muted, remoteAudioElements) {
    // Optional - no-op by default
  }

  /**
   * Get current mic mute state
   * @returns {boolean} Whether mic is muted
   */
  isMicMuted() {
    return false;
  }

  /**
   * Get current speakers mute state
   * @returns {boolean} Whether speakers are muted
   */
  isSpeakersMuted() {
    return false;
  }
}

