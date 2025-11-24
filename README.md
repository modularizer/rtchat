# RTChat

RTChat is a **cross-platform, framework-agnostic** peer-to-peer communication library using WebRTC and MQTT. 

## Features

* ✅ **Serverless**: No backend required - uses public MQTT brokers and STUN servers only for initial signaling (~3kB per connection)
* ✅ **Cross-platform**: Works in browser, Node.js, React Native, and any JavaScript environment
* ✅ **Framework-agnostic**: Use with React, Vue, Svelte, Angular, or vanilla JS
* ✅ **Dependency injection**: Inject storage, crypto, and platform-specific APIs
* ✅ **Identity verification**: RSA-PSS cryptographic challenge/response system
* ✅ **Zero dependencies**: No external runtime dependencies
* ✅ **End-to-end encrypted**: WebRTC connections are encrypted by default

## Installation

```bash
npm install @rtchat/core
```

## Documentation

- **[Custom UI Guide](./CUSTOM_UI_GUIDE.md)** - Complete guide for building your own chat UI
- **[RTC Protocol Guide](./RTC_GUIDE.md)** - RTC channels, handlers, methods, and extending the protocol
- Core API documentation in source files (JSDoc comments)

## Quick Start

### npm Package (Recommended)

```javascript
import { MQTTRTCClient } from '@rtchat/core';

const client = new MQTTRTCClient({
  name: 'MyName',
  topic: 'myroom'
});

client.on('connectedtopeer', (user) => {
  console.log('Connected to', user);
});

client.on('chat', (message, sender) => {
  console.log(`${sender}: ${message}`);
});
```

### CDN / HTML (Legacy)
```html
<script src="https://modularizer.github.io/rtchat/rtchat.js?add"></script>
```

### Developer Quick Start (to use the barebones chat system in your own project)
```html
<script type="module">
import { MQTTRTCClient } from "https://modularizer.github.io/rtchat/mqtt-rtc.js";

const client = new MQTTRTCClient();
client.on("connectionrequest", (user, userInfo) => {
    console.log("connectionrequest", user, userInfo);
    if (confirm("accept connection from " + user + "?")){
        return Promise.resolve(true);
    }else{
        return Promise.resolve(false);
    }
});
client.on("connectedtopeer", (user, userInfo) => {
    console.log("connectedtopeer", user, userInfo);
    window.peer = client.getPeer(user);
});
client.on("question", (question, sender) => {
    console.log("received question", question);
    if (question == "what is the answer to life, the universe, and everything?"){
        return 42;
    }
    return "I don't know the answer";
});
client.on("answer", (answer, sender) => {
    console.log("received answer", answer);
});

// peer.ask("what is the answer to life, the universe, and everything?").then(console.log);
</script>
```

## Security
* the webRTC connection is end-to-end encrypted, BUT right now I have not implemented in security in the signaling and connection process
* specifically, by default this chat will broadcast information related to your IP address (which every site you ever connect to on the internet already knows) to anyone else who has subscribed to the same mqtt broker and topic
* basically, the signalling process as implemented right now is not secure, but also is not super sensitive information. it certainly could be made more secure, but there may not be much reason to do so
* just make sure the person you are talking to ACTUALLY is the person you think you are talking to
* sign.js implements a challenge/response system to verify the identity of the person you are talking to, but it is not fully implemented in the chat system yet
  * the challenge/response system only works if you...
    1. trust the person the first time you connect to them, you can verify on future times it is the same person
    2. if you exchange public keys through some other method, you can call `Sign.register` to save that public key to the local storage



# How it works
## Get an identity
1. When the page loads, the client make sure it has a name to call itself
   i. figures out a unique tab id for this specific tab open to this page domain by checking local storage
      a. reads tab id list from local storage
      b. filters the tab id list to those which have phoned into local storage recently and set the local time as a sort of "keep-alive"
      c. uses a tab id not in the list, sets localStorage, and sets up an interval to keep the tab id alive
   ii. loads name from local storage if it exists, otherwise it prompts the user for a name
   iii. saves the name to local storage
   iv. name + tab_id becomes the "name" of the client
2. Make a topic from the page url, along with the "room" if applicable. This is how we'll find other people to talk to
3. Make a private/public key pair if you don't already have one
   i. loads the public key from local storage if it exists, otherwise it generates a new key pair
   ii. saves the public key to local storage

## Connect to the room
1. The client connects to the public mqtt broker at a topic dictated by the page url
2. The client subscribes to the topic and listens for all messages from anyone on the same topic (any tabs open to this url). We use "subtopics" just encoded in the message payload.

## Use the public mqtt broker and a public stun server to help establish WebRTC connections with other clients
1. post a public MQTT message of your public key to the subtopic "connect"
   i. this actually means the payload `'{subtopic: connect, sender: <name>, timestamp: <Date.now()>, data: {publicKeyString: 'asdfasd'}'` is sent to the topic every page user is connected to
2. each client receives your name and public key on that "connect" message and decides whether it wants to try to talk to you
   i. NOTE: we don't implement the public key challenge yet over mqtt. we semi-trust the info for now and once we finalize a secure connection the first thing we do is challenge the other person to prove they are who they say they are
3. if a client wants to talk to you, 
    i. it establishes a new RTCPeerConnection configured to talk to a public stun server
    ii. it uses this stun server to get its public IP address, port, and other info your browser will need to talk directly to its browser
    iii. it puts this identifying info into an RTCOffer and sends it to the public mqtt topic for the page with the subtopic "RTCOffer", along with its own name and public key and your name so you know it is for you
4. when you receive an RTCOffer, you create an RTCOffer, use the name and public key to decide if you want to talk to this person
  i. NOTE: we don't implement the public key challenge yet over mqtt. we semi-trust the info for now and once we finalize a secure connection the first thing we do is challenge the other person to prove they are who they say they are
5. if you want to talk to this person...
    i. you establish a new RTCPeerConnection configured to talk to a public stun server
    ii. you use this stun server to get your public IP address, port, and other info the other person's browser will need to talk directly to your browser
    iii. you put this identifying info into an RTCAnswer and send it to the public mqtt topic for the page with the subtopic "RTCAnswer"
6. when the other person receives your RTCAnswer, they use the info to establish a direct connection to your browser
7. now the two browsers can talk directly to each other using WebRTC!

## Validate Who You're Talking To
1. as soon as the WebRTC connection is established, the two clients exchange a challenge / response to verify they each have the private key that corresponds to the public key they sent over mqtt
2. if the challenge / response is successful, the two clients can trust that they are talking to the person they think they are talking to
3. if the challenge / response is unsuccessful, the connection gets closed

## Send Messages
1. now there is a secure serverless connection between the two clients and it has been validated with cryptography keys and encrypted end-to-end





