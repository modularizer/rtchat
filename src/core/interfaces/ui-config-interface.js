/**
 * UIConfigInterface - Configuration options for UI components
 * 
 * This interface defines standard configuration options that all UI implementations
 * should support. This ensures consistency across different UI implementations.
 * 
 * @interface UIConfigInterface
 */
export class UIConfigInterface {
  /**
   * Get the default configuration
   * @returns {Object} Default configuration object
   */
  static getDefaultConfig() {
    return {
      // Room/Name configuration
      allowRoomChange: true,
      showRoom: true,
      baseTopic: '',
      currentRoom: '',
      
      // Call configuration
      callModes: 'both', // 'audio' | 'video' | 'both'
      callTimeout: 15000, // milliseconds
      
      // Component configuration
      videoDisplayComponent: null, // Optional custom video display component class
      
      // User configuration
      primaryUserColor: 'lightblue',
      userColors: [
        'lightcoral',
        'lightseagreen',
        'lightsalmon',
        'lightgreen',
      ],
      
      // Audio configuration
      ringerVolume: 0.3,
      notificationVolume: 0.2,
    };
  }

  /**
   * Validate configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validated configuration with defaults applied
   */
  static validateConfig(config = {}) {
    const defaults = this.getDefaultConfig();
    const validated = { ...defaults };
    
    // Validate and apply provided config
    if (typeof config.allowRoomChange === 'boolean') {
      validated.allowRoomChange = config.allowRoomChange;
    }
    
    if (typeof config.showRoom === 'boolean') {
      validated.showRoom = config.showRoom;
    }
    
    if (typeof config.baseTopic === 'string') {
      validated.baseTopic = config.baseTopic;
    }
    
    if (typeof config.currentRoom === 'string') {
      validated.currentRoom = config.currentRoom;
    }
    
    if (['audio', 'video', 'both'].includes(config.callModes)) {
      validated.callModes = config.callModes;
    }
    
    if (typeof config.callTimeout === 'number' && config.callTimeout > 0) {
      validated.callTimeout = config.callTimeout;
    }
    
    if (config.videoDisplayComponent !== undefined) {
      validated.videoDisplayComponent = config.videoDisplayComponent;
    }
    
    if (typeof config.primaryUserColor === 'string') {
      validated.primaryUserColor = config.primaryUserColor;
    }
    
    if (Array.isArray(config.userColors)) {
      validated.userColors = config.userColors;
    }
    
    if (typeof config.ringerVolume === 'number' && config.ringerVolume >= 0 && config.ringerVolume <= 1) {
      validated.ringerVolume = config.ringerVolume;
    }
    
    if (typeof config.notificationVolume === 'number' && config.notificationVolume >= 0 && config.notificationVolume <= 1) {
      validated.notificationVolume = config.notificationVolume;
    }
    
    return validated;
  }
}

