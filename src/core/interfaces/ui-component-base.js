/**
 * UIComponentBase - Abstract base class for UI components that extend HTMLElement
 * 
 * This base class provides common functionality for all UI components:
 * - Shadow DOM setup
 * - Configuration management
 * - Lifecycle hooks
 * - Event handling utilities
 * 
 * All UI components that extend HTMLElement should extend this class.
 * 
 * @abstract
 */
export class UIComponentBase extends HTMLElement {
  /**
   * Create a new UIComponentBase instance
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    super();
    
    // Store configuration
    this.config = { ...config };
    
    // Initialize shadow DOM (can be overridden)
    this._initShadowDOM();
    
    // Setup lifecycle
    this._initialized = false;
  }

  /**
   * Initialize shadow DOM (can be overridden by subclasses)
   * @protected
   */
  _initShadowDOM() {
    // Default: open shadow DOM
    // Subclasses can override to use closed shadow DOM or no shadow DOM
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Called when element is connected to DOM
   * Subclasses should override connectedCallback() and call super.connectedCallback()
   */
  connectedCallback() {
    if (!this._initialized) {
      this._initialize();
      this._initialized = true;
    }
  }

  /**
   * Called when element is disconnected from DOM
   * Subclasses should override disconnectedCallback() and call super.disconnectedCallback()
   */
  disconnectedCallback() {
    // Cleanup can be done here
  }

  /**
   * Initialize the component
   * Subclasses should override this method
   * @protected
   */
  _initialize() {
    // Override in subclasses
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} Configuration value
   */
  getConfig(key, defaultValue = undefined) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   */
  setConfig(key, value) {
    this.config[key] = value;
  }

  /**
   * Dispatch a custom event
   * @param {string} eventName - Event name
   * @param {Object} detail - Event detail object
   * @param {boolean} bubbles - Whether event bubbles (default: true)
   * @param {boolean} composed - Whether event crosses shadow DOM boundary (default: true)
   */
  dispatchCustomEvent(eventName, detail = {}, bubbles = true, composed = true) {
    this.dispatchEvent(new CustomEvent(eventName, {
      detail,
      bubbles,
      composed
    }));
  }

  /**
   * Get the root element (shadow root or this)
   * @returns {ShadowRoot|HTMLElement} Root element
   */
  getRoot() {
    return this.shadowRoot || this;
  }

  /**
   * Query selector in root
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null} Element or null
   */
  queryRoot(selector) {
    const root = this.getRoot();
    return root.querySelector ? root.querySelector(selector) : null;
  }

  /**
   * Query selector all in root
   * @param {string} selector - CSS selector
   * @returns {NodeList} Elements
   */
  queryRootAll(selector) {
    const root = this.getRoot();
    return root.querySelectorAll ? root.querySelectorAll(selector) : [];
  }
}

