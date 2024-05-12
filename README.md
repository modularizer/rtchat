# RTChat

RTChat is a serverless chat system built using WebRTC and MQTT. 

* Public MQTT brokers and stun servers are used only for the initial signaling process to exchange information between the clients.
  * because the mqtt broker and stun servers are publicly accessible, there is no backend for this project, only staticly served files
  * the public servers are only used very briefly to exchange small amounts of info when new clients connect
* Once the clients have exchanged the necessary information, they can communicate directly and securely with each other using WebRTC.

## Try It
* [RTChat](https://modularizer.github.io/rtchat/)

Note: I did very minimal work on the UI, so it is not very pretty. 
The focus and interest was on the functionality of the chat system.
If someone else wants to make it look nice or add UI features like emojis, reactions, file sharing, etc. please feel free to fork the project!

## Quick Start
```html
<script type="module" src="https://modularizer.github.io/rtchat/mqtt-rtc.js"</script>
```
```javascript
import { MQTTRTCClient } from "./mqtt-rtc.js";

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
```
