/**
 * CallManagement - UI component for displaying call controls and information
 * 
 * This is a pure UI component that displays call state from CallManager.
 * It does not manage any state itself - all state comes from CallManager.
 * 
 * This component provides a dedicated UI section for call management, separate from
 * the chat messages area. It displays:
 * - Active call information (who you're calling with)
 * - Call controls (mute mic, mute speakers, video toggle)
 * - Latency metrics (RTT, packet loss, jitter)
 * 
 * Usage:
 *   import { CallManager } from '../core/call-manager.js';
 *   import { CallManagement } from './call-management.js';
 *   
 *   const callManager = new CallManager(rtcClient);
 *   const callMgmt = new CallManagement(containerElement, callManager);
 *   
 *   // CallManagement automatically subscribes to CallManager events
 *   // and updates the UI accordingly
 */

class CallManagement {
  /**
   * Create a new CallManagement instance
   * @param {HTMLElement} container - Container element for the call management UI
   * @param {CallManager} callManager - CallManager instance to read state from
   * @param {Object} options - Configuration options
   */
  constructor(container, callManager, options = {}) {
    if (!callManager) {
      throw new Error('CallManager is required');
    }
    
    this.container = container;
    this.callManager = callManager;
    this.options = {
      showMetrics: options.showMetrics !== false, // Default: true
      ...options
    };
    
    this._setupUI();
    this._setupEventListeners();
    this._setupCallManagerListeners();
    
    // Initial render from current state
    this._updateFromCallManager();
  }

  /**
   * Setup the UI structure
   * @private
   */
  _setupUI() {
    // Check if call-buttons-container already exists (from ChatBox template)
    const existingButtonsContainer = this.container.querySelector('#call-buttons-container');
    
    // Only set innerHTML if call-buttons-container doesn't exist
    // This preserves the call buttons that ChatBox adds
    if (!existingButtonsContainer) {
      this.container.innerHTML = `
        <div id="call-buttons-container"></div>
        <div id="call-info-container"></div>
        <div id="call-controls-container">
          <span style="font-weight: bold; margin-right: 8px;">Call Controls:</span>
          <button id="call-mute-mic-btn" class="call-control-button" title="Toggle microphone on/off">Mic</button>
          <button id="call-mute-speakers-btn" class="call-control-button" title="Toggle speakers on/off">Speakers</button>
          <button id="call-video-toggle-btn" class="call-control-button" title="Toggle camera on/off">Camera</button>
          <button id="end-call-button" class="call-control-button end-call" title="End call" style="background-color: #f44336; color: white;">End</button>
          <span id="call-metrics"></span>
        </div>
      `;
    } else {
      // Preserve existing buttons, just add our containers if they don't exist
      if (!this.container.querySelector('#call-info-container')) {
        const infoContainer = document.createElement('div');
        infoContainer.id = 'call-info-container';
        existingButtonsContainer.after(infoContainer);
      }
      
      // Check if end call button exists in call-buttons-container and needs to be moved
      const existingEndCallButton = existingButtonsContainer.querySelector('#end-call-button');
      
      if (!this.container.querySelector('#call-controls-container')) {
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'call-controls-container';
        controlsContainer.innerHTML = `
          <span style="font-weight: bold; margin-right: 8px;">Call Controls:</span>
          <button id="call-mute-mic-btn" class="call-control-button" title="Toggle microphone on/off">Mic</button>
          <button id="call-mute-speakers-btn" class="call-control-button" title="Toggle speakers on/off">Speakers</button>
          <button id="call-video-toggle-btn" class="call-control-button" title="Toggle camera on/off">Camera</button>
          <span id="call-metrics"></span>
        `;
        this.container.appendChild(controlsContainer);
        
        // Move existing end call button to call-controls-container if it exists
        if (existingEndCallButton) {
          // Update the button styling and class
          existingEndCallButton.className = 'call-control-button end-call';
          existingEndCallButton.style.backgroundColor = '#f44336';
          existingEndCallButton.style.color = 'white';
          // Move it to call-controls-container (before metrics span)
          const metricsSpan = controlsContainer.querySelector('#call-metrics');
          if (metricsSpan) {
            controlsContainer.insertBefore(existingEndCallButton, metricsSpan);
          } else {
            controlsContainer.appendChild(existingEndCallButton);
          }
        } else {
          // Create new end call button if it doesn't exist
          const endCallBtn = document.createElement('button');
          endCallBtn.id = 'end-call-button';
          endCallBtn.className = 'call-control-button end-call';
          endCallBtn.title = 'End call';
          endCallBtn.textContent = 'End';
          endCallBtn.style.backgroundColor = '#f44336';
          endCallBtn.style.color = 'white';
          const metricsSpan = controlsContainer.querySelector('#call-metrics');
          if (metricsSpan) {
            controlsContainer.insertBefore(endCallBtn, metricsSpan);
          } else {
            controlsContainer.appendChild(endCallBtn);
          }
        }
      } else {
        // call-controls-container already exists, but we still need to move the end call button
        const controlsContainer = this.container.querySelector('#call-controls-container');
        const existingEndCallInControls = controlsContainer.querySelector('#end-call-button');
        
        if (existingEndCallButton && !existingEndCallInControls) {
          // Move end call button from call-buttons-container to call-controls-container
          existingEndCallButton.className = 'call-control-button end-call';
          existingEndCallButton.style.backgroundColor = '#f44336';
          existingEndCallButton.style.color = 'white';
          const metricsSpan = controlsContainer.querySelector('#call-metrics');
          if (metricsSpan) {
            controlsContainer.insertBefore(existingEndCallButton, metricsSpan);
          } else {
            controlsContainer.appendChild(existingEndCallButton);
          }
        } else if (!existingEndCallButton && !existingEndCallInControls) {
          // Create new end call button if neither exists
          const endCallBtn = document.createElement('button');
          endCallBtn.id = 'end-call-button';
          endCallBtn.className = 'call-control-button end-call';
          endCallBtn.title = 'End call';
          endCallBtn.textContent = 'End';
          endCallBtn.style.backgroundColor = '#f44336';
          endCallBtn.style.color = 'white';
          const metricsSpan = controlsContainer.querySelector('#call-metrics');
          if (metricsSpan) {
            controlsContainer.insertBefore(endCallBtn, metricsSpan);
          } else {
            controlsContainer.appendChild(endCallBtn);
          }
        }
      }
    }
    
    this.buttonsContainer = this.container.querySelector('#call-buttons-container');
    this.callInfoContainer = this.container.querySelector('#call-info-container');
    this.callControlsContainer = this.container.querySelector('#call-controls-container');
    this.muteMicBtn = this.container.querySelector('#call-mute-mic-btn');
    this.muteSpeakersBtn = this.container.querySelector('#call-mute-speakers-btn');
    this.videoToggleBtn = this.container.querySelector('#call-video-toggle-btn');
    this.endCallButton = this.container.querySelector('#end-call-button');
    this.metricsSpan = this.container.querySelector('#call-metrics');
    
    this.callInfoItems = new Map(); // Map<user, HTMLElement>
    this.incomingCallPrompts = new Map(); // Map<user, {element: HTMLElement, resolve: Function}>
    
    // Ensure end call button is in the correct location (call-controls-container, not call-buttons-container)
    this._ensureEndCallButtonInCorrectLocation();
  }
  
  /**
   * Ensure the end call button is in call-controls-container, not call-buttons-container
   * @private
   */
  _ensureEndCallButtonInCorrectLocation() {
    const buttonsContainer = this.container.querySelector('#call-buttons-container');
    const controlsContainer = this.container.querySelector('#call-controls-container');
    const endCallButton = this.container.querySelector('#end-call-button');
    
    if (!endCallButton || !controlsContainer) {
      return;
    }
    
    // If end call button is in call-buttons-container, move it to call-controls-container
    if (buttonsContainer && buttonsContainer.contains(endCallButton)) {
      endCallButton.className = 'call-control-button end-call';
      endCallButton.style.backgroundColor = '#f44336';
      endCallButton.style.color = 'white';
      const metricsSpan = controlsContainer.querySelector('#call-metrics');
      if (metricsSpan) {
        controlsContainer.insertBefore(endCallButton, metricsSpan);
      } else {
        controlsContainer.appendChild(endCallButton);
      }
    }
    
    // Update reference
    this.endCallButton = endCallButton;
  }

  /**
   * Setup event listeners for control buttons
   * @private
   */
  _setupEventListeners() {
    if (this.muteMicBtn) {
      this.muteMicBtn.addEventListener('click', () => {
        const currentState = this.callManager.getMuteState();
        this.callManager.setMicMuted(!currentState.mic);
      });
    }
    
    if (this.muteSpeakersBtn) {
      this.muteSpeakersBtn.addEventListener('click', () => {
        const currentState = this.callManager.getMuteState();
        this.callManager.setSpeakersMuted(!currentState.speakers);
      });
    }
    
    if (this.videoToggleBtn) {
      this.videoToggleBtn.addEventListener('click', () => {
        const currentState = this.callManager.getMuteState();
        this.callManager.setVideoHidden(!currentState.video);
      });
    }
    
    // End call button handler
    if (this.endCallButton) {
      this.endCallButton.addEventListener('click', () => {
        console.log('End call button clicked from CallManagement');
        // End all active calls
        if (this.callManager && typeof this.callManager.endAllCalls === 'function') {
          this.callManager.endAllCalls();
        }
      });
    }
  }

  /**
   * Setup listeners for CallManager events
   * @private
   */
  _setupCallManagerListeners() {
    // Listen to mute state changes
    this.callManager.on('mutechanged', () => {
      this._updateButtonStates();
    });
    
    // Listen to call state changes
    this.callManager.on('callconnected', () => {
      this._updateFromCallManager();
    });
    
    this.callManager.on('callended', () => {
      this._updateFromCallManager();
    });
    
    // Listen to metrics updates
    this.callManager.on('metricsupdated', () => {
      this._updateMetrics();
    });
  }

  /**
   * Update UI from CallManager state
   * @private
   */
  _updateFromCallManager() {
    const activeCalls = this.callManager.getActiveCalls();
    const pendingCalls = this.callManager.getPendingCalls();
    const hasActiveCalls = activeCalls.audio.size > 0 || activeCalls.video.size > 0;
    const hasPendingCalls = pendingCalls.size > 0;
    
    // Determine current state and apply it
    if (!hasActiveCalls && !hasPendingCalls) {
      // State 1: No call (inactive)
      this._setStateInactive();
    } else if (hasPendingCalls && !hasActiveCalls) {
      // State 2: Pending call
      this._setStatePending();
    } else if (hasActiveCalls) {
      // State 3: Active call
      this._setStateActive(activeCalls.audio, activeCalls.video);
    }
  }

  /**
   * Set UI to State 1: No call (inactive)
   * @private
   */
  _setStateInactive() {
    // Set to inactive state - container remains in DOM and visible for start call buttons
    // The container should be visible so users can start new calls
    this.container.classList.remove('active');
    this.container.classList.remove('hidden');
    // Ensure container is visible (buttons should be shown)
    this.container.style.display = 'flex';
    
    // Show buttons container (for start call buttons)
    if (this.buttonsContainer) {
      this.buttonsContainer.style.display = 'flex';
    }
    
    // Hide call controls and info containers (only show when active)
    if (this.callControlsContainer) {
      this.callControlsContainer.classList.remove('active');
      this.callControlsContainer.style.display = 'none';
    }
    if (this.callInfoContainer) {
      this.callInfoContainer.classList.remove('active');
      this.callInfoContainer.style.display = 'none';
    }
    
    // Clear call info items (these are dynamically created, so removing is OK)
    for (const [user, item] of this.callInfoItems.entries()) {
      if (item && item.parentNode) {
        item.parentNode.removeChild(item);
      }
    }
    this.callInfoItems.clear();
    
    // Clear metrics (non-destructive - just clear text)
    if (this.metricsSpan) {
      this.metricsSpan.textContent = '';
    }
    
    // Reset button states (non-destructive)
    this._updateButtonStates();
    
    // Container remains in DOM and visible with start call buttons ready
    // All sub-containers remain in DOM, just hidden
  }

  /**
   * Set UI to State 2: Pending call
   * @private
   */
  _setStatePending() {
    // Show call-management container (for incoming call prompt)
    this.container.classList.add('active');
    this.container.classList.remove('hidden');
    this.container.style.display = 'flex';
    
    // Hide controls and info (only prompt should be visible)
    // Non-destructive - just hide, containers remain in DOM
    if (this.callControlsContainer) {
      this.callControlsContainer.classList.remove('active');
      this.callControlsContainer.style.display = 'none';
    }
    if (this.callInfoContainer) {
      this.callInfoContainer.classList.remove('active');
      this.callInfoContainer.style.display = 'none';
    }
    
    // Clear call info items (prompt is shown separately)
    for (const [user, item] of this.callInfoItems.entries()) {
      if (item && item.parentNode) {
        item.parentNode.removeChild(item);
      }
    }
    this.callInfoItems.clear();
    
    // Clear metrics
    if (this.metricsSpan) {
      this.metricsSpan.textContent = '';
    }
  }

  /**
   * Set UI to State 3: Active call
   * @private
   */
  _setStateActive(audioCalls, videoCalls) {
    // Show call-management container
    this.container.classList.add('active');
    this.container.classList.remove('hidden');
    this.container.style.display = 'flex';
    
    // Show controls and info (non-destructive - ensure they're visible)
    if (this.callControlsContainer) {
      this.callControlsContainer.classList.add('active');
      this.callControlsContainer.style.display = '';
    }
    if (this.callInfoContainer) {
      this.callInfoContainer.classList.add('active');
      this.callInfoContainer.style.display = '';
    }
    
    // Update call info, button states, and metrics
    this._updateCallInfo(audioCalls, videoCalls);
    this._updateButtonStates();
    this._updateMetrics();
  }

  /**
   * @deprecated Use CallManager directly. This method is kept for backward compatibility.
   * Set active calls (reads from CallManager)
   * @param {Set|Array} audioCalls - Set or array of users in audio calls
   * @param {Set|Array} videoCalls - Set or array of users in video calls
   */
  setActiveCalls(audioCalls, videoCalls) {
    // This is now a no-op - state comes from CallManager
    // Kept for backward compatibility
    this._updateFromCallManager();
  }

  /**
   * @deprecated Use CallManager directly. This method is kept for backward compatibility.
   * Set mute state (reads from CallManager)
   * @param {Object} state - Mute state object {mic: boolean, speakers: boolean, video: boolean}
   */
  setMuteState(state) {
    // This is now a no-op - state comes from CallManager
    // Kept for backward compatibility
    this._updateButtonStates();
  }

  /**
   * @deprecated Use CallManager directly. This method is kept for backward compatibility.
   * Set latency metrics for a user (reads from CallManager)
   * @param {string} user - User name
   * @param {Object} metrics - Metrics object {rtt: number, packetLoss: number, jitter: number}
   */
  setMetrics(user, metrics) {
    // This is now a no-op - state comes from CallManager
    // Kept for backward compatibility
    this._updateMetrics();
  }

  /**
   * @deprecated Use CallManager directly. This method is kept for backward compatibility.
   * Clear metrics for a user
   * @param {string} user - User name
   */
  clearMetrics(user) {
    // This is now a no-op - state comes from CallManager
    // Kept for backward compatibility
    this._updateMetrics();
  }

  /**
   * @deprecated Use CallManager directly. This method is kept for backward compatibility.
   * Clear all metrics
   */
  clearAllMetrics() {
    // This is now a no-op - state comes from CallManager
    // Kept for backward compatibility
    this._updateMetrics();
  }


  /**
   * Show an incoming call prompt
   * @param {string} peerName - Name of the caller
   * @param {Object} callInfo - {video: boolean, audio: boolean}
   * @returns {Promise<boolean>} Promise that resolves to true to accept, false to reject
   */
  showIncomingCallPrompt(peerName, callInfo) {
    console.log('CallManagement.showIncomingCallPrompt called', { peerName, callInfo, container: this.container });
    
    // Remove any existing prompt for this user
    this.hideIncomingCallPrompt(peerName);
    
    // Ensure call-management container is visible
    if (this.container) {
      this.container.style.display = 'flex';
      this.container.classList.add('active');
    }
    
    // Get the call-buttons-container
    const buttonsContainer = this.container ? this.container.querySelector('#call-buttons-container') : null;
    console.log('buttonsContainer found:', !!buttonsContainer, { container: this.container, buttonsContainer });
    
    if (!buttonsContainer) {
      console.error('call-buttons-container not found in container:', this.container);
      return Promise.resolve(false);
    }
    
    // Create prompt element
    const promptElement = document.createElement('div');
    promptElement.className = 'incoming-call-prompt';
    promptElement.style.cssText = `
      padding: 12px;
      margin: 8px 0;
      background-color: #4CAF50;
      color: white;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      width: 100%;
      box-sizing: border-box;
    `;
    
    const callType = callInfo.video ? 'video' : 'audio';
    const callTypeIcon = callInfo.video ? '📹' : '🔊';
    const isVideoCall = callInfo.video === true;
    
    // For video calls, show three options: Answer as Video, Answer as Audio, Decline
    // For audio calls, show two options: Accept, Reject
    let buttonsHTML = '';
    if (isVideoCall) {
      buttonsHTML = `
        <button class="accept-video-btn" style="
          padding: 8px 16px;
          background-color: white;
          color: #4CAF50;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">📹 Answer as Video</button>
        <button class="accept-audio-btn" style="
          padding: 8px 16px;
          background-color: #2196F3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">🔊 Answer as Audio</button>
        <button class="reject-call-btn" style="
          padding: 8px 16px;
          background-color: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">Decline</button>
      `;
    } else {
      buttonsHTML = `
        <button class="accept-call-btn" style="
          padding: 8px 16px;
          background-color: white;
          color: #4CAF50;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">Accept</button>
        <button class="reject-call-btn" style="
          padding: 8px 16px;
          background-color: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">Reject</button>
      `;
    }
    
    promptElement.innerHTML = `
      <div style="font-weight: bold; font-size: 1.1em;">
        ${callTypeIcon} Incoming ${callType} call from ${peerName}
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
        ${buttonsHTML}
      </div>
    `;
    
    // Create promise for accept/reject
    // Promise can resolve to:
    // - true: accept with original callInfo (for video calls, means accept as video)
    // - {video: false, audio: true}: accept as audio only (for video calls)
    // - false: reject
    let resolvePrompt;
    const promptPromise = new Promise((resolve) => {
      resolvePrompt = resolve;
    });
    
    // Set up button handlers
    if (isVideoCall) {
      // Video call: three buttons
      const acceptVideoBtn = promptElement.querySelector('.accept-video-btn');
      const acceptAudioBtn = promptElement.querySelector('.accept-audio-btn');
      const rejectBtn = promptElement.querySelector('.reject-call-btn');
      
      acceptVideoBtn.addEventListener('click', () => {
        this.hideIncomingCallPrompt(peerName);
        // Return true to accept with original callInfo (video + audio)
        resolvePrompt(true);
      });
      
      acceptAudioBtn.addEventListener('click', () => {
        this.hideIncomingCallPrompt(peerName);
        // Return modified callInfo to accept as audio only
        resolvePrompt({video: false, audio: true});
      });
      
      rejectBtn.addEventListener('click', () => {
        // Stop ringing immediately
        if (this.callManager && this.callManager.ringer && typeof this.callManager.ringer.stop === 'function') {
          this.callManager.ringer.stop();
        }
        
        // Hide the prompt first
        this.hideIncomingCallPrompt(peerName);
        
        // CRITICAL: End the call FIRST to send "endcall" message to caller
        // This ensures the caller receives the message and their UI updates
        if (this.callManager) {
          this.callManager.endCall(peerName);
        }
        
        // Then resolve promise to false to indicate rejection
        // This will cause RTC client to reject the call (which also sends "endcall" via catch handler)
        // But we've already sent it above, so this is just for cleanup
        resolvePrompt(false);
      });
    } else {
      // Audio call: two buttons (same as before)
      const acceptBtn = promptElement.querySelector('.accept-call-btn');
      const rejectBtn = promptElement.querySelector('.reject-call-btn');
      
      acceptBtn.addEventListener('click', () => {
        this.hideIncomingCallPrompt(peerName);
        resolvePrompt(true);
      });
      
      rejectBtn.addEventListener('click', () => {
        // Stop ringing immediately
        if (this.callManager && this.callManager.ringer && typeof this.callManager.ringer.stop === 'function') {
          this.callManager.ringer.stop();
        }
        
        // Hide the prompt first
        this.hideIncomingCallPrompt(peerName);
        
        // CRITICAL: End the call FIRST to send "endcall" message to caller
        // This ensures the caller receives the message and their UI updates
        if (this.callManager) {
          this.callManager.endCall(peerName);
        }
        
        // Then resolve promise to false to indicate rejection
        // This will cause RTC client to reject the call (which also sends "endcall" via catch handler)
        // But we've already sent it above, so this is just for cleanup
        resolvePrompt(false);
      });
    }
    
    // Store prompt
    this.incomingCallPrompts.set(peerName, {
      element: promptElement,
      resolve: resolvePrompt
    });
    
    // Clear the buttons container and add the prompt
    console.log('Clearing buttonsContainer and adding prompt', { buttonsContainer, promptElement });
    buttonsContainer.innerHTML = '';
    buttonsContainer.appendChild(promptElement);
    console.log('Prompt added to buttonsContainer', { buttonsContainerHTML: buttonsContainer.innerHTML.substring(0, 100) });
    
    return promptPromise;
  }
  
  /**
   * Hide/remove an incoming call prompt
   * @param {string} peerName - Name of the caller
   */
  hideIncomingCallPrompt(peerName) {
    const prompt = this.incomingCallPrompts.get(peerName);
    if (prompt) {
      const buttonsContainer = this.container.querySelector('#call-buttons-container');
      if (prompt.element && prompt.element.parentNode) {
        prompt.element.parentNode.removeChild(prompt.element);
      }
      this.incomingCallPrompts.delete(peerName);
      
      // If no more prompts, restore buttons (ChatBox will handle showing the right ones)
      if (this.incomingCallPrompts.size === 0 && buttonsContainer) {
        // ChatBox will restore the buttons via _updateCallButtonVisibility
        // We just need to clear the container so it can be repopulated
        buttonsContainer.innerHTML = '';
      }
    }
  }

  /**
   * Show a missed call notification
   * @param {string} peerName - Name of the peer
   * @param {string} direction - 'incoming' or 'outgoing'
   */
  showMissedCallNotification(peerName, direction) {
    const buttonsContainer = this.container.querySelector('#call-buttons-container');
    if (!buttonsContainer) {
      return;
    }
    
    const message = direction === 'incoming'
      ? `Missed call from ${peerName}`
      : `${peerName} missed your call`;
    
    const notificationEl = document.createElement('div');
    notificationEl.className = 'missed-call-notification';
    notificationEl.style.cssText = `
      padding: 8px 12px;
      margin: 4px 0;
      background-color: #ff9800;
      color: white;
      border-radius: 4px;
      font-size: 0.9em;
      text-align: center;
    `;
    notificationEl.textContent = message;
    
    // Add to call-info-container (not buttons container, as that's for controls)
    if (this.callInfoContainer) {
      this.callInfoContainer.appendChild(notificationEl);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (notificationEl.parentNode) {
          notificationEl.parentNode.removeChild(notificationEl);
        }
      }, 5000);
    }
  }

  /**
   * Show a call declined notification
   * @param {string} peerName - Name of the peer who declined
   */
  showCallDeclinedNotification(peerName) {
    const buttonsContainer = this.container.querySelector('#call-buttons-container');
    if (!buttonsContainer) {
      return;
    }
    
    const notificationEl = document.createElement('div');
    notificationEl.className = 'call-declined-notification';
    notificationEl.style.cssText = `
      padding: 8px 12px;
      margin: 4px 0;
      background-color: #f44336;
      color: white;
      border-radius: 4px;
      font-size: 0.9em;
      text-align: center;
    `;
    notificationEl.textContent = `${peerName} declined your call`;
    
    // Add to call-info-container (not buttons container, as that's for controls)
    if (this.callInfoContainer) {
      this.callInfoContainer.appendChild(notificationEl);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (notificationEl.parentNode) {
          notificationEl.parentNode.removeChild(notificationEl);
        }
      }, 5000);
    }
  }

  /**
   * Update call info display (list of active calls)
   * @private
   */
  _updateCallInfo(audioCalls, videoCalls) {
    if (!this.callInfoContainer) {
      return;
    }
    
    // Remove existing call info items (but keep incoming call prompts)
    for (const [user, item] of this.callInfoItems.entries()) {
      if (item && item.parentNode) {
        item.parentNode.removeChild(item);
      }
    }
    this.callInfoItems.clear();
    
    // Add audio call info (only if not also a video call)
    for (const user of audioCalls) {
      if (!videoCalls.has(user)) {
        const infoItem = document.createElement('div');
        infoItem.className = 'call-info-item';
        infoItem.textContent = `🔊 Audio call with ${user}`;
        // Insert after incoming call prompts
        const prompts = Array.from(this.incomingCallPrompts.values());
        if (prompts.length > 0 && prompts[0].element && prompts[0].element.nextSibling) {
          this.callInfoContainer.insertBefore(infoItem, prompts[0].element.nextSibling);
        } else {
          this.callInfoContainer.appendChild(infoItem);
        }
        this.callInfoItems.set(user, infoItem);
      }
    }
    
    // Add video call info
    for (const user of videoCalls) {
      const infoItem = document.createElement('div');
      infoItem.className = 'call-info-item';
      infoItem.textContent = `📹 Video call with ${user}`;
      // Insert after incoming call prompts
      const prompts = Array.from(this.incomingCallPrompts.values());
      if (prompts.length > 0 && prompts[0].element && prompts[0].element.nextSibling) {
        this.callInfoContainer.insertBefore(infoItem, prompts[0].element.nextSibling);
      } else {
        this.callInfoContainer.appendChild(infoItem);
      }
      this.callInfoItems.set(user, infoItem);
    }
  }

  /**
   * Update button states based on mute state from CallManager
   * @private
   */
  _updateButtonStates() {
    const muteState = this.callManager.getMuteState();
    const activeCalls = this.callManager.getActiveCalls();
    const hasVideoCalls = activeCalls.video.size > 0;
    
    if (this.muteMicBtn) {
      // Toggle button: show "Mic" with active state and strikethrough when muted
      this.muteMicBtn.textContent = 'Mic';
      this.muteMicBtn.title = muteState.mic ? 'Microphone is muted - click to unmute' : 'Microphone is on - click to mute';
      this.muteMicBtn.classList.toggle('active', muteState.mic);
      this.muteMicBtn.style.textDecoration = muteState.mic ? 'line-through' : 'none';
    }
    
    if (this.muteSpeakersBtn) {
      // Toggle button: show "Speakers" with active state and strikethrough when muted
      this.muteSpeakersBtn.textContent = 'Speakers';
      this.muteSpeakersBtn.title = muteState.speakers ? 'Speakers are muted - click to unmute' : 'Speakers are on - click to mute';
      this.muteSpeakersBtn.classList.toggle('active', muteState.speakers);
      this.muteSpeakersBtn.style.textDecoration = muteState.speakers ? 'line-through' : 'none';
    }
    
    if (this.videoToggleBtn) {
      // Show camera button only for video calls
      this.videoToggleBtn.style.display = hasVideoCalls ? 'inline-block' : 'none';
      // Toggle button: show "Camera" with active state and strikethrough when hidden
      this.videoToggleBtn.textContent = 'Camera';
      this.videoToggleBtn.title = muteState.video ? 'Camera is hidden - click to show' : 'Camera is on - click to hide';
      this.videoToggleBtn.classList.toggle('active', muteState.video);
      this.videoToggleBtn.style.textDecoration = muteState.video ? 'line-through' : 'none';
    }
  }

  /**
   * Update metrics display from CallManager
   * @private
   */
  _updateMetrics() {
    if (!this.metricsSpan || !this.options.showMetrics) {
      return;
    }
    
    const activeCalls = this.callManager.getActiveCalls();
    const activeCallUsers = new Set([...activeCalls.audio, ...activeCalls.video]);
    const allMetrics = this.callManager.getAllMetrics();
    
    if (activeCallUsers.size === 0) {
      this.metricsSpan.textContent = '';
      return;
    }
    
    // Collect metrics for all active calls
    const metrics = [];
    for (const user of activeCallUsers) {
      const userMetrics = allMetrics.get(user);
      if (userMetrics) {
        const parts = [];
        if (userMetrics.rtt !== null && userMetrics.rtt !== undefined) {
          parts.push(`${Math.round(userMetrics.rtt)}ms`);
        }
        if (userMetrics.packetLoss !== null && userMetrics.packetLoss !== undefined && userMetrics.packetLoss > 0) {
          parts.push(`Loss: ${userMetrics.packetLoss.toFixed(1)}%`);
        }
        if (userMetrics.jitter !== null && userMetrics.jitter !== undefined) {
          parts.push(`Jitter: ${Math.round(userMetrics.jitter)}ms`);
        }
        
        if (parts.length > 0) {
          const displayName = activeCallUsers.size > 1 ? user : '';
          metrics.push(`${displayName}${displayName ? ': ' : ''}${parts.join(', ')}`);
        }
      }
    }
    
    if (metrics.length > 0) {
      this.metricsSpan.textContent = `📊 ${metrics.join(' | ')}`;
    } else {
      this.metricsSpan.textContent = '📊 Connecting...';
    }
  }
}

export { CallManagement };


