/**
 * NotificationInterface - Interface for notification components
 * 
 * This interface defines methods for showing notifications (e.g., connection sounds, alerts).
 * Implement this if you want to provide custom notification behavior.
 * 
 * @interface NotificationInterface
 */
export class NotificationInterface {
  /**
   * Play a ping/connection sound
   * @returns {Promise} Promise that resolves when sound plays
   */
  ping() {
    // Optional - no-op by default
    return Promise.resolve();
  }

  /**
   * Play a beep sound
   * @returns {Promise} Promise that resolves when sound plays
   */
  beep() {
    // Optional - no-op by default
    return Promise.resolve();
  }

  /**
   * Show a visual notification (e.g., browser notification)
   * @param {string} title - Notification title
   * @param {Object} options - Notification options {body, icon, etc.}
   * @returns {Promise} Promise that resolves when notification is shown
   */
  showNotification(title, options = {}) {
    // Optional - no-op by default
    return Promise.resolve();
  }
}

