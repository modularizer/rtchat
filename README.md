# RTChat

RTChat is a serverless chat system built using WebRTC and MQTT. 

* Public MQTT brokers and stun servers are used only for the initial signaling process to exchange information between the clients.
  * because the mqtt broker and stun servers are publicly accessible, there is no backend for this project, only staticly served files
  * the public servers are only used very briefly to exchange small amounts of info when new clients connect
  * it takes **~3kB** of data transfer over mqtt to establish a connection between two clients
* Once the clients have exchanged the necessary information, they can communicate directly and securely with each other using WebRTC.

## Try It
* [RTChat](https://modularizer.github.io/rtchat/)

Note: I did very minimal work on the UI, so it is not very pretty. 
The focus and interest was on the functionality of the chat system.
If someone else wants to make it look nice or add UI features like emojis, reactions, file sharing, etc. please feel free to fork the project!

## Quick Start (to use the barebones chat system in your own project)
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



