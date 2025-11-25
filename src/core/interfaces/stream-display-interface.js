/**
 * StreamDisplayInterface - Interface for audio/video stream display components
 * 
 * This interface defines the minimum methods a stream display component must implement
 * to work with CallManager for displaying media streams.
 * 
 * @interface StreamDisplayInterface
 */
export class StreamDisplayInterface {
  /**
   * Set streams for a user
   * @param {string} user - User name
   * @param {Object} streams - {localStream: MediaStream, remoteStream: MediaStream}
   */
  setStreams(user, streams) {
    throw new Error('setStreams must be implemented');
  }

  /**
   * Remove streams for a user
   * @param {string} user - User name
   */
  removeStreams(user) {
    throw new Error('removeStreams must be implemented');
  }

  /**
   * Show the stream display
   */
  show() {
    // Optional - no-op by default
  }

  /**
   * Hide the stream display
   */
  hide() {
    // Optional - no-op by default
  }
}

