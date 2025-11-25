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
   * @param {Object} options.chatManager - Optional ChatManager instance for getting active users
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
    this.chatManager = options.chatManager || null;
    
    // Unified call state tracking (platform-agnostic, UI-agnostic)
    this.callState = new CallState();
    
    // Additional metadata tracking (not part of core state)
    this.pendingCalls = new Map(); // Map<user, {callInfo, promises, timeoutId, promptElement}>
    this.outgoingCalls = new Map(); // Map<user, {type, cancelFn, timeoutId}>
    // NOTE: We do NOT track localStreams here - they are tracked in rtcClient.rtcConnections[user].localStream
    // This is the single source of truth for streams
    
    // Group call mesh tracking - tracks which users are in the same group call
    this.groupCallMesh = new Set(); // Set of users in the current group call mesh
    this.groupCallType = null; // 'audio' or 'video' - type of the group call
    
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
    
    // Track pending call (autoAccepted flag set after we determine preference)
    this.pendingCalls.set(peerName, {
      callInfo,
      promises,
      timeoutId,
      promptElement: null,
      autoAccepted: false
    });
    
    // Update unified call state
    this.callState.setUserState(peerName, {
      status: 'pending',
      audio: callInfo.audio !== false, // Default to true if not specified
      video: callInfo.video === true
    });
    
    const shouldAutoAccept = this._shouldAutoAcceptIncomingCall(peerName, callInfo);
    const pendingEntry = this.pendingCalls.get(peerName);
    if (pendingEntry) {
      pendingEntry.autoAccepted = shouldAutoAccept;
    }
    
    if (!shouldAutoAccept) {
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
    } else {
      // Stop any ringing ASAP since we're auto-accepting
      if (this.ringer && typeof this.ringer.stop === 'function') {
        this.ringer.stop();
      }
    }
    
    // Emit event for UI to handle (even if auto-accepting, so UI can update state)
    this.emit('incomingcall', {
      peerName,
      callInfo,
      promises,
      timeoutId,
      autoAccepted: shouldAutoAccept
    });
    
    if (shouldAutoAccept) {
      console.log(`Auto-accepting incoming call from ${peerName} (already in group call)`);
      const autoPending = this.pendingCalls.get(peerName);
      if (autoPending && autoPending.timeoutId) {
        clearTimeout(autoPending.timeoutId);
        autoPending.timeoutId = null;
      }
      return Promise.resolve(true);
    }
    
    // Use callUI if provided, otherwise auto-accept
    if (this.callUI && typeof this.callUI.showIncomingCallPrompt === 'function') {
      return this.callUI.showIncomingCallPrompt(peerName, callInfo);
    }
    
    // Default: auto-accept
    return Promise.resolve(true);
  }

  /**
   * Determine whether we should auto-accept an incoming call
   * Auto-accept when we're already in a group call (mesh) or already have an active call,
   * so additional mesh connections don't re-prompt the user.
   * @param {string} peerName
   * @param {Object} callInfo
   * @returns {boolean}
   * @private
   */
  _shouldAutoAcceptIncomingCall(peerName, callInfo) {
    const activeCalls = this.callState.getActiveCalls();
    const totalActiveCalls = activeCalls.audio.size + activeCalls.video.size;
    const isAlreadyInGroupCall = this.groupCallMesh.size > 0;
    
    // Auto-accept if we already have at least one active call or if the group mesh is active.
    if (isAlreadyInGroupCall) {
      return true;
    }
    
    if (totalActiveCalls > 0) {
      return true;
    }
    
    // Default: require explicit acceptance
    return false;
  }

  /**
   * Handle call connected event
   * @param {string} sender - Name of the peer
   * @param {Object} streams - Stream objects {localStream, remoteStream}
   * @private
   */
  _handleCallConnected(sender, {localStream, remoteStream}) {
    // Clear pending-call timeout (incoming)
    const pendingCall = this.pendingCalls.get(sender);
    if (pendingCall && pendingCall.timeoutId) {
      clearTimeout(pendingCall.timeoutId);
      pendingCall.timeoutId = null;
    }
    this.pendingCalls.delete(sender);

    // Clear outgoing-call timeout (our dial)
    const outgoingCall = this.outgoingCalls.get(sender);
    if (outgoingCall && outgoingCall.timeoutId) {
      clearTimeout(outgoingCall.timeoutId);
    }
    this.outgoingCalls.delete(sender);
    
    // Stop ringing if ringer is provided
    if (this.ringer && typeof this.ringer.stop === 'function') {
      this.ringer.stop();
    }
    
    // Determine call type
    const hasVideo = localStream?.getVideoTracks().length > 0 || 
                     remoteStream?.getVideoTracks().length > 0;
    const hasAudio = localStream?.getAudioTracks().length > 0 || 
                     remoteStream?.getAudioTracks().length > 0;
    
    // NOTE: localStream is already stored in rtcClient.rtcConnections[sender].localStream
    // We don't need to store it again in CallManager
    
    // Update unified call state
    this.callState.setUserState(sender, {
      status: 'active',
      audio: hasAudio,
      video: hasVideo
    });
    
    // Check if we should add to group call mesh
    // If we're already in a group call, add them
    // OR if we now have 2+ active calls, start a group call mesh
    // OR if there are 2+ other users in the room, treat this as a group call
    const currentActiveCalls = this.callState.getActiveCalls();
    const totalActiveCalls = currentActiveCalls.audio.size + currentActiveCalls.video.size;
    const activeUsers = this._getActiveUsers();
    const hasMultipleUsers = activeUsers.length >= 2; // 2+ other users in room
    
    // Determine call type from the current call (hasVideo already determined above)
    const callType = hasVideo ? 'video' : 'audio';
    
    if (this.groupCallMesh.size > 0) {
      // Already in a group call - add new participant
      this.groupCallMesh.add(sender);
      console.log(`Added ${sender} to existing group call mesh. Current mesh:`, Array.from(this.groupCallMesh));
      
      // CRITICAL: Automatically connect to all other participants in the mesh
      // This creates the full mesh network - when B joins, B automatically calls C, D, etc.
      this._connectToOtherMeshParticipants(sender);
    } else if (totalActiveCalls >= 2 || hasMultipleUsers) {
      // We now have 2+ active calls OR 2+ users in room - this is a group call!
      // Initialize the mesh with all current participants and all active users
      this.groupCallMesh.clear();
      this.groupCallMesh.add(this.rtcClient.name); // Add ourselves
      this.groupCallMesh.add(sender); // Add the person who just connected
      
      // Add all active call participants
      currentActiveCalls.audio.forEach(user => this.groupCallMesh.add(user));
      currentActiveCalls.video.forEach(user => this.groupCallMesh.add(user));
      
      // Also add all other active users in the room (they might not be connected yet)
      activeUsers.forEach(user => {
        if (user !== this.rtcClient.name) {
          this.groupCallMesh.add(user);
        }
      });
      
      // Set group call type
      this.groupCallType = callType;
      
      console.log(`Detected group call! Initialized mesh with ${this.groupCallMesh.size} participants:`, Array.from(this.groupCallMesh));
      console.log(`Active users in room: ${activeUsers.length}, Active calls: ${totalActiveCalls}, Call type: ${callType}`);
      
      // CRITICAL: Connect ourselves to all other participants in the room
      // This ensures that when B accepts A's call, B automatically calls C
      // When C accepts A's call, C automatically calls B
      // This creates the full mesh network
      // Pass null as newParticipant since we're the one initiating the mesh connections
      this._connectToOtherMeshParticipants(null);
    }
    
    // Start stats polling if not already started
    const activeCalls = this.callState.getActiveCalls();
    if (!this.statsInterval && (activeCalls.video.size > 0 || activeCalls.audio.size > 0)) {
      this._startStatsPolling();
    }
    
    // Get shared local stream from RTC client (single source of truth)
    const sharedLocalStream = this.rtcClient?.sharedLocalStream || localStream;
    
    // Emit event
    this.emit('callconnected', {
      sender,
      localStream: sharedLocalStream,
      remoteStream,
      type: hasVideo ? 'video' : 'audio'
    });
    
    // Use stream displays if provided
    if (hasVideo && this.videoDisplay && typeof this.videoDisplay.setStreams === 'function') {
      this.videoDisplay.setStreams(sender, { localStream: sharedLocalStream, remoteStream });
    } else if (hasAudio && this.audioDisplay && typeof this.audioDisplay.setStreams === 'function') {
      this.audioDisplay.setStreams(sender, { localStream: sharedLocalStream, remoteStream });
    }
  }
  
  /**
   * Connect to all other participants in the group call mesh
   * This creates the full mesh network - everyone connects to everyone
   * @param {string} newParticipant - The participant who just joined (or null if we're initiating)
   * @private
   */
  async _connectToOtherMeshParticipants(newParticipant) {
    if (!this.groupCallType) {
      console.warn('_connectToOtherMeshParticipants called but no groupCallType set');
      return;
    }
    
    const activeCalls = this.callState.getActiveCalls();
    const allActiveParticipants = new Set([
      ...activeCalls.audio,
      ...activeCalls.video
    ]);
    
    // Build list of users we should connect to: anyone in the mesh OR currently active in the room
    const roomParticipants = this._getActiveUsers();
    const meshParticipants = Array.from(this.groupCallMesh || []);
    const potentialParticipants = new Set([
      ...roomParticipants,
      ...meshParticipants
    ]);
    
    const otherParticipants = Array.from(potentialParticipants).filter(user => {
      if (!user) return false;
      if (user === this.rtcClient?.name) return false; // Never call ourselves
      if (newParticipant && user === newParticipant) return false; // Skip the participant we just connected with
      return !allActiveParticipants.has(user); // Skip if we already have an active connection
    });
    
    if (otherParticipants.length === 0) {
      console.log('No other participants to connect to in mesh');
      return;
    }
    
    console.log(`${newParticipant || 'We'} joining group call. Connecting to other participants:`, otherParticipants);
    console.log(`Current active participants:`, Array.from(allActiveParticipants));
    console.log(`Group call mesh:`, Array.from(this.groupCallMesh));
    
    // Call all other participants in parallel
    const callInfo = this.groupCallType === 'audio' 
      ? { video: false, audio: true }
      : { video: true, audio: true };
    
    const connectionPromises = otherParticipants.map(async (participant) => {
      // Check current state for this participant
      const isAlreadyConnected = allActiveParticipants.has(participant);
      const isPending = this.pendingCalls.has(participant);
      const isOutgoing = this.outgoingCalls.has(participant);
      
      if (isAlreadyConnected) {
        console.log(`Skipping ${participant} - already connected`);
        return { participant, skipped: true };
      }
      
      // If we have stale pending/outgoing entries (for example from a previous attempt),
      // clear them so we can safely retry the connection.
      if (isPending) {
        console.log(`Clearing stale pending call for ${participant} before reconnecting`);
        const pending = this.pendingCalls.get(participant);
        if (pending?.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        this.pendingCalls.delete(participant);
      }
      
      if (isOutgoing) {
        console.log(`Cancelling stale outgoing call for ${participant} before reconnecting`);
        const outgoing = this.outgoingCalls.get(participant);
        if (outgoing?.timeoutId) {
          clearTimeout(outgoing.timeoutId);
        }
        this.outgoingCalls.delete(participant);
      }
      
      try {
        console.log(`Auto-connecting to ${participant} in mesh (from ${newParticipant || 'initiator'})`);
        const { start, end } = this.rtcClient.callUser(participant, callInfo);
        
        // Track as automatic mesh connection
        this.outgoingCalls.set(participant, {
          type: this.groupCallType,
          cancelFn: null,
          timeoutId: null,
          isMeshConnection: true
        });
        
        // Wait for connection
        const streamResult = await start;
        if (streamResult && (streamResult.localStream || streamResult.remoteStream)) {
          this._handleCallConnected(participant, streamResult);
        }
        return { participant, success: true };
      } catch (err) {
        console.warn(`Failed to auto-connect to ${participant}:`, err);
        this.outgoingCalls.delete(participant);
        return { participant, success: false, error: err };
      }
    });
    
    // Wait for all connections (but don't fail if some fail)
    const results = await Promise.allSettled(connectionPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    console.log(`Mesh connection: ${successful}/${otherParticipants.length} successful`);
  }

  /**
   * Handle call ended event from receiving "callended" message
   * Only ends the specific call, keeps other connections active
   * @param {string} peerName - Name of the peer
   * @private
   */
  _handleCallEnded(peerName) {
    console.log("CallManager._handleCallEnded: Called for " + peerName + " (receiver side - only end this call)");
    // Check if call is already ended (idempotent)
    const currentState = this.callState.getUserState(peerName);
    if (currentState && currentState.status === 'inactive') {
      // Already ended, skip
      console.log("CallManager._handleCallEnded: Call already ended for " + peerName + ", skipping");
      return;
    }
    
    // Only finalize THIS specific call (receiver side)
    this._finalizeCallClosure(peerName);
    
    // Check if there are any remaining active calls after closing this one
    const remainingActiveCalls = this.callState.getActiveCalls();
    const hasRemainingCalls = remainingActiveCalls.audio.size > 0 || remainingActiveCalls.video.size > 0;
    
    console.log("CallManager._handleCallEnded: After ending " + peerName + ", remaining calls:", {
      audio: Array.from(remainingActiveCalls.audio),
      video: Array.from(remainingActiveCalls.video),
      hasRemainingCalls
    });
    
    // Only stop stats polling if no calls remain
    // Note: RTC layer handles closing streams/stopping tracks
    if (!hasRemainingCalls) {
      this._stopStatsPolling();
      this.groupCallMesh.clear();
      this.groupCallType = null;
      console.log("CallManager._handleCallEnded: No remaining calls, released all resources");
    } else {
      console.log("CallManager._handleCallEnded: Other calls still active, keeping resources");
    }
  }

  /**
   * Handle call timeout
   * @param {string} peerName - Name of the peer
   * @param {string} direction - 'incoming' or 'outgoing'
   * @private
   */
  _handleCallTimeout(peerName, direction) {
    const pendingCall = this.pendingCalls.get(peerName);
    const wasAutoAccepted = pendingCall?.autoAccepted;
    
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
    
    // Finalize only this specific call
    this._finalizeCallClosure(peerName);
    
    // Check if there are any remaining active calls
    const remainingActiveCalls = this.callState.getActiveCalls();
    const hasRemainingCalls = remainingActiveCalls.audio.size > 0 || remainingActiveCalls.video.size > 0;
    
    // Only release resources if no calls remain
    // Note: RTC layer handles closing streams/stopping tracks
    if (!hasRemainingCalls) {
      this._stopStatsPolling();
      this.groupCallMesh.clear();
      this.groupCallType = null;
    }
    
    // Emit timeout event for UI notifications
    this.emit('calltimeout', { peerName, direction });
    
    // Use callUI if provided (skip notifications for auto-accepted mesh calls)
    if (!wasAutoAccepted && this.callUI && typeof this.callUI.showMissedCallNotification === 'function') {
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
      
      // Finalize only this specific call
      this._finalizeCallClosure(user);
      
      // Check if there are any remaining active calls
      const remainingActiveCalls = this.callState.getActiveCalls();
      const hasRemainingCalls = remainingActiveCalls.audio.size > 0 || remainingActiveCalls.video.size > 0;
      
      // Only release resources if no calls remain
      // Note: RTC layer handles closing streams/stopping tracks
      if (!hasRemainingCalls) {
        this._stopStatsPolling();
        this.groupCallMesh.clear();
        this.groupCallType = null;
      }
    }
  }

  /**
   * Log all active tracks and their dependent streams
   * Single source of truth: rtcClient.rtcConnections
   * @private
   */
  _logActiveTracksAndStreams() {
    console.log("=== ACTIVE TRACKS AND STREAMS (Single Source: rtcConnections) ===");
    
    const allTracks = new Map(); // track.id -> {track, owners: []}
    
    // Collect from rtcConnections ONLY (single source of truth)
    if (this.rtcClient && this.rtcClient.rtcConnections) {
      for (const [user, conn] of Object.entries(this.rtcClient.rtcConnections)) {
        if (conn && conn.localStream && conn.localStream.getTracks) {
          conn.localStream.getTracks().forEach(track => {
            if (!allTracks.has(track.id)) {
              allTracks.set(track.id, { track, owners: [] });
            }
            allTracks.get(track.id).owners.push(user);
          });
        }
      }
    }
    
    console.log(`Total unique tracks: ${allTracks.size}`);
    for (const [trackId, {track, owners}] of allTracks.entries()) {
      console.log(`  Track ${track.kind} ${trackId.substring(0, 8)}... (readyState: ${track.readyState})`);
      console.log(`    - Used by rtcConnections: [${owners.join(', ')}]`);
    }
    console.log("==================================================================");
  }

  /**
   * Close a stream properly: stop its tracks only if not shared by other streams
   * CRITICAL: This is the ONLY method that should stop tracks
   * Single source of truth: rtcClient.rtcConnections
   * @param {MediaStream} stream - Stream to close
   * @param {string} streamOwner - Owner identifier (for checking if track is shared)
   * @private
   */
  _closeStream(stream, streamOwner) {
    if (!stream || typeof stream.getTracks !== 'function') {
      console.warn(`_closeStream: Invalid stream for ${streamOwner}`);
      return;
    }
    
    const tracks = stream.getTracks();
    console.log(`_closeStream: Closing stream for ${streamOwner} with ${tracks.length} track(s)`);
    
    tracks.forEach(track => {
      // Check if ANY other RTC connection uses this track (single source of truth)
      let trackShared = false;
      
      if (this.rtcClient && this.rtcClient.rtcConnections) {
        for (const [user, conn] of Object.entries(this.rtcClient.rtcConnections)) {
          if (user === streamOwner) continue; // Skip the connection we're closing
          if (conn && conn.localStream && conn.localStream.getTracks) {
            if (conn.localStream.getTracks().some(t => t.id === track.id)) {
              trackShared = true;
              console.log(`_closeStream: Track ${track.kind} ${track.id.substring(0,8)}... is shared with rtcConnection[${user}]`);
              break;
            }
          }
        }
      }
      
      // Only stop track if NOT shared
      if (!trackShared) {
        console.log(`_closeStream: Stopping ${track.kind} track ${track.id.substring(0,8)}... (readyState: ${track.readyState})`);
        try {
          track.stop();
          console.log(`_closeStream: Stopped track (new readyState: ${track.readyState})`);
        } catch (err) {
          console.warn(`_closeStream: Failed to stop track:`, err);
        }
      } else {
        console.log(`_closeStream: Keeping ${track.kind} track ${track.id.substring(0,8)}... alive (shared)`);
      }
    });
    
    // Log state after closing
    this._logActiveTracksAndStreams();
  }

  /**
   * Close the stream for a specific RTC connection
   * Single source of truth: rtcClient.rtcConnections[user].localStream
   * @param {string} user - User identifier
   * @private
   */
  _releaseLocalStreamForUser(user) {
    console.log(`_releaseLocalStreamForUser: Closing stream for ${user}`);
    this._logActiveTracksAndStreams();
    
    if (!this.rtcClient || !this.rtcClient.rtcConnections || !this.rtcClient.rtcConnections[user]) {
      console.log(`_releaseLocalStreamForUser: No RTC connection for ${user}`);
      return;
    }
    
    const conn = this.rtcClient.rtcConnections[user];
    const stream = conn.localStream;
    
    if (!stream) {
      console.log(`_releaseLocalStreamForUser: No localStream in connection for ${user}`);
      return;
    }
    
    // Remove from connection BEFORE closing (so _closeStream doesn't see it when checking)
    conn.localStream = null;
    
    // Close the stream (will check if tracks are shared and stop accordingly)
    this._closeStream(stream, user);
  }

  /**
   * Fully tear down local bookkeeping for a peer that has ended
   * @param {string} user
   * @private
   */
  _finalizeCallClosure(user) {
    if (!user) {
      return;
    }
    
    // Clear pending call timeouts
    const pendingCall = this.pendingCalls.get(user);
    if (pendingCall && pendingCall.timeoutId) {
      clearTimeout(pendingCall.timeoutId);
    }
    this.pendingCalls.delete(user);
    
    // Clear outgoing call timeouts
    const outgoingCall = this.outgoingCalls.get(user);
    if (outgoingCall && outgoingCall.timeoutId) {
      clearTimeout(outgoingCall.timeoutId);
    }
    this.outgoingCalls.delete(user);
    
    // Reset unified call state
    this.callState.setUserState(user, {
      status: 'inactive',
      audio: false,
      video: false
    });
    
    // Note: RTC layer handles closing streams/stopping tracks via endCallWithUser
    this.latencyMetrics.delete(user);
    
    // Remove from group call mesh (and clear when empty)
    if (this.groupCallMesh.has(user)) {
      this.groupCallMesh.delete(user);
      console.log(`Removed ${user} from group call mesh. Remaining:`, Array.from(this.groupCallMesh));
      if (this.groupCallMesh.size <= 1) {
        this.groupCallMesh.clear();
        this.groupCallType = null;
        console.log('Group call mesh cleared - no more participants');
      }
    }
    
    // Notify UI layers that this peer is gone
    this.emit('callended', { peerName: user });
  }

  /**
   * Close all streams from RTC connections
   * Single source of truth: rtcClient.rtcConnections
   * @private
   */
  _releaseAllLocalStreams() {
    console.log(`_releaseAllLocalStreams: Closing all RTC connection streams`);
    
    if (!this.rtcClient || !this.rtcClient.rtcConnections) {
      console.log(`_releaseAllLocalStreams: No RTC connections`);
      return;
    }
    
    // Get all users with connections
    const users = Object.keys(this.rtcClient.rtcConnections);
    console.log(`_releaseAllLocalStreams: Found ${users.length} connections`);
    
    // Close each stream individually
    for (const user of users) {
      this._releaseLocalStreamForUser(user);
    }
  }

  /**
   * Get list of active users (connected peers)
   * @returns {Array<string>} Array of user names
   * @private
   */
  _getActiveUsers() {
    let users = [];
    
    // Try to get from chatManager first
    if (this.chatManager && typeof this.chatManager.getActiveUsers === 'function') {
      users = this.chatManager.getActiveUsers();
      console.log('Got active users from chatManager:', users);
      return users;
    }
    
    // Fallback to rtcClient connectedUsers
    if (this.rtcClient && this.rtcClient.connectedUsers) {
      const connected = this.rtcClient.connectedUsers;
      users = Array.isArray(connected) ? connected : [];
      console.log('Got active users from rtcClient.connectedUsers:', users);
      return users;
    }
    
    // Last resort: get from rtcConnections
    if (this.rtcClient && this.rtcClient.rtcConnections) {
      users = Object.keys(this.rtcClient.rtcConnections).filter(user => {
        const conn = this.rtcClient.rtcConnections[user];
        return conn && conn.peerConnection && 
               (conn.peerConnection.connectionState === 'connected' || 
                conn.peerConnection.connectionState === 'completed');
      });
      console.log('Got active users from rtcConnections:', users);
      return users;
    }
    
    console.warn('No active users found!');
    return [];
  }

  /**
   * Start a group call with multiple users - creates a full mesh network
   * @param {string|Array<string>} users - 'all' to call all active users, or array of user names
   * @param {string} type - 'audio' or 'video'
   * @returns {Promise} Promise that resolves with results for all calls
   */
  async startGroupCall(users, type) {
    if (!this.rtcClient || !this.rtcClient.callUser) {
      throw new Error('RTC client not available or does not support callUser');
    }
    
    // Get target users
    let targetUsers;
    if (users === 'all') {
      targetUsers = this._getActiveUsers();
      console.log('startGroupCall: Got active users for "all":', targetUsers);
    } else if (Array.isArray(users)) {
      targetUsers = users;
      console.log('startGroupCall: Using provided user array:', targetUsers);
    } else {
      // Single user - convert to array
      targetUsers = [users];
      console.log('startGroupCall: Single user converted to array:', targetUsers);
    }
    
    if (targetUsers.length === 0) {
      console.error('startGroupCall: No users to call!');
      throw new Error('No users to call');
    }
    
    console.log(`startGroupCall: Will call ${targetUsers.length} users:`, targetUsers);
    
    // Filter out users we're already calling
    const activeCalls = this.callState.getActiveCalls();
    const pendingCalls = this.callState.getPendingCalls();
    const alreadyInCall = new Set([
      ...activeCalls.audio,
      ...activeCalls.video,
      ...pendingCalls,
      ...this.outgoingCalls.keys()
    ]);
    
    targetUsers = targetUsers.filter(user => !alreadyInCall.has(user));
    
    if (targetUsers.length === 0) {
      throw new Error('All selected users are already in a call');
    }
    
    // Initialize group call mesh - add ourselves and all target users
    this.groupCallMesh.clear();
    this.groupCallMesh.add(this.rtcClient.name); // Add ourselves
    targetUsers.forEach(user => this.groupCallMesh.add(user));
    this.groupCallType = type;
    
    console.log(`Starting group ${type} call mesh with ${targetUsers.length} users:`, targetUsers);
    console.log('Group call mesh participants:', Array.from(this.groupCallMesh));
    
    const callInfo = type === 'audio' 
      ? { video: false, audio: true }
      : { video: true, audio: true };
    
    console.log(`Calling ${targetUsers.length} users simultaneously:`, targetUsers);
    
    // Start calls to all users in parallel - call RTC client directly
    // When each user accepts, they will automatically connect to all other participants
    const callPromises = targetUsers.map(async (user) => {
      try {
        console.log(`Initiating call to ${user}...`);
        
        // Track as outgoing call
        const timeoutId = setTimeout(() => {
          this._handleCallTimeout(user, 'outgoing');
        }, this.options.callTimeout);
        
        this.outgoingCalls.set(user, {
          type,
          cancelFn: null,
          timeoutId,
          isMeshConnection: false
        });
        
        // Call RTC client directly (bypass startCall to avoid single-call assumptions)
        const { start, end } = this.rtcClient.callUser(user, callInfo);
        
        // Await the start promise to get the streams
        const streamResult = await start;
        
        // Clear timeout if call started successfully
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // If streamResult contains streams, handle them
        if (streamResult && (streamResult.localStream || streamResult.remoteStream)) {
          this._handleCallConnected(user, streamResult);
        }
        
        // Emit event
        this.emit('callstarted', { user, type });
        
        console.log(`Successfully called ${user}`);
        return { user, success: true, result: { ...streamResult, end } };
      } catch (err) {
        console.error(`Failed to call ${user}:`, err);
        
        // Clear timeout
        const outgoingCall = this.outgoingCalls.get(user);
        if (outgoingCall && outgoingCall.timeoutId) {
          clearTimeout(outgoingCall.timeoutId);
        }
        this.outgoingCalls.delete(user);
        
        // Remove from mesh if call failed
        this.groupCallMesh.delete(user);
        
        // Check if call was rejected
        if (err === "Call rejected" || err?.message === "Call rejected") {
          this._handleCallEnded(user);
          this.emit('callrejected', { user });
        } else {
          this._handleCallEnded(user);
          this.emit('callerror', { user, error: err });
        }
        
        // Don't end other calls if one fails
        return { user, success: false, error: err };
      }
    });
    
    const results = await Promise.allSettled(callPromises);
    
    // Process results
    const successful = [];
    const failed = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successful.push(result.value.user);
      } else {
        failed.push({
          user: targetUsers[index],
          error: result.status === 'fulfilled' ? result.value.error : result.reason
        });
        this.groupCallMesh.delete(targetUsers[index]);
      }
    });
    
    // Emit group call event
    this.emit('groupcallstarted', { 
      users: targetUsers, 
      type, 
      successful,
      failed,
      results 
    });
    
    return {
      successful,
      failed,
      total: targetUsers.length
    };
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
        // Only end this specific call, not all calls
        this._handleCallEnded(user);
        this.emit('callrejected', { user });
      } else {
        // For other errors, only end this specific call
        this._handleCallEnded(user);
        this.emit('callerror', { user, error: err });
      }
      
      throw err;
    }
  }

  /**
   * End a call with a user
   * This ends the specific call and sends "endcall" message to peer
   * Note: For ending all calls (button click), use endAllCalls() instead
   * @param {string} user - Name of the user
   */
  endCall(user) {
    console.log("CallManager.endCall: Ending call with " + user);
    
    // Tell RTC client to end the call and send "endcall" message to peer
    if (this.rtcClient && this.rtcClient.endCallWithUser) {
      try {
        this.rtcClient.endCallWithUser(user);
      } catch (err) {
        console.error(`Error ending call:`, err);
      }
    }
    
    // Finalize this specific call locally
    this._finalizeCallClosure(user);
    
    // Check if there are any remaining active calls
    const remainingActiveCalls = this.callState.getActiveCalls();
    const hasRemainingCalls = remainingActiveCalls.audio.size > 0 || remainingActiveCalls.video.size > 0;
    
    // Only stop stats polling if no calls remain
    // Note: RTC layer handles closing streams/stopping tracks
    if (!hasRemainingCalls) {
      this._stopStatsPolling();
      this.groupCallMesh.clear();
      this.groupCallType = null;
      console.log("CallManager.endCall: No remaining calls, released all resources");
    } else {
      console.log("CallManager.endCall: Other calls still active, keeping resources");
    }
  }

  /**
   * End all active calls (initiator side - button click)
   * Delegates to RTC layer which handles streams and tracks
   */
  endAllCalls() {
    console.log("CallManager.endAllCalls: Ending ALL calls");
    
    // Get users from call state
    const activeCalls = this.callState.getActiveCalls();
    const pendingCalls = this.callState.getPendingCalls();
    const allUsers = new Set([...activeCalls.video, ...activeCalls.audio, ...pendingCalls, ...this.outgoingCalls.keys()]);
    
    // ALSO get users from rtcConnections (source of truth for actual connections)
    if (this.rtcClient && this.rtcClient.rtcConnections) {
      for (const user of Object.keys(this.rtcClient.rtcConnections)) {
        allUsers.add(user);
      }
    }
    
    console.log("CallManager.endAllCalls: All users to end:", Array.from(allUsers));
    
    // Delegate to RTC client to end calls (it handles streams/tracks)
    for (const user of allUsers) {
      this.endCall(user);
    }
    
    console.log("CallManager.endAllCalls: Complete");
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
        // Check if stream connection exists and is in a connected state
        if (streamConnection && (streamConnection.iceConnectionState === 'connected' || streamConnection.iceConnectionState === 'completed')) {
          const stats = await streamConnection.getStats();
          
          let rtt = null;
          let packetLoss = null;
          let jitter = null;
          
          // Parse stats - WebRTC stats API structure
          for (const [id, report] of stats.entries()) {
            // Try multiple ways to get RTT
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              // currentRoundTripTime is in seconds, convert to ms
              if (report.currentRoundTripTime !== undefined && report.currentRoundTripTime > 0) {
                rtt = report.currentRoundTripTime * 1000;
              } else if (report.roundTripTime !== undefined && report.roundTripTime > 0) {
                rtt = report.roundTripTime * 1000;
              }
            }
            
            // Also check transport stats for RTT
            if (report.type === 'transport') {
              if (report.currentRoundTripTime !== undefined && report.currentRoundTripTime > 0) {
                rtt = report.currentRoundTripTime * 1000;
              } else if (report.rtt !== undefined && report.rtt > 0) {
                rtt = report.rtt * 1000;
              }
            }
            
            // Get audio stats
            if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
              if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                const totalPackets = report.packetsLost + report.packetsReceived;
                if (totalPackets > 0) {
                  packetLoss = (report.packetsLost / totalPackets) * 100;
                }
              }
              // jitter is already in seconds, convert to ms
              if (report.jitter !== undefined && report.jitter > 0) {
                jitter = report.jitter * 1000;
              }
            }
            
            // Get video stats (for packet loss if audio didn't have it)
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
          
          // Only update metrics if we got at least one valid value
          // This prevents overwriting with null values
          const currentMetrics = this.latencyMetrics.get(user) || { rtt: null, packetLoss: null, jitter: null };
          const updatedMetrics = {
            rtt: rtt !== null ? rtt : currentMetrics.rtt,
            packetLoss: packetLoss !== null ? packetLoss : currentMetrics.packetLoss,
            jitter: jitter !== null ? jitter : currentMetrics.jitter
          };
          
          // Store metrics
          this.latencyMetrics.set(user, updatedMetrics);
          
          // Emit event
          this.emit('metricsupdated', { user, metrics: updatedMetrics });
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
    // Note: RTC layer handles closing streams/stopping tracks
    this.pendingCalls.clear();
    this.outgoingCalls.clear();
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


