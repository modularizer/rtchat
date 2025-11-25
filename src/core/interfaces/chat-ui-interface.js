/**
 * ChatUIInterface - Interface for chat UI components
 * 
 * This interface defines the minimum methods a chat UI component must implement
 * to work with ChatManager. All methods are optional - implement only what you need.
 * 
 * Configuration options (via UIConfigInterface):
 * - allowRoomChange: boolean - Whether room changes are allowed (default: true)
 * - showRoom: boolean - Whether to show room name (default: true)
 * - baseTopic: string - Base MQTT topic prefix (default: '')
 * - currentRoom: string - Current room name (default: '')
 * - callModes: 'audio' | 'video' | 'both' - Which call types to expose (default: 'both')
 * - callTimeout: number - Call timeout in milliseconds (default: 15000)
 * - videoDisplayComponent: class - Optional custom video display component
 * - primaryUserColor: string - Color for primary user (default: 'lightblue')
 * - userColors: Array<string> - Colors for other users
 * - ringerVolume: number - Ringtone volume 0-1 (default: 0.3)
 * - notificationVolume: number - Notification volume 0-1 (default: 0.2)
 * 
 * @interface ChatUIInterface
 */
export class ChatUIInterface {
  /**
   * Get configuration for this UI component
   * @returns {Object} Configuration object
   */
  getConfig() {
    throw new Error('getConfig must be implemented or use UIConfigInterface.getDefaultConfig()');
  }
  /**
   * Display a chat message
   * @param {Object} messageData - {data: string, sender: string, timestamp: number}
   */
  displayMessage(messageData) {
    throw new Error('displayMessage must be implemented');
  }

  /**
   * Update the active users display
   * @param {Array<string>} users - List of active user names
   */
  updateActiveUsers(users) {
    throw new Error('updateActiveUsers must be implemented');
  }

  /**
   * Get the current message input value
   * @returns {string} Current input value
   */
  getMessageInput() {
    throw new Error('getMessageInput must be implemented');
  }

  /**
   * Clear the message input
   */
  clearMessageInput() {
    throw new Error('clearMessageInput must be implemented');
  }

  /**
   * Enable or disable the message input
   * @param {boolean} enabled - Whether input should be enabled
   */
  setInputEnabled(enabled) {
    throw new Error('setInputEnabled must be implemented');
  }
}

