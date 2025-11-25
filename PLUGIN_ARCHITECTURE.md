# RTChat Plugin Architecture

This document explains how to create custom UI implementations for RTChat using the core business logic managers and interfaces.

## Architecture Overview

RTChat uses an interface-based plugin architecture. UI components implement specific interfaces, and the core managers automatically use them when provided. This makes it easy to create custom UIs with minimal code.

### Core Components

1. **Managers** (`CallManager`, `ChatManager`) - Business logic, no UI dependencies
2. **Interfaces** - Define what methods UI components must implement
3. **Plugin Adapter** - Base class with default no-op implementations
4. **Your UI** - Implement only the methods you need

## Quick Start

### Using Interfaces (Recommended)

```javascript
import { 
  CallManager, 
  ChatManager, 
  SignedMQTTRTCClient,
  PluginAdapter 
} from './core/index.js';

// Create a simple adapter that implements only what you need
class MyChatAdapter extends PluginAdapter {
  displayMessage({data, sender, timestamp}) {
    // Just implement what you need - everything else is no-op
    console.log(`${sender}: ${data}`);
  }
  
  updateActiveUsers(users) {
    console.log('Active users:', users);
  }
  
  getMessageInput() {
    return document.getElementById('myInput').value;
  }
  
  clearMessageInput() {
    document.getElementById('myInput').value = '';
  }
}

// Initialize RTC client
const rtcClient = new SignedMQTTRTCClient({
  name: 'MyName',
  topic: 'myroom'
});

// Create your adapter
const chatUI = new MyChatAdapter();

// Initialize managers with your UI
const chatManager = new ChatManager(rtcClient, { chatUI });
const callManager = new CallManager(rtcClient);

// That's it! ChatManager will automatically call your adapter methods
chatManager.sendMessage(); // Gets message from getMessageInput()
```

### Using Events (Alternative)

If you prefer event-driven architecture:

```javascript
import { CallManager, ChatManager, SignedMQTTRTCClient } from './core/index.js';

// Initialize RTC client
const rtcClient = new SignedMQTTRTCClient({
  name: 'MyName',
  topic: 'myroom'
});

// Initialize managers
const callManager = new CallManager(rtcClient);
const chatManager = new ChatManager(rtcClient);

// Listen to events
callManager.on('callconnected', ({sender, localStream, remoteStream}) => {
  // Display streams in your UI
  console.log(`Call connected with ${sender}`);
});

chatManager.on('message', ({data, sender, timestamp}) => {
  // Display message in your UI
  console.log(`${sender}: ${data}`);
});

// User interactions
document.getElementById('callButton').onclick = () => {
  const users = chatManager.getActiveUsers();
  if (users.length > 0) {
    callManager.startCall(users[0], 'video');
  }
};

document.getElementById('sendButton').onclick = () => {
  const message = document.getElementById('messageInput').value;
  chatManager.sendMessage(message);
};
```

## Interfaces

### ChatUIInterface

Methods your chat UI should implement:

- `displayMessage(messageData)` - Display a chat message
- `updateActiveUsers(users)` - Update the active users list
- `getMessageInput()` - Get current input value (optional, for sendMessage())
- `clearMessageInput()` - Clear the input (optional, called after send)
- `setInputEnabled(enabled)` - Enable/disable input

### CallUIInterface

Methods your call UI should implement:

- `showIncomingCallPrompt(peerName, callInfo)` - Show incoming call, return Promise<boolean>
- `hideIncomingCallPrompt(peerName)` - Hide incoming call prompt
- `showMissedCallNotification(peerName, direction)` - Show missed call message
- `showCallDeclinedNotification(peerName)` - Show declined call message
- `updateCallButtonStates(state)` - Update call button UI

### StreamDisplayInterface

Methods your stream display should implement:

- `setStreams(user, streams)` - Set streams for a user
- `removeStreams(user)` - Remove streams for a user
- `show()` - Show the display
- `hide()` - Hide the display

### AudioControllerInterface

Methods your audio controller should implement:

- `setMicMuted(muted, localStreams)` - Mute/unmute mic
- `setSpeakersMuted(muted, remoteAudioElements)` - Mute/unmute speakers
- `isMicMuted()` - Get mic mute state
- `isSpeakersMuted()` - Get speakers mute state

### VideoControllerInterface

Methods your video controller should implement:

- `setVideoHidden(hidden, localStreams)` - Hide/show video
- `isVideoHidden()` - Get video hidden state

### RingerInterface

Methods your ringtone component should implement:

- `start()` - Start playing the ringtone
- `stop()` - Stop playing the ringtone
- `isRinging()` - Check if ringtone is currently playing

### NotificationInterface

Methods your notification component should implement:

- `ping()` - Play a ping/connection sound
- `beep()` - Play a beep sound
- `showNotification(title, options)` - Show a visual notification

### StorageInterface

Methods your storage adapter should implement:

- `getItem(key)` - Get an item from storage
- `setItem(key, value)` - Set an item in storage
- `removeItem(key)` - Remove an item from storage

## Complete Example

### Minimal Chat UI

```javascript
import { ChatManager, PluginAdapter } from './core/index.js';

class MinimalChat extends PluginAdapter {
  constructor(container) {
    super();
    this.container = container;
    this.messages = [];
  }
  
  displayMessage({data, sender}) {
    const msg = document.createElement('div');
    msg.textContent = `${sender}: ${data}`;
    this.container.appendChild(msg);
  }
  
  updateActiveUsers(users) {
    console.log('Users:', users);
  }
}

// Usage
const chatUI = new MinimalChat(document.getElementById('chat'));
const chatManager = new ChatManager(rtcClient, { chatUI });
// ChatManager automatically uses your UI!
```

### Minimal Call UI with Custom Ringer

```javascript
import { CallManager, PluginAdapter } from './core/index.js';

class MyRinger extends PluginAdapter {
  start() {
    // Play your custom ringtone
    console.log('Ring ring!');
    return Promise.resolve();
  }
  
  stop() {
    console.log('Stopped ringing');
  }
}

class MinimalCall extends PluginAdapter {
  showIncomingCallPrompt(peerName, callInfo) {
    const accept = confirm(`Incoming ${callInfo.video ? 'video' : 'audio'} call from ${peerName}`);
    return Promise.resolve(accept);
  }
  
  showMissedCallNotification(peerName, direction) {
    alert(`Missed call from ${peerName}`);
  }
}

// Usage
const ringer = new MyRinger();
const callUI = new MinimalCall();
const callManager = new CallManager(rtcClient, { 
  callUI,
  ringer  // Automatically starts/stops for incoming calls
});
```

### Complete Example with All Interfaces

```javascript
import { 
  CallManager, 
  ChatManager, 
  PluginAdapter,
  SignedMQTTRTCClient 
} from './core/index.js';

class MyCompleteUI extends PluginAdapter {
  constructor() {
    super();
    this.messageContainer = document.getElementById('messages');
    this.input = document.getElementById('input');
    this.videoElement = document.getElementById('video');
  }
  
  // ChatUIInterface
  displayMessage({data, sender}) {
    const div = document.createElement('div');
    div.textContent = `${sender}: ${data}`;
    this.messageContainer.appendChild(div);
  }
  
  getMessageInput() {
    return this.input.value;
  }
  
  clearMessageInput() {
    this.input.value = '';
  }
  
  // CallUIInterface
  showIncomingCallPrompt(peerName, callInfo) {
    return Promise.resolve(confirm(`Accept call from ${peerName}?`));
  }
  
  // StreamDisplayInterface
  setStreams(user, {localStream, remoteStream}) {
    this.videoElement.srcObject = remoteStream;
  }
  
  removeStreams(user) {
    this.videoElement.srcObject = null;
  }
  
  // RingerInterface
  start() {
    // Play custom ringtone
    return Promise.resolve();
  }
  
  stop() {
    // Stop ringtone
  }
  
  // NotificationInterface
  ping() {
    // Play connection sound
    return Promise.resolve();
  }
}

// Initialize
const rtcClient = new SignedMQTTRTCClient({name: 'Me', topic: 'room'});
const ui = new MyCompleteUI();

const chatManager = new ChatManager(rtcClient, { 
  chatUI: ui,
  notifications: ui  // Uses ping() for connections
});
const callManager = new CallManager(rtcClient, {
  callUI: ui,
  videoDisplay: ui,
  ringer: ui  // Uses start()/stop() for incoming calls
});

// That's it! Everything works automatically.
```

## Event Reference

### CallManager Events

#### `incomingcall`
Emitted when an incoming call is received.

```javascript
callManager.on('incomingcall', ({peerName, callInfo, promises, timeoutId}) => {
  // peerName: string - Name of the caller
  // callInfo: {video: boolean, audio: boolean} - Call type
  // promises: {start: Promise, end: Promise} - Call promises
  // timeoutId: number - Timeout ID (can be cleared if needed)
  
  // Show UI prompt to accept/decline
  const accept = confirm(`Incoming ${callInfo.video ? 'video' : 'audio'} call from ${peerName}`);
  
  // Return acceptance (handled automatically by CallManager)
  return accept;
});
```

#### `callconnected`
Emitted when a call is connected.

```javascript
callManager.on('callconnected', ({sender, localStream, remoteStream, type}) => {
  // sender: string - Name of the peer
  // localStream: MediaStream - Your local stream
  // remoteStream: MediaStream - Remote peer's stream
  // type: 'audio' | 'video' - Call type
  
  // Display streams in your UI
  if (type === 'video') {
    localVideoElement.srcObject = localStream;
    remoteVideoElement.srcObject = remoteStream;
  }
});
```

#### `callended`
Emitted when a call ends.

```javascript
callManager.on('callended', ({peerName}) => {
  // Clean up UI
  localVideoElement.srcObject = null;
  remoteVideoElement.srcObject = null;
});
```

#### `calltimeout`
Emitted when a call times out.

```javascript
callManager.on('calltimeout', ({peerName, direction}) => {
  // direction: 'incoming' | 'outgoing'
  // Show missed call notification
  showNotification(`${peerName} missed your call`);
});
```

#### `mutechanged`
Emitted when mute state changes.

```javascript
callManager.on('mutechanged', ({mic, speakers, video}) => {
  // Update mute button states in UI
  muteMicButton.classList.toggle('active', mic);
  muteSpeakersButton.classList.toggle('active', speakers);
  hideVideoButton.classList.toggle('active', video);
});
```

#### `metricsupdated`
Emitted when connection metrics are updated.

```javascript
callManager.on('metricsupdated', ({user, metrics}) => {
  // metrics: {rtt: number, packetLoss: number, jitter: number}
  // Update metrics display
  metricsDisplay.textContent = `RTT: ${metrics.rtt}ms, Loss: ${metrics.packetLoss}%`;
});
```

### ChatManager Events

#### `message`
Emitted when a chat message is received.

```javascript
chatManager.on('message', ({data, sender, timestamp}) => {
  // Add message to UI
  const messageEl = document.createElement('div');
  messageEl.textContent = `${sender}: ${data}`;
  messagesContainer.appendChild(messageEl);
});
```

#### `userconnected`
Emitted when a user connects.

```javascript
chatManager.on('userconnected', ({user}) => {
  // Add user to user list
  const userEl = document.createElement('div');
  userEl.textContent = user;
  userList.appendChild(userEl);
});
```

#### `userdisconnected`
Emitted when a user disconnects.

```javascript
chatManager.on('userdisconnected', ({user}) => {
  // Remove user from user list
  const userEl = document.querySelector(`[data-user="${user}"]`);
  if (userEl) userEl.remove();
});
```

## Method Reference

### CallManager Methods

```javascript
// Start a call
await callManager.startCall(user, 'video'); // or 'audio'

// End a call
callManager.endCall(user);

// End all calls
callManager.endAllCalls();

// Mute controls
callManager.setMicMuted(true);
callManager.setSpeakersMuted(true);
callManager.setVideoHidden(true);

// Get state
const muteState = callManager.getMuteState();
const activeCalls = callManager.getActiveCalls();
const metrics = callManager.getMetrics(user);
```

### ChatManager Methods

```javascript
// Send a message
chatManager.sendMessage('Hello!');

// Get state
const history = chatManager.getHistory();
const users = chatManager.getActiveUsers();
const color = chatManager.getUserColor(user);

// Set name
chatManager.setName('MyName');
```

## Platform-Specific Considerations

### Browser (DOM)

```javascript
// Video streams
localVideoElement.srcObject = localStream;
remoteVideoElement.srcObject = remoteStream;

// Audio streams
audioElement.srcObject = remoteStream;
```

### React Native

```javascript
import { RTCView } from 'react-native-webrtc';

<RTCView streamURL={localStream.toURL()} />
<RTCView streamURL={remoteStream.toURL()} />
```

### Node.js / Server

For server-side implementations, you may need to:
- Use different stream handling (no MediaStream)
- Implement custom audio/video processing
- Use platform-specific APIs for notifications

## Best Practices

1. **Always clean up streams** when calls end
2. **Handle errors gracefully** - calls can fail for many reasons
3. **Update UI immediately** on user interactions, then sync with manager state
4. **Use manager events** as the source of truth for state
5. **Don't duplicate state** - let managers handle all business logic
6. **Extend PluginAdapter** - only implement what you need
7. **Use interfaces** - managers automatically use them when provided

## Migration from UI Components

If you're currently using `ChatBox` or other UI components and want to migrate:

1. Initialize `CallManager` and `ChatManager` with your RTC client
2. Create adapters that extend `PluginAdapter` and implement only what you need
3. Pass adapters to managers in options
4. Remove dependencies on UI components

The managers provide the same functionality as the UI components, but without any UI dependencies.
