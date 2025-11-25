/**
 * VideoControllerInterface - Interface for video control components
 * 
 * This interface defines methods for controlling video streams (hide/show video).
 * Implement this if you want to provide video controls.
 * 
 * @interface VideoControllerInterface
 */
export class VideoControllerInterface {
  /**
   * Hide or show video
   * @param {boolean} hidden - Whether to hide (true) or show (false) video
   * @param {Map<string, MediaStream>} localStreams - Map of user -> local MediaStream
   */
  setVideoHidden(hidden, localStreams) {
    // Optional - no-op by default
  }

  /**
   * Get current video hidden state
   * @returns {boolean} Whether video is hidden
   */
  isVideoHidden() {
    return false;
  }
}

