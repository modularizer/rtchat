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
          <button id="call-mute-mic-btn" class="call-control-button" title="Mute/Unmute microphone">Mute Mic</button>
          <button id="call-mute-speakers-btn" class="call-control-button" title="Mute/Unmute speakers">Mute Speakers</button>
          <button id="call-video-toggle-btn" class="call-control-button" title="Hide/Show video" style="display: none;">Hide Video</button>
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
      if (!this.container.querySelector('#call-controls-container')) {
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'call-controls-container';
        controlsContainer.innerHTML = `
          <span style="font-weight: bold; margin-right: 8px;">Call Controls:</span>
          <button id="call-mute-mic-btn" class="call-control-button" title="Mute/Unmute microphone">Mute Mic</button>
          <button id="call-mute-speakers-btn" class="call-control-button" title="Mute/Unmute speakers">Mute Speakers</button>
          <button id="call-video-toggle-btn" class="call-control-button" title="Hide/Show video" style="display: none;">Hide Video</button>
          <span id="call-metrics"></span>
        `;
        this.container.appendChild(controlsContainer);
      }
    }
    
    this.callInfoContainer = this.container.querySelector('#call-info-container');
    this.callControlsContainer = this.container.querySelector('#call-controls-container');
    this.muteMicBtn = this.container.querySelector('#call-mute-mic-btn');
    this.muteSpeakersBtn = this.container.querySelector('#call-mute-speakers-btn');
    this.videoToggleBtn = this.container.querySelector('#call-video-toggle-btn');
    this.metricsSpan = this.container.querySelector('#call-metrics');
    
    this.callInfoItems = new Map(); // Map<user, HTMLElement>
    this.incomingCallPrompts = new Map(); // Map<user, {element: HTMLElement, resolve: Function}>
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
    
    // Update visibility (handles all three states - this will hide/show containers correctly)
    this._updateVisibility(activeCalls.audio, activeCalls.video);
    
    // Only show call info and controls if there are active calls (not pending)
    if (activeCalls.audio.size > 0 || activeCalls.video.size > 0) {
      this._updateCallInfo(activeCalls.audio, activeCalls.video);
      this._updateButtonStates();
      this._updateMetrics();
    } else {
      // No active calls - clear info and metrics
      if (this.callInfoContainer) {
        // Clear call info items but keep incoming call prompts
        for (const [user, item] of this.callInfoItems.entries()) {
          if (item && item.parentNode) {
            item.parentNode.removeChild(item);
          }
        }
        this.callInfoItems.clear();
      }
      if (this.metricsSpan) {
        this.metricsSpan.textContent = '';
      }
      // Button states will be updated by _updateVisibility via _updateButtonStates
      this._updateButtonStates();
    }
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
   * Update visibility of the call management section
   * @private
   */
  _updateVisibility(audioCalls, videoCalls) {
    const hasActiveCalls = audioCalls.size > 0 || videoCalls.size > 0;
    const pendingCalls = this.callManager ? this.callManager.getPendingCalls() : new Set();
    const hasPendingCalls = pendingCalls.size > 0;
    
    // State 1: No active calls and no pending calls - hide everything
    if (!hasActiveCalls && !hasPendingCalls) {
      this.container.classList.remove('active');
      this.container.classList.add('hidden');
      // Hide controls and info containers
      if (this.callControlsContainer) {
        this.callControlsContainer.classList.remove('active');
      }
      if (this.callInfoContainer) {
        this.callInfoContainer.classList.remove('active');
      }
      return;
    }
    
    // State 2 or 3: Show the container
    this.container.classList.add('active');
    this.container.classList.remove('hidden');
    
    // State 2: Pending call - show container but hide controls and info (prompt is shown separately)
    if (hasPendingCalls && !hasActiveCalls) {
      if (this.callControlsContainer) {
        this.callControlsContainer.classList.remove('active');
      }
      if (this.callInfoContainer) {
        this.callInfoContainer.classList.remove('active');
      }
      return;
    }
    
    // State 3: Active call - show controls and info
    if (hasActiveCalls) {
      if (this.callControlsContainer) {
        this.callControlsContainer.classList.add('active');
      }
      if (this.callInfoContainer) {
        this.callInfoContainer.classList.add('active');
      }
    }
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
    
    // Ensure call-management container is visible for pending calls
    if (this.container) {
      this.container.classList.remove('hidden');
      this.container.classList.add('active');
      // Hide controls and info containers (only show prompt)
      if (this.callControlsContainer) {
        this.callControlsContainer.classList.remove('active');
      }
      if (this.callInfoContainer) {
        this.callInfoContainer.classList.remove('active');
      }
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
    promptElement.innerHTML = `
      <div style="font-weight: bold; font-size: 1.1em;">
        ${callTypeIcon} Incoming ${callType} call from ${peerName}
      </div>
      <div style="display: flex; gap: 8px;">
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
      </div>
    `;
    
    // Create promise for accept/reject
    let resolvePrompt;
    const promptPromise = new Promise((resolve) => {
      resolvePrompt = resolve;
    });
    
    // Set up button handlers
    const acceptBtn = promptElement.querySelector('.accept-call-btn');
    const rejectBtn = promptElement.querySelector('.reject-call-btn');
    
    acceptBtn.addEventListener('click', () => {
      this.hideIncomingCallPrompt(peerName);
      resolvePrompt(true);
    });
    
    rejectBtn.addEventListener('click', () => {
      this.hideIncomingCallPrompt(peerName);
      resolvePrompt(false);
    });
    
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
      this.muteMicBtn.textContent = muteState.mic ? 'Unmute Mic' : 'Mute Mic';
      this.muteMicBtn.title = muteState.mic ? 'Unmute microphone' : 'Mute microphone';
      this.muteMicBtn.classList.toggle('active', muteState.mic);
    }
    
    if (this.muteSpeakersBtn) {
      this.muteSpeakersBtn.textContent = muteState.speakers ? 'Unmute Speakers' : 'Mute Speakers';
      this.muteSpeakersBtn.title = muteState.speakers ? 'Unmute speakers' : 'Mute speakers';
      this.muteSpeakersBtn.classList.toggle('active', muteState.speakers);
    }
    
    if (this.videoToggleBtn) {
      this.videoToggleBtn.style.display = hasVideoCalls ? 'inline-block' : 'none';
      this.videoToggleBtn.textContent = muteState.video ? 'Show Video' : 'Hide Video';
      this.videoToggleBtn.title = muteState.video ? 'Show video' : 'Hide video';
      this.videoToggleBtn.classList.toggle('active', muteState.video);
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


