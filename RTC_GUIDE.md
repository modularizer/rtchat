# RTC Protocol Guide

Quick reference for the RTC protocol layer.

## Table of Contents

1. [Core Concepts](#1-core-concepts) - `.on()`, `.sendOverRTC()`, connection process, built-in events
2. [Helper Methods](#2-helper-methods) - Convenience shortcuts (`.chat`, `.dm`, `.ask`, etc.)
3. [Custom Channels](#3-custom-channels) - Setting up your own message types

---

## 1. Core Concepts

### Connection Process

1. **Create client**: `new MQTTRTCClient({ name, topic })`
2. **Connect to MQTT**: Automatically connects to broker for signaling
3. **Discover peers**: Peers on same topic discover each other via MQTT
4. **Establish WebRTC**: Direct peer-to-peer connections via WebRTC data channels
5. **Ready to communicate**: Once connected, you can send/receive messages

```javascript
const rtc = new MQTTRTCClient({
  name: 'MyName',
  topic: { room: 'myroom' }
});

// Wait for connection
rtc.on('mqttconnected', () => {
  console.log('Connected to MQTT broker');
});

rtc.on('connectedtopeer', (peerName) => {
  console.log('Connected to peer:', peerName);
  // Now you can send messages to this peer
});
```

### `.on(event, callback)` - Listening to Events

Listen to events emitted by the RTC client:

| Event | Parameters | When Fired |
|-------|------------|------------|
| `'mqttconnected'` | `(topic, name)` | Connected to MQTT broker |
| `'connectedtopeer'` | `(peerName)` | WebRTC connection established with peer |
| `'disconnectedfrompeer'` | `(peerName)` | WebRTC connection lost with peer |
| `'chat'` | `(message, sender)` | Received chat message |
| `'dm'` | `(message, sender)` | Received direct message |
| `'question'` | `(data, sender)` | Received question |
| `'answer'` | `(answer, sender)` | Received answer to question |
| `'ping'` | `(data, sender)` | Received ping |
| `'pong'` | `(data, sender)` | Received pong |
| `'rtcmessage'` | `(channel, data, sender)` | Generic event for any RTC message |

**Usage**:
```javascript
// Listen to chat messages
rtc.on('chat', (message, sender) => {
  console.log(`${sender}: ${message}`);
});

// Listen to peer connections
rtc.on('connectedtopeer', (peerName) => {
  console.log('New peer connected:', peerName);
});

// Listen to all RTC messages (generic)
rtc.on('rtcmessage', (channel, data, sender) => {
  console.log(`Message on ${channel} from ${sender}:`, data);
});
```

### `.sendOverRTC(channel, data, users)` - Core Sending Method

**This is the core method for sending messages. All other methods are shortcuts to this.**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | string | Yes | Channel name (must be registered in `rtcHandlers`) |
| `data` | any | No | Data to send (JSON-serialized by default) |
| `users` | string\|array\|undefined | No | `undefined` = all peers, `string` = one peer, `array` = multiple peers |

**Returns**: `undefined`  
**Throws**: 
- `Error("No channel specified")` if channel is missing
- `Error("Unsupported RTC channel: <channel>")` if channel not registered

**Examples**:
```javascript
// Send to all connected peers
rtc.sendOverRTC('chat', 'Hello everyone!');

// Send to specific peer
rtc.sendOverRTC('dm', 'Private message', 'PeerName');

// Send to multiple peers
rtc.sendOverRTC('metadata', { status: 'online' }, ['Peer1', 'Peer2']);

// Send custom channel
rtc.sendOverRTC('silentchat', 'Silent message', 'PeerName');
```

### Built-in Events Reference

| Event | When | Parameters | Example |
|-------|------|------------|---------|
| `'mqttconnected'` | Connected to MQTT broker | `(topic, name)` | `rtc.on('mqttconnected', (topic, name) => {})` |
| `'connectedtopeer'` | WebRTC connection established | `(peerName)` | `rtc.on('connectedtopeer', (peer) => {})` |
| `'disconnectedfrompeer'` | WebRTC connection lost | `(peerName)` | `rtc.on('disconnectedfrompeer', (peer) => {})` |
| `'chat'` | Received chat message | `(message, sender)` | `rtc.on('chat', (msg, sender) => {})` |
| `'dm'` | Received direct message | `(message, sender)` | `rtc.on('dm', (msg, sender) => {})` |
| `'question'` | Received question | `(data, sender)` | `rtc.on('question', (data, sender) => {})` |
| `'answer'` | Received answer | `(answer, sender)` | `rtc.on('answer', (answer, sender) => {})` |
| `'ping'` | Received ping | `(data, sender)` | `rtc.on('ping', (data, sender) => {})` |
| `'pong'` | Received pong | `(data, sender)` | `rtc.on('pong', (data, sender) => {})` |
| `'rtcmessage'` | Any RTC message (generic) | `(channel, data, sender)` | `rtc.on('rtcmessage', (ch, data, sender) => {})` |

---

## 2. Helper Methods

These are convenience shortcuts that call `sendOverRTC` internally.

### Chat Messages

| Method | Equivalent To | Target |
|--------|---------------|--------|
| `rtc.sendRTCChat(message)` | `rtc.sendOverRTC('chat', message)` | All peers |

```javascript
// Send chat message
rtc.sendRTCChat('Hello everyone!');

// Receive chat messages
rtc.on('chat', (message, sender) => {
  console.log(`${sender}: ${message}`);
});
```

### Direct Messages

| Method | Equivalent To | Target |
|--------|---------------|--------|
| `rtc.sendRTCDM(message, target)` | `rtc.sendOverRTC('dm', message, target)` | Specific peer |
| `peer.dm(message)` | `rtc.sendOverRTC('dm', message, peerName)` | Specific peer |

```javascript
// Send direct message
rtc.sendRTCDM('Private message', 'PeerName');
// or
const peer = rtc.getPeer('PeerName');
peer.dm('Private message');

// Receive direct messages
rtc.on('dm', (message, sender) => {
  console.log(`DM from ${sender}: ${message}`);
});
```

### Questions & Answers

| Method | Equivalent To | Target |
|--------|---------------|--------|
| `peer.ask(question)` | `rtc.sendRTCQuestion(...)` → `sendOverRTC('question', ...)` | Specific peer |
| `rtc.addQuestionHandler(name, handler)` | Registers handler for questions | N/A |

```javascript
// Ask a question
const peer = rtc.getPeer('PeerName');
peer.ask('What is 2+2?').then(answer => {
  console.log('Answer:', answer);
});

// Answer questions (synchronous)
rtc.addQuestionHandler('math', (question, sender) => {
  return question === '2+2?' ? 4 : 'unknown';
});

// Answer questions (async - returns Promise)
rtc.addQuestionHandler('api', async (question, sender) => {
  const result = await fetchData(question);
  return result;
});

// Listen to questions/answers
rtc.on('question', (data, sender) => { /* ... */ });
rtc.on('answer', (answer, sender) => { /* ... */ });
```

**Note**: Question handlers can return values directly or Promises. The system automatically waits for Promises to resolve.

### Ping/Pong

| Method | Equivalent To | Target |
|--------|---------------|--------|
| `peer.ping()` | `rtc.sendOverRTC('ping', 'ping', peerName)` | Specific peer |
| `rtc.ping(user)` | `rtc.sendOverRTC('ping', 'ping', user)` | Specific peer |
| `rtc.pingEveryone()` | `rtc.sendOverRTC('ping', 'ping')` to all | All peers |

```javascript
// Ping a peer
const peer = rtc.getPeer('PeerName');
peer.ping().then(() => {
  console.log('Peer is alive!');
});

// Ping everyone
rtc.pingEveryone().then(() => {
  console.log('All peers responded');
});
```

### Peer Object

Get a peer object for convenient peer-specific operations:

```javascript
const peer = rtc.getPeer('PeerName');

// Built-in methods
peer.dm('Message');
peer.ask('Question?').then(answer => { /* ... */ });
peer.ping().then(() => { /* ... */ });

// Custom channels via send method
peer.send('silentchat', 'Data');
peer.send('metadata', { status: 'online' });
```

---

## 3. Custom Channels

### Quick Start

```javascript
// 1. Register handler
const rtc = new MQTTRTCClient({
  name: 'MyName',
  topic: { room: 'myroom' },
  handlers: {
    silentchat: (data, sender) => {
      rtc.emit('silentchat', data, sender);
    }
  }
});

// 2. Listen to events
rtc.on('silentchat', (data, sender) => {
  console.log(`Silent from ${sender}:`, data);
});

// 3. Send messages
rtc.sendOverRTC('silentchat', 'Message', 'PeerName');
```

### Handler Registration

**Method 1: Via Constructor**
```javascript
const rtc = new MQTTRTCClient({
  handlers: {
    mychannel: (data, sender) => {
      rtc.emit('mychannel', data, sender);
    }
  }
});
```

**Method 2: Direct Assignment**
```javascript
rtc.rtcHandlers.mychannel = (data, sender) => {
  rtc.emit('mychannel', data, sender);
};
```

**Method 3: Object.assign**
```javascript
Object.assign(rtc.rtcHandlers, {
  mychannel: (data, sender) => {
    rtc.emit('mychannel', data, sender);
  }
});
```

**Important**: Handlers must be registered **before** connections are established.

### Handler Configuration

| Property | Type | Description |
|----------|------|-------------|
| `handler` | `function(data, sender)` | Required: Processes incoming messages |
| `raw` | `boolean` | If `true`, skip JSON serialization (for binary data) |
| `serializer` | `function(data) => string` | Custom serialization (overrides JSON) |
| `deserializer` | `function(string) => data` | Custom deserialization (overrides JSON) |

**Simple Handler**:
```javascript
rtc.rtcHandlers.mychannel = (data, sender) => {
  rtc.emit('mychannel', data, sender);
};
```

**Raw Binary Handler**:
```javascript
rtc.rtcHandlers.binarydata = {
  raw: true,
  handler: (data, sender) => {
    // data is raw string/ArrayBuffer/Blob
    rtc.emit('binarydata', data, sender);
  }
};
```

**Custom Serialization**:
```javascript
rtc.rtcHandlers.encoded = {
  serializer: (data) => btoa(JSON.stringify(data)),   // base64 encode
  deserializer: (data) => JSON.parse(atob(data)),      // base64 decode
  handler: (data, sender) => {
    rtc.emit('encoded', data, sender);
  }
};
```

### Supported Payload Types

| Mode | Types Supported | Example |
|------|----------------|---------|
| **Default (JSON)** | Objects, Arrays, Strings, Numbers, Booleans, Null | `{ id: 1 }`, `"text"`, `42` |
| **Raw** | String, ArrayBuffer, Blob | `new ArrayBuffer(8)` |
| **Custom** | Any (via serializer/deserializer) | Depends on implementation |

**JSON Limitations**: `undefined` omitted, functions not serialized, `Date` becomes string

### Complete Example: Typing Indicators

```javascript
const rtc = new MQTTRTCClient({
  name: 'MyName',
  topic: { room: 'myroom' },
  handlers: {
    typing: (data, sender) => {
      rtc.emit('typing', sender, data);
    }
  }
});

// Listen
rtc.on('typing', (sender, data) => {
  console.log(`${sender} is ${data.isTyping ? 'typing' : 'idle'}`);
});

// Send
const input = document.getElementById('message-input');
input.addEventListener('input', () => {
  rtc.sendOverRTC('typing', { isTyping: true });
  clearTimeout(window.typingTimeout);
  window.typingTimeout = setTimeout(() => {
    rtc.sendOverRTC('typing', { isTyping: false });
  }, 3000);
});
```

### Extending Existing Handlers

**Wrap existing handler**:
```javascript
const original = rtc.rtcHandlers.chat;
rtc.rtcHandlers.chat = (data, sender) => {
  console.log('Intercepted:', data);
  original.call(rtc, data, sender);
};
```

**Replace entirely**:
```javascript
rtc.rtcHandlers.chat = (data, sender) => {
  if (data.includes('spam')) return; // Filter spam
  rtc.emit('filteredchat', data, sender);
};
```

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `"Unsupported RTC channel"` | Channel not registered | Add to `rtcHandlers` before sending |
| Messages not received | Handler not emitting events | Call `rtc.emit()` in handler |
| Serialization errors | Invalid JSON | Use `raw: true` or custom serializer |

## Best Practices

1. **Register handlers early** - Before connections are established
2. **Emit events from handlers** - Always call `rtc.emit()` so `.on()` listeners work
3. **Handle errors** - Wrap `sendOverRTC` in try/catch
4. **Use namespaces** - Use `'app:typing'` instead of `'typing'` to avoid conflicts

---

## 4. WebRTC Media Streams (Video/Audio)

### Overview

The RTC client provides access to WebRTC's media streaming capabilities for video and audio calls. You can:
- Get local media streams (camera/microphone)
- Make and receive calls
- Access raw `RTCPeerConnection` and `MediaStream` objects
- Handle media tracks directly

### Making Calls

**Method**: `rtc.callUser(user, callInfo)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `user` | string | Peer name to call |
| `callInfo` | object\|MediaStream | `{video: true, audio: true}` or existing MediaStream |

**Returns**: `{start: Promise, end: Promise}`
- `start`: Resolves when call is connected with `{localStream, remoteStream}`
- `end`: Resolves when call ends

**Examples**:
```javascript
// Simple call (auto-requests camera/mic)
const {start, end} = rtc.callUser('PeerName');
start.then(({localStream, remoteStream}) => {
  // Attach streams to video elements
  localVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
});

// Call with custom MediaStream
const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
const {start} = rtc.callUser('PeerName', stream);
start.then(({localStream, remoteStream}) => {
  // Use streams
});
```

### Receiving Calls

**Event**: `rtc.on('call', ...)`

```javascript
rtc.on('call', (peerName, callInfo, promises) => {
  // callInfo: {video: true, audio: true}
  // promises: {start: Promise, end: Promise}
  
  const accept = confirm(`Accept call from ${peerName}?`);
  if (accept) {
    // Return the start promise to accept
    return promises.start.then(({localStream, remoteStream}) => {
      localVideo.srcObject = localStream;
      remoteVideo.srcObject = remoteStream;
    });
  } else {
    // Reject to decline
    promises.start.catch(() => {});
  }
});
```

### Call Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `'call'` | `(peerName, callInfo, promises)` | Incoming call (return Promise to accept) |
| `'callconnected'` | `(peerName, {localStream, remoteStream})` | Call connected |
| `'callended'` | `(peerName)` | Call ended |

```javascript
rtc.on('callconnected', (peerName, {localStream, remoteStream}) => {
  console.log('Call connected with', peerName);
  localVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
});

rtc.on('callended', (peerName) => {
  console.log('Call ended with', peerName);
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
});
```

### Ending Calls

**Method**: `rtc.endCallWithUser(user)`

```javascript
// End call with specific peer
rtc.endCallWithUser('PeerName');
```

### Accessing Raw WebRTC Objects

You can access the underlying WebRTC objects for advanced use cases:

**Get RTCPeerConnection for data channels**:
```javascript
const peer = rtc.getPeer('PeerName');
// Access via RTCConnection (internal)
const rtcConnection = rtc.rtcConnections['PeerName'];
const peerConnection = rtcConnection.peerConnection; // RTCPeerConnection for data
```

**Get RTCPeerConnection for media streams**:
```javascript
const rtcConnection = rtc.rtcConnections['PeerName'];
const streamConnection = rtcConnection.streamConnection; // RTCPeerConnection for media
```

**Get MediaStreams**:
```javascript
// From callconnected event
rtc.on('callconnected', (peerName, {localStream, remoteStream}) => {
  // localStream: MediaStream (your camera/mic)
  // remoteStream: MediaStream (peer's camera/mic)
  
  // Access tracks
  const videoTracks = localStream.getVideoTracks();
  const audioTracks = localStream.getAudioTracks();
  
  // Control tracks
  videoTracks[0].enabled = false; // Disable video
  audioTracks[0].enabled = false; // Mute audio
});
```

### Getting Media Streams

Use the standard WebRTC API:

```javascript
// Get camera and microphone
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});

// Video only
const videoStream = await navigator.mediaDevices.getUserMedia({
  video: { width: 1280, height: 720 }
});

// Audio only
const audioStream = await navigator.mediaDevices.getUserMedia({
  audio: true
});

// Specific constraints
const hdStream = await navigator.mediaDevices.getUserMedia({
  video: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: 'user' // or 'environment' for back camera
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true
  }
});
```

### Complete Example: Custom Video Call

```javascript
const rtc = new MQTTRTCClient({
  name: 'MyName',
  topic: { room: 'myroom' }
});

// Get local media
const localStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});

// Attach to local video element
const localVideo = document.getElementById('localVideo');
localVideo.srcObject = localStream;

// Make call
rtc.on('connectedtopeer', (peerName) => {
  const {start, end} = rtc.callUser(peerName, localStream);
  
  start.then(({localStream, remoteStream}) => {
    // Attach remote stream
    const remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.srcObject = remoteStream;
    
    console.log('Call connected!');
  });
  
  end.then(() => {
    console.log('Call ended');
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
  });
});

// Handle incoming calls
rtc.on('call', (peerName, callInfo, promises) => {
  const accept = confirm(`Accept call from ${peerName}?`);
  
  if (accept) {
    return promises.start.then(({localStream, remoteStream}) => {
      const localVideo = document.getElementById('localVideo');
      const remoteVideo = document.getElementById('remoteVideo');
      
      localVideo.srcObject = localStream;
      remoteVideo.srcObject = remoteStream;
    });
  }
});

// Handle call events
rtc.on('callconnected', (peerName, {localStream, remoteStream}) => {
  console.log('Call connected with', peerName);
});

rtc.on('callended', (peerName) => {
  console.log('Call ended with', peerName);
});
```

### Advanced: Direct RTCPeerConnection Access

For advanced use cases, you can access the raw `RTCPeerConnection`:

```javascript
// Get the RTCConnection object
const rtcConnection = rtc.rtcConnections['PeerName'];

// Access data channel peer connection
const dataConnection = rtcConnection.peerConnection;

// Access media stream peer connection
const mediaConnection = rtcConnection.streamConnection;

// Listen to connection state changes
mediaConnection.onconnectionstatechange = () => {
  console.log('Connection state:', mediaConnection.connectionState);
};

// Listen to ICE connection state
mediaConnection.oniceconnectionstatechange = () => {
  console.log('ICE state:', mediaConnection.iceConnectionState);
};

// Access ICE candidates
mediaConnection.onicecandidate = (event) => {
  if (event.candidate) {
    console.log('ICE candidate:', event.candidate);
  }
};

// Access media tracks
mediaConnection.ontrack = (event) => {
  console.log('Received track:', event.track);
  const stream = event.streams[0];
  remoteVideo.srcObject = stream;
};
```

### Media Track Control

```javascript
// Get tracks from stream
const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
const videoTrack = stream.getVideoTracks()[0];
const audioTrack = stream.getAudioTracks()[0];

// Enable/disable video
videoTrack.enabled = false; // Turn off camera
videoTrack.enabled = true;  // Turn on camera

// Mute/unmute audio
audioTrack.enabled = false; // Mute
audioTrack.enabled = true;  // Unmute

// Stop tracks (releases camera/mic)
videoTrack.stop();
audioTrack.stop();

// Get track settings
console.log(videoTrack.getSettings());
// { width: 1280, height: 720, frameRate: 30, ... }

// Apply constraints
videoTrack.applyConstraints({ width: 1920, height: 1080 });
```

## See Also

- [Custom UI Guide](./CUSTOM_UI_GUIDE.md) - Building UIs on top of RTC
- `src/core/mqtt-rtc-client.js` - Core implementation
- `src/ui/video-chat.js` - Video chat component implementation
