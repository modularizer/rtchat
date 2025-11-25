/**
 * CallManager - Platform-agnostic call state and business logic management
 * 
 * This class manages all call-related business logic without any UI dependencies.
 * It tracks call state, manages mute states, handles timeouts, and collects statistics.
 * 
 * Usage:
 *   import { CallManager } from './call-manager.js';
 *   import { EventEmitter } from './event-emitter.js';
 *   
 *   const callManager = new CallManager(rtcClient);
 *   callManager.on('callstarted', (user, type) => { ... });
 *   callManager.on('callended', (user) => { ... });
 *   callManager.on('mutechanged', ({mic, speakers, video}) => { ... });
 *   
 *   // Start a call
 *   await callManager.startCall(user, 'audio');
 *   
 *   // Mute/unmute
 *   callManager.setMicMuted(true);
 *   callManager.setSpeakersMuted(true);
 *   callManager.setVideoHidden(true);
 * 
 * Features:
 * - Call state tracking (active calls, pending calls, outgoing calls)
 * - Mute state management (mic, speakers, video)
 * - Call timeout handling
 * - Connection statistics collection
 * - Event-driven architecture
 * 
 * @module call-manager
 */

import { EventEmitter } from '../utils/event-emitter.js';
import { CallState } from './call-state.js';

class CallManager extends EventEmitter {
  /**
   * Create a new CallManager instance
   * @param {Object} rtcClient - RTC client instance (MQTTRTCClient or similar)
   * @param {Object} options - Configuration options
   * @param {number} options.callTimeout - Call timeout in milliseconds (default: 15000)
   * @param {number} options.statsPollInterval - Stats polling interval in milliseconds (default: 2000)
   * @param {CallUIInterface} options.callUI - Optional call UI component implementing CallUIInterface
   * @param {StreamDisplayInterface} options.videoDisplay - Optional video display component
   * @param {StreamDisplayInterface} options.audioDisplay - Optional audio display component
   * @param {AudioControllerInterface} options.audioController - Optional audio controller
   * @param {VideoControllerInterface} options.videoController - Optional video controller
   * @param {RingerInterface} options.ringer - Optional ringtone component
   * @param {NotificationInterface} options.notifications - Optional notification component
   */
  constructor(rtcClient, options = {}) {
    super();
    
    this.rtcClient = rtcClient;
    this.options = {
      callTimeout: options.callTimeout || 15000,
      statsPollInterval: options.statsPollInterval || 2000,
      ...options
    };
    
    // Optional UI components
    this.callUI = options.callUI || null;
    this.videoDisplay = options.videoDisplay || null;
    this.audioDisplay = options.audioDisplay || null;
    this.audioController = options.audioController || null;
    this.videoController = options.videoController || null;
    this.ringer = options.ringer || null;
    this.notifications = options.notifications || null;
    
    // Unified call state tracking (platform-agnostic, UI-agnostic)
    this.callState = new CallState();
    
    // Additional metadata tracking (not part of core state)
    this.pendingCalls = new Map(); // Map<user, {callInfo, promises, timeoutId, promptElement}>
    this.outgoingCalls = new Map(); // Map<user, {type, cancelFn, timeoutId}>
    this.localStreams = new Map(); // Map<user, MediaStream>
    
    // Mute state
    this.muteState = {
      mic: false,
      speakers: false,
      video: false
    };
    
    // Statistics
    this.statsInterval = null;
    this.latencyMetrics = new Map(); // Map<user, {rtt, packetLoss, jitter}>
    
    // Bind methods
    this._handleIncomingCall = this._handleIncomingCall.bind(this);
    this._handleCallConnected = this._handleCallConnected.bind(this);
    this._handleCallEnded = this._handleCallEnded.bind(this);
    
    // Setup RTC client event listeners if available
    if (rtcClient) {
      this._setupRTCEventListeners();
    }
  }

  /**
   * Setup event listeners on RTC client
   * @private
   */
  _setupRTCEventListeners() {
    if (this.rtcClient.on) {
      this.rtcClient.on('call', this._handleIncomingCall);
      this.rtcClient.on('callconnected', this._handleCallConnected);
      this.rtcClient.on('callended', (user) => {
        console.log("CallManager: Received 'callended' event from RTC client for " + user);
        this._handleCallEnded(user);
      });
      this.rtcClient.on('disconnectedfrompeer', (user) => {
        this._handleDisconnectedFromUser(user);
      });
    }
  }

  /**
   * Handle incoming call from RTC client
   * @param {string} peerName - Name of the peer calling
   * @param {Object} callInfo - Call information {video: boolean, audio: boolean}
   * @param {Object} promises - Call promises {start: Promise, end: Promise}
   * @returns {Promise} Promise that resolves to acceptance result
   * @private
   */
  _handleIncomingCall(peerName, callInfo, promises) {
    console.log('CallManager._handleIncomingCall called', { peerName, callInfo, hasRinger: !!this.ringer });
    
    // Set up timeout for unanswered call
    const timeoutId = setTimeout(() => {
      this._handleCallTimeout(peerName, 'incoming');
    }, this.options.callTimeout);
    
    // Track pending call
    this.pendingCalls.set(peerName, {
      callInfo,
      promises,
      timeoutId,
      promptElement: null // UI can set this
    });
    
    // Update unified call state
    this.callState.setUserState(peerName, {
      status: 'pending',
      audio: callInfo.audio !== false, // Default to true if not specified
      video: callInfo.video === true
    });
    
    // Start ringing if ringer is provided
    if (this.ringer && typeof this.ringer.start === 'function') {
      console.log('Starting ringtone...');
      this.ringer.start().catch(err => {
        console.error('Could not start ringtone:', err);
      });
    } else {
      console.warn('No ringer available or ringer.start is not a function', { 
        hasRinger: !!this.ringer, 
        ringerType: this.ringer ? typeof this.ringer : 'undefined',
        hasStart: this.ringer ? typeof this.ringer.start : 'N/A'
      });
    }
    
    // Emit event for UI to handle
    this.emit('incomingcall', {
      peerName,
      callInfo,
      promises,
      timeoutId
    });
    
    // Use callUI if provided, otherwise auto-accept
    if (this.callUI && typeof this.callUI.showIncomingCallPrompt === 'function') {
      return this.callUI.showIncomingCallPrompt(peerName, callInfo);
    }
    
    // Default: auto-accept
    return Promise.resolve(true);
  }

  /**
   * Handle call connected event
   * @param {string} sender - Name of the peer
   * @param {Object} streams - Stream objects {localStream, remoteStream}
   * @private
   */
  _handleCallConnected(sender, {localStream, remoteStream}) {
    // Clear timeout
    const pendingCall = this.pendingCalls.get(sender);
    if (pendingCall && pendingCall.timeoutId) {
      clearTimeout(pendingCall.timeoutId);
      pendingCall.timeoutId = null;
    }
    this.pendingCalls.delete(sender);
    
    // Stop ringing if ringer is provided
    if (this.ringer && typeof this.ringer.stop === 'function') {
      this.ringer.stop();
    }
    
    // Determine call type
    const hasVideo = localStream?.getVideoTracks().length > 0 || 
                     remoteStream?.getVideoTracks().length > 0;
    const hasAudio = localStream?.getAudioTracks().length > 0 || 
                     remoteStream?.getAudioTracks().length > 0;
    
    // Store local stream
    if (localStream instanceof MediaStream) {
      this.localStreams.set(sender, localStream);
    }
    
    // Update unified call state
    this.callState.setUserState(sender, {
      status: 'active',
      audio: hasAudio,
      video: hasVideo
    });
    
    // Start stats polling if not already started
    const activeCalls = this.callState.getActiveCalls();
    if (!this.statsInterval && (activeCalls.video.size > 0 || activeCalls.audio.size > 0)) {
      this._startStatsPolling();
    }
    
    // Emit event
    this.emit('callconnected', {
      sender,
      localStream,
      remoteStream,
      type: hasVideo ? 'video' : 'audio'
    });
    
    // Use stream displays if provided
    if (hasVideo && this.videoDisplay && typeof this.videoDisplay.setStreams === 'function') {
      this.videoDisplay.setStreams(sender, { localStream, remoteStream });
    } else if (hasAudio && this.audioDisplay && typeof this.audioDisplay.setStreams === 'function') {
      this.audioDisplay.setStreams(sender, { localStream, remoteStream });
    }
  }

  /**
   * Handle call ended event
   * @param {string} peerName - Name of the peer
   * @private
   */
  _handleCallEnded(peerName) {
    console.log("CallManager._handleCallEnded: Called for " + peerName);
    // Check if call is already ended (idempotent)
    const currentState = this.callState.getUserState(peerName);
    if (currentState && currentState.status === 'inactive') {
      // Already ended, skip
      console.log("CallManager._handleCallEnded: Call already ended for " + peerName + ", skipping");
      return;
    }
    
    // CRITICAL: Collect all users with active/pending calls BEFORE updating any state
    // This ensures we get the complete list of all calls that need to be ended
    const activeCallsBefore = this.callState.getActiveCalls();
    const pendingCallsBefore = this.callState.getPendingCalls();
    const allUsersToEnd = new Set([
      ...activeCallsBefore.audio,
      ...activeCallsBefore.video,
      ...pendingCallsBefore,
      ...this.outgoingCalls.keys()
    ]);
    
    console.log("CallManager._handleCallEnded: Found calls to end:", {
      activeAudio: Array.from(activeCallsBefore.audio),
      activeVideo: Array.from(activeCallsBefore.video),
      pending: Array.from(pendingCallsBefore),
      outgoing: Array.from(this.outgoingCalls.keys()),
      allUsersToEnd: Array.from(allUsersToEnd)
    });
    
    // Clear timeouts for the primary peer
    const pendingCall = this.pendingCalls.get(peerName);
    if (pendingCall && pendingCall.timeoutId) {
      clearTimeout(pendingCall.timeoutId);
    }
    this.pendingCalls.delete(peerName);
    
    const outgoingCall = this.outgoingCalls.get(peerName);
    if (outgoingCall && outgoingCall.timeoutId) {
      clearTimeout(outgoingCall.timeoutId);
    }
    this.outgoingCalls.delete(peerName);
    
    // Update unified call state for the primary peer
    this.callState.setUserState(peerName, {
      status: 'inactive',
      audio: false,
      video: false
    });
    
    this.localStreams.delete(peerName);
    this.latencyMetrics.delete(peerName);
    
    // CRITICAL: Emit callended event for the primary call - this must always happen
    this.emit('callended', { peerName });
    
    // End all other remaining calls (excluding the one we just ended)
    for (const otherUser of allUsersToEnd) {
      if (otherUser !== peerName) {
        // End call with RTC client to send message
        if (this.rtcClient && this.rtcClient.endCallWithUser) {
          try {
            this.rtcClient.endCallWithUser(otherUser);
          } catch (err) {
            console.warn(`Error ending call with ${otherUser}:`, err);
          }
        }
        
        // Update state for other user
        const otherPendingCall = this.pendingCalls.get(otherUser);
        if (otherPendingCall && otherPendingCall.timeoutId) {
          clearTimeout(otherPendingCall.timeoutId);
        }
        this.pendingCalls.delete(otherUser);
        
        const otherOutgoingCall = this.outgoingCalls.get(otherUser);
        if (otherOutgoingCall && otherOutgoingCall.timeoutId) {
          clearTimeout(otherOutgoingCall.timeoutId);
        }
        this.outgoingCalls.delete(otherUser);
        
        this.callState.setUserState(otherUser, {
          status: 'inactive',
          audio: false,
          video: false
        });
        this.localStreams.delete(otherUser);
        this.latencyMetrics.delete(otherUser);
        
        // CRITICAL: Emit callended event for each other user
        this.emit('callended', { peerName: otherUser });
      }
    }
    
    // Stop stats polling and reset mute states (all calls are now ended)
    this._stopStatsPolling();
    this.muteState = { mic: false, speakers: false, video: false };
  }

  /**
   * Handle call timeout
   * @param {string} peerName - Name of the peer
   * @param {string} direction - 'incoming' or 'outgoing'
   * @private
   */
  _handleCallTimeout(peerName, direction) {
    // Stop ringing if ringer is provided
    if (this.ringer && typeof this.ringer.stop === 'function') {
      this.ringer.stop();
    }
    
    // End call with RTC client to send message
    if (this.rtcClient && this.rtcClient.endCallWithUser) {
      try {
        this.rtcClient.endCallWithUser(peerName);
      } catch (err) {
        console.warn(`Error ending timed out call:`, err);
      }
    }
    
    // CRITICAL: Use _handleCallEnded which will end ALL calls and emit events
    this._handleCallEnded(peerName);
    
    // Emit timeout event for UI notifications
    this.emit('calltimeout', { peerName, direction });
    
    // Use callUI if provided
    if (this.callUI && typeof this.callUI.showMissedCallNotification === 'function') {
      this.callUI.showMissedCallNotification(peerName, direction);
    }
    
    // Clean up stream displays
    if (this.videoDisplay && typeof this.videoDisplay.removeStreams === 'function') {
      this.videoDisplay.removeStreams(peerName);
    }
    if (this.audioDisplay && typeof this.audioDisplay.removeStreams === 'function') {
      this.audioDisplay.removeStreams(peerName);
    }
  }

  /**
   * Handle user disconnection
   * @param {string} user - Name of the user
   * @private
   */
  _handleDisconnectedFromUser(user) {
    const userState = this.callState.getUserState(user);
    const hasActiveOrPendingCall = userState && (userState.status === 'active' || userState.status === 'pending');
    const hasOutgoingCall = this.outgoingCalls.has(user);
    
    if (hasActiveOrPendingCall || hasOutgoingCall) {
      // End call with disconnected user
      if (this.rtcClient && this.rtcClient.endCallWithUser) {
        try {
          this.rtcClient.endCallWithUser(user);
        } catch (err) {
          console.warn(`Error ending call with disconnected user:`, err);
        }
      }
      
      this._handleCallEnded(user);
    }
  }

  /**
   * Start a call with a user
   * @param {string} user - Name of the user to call
   * @param {string} type - 'audio' or 'video'
   * @returns {Promise} Promise that resolves when call starts
   */
  async startCall(user, type) {
    if (!this.rtcClient || !this.rtcClient.callUser) {
      throw new Error('RTC client not available or does not support callUser');
    }
    
    const callInfo = type === 'audio' 
      ? { video: false, audio: true }
      : { video: true, audio: true };
    
    // Create cancel function
    let timeoutId = null;
    const cancelCall = (reason = 'cancelled') => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      this.outgoingCalls.delete(user);
      if (this.rtcClient && this.rtcClient.endCallWithUser) {
        try {
          this.rtcClient.endCallWithUser(user);
        } catch (err) {
          console.error(`Error canceling call:`, err);
        }
      }
      this.emit('callcancelled', { user, reason });
    };
    
    // Set up timeout
    timeoutId = setTimeout(() => {
      this._handleCallTimeout(user, 'outgoing');
    }, this.options.callTimeout);
    
    // Track outgoing call
    this.outgoingCalls.set(user, {
      type,
      cancelFn: cancelCall,
      timeoutId
    });
    
    try {
      // Start the call - callUser returns {start, end} promises
      const { start, end } = this.rtcClient.callUser(user, callInfo);
      
      // Await the start promise to get the streams
      const streamResult = await start;
      
      // Clear timeout if call started successfully
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // If streamResult contains streams, handle them
      if (streamResult && (streamResult.localStream || streamResult.remoteStream)) {
        this._handleCallConnected(user, streamResult);
      }
      
      // Emit event
      this.emit('callstarted', { user, type });
      
      // Return the stream result and end promise
      return { ...streamResult, end };
    } catch (err) {
      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.outgoingCalls.delete(user);
      
      // Check if call was rejected
      if (err === "Call rejected" || err?.message === "Call rejected") {
        // CRITICAL: When call is rejected, end ALL calls and emit events
        this._handleCallEnded(user);
        this.emit('callrejected', { user });
      } else {
        // For other errors, also end all calls to ensure clean state
        this._handleCallEnded(user);
        this.emit('callerror', { user, error: err });
      }
      
      throw err;
    }
  }

  /**
   * End a call with a user
   * @param {string} user - Name of the user
   */
  endCall(user) {
    // First, tell RTC client to end the call and send "endcall" message to peer
    // This must happen while the call is still active so the message can be sent
    if (this.rtcClient && this.rtcClient.endCallWithUser) {
      try {
        this.rtcClient.endCallWithUser(user);
      } catch (err) {
        console.error(`Error ending call:`, err);
      }
    }
    
    // CRITICAL: Use _handleCallEnded which will end ALL calls and emit events
    // This ensures when any call ends, all other calls are also ended
    this._handleCallEnded(user);
  }

  /**
   * End all active calls
   */
  endAllCalls() {
    const activeCalls = this.callState.getActiveCalls();
    const pendingCalls = this.callState.getPendingCalls();
    const allUsers = new Set([...activeCalls.video, ...activeCalls.audio, ...pendingCalls, ...this.outgoingCalls.keys()]);
    for (const user of allUsers) {
      this.endCall(user);
    }
  }

  /**
   * Set microphone mute state
   * @param {boolean} muted - Whether microphone is muted
   */
  setMicMuted(muted) {
    this.muteState.mic = muted;
    
    // Update all local streams
    for (const [user, stream] of this.localStreams.entries()) {
      if (stream && stream instanceof MediaStream) {
        const audioTracks = stream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = !muted;
        });
      }
    }
    
    this.emit('mutechanged', { ...this.muteState });
  }

  /**
   * Set speakers mute state
   * @param {boolean} muted - Whether speakers are muted
   */
  setSpeakersMuted(muted) {
    this.muteState.speakers = muted;
    
    // Note: Speakers muting requires UI to handle remote audio/video elements
    // This just tracks the state and emits event
    this.emit('mutechanged', { ...this.muteState });
    this.emit('speakersmutechanged', { muted });
  }

  /**
   * Set video hidden state
   * @param {boolean} hidden - Whether video is hidden
   */
  setVideoHidden(hidden) {
    this.muteState.video = hidden;
    
    // Update all local streams
    for (const [user, stream] of this.localStreams.entries()) {
      if (stream && stream instanceof MediaStream) {
        const videoTracks = stream.getVideoTracks();
        videoTracks.forEach(track => {
          track.enabled = !hidden;
        });
      }
    }
    
    // Use videoController if provided
    if (this.videoController && typeof this.videoController.setVideoHidden === 'function') {
      this.videoController.setVideoHidden(hidden, this.localStreams);
    }
    
    this.emit('mutechanged', { ...this.muteState });
  }

  /**
   * Get current mute state
   * @returns {Object} Mute state {mic: boolean, speakers: boolean, video: boolean}
   */
  getMuteState() {
    return { ...this.muteState };
  }

  /**
   * Get active calls
   * @returns {Object} {audio: Set, video: Set}
   */
  getActiveCalls() {
    // Use unified call state as source of truth
    return this.callState.getActiveCalls();
  }

  /**
   * Get pending incoming calls
   * @returns {Set} Set of user names with pending incoming calls
   */
  getPendingCalls() {
    // Use unified call state as source of truth
    return this.callState.getPendingCalls();
  }

  /**
   * Get call state for a user
   * @param {string} user - User name
   * @returns {Object|null} State object {status: string, audio: boolean, video: boolean} or null
   */
  getUserCallState(user) {
    return this.callState.getUserState(user);
  }

  /**
   * Get all call states
   * @returns {Map} Map of user -> state
   */
  getAllCallStates() {
    return this.callState.getAllStates();
  }

  /**
   * Get latency metrics for a user
   * @param {string} user - User name
   * @returns {Object|null} Metrics {rtt, packetLoss, jitter} or null
   */
  getMetrics(user) {
    return this.latencyMetrics.get(user) || null;
  }

  /**
   * Get all latency metrics
   * @returns {Map} Map of user -> metrics
   */
  getAllMetrics() {
    return new Map(this.latencyMetrics);
  }

  /**
   * Start polling connection statistics
   * @private
   */
  _startStatsPolling() {
    if (this.statsInterval) {
      return;
    }
    
    this.statsInterval = setInterval(() => {
      this._collectConnectionStats();
    }, this.options.statsPollInterval);
    
    // Collect initial stats
    this._collectConnectionStats();
  }

  /**
   * Stop polling connection statistics
   * @private
   */
  _stopStatsPolling() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  /**
   * Collect connection statistics from active calls
   * @private
   */
  async _collectConnectionStats() {
    if (!this.rtcClient || !this.rtcClient.rtcConnections) {
      return;
    }
    
    const activeCalls = this.callState.getActiveCalls();
    const activeCallUsers = new Set([...activeCalls.video, ...activeCalls.audio]);
    
    for (const user of activeCallUsers) {
      const connection = this.rtcClient.rtcConnections[user];
      if (!connection) {
        continue;
      }
      
      try {
        const streamConnection = connection.streamConnection;
        if (streamConnection && streamConnection.connectionState === 'connected') {
          const stats = await streamConnection.getStats();
          
          let rtt = null;
          let packetLoss = null;
          let jitter = null;
          
          // Parse stats
          for (const [id, report] of stats.entries()) {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime !== undefined) {
                rtt = report.currentRoundTripTime * 1000; // Convert to ms
              }
            }
            
            if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
              if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                const totalPackets = report.packetsLost + report.packetsReceived;
                if (totalPackets > 0) {
                  packetLoss = (report.packetsLost / totalPackets) * 100;
                }
              }
              if (report.jitter !== undefined) {
                jitter = report.jitter * 1000; // Convert to ms
              }
            }
            
            if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
              if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                const totalPackets = report.packetsLost + report.packetsReceived;
                if (totalPackets > 0) {
                  const videoPacketLoss = (report.packetsLost / totalPackets) * 100;
                  if (packetLoss === null) {
                    packetLoss = videoPacketLoss;
                  }
                }
              }
            }
          }
          
          // Store metrics
          this.latencyMetrics.set(user, { rtt, packetLoss, jitter });
          
          // Emit event
          this.emit('metricsupdated', { user, metrics: { rtt, packetLoss, jitter } });
        }
      } catch (err) {
        console.warn(`Error collecting stats for ${user}:`, err);
      }
    }
  }

  /**
   * Cleanup and destroy the manager
   */
  destroy() {
    // Stop stats polling
    this._stopStatsPolling();
    
    // End all calls
    this.endAllCalls();
    
    // Clear all state
    this.pendingCalls.clear();
    this.outgoingCalls.clear();
    this.localStreams.clear();
    this.latencyMetrics.clear();
    
    // Clear unified call state
    this.callState.clear();
    
    // Remove event listeners
    if (this.rtcClient && this.rtcClient.off) {
      this.rtcClient.off('call', this._handleIncomingCall);
      this.rtcClient.off('callconnected', this._handleCallConnected);
      this.rtcClient.off('callended', this._handleCallEnded);
    }
    
    // Remove all event listeners
    this.removeAllListeners();
  }
}

export { CallManager };


