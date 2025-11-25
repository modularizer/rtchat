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
    this.localStreams = new Map(); // Map<user, MediaStream>
    
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
    
    // Remove from group call mesh if in a group call
    if (this.groupCallMesh.has(peerName)) {
      this.groupCallMesh.delete(peerName);
      console.log(`Removed ${peerName} from group call mesh. Remaining:`, Array.from(this.groupCallMesh));
      
      // If mesh is empty or only has ourselves, clear the group call
      if (this.groupCallMesh.size <= 1) {
        this.groupCallMesh.clear();
        this.groupCallType = null;
        console.log('Group call mesh cleared - no more participants');
      }
    }
    
    // CRITICAL: Emit callended event for the primary call - this must always happen
    this.emit('callended', { peerName });
    
    // Check if there are any remaining active calls
    const remainingActiveCalls = this.callState.getActiveCalls();
    const hasRemainingCalls = remainingActiveCalls.audio.size > 0 || remainingActiveCalls.video.size > 0;
    
    // Only stop stats polling and reset mute states if no calls remain
    // (For group calls, we want to keep stats polling and mute states active)
    if (!hasRemainingCalls) {
      this._stopStatsPolling();
      // Clear group call mesh if no calls remain
      this.groupCallMesh.clear();
      this.groupCallType = null;
      // Only reset mute states if no calls remain
      // Note: We keep mute state even when calls end, so user preferences persist
      // this.muteState = { mic: false, speakers: false, video: false };
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
    
    // CRITICAL: Use _handleCallEnded which will end ALL calls and emit events
    this._handleCallEnded(peerName);
    
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
      
      this._handleCallEnded(user);
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


