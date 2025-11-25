/**
 * UI Adapter Interface - Define the contract for UI implementations
 * 
 * This module defines the interface that UI components should implement
 * to work with the core CallManager and ChatManager. This makes it easy
 * to create custom UI implementations.
 * 
 * Usage:
 *   import { CallManager, ChatManager } from './core/index.js';
 *   
 *   class MyCustomUI {
 *     constructor(rtcClient) {
 *       // Initialize managers
 *       this.callManager = new CallManager(rtcClient);
 *       this.chatManager = new ChatManager(rtcClient);
 *       
 *       // Wire up events
 *       this._setupEventListeners();
 *     }
 *     
 *     _setupEventListeners() {
 *       // Listen to manager events and update UI
 *       this.callManager.on('callconnected', ({sender, localStream, remoteStream}) => {
 *         this._renderVideoStream(sender, localStream, remoteStream);
 *       });
 *       
 *       this.chatManager.on('message', ({data, sender, timestamp}) => {
 *         this._renderMessage(data, sender, timestamp);
 *       });
 *     }
 *     
 *     // Implement UI methods
 *     _renderVideoStream(sender, localStream, remoteStream) { // implementation
 *     }
 *     _renderMessage(data, sender, timestamp) { // implementation
 *     }
 *   }
 * 
 * @module ui-adapter
 */

/**
 * UI Adapter Interface Documentation
 * 
 * To create a custom UI for RTChat, you need to:
 * 
 * 1. Initialize CallManager and ChatManager with your RTC client
 * 2. Listen to manager events and update your UI accordingly
 * 3. Call manager methods when users interact with your UI
 * 
 * ## CallManager Events
 * 
 * - `incomingcall` - {peerName, callInfo, promises, timeoutId}
 *   - Emitted when an incoming call is received
 *   - UI should show a prompt/notification to accept/decline
 * 
 * - `callconnected` - {sender, localStream, remoteStream, type}
 *   - Emitted when a call is connected
 *   - UI should display video/audio streams
 * 
 * - `callended` - {peerName}
 *   - Emitted when a call ends
 *   - UI should clean up streams and update state
 * 
 * - `calltimeout` - {peerName, direction}
 *   - Emitted when a call times out
 *   - UI should show missed call notification
 * 
 * - `callrejected` - {user}
 *   - Emitted when a call is rejected
 *   - UI should show rejection notification
 * 
 * - `mutechanged` - {mic, speakers, video}
 *   - Emitted when mute state changes
 *   - UI should update mute button states
 * 
 * - `metricsupdated` - {user, metrics}
 *   - Emitted when connection metrics are updated
 *   - metrics: {rtt, packetLoss, jitter}
 *   - UI should display metrics
 * 
 * ## ChatManager Events
 * 
 * - `message` - {data, sender, timestamp}
 *   - Emitted when a chat message is received
 *   - UI should display the message
 * 
 * - `userconnected` - {user}
 *   - Emitted when a user connects
 *   - UI should update user list
 * 
 * - `userdisconnected` - {user}
 *   - Emitted when a user disconnects
 *   - UI should update user list
 * 
 * - `historyupdated` - {history}
 *   - Emitted when message history is updated
 *   - UI should refresh message display
 * 
 * ## CallManager Methods
 * 
 * - `startCall(user, type)` - Start a call ('audio' or 'video')
 * - `endCall(user)` - End a call with a specific user
 * - `endAllCalls()` - End all active calls
 * - `setMicMuted(muted)` - Mute/unmute microphone
 * - `setSpeakersMuted(muted)` - Mute/unmute speakers
 * - `setVideoHidden(hidden)` - Hide/show video
 * - `getMuteState()` - Get current mute state
 * - `getActiveCalls()` - Get active calls {audio: Set, video: Set}
 * - `getMetrics(user)` - Get latency metrics for a user
 * 
 * ## ChatManager Methods
 * 
 * - `sendMessage(message)` - Send a chat message
 * - `getHistory()` - Get message history
 * - `getActiveUsers()` - Get list of active users
 * - `getUserColor(user)` - Get color for a user
 * - `setName(name)` - Set your name
 * - `getName()` - Get your name
 * 
 * ## Example Implementation
 * 
 * ```javascript
 * import { CallManager, ChatManager } from './core/index.js';
 * 
 * class MyCustomChatUI {
 *   constructor(rtcClient) {
 *     this.rtcClient = rtcClient;
 *     this.callManager = new CallManager(rtcClient);
 *     this.chatManager = new ChatManager(rtcClient);
 *     
 *     this._setupEventListeners();
 *     this._setupUI();
 *   }
 *   
 *   _setupEventListeners() {
 *     // Call events
 *     this.callManager.on('incomingcall', ({peerName, callInfo}) => {
 *       const accept = confirm(`Incoming ${callInfo.video ? 'video' : 'audio'} call from ${peerName}`);
 *       // Return acceptance from the incoming call handler
 *     });
 *     
 *     this.callManager.on('callconnected', ({sender, localStream, remoteStream, type}) => {
 *       this._displayStreams(sender, localStream, remoteStream, type);
 *     });
 *     
 *     this.callManager.on('callended', ({peerName}) => {
 *       this._removeStreams(peerName);
 *     });
 *     
 *     // Chat events
 *     this.chatManager.on('message', ({data, sender, timestamp}) => {
 *       this._addMessage(data, sender, timestamp);
 *     });
 *     
 *     this.chatManager.on('userconnected', ({user}) => {
 *       this._addUser(user);
 *     });
 *   }
 *   
 *   _setupUI() {
 *     // Create your UI elements
 *     this.messageInput = document.createElement('input');
 *     this.messageInput.addEventListener('keypress', (e) => {
 *       if (e.key === 'Enter') {
 *         this.chatManager.sendMessage(e.target.value);
 *         e.target.value = '';
 *       }
 *     });
 *     
 *     this.callButton = document.createElement('button');
 *     this.callButton.textContent = 'Call';
 *     this.callButton.addEventListener('click', () => {
 *       const users = this.chatManager.getActiveUsers();
 *       if (users.length > 0) {
 *         this.callManager.startCall(users[0], 'video');
 *       }
 *     });
 *   }
 *   
 *   _displayStreams(sender, localStream, remoteStream, type) {
 *     // Create video/audio elements and attach streams
 *     // This is platform-specific (browser DOM)
 *   }
 *   
 *   _addMessage(data, sender, timestamp) {
 *     // Add message to your UI
 *   }
 * }
 * ```
 */

// This is a documentation-only module
// The actual interface is defined by CallManager and ChatManager

export {};


