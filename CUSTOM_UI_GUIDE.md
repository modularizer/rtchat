# Custom UI Implementation Guide

Build your own chat UI using the RTChat core library. This guide focuses on UI patterns and examples.

**For RTC protocol details, see [RTC Protocol Guide](./RTC_GUIDE.md)**

## Quick Start

```javascript
import { MQTTRTCClient } from './src/core/mqtt-rtc-client.js';

const rtc = new MQTTRTCClient({
  name: 'MyName',
  topic: { room: 'myroom' }
});

// Listen to events
rtc.on('chat', (message, sender) => {
  console.log(`${sender}: ${message}`);
});

rtc.on('connectedtopeer', (peerName) => {
  console.log('Connected to', peerName);
});

// Send messages
rtc.sendRTCChat('Hello!');
```

## Basic Setup

1. **Create RTC client**
2. **Listen to events** (chat, connections, etc.)
3. **Send messages** when user interacts
4. **Update UI** based on events

## Essential Events

| Event | Parameters | When to Use |
|-------|------------|-------------|
| `'chat'` | `(message, sender)` | Display incoming messages |
| `'connectedtopeer'` | `(peerName)` | Show peer in user list |
| `'disconnectedfrompeer'` | `(peerName)` | Remove peer from user list |
| `'mqttconnected'` | `(topic, name)` | Show connection status |

See [RTC Guide - Events](./RTC_GUIDE.md#1-core-concepts) for complete event list.

## Essential Methods

| Method | Purpose |
|--------|---------|
| `rtc.sendRTCChat(message)` | Send message to all peers |
| `rtc.sendRTCDM(message, target)` | Send direct message |
| `rtc.getPeer(name)` | Get peer object for direct interaction |
| `rtc.isConnectedToUser(name)` | Check if peer is connected |

See [RTC Guide - Methods](./RTC_GUIDE.md#2-helper-methods) for complete method list.

## Vanilla JavaScript Example

```javascript
import { MQTTRTCClient } from './src/core/mqtt-rtc-client.js';

class MyChat {
  constructor(config) {
    this.rtc = new MQTTRTCClient({
      name: config.name || 'User',
      topic: { room: config.room || 'chat' }
    });
    
    this.setupUI();
    this.setupEvents();
  }
  
  setupUI() {
    this.container = document.createElement('div');
    this.container.innerHTML = `
      <div class="users"></div>
      <div class="messages"></div>
      <input type="text" id="message-input">
      <button id="send-btn">Send</button>
    `;
    document.body.appendChild(this.container);
    
    this.usersEl = this.container.querySelector('.users');
    this.messagesEl = this.container.querySelector('.messages');
    this.input = this.container.querySelector('#message-input');
    this.sendBtn = this.container.querySelector('#send-btn');
    
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }
  
  setupEvents() {
    // Chat messages
    this.rtc.on('chat', (message, sender) => {
      this.addMessage(message, sender);
    });
    
    // Peer connections
    this.rtc.on('connectedtopeer', (peerName) => {
      this.addUser(peerName);
    });
    
    this.rtc.on('disconnectedfrompeer', (peerName) => {
      this.removeUser(peerName);
    });
  }
  
  sendMessage() {
    const message = this.input.value.trim();
    if (!message) return;
    
    this.rtc.sendRTCChat(message);
    this.addMessage(message, this.rtc.name, true);
    this.input.value = '';
  }
  
  addMessage(text, sender, isOwn = false) {
    const msgEl = document.createElement('div');
    msgEl.className = isOwn ? 'message own' : 'message';
    msgEl.innerHTML = `<strong>${sender}:</strong> ${text}`;
    this.messagesEl.appendChild(msgEl);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
  
  addUser(name) {
    const userEl = document.createElement('div');
    userEl.textContent = name;
    userEl.dataset.name = name;
    this.usersEl.appendChild(userEl);
  }
  
  removeUser(name) {
    const userEl = this.usersEl.querySelector(`[data-name="${name}"]`);
    if (userEl) userEl.remove();
  }
}

// Usage
const chat = new MyChat({ name: 'MyName', room: 'myroom' });
```

## React Example

```jsx
import { useState, useEffect } from 'react';
import { MQTTRTCClient } from '@rtchat/core';

function ChatUI({ name, room }) {
  const [rtc, setRTC] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [input, setInput] = useState('');
  
  useEffect(() => {
    const client = new MQTTRTCClient({
      name,
      topic: { room }
    });
    
    client.on('chat', (message, sender) => {
      setMessages(prev => [...prev, { message, sender, timestamp: Date.now() }]);
    });
    
    client.on('connectedtopeer', (peerName) => {
      setUsers(prev => prev.includes(peerName) ? prev : [...prev, peerName]);
    });
    
    client.on('disconnectedfrompeer', (peerName) => {
      setUsers(prev => prev.filter(u => u !== peerName));
    });
    
    setRTC(client);
    
    return () => client.close();
  }, [name, room]);
  
  const sendMessage = () => {
    if (rtc && input.trim()) {
      rtc.sendRTCChat(input);
      setInput('');
    }
  };
  
  return (
    <div className="chat">
      <div className="users">
        {users.map(user => <div key={user}>{user}</div>)}
      </div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.sender}:</strong> {msg.message}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
```

## Vue Example

```vue
<template>
  <div class="chat">
    <div class="users">
      <div v-for="user in users" :key="user">{{ user }}</div>
    </div>
    <div class="messages">
      <div v-for="(msg, i) in messages" :key="i">
        <strong>{{ msg.sender }}:</strong> {{ msg.message }}
      </div>
    </div>
    <div class="input-area">
      <input v-model="input" @keydown.enter="sendMessage" />
      <button @click="sendMessage">Send</button>
    </div>
  </div>
</template>

<script>
import { MQTTRTCClient } from '@rtchat/core';

export default {
  props: ['name', 'room'],
  data() {
    return {
      rtc: null,
      messages: [],
      users: [],
      input: ''
    };
  },
  mounted() {
    this.rtc = new MQTTRTCClient({
      name: this.name,
      topic: { room: this.room }
    });
    
    this.rtc.on('chat', (message, sender) => {
      this.messages.push({ message, sender, timestamp: Date.now() });
    });
    
    this.rtc.on('connectedtopeer', (peerName) => {
      if (!this.users.includes(peerName)) {
        this.users.push(peerName);
      }
    });
    
    this.rtc.on('disconnectedfrompeer', (peerName) => {
      this.users = this.users.filter(u => u !== peerName);
    });
  },
  beforeUnmount() {
    if (this.rtc) this.rtc.close();
  },
  methods: {
    sendMessage() {
      if (this.rtc && this.input.trim()) {
        this.rtc.sendRTCChat(this.input);
        this.input = '';
      }
    }
  }
};
</script>
```

## Using Custom Channels

See [RTC Guide - Custom Channels](./RTC_GUIDE.md#3-custom-channels) for details.

**Quick example**:
```javascript
// Register handler
const rtc = new MQTTRTCClient({
  handlers: {
    typing: (data, sender) => {
      rtc.emit('typing', sender, data);
    }
  }
});

// Listen
rtc.on('typing', (sender, data) => {
  console.log(`${sender} is typing`);
});

// Send
rtc.sendOverRTC('typing', { isTyping: true });
```

## Video/Audio Calls

See [RTC Guide - WebRTC Media Streams](./RTC_GUIDE.md#4-webrtc-media-streams-videoaudio) for details.

**Quick example**:
```javascript
// Make call
const {start, end} = rtc.callUser('PeerName');
start.then(({localStream, remoteStream}) => {
  localVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
});

// Handle incoming calls
rtc.on('call', (peerName, callInfo, promises) => {
  if (confirm(`Accept call from ${peerName}?`)) {
    return promises.start.then(({localStream, remoteStream}) => {
      localVideo.srcObject = localStream;
      remoteVideo.srcObject = remoteStream;
    });
  }
});
```

## Tips

1. **Always clean up**: Call `rtc.close()` when component unmounts
2. **Store messages**: Keep your own message history if needed
3. **Track users**: Maintain your own user list from events
4. **Handle errors**: Wrap RTC operations in try/catch
5. **Check connection**: Use `rtc.isConnectedToUser(name)` before sending

## Reference

- **[RTC Protocol Guide](./RTC_GUIDE.md)** - Complete RTC API reference
- `src/ui/chat-box.js` - Reference implementation (simple but functional)
