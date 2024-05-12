
// _____________________________________________ tab ID _______________________________________________________________
// find the id of all the tabs open
let tabs = localStorage.getItem('tabs');
let existingTabs = tabs?JSON.parse(tabs):[];

// If there are more than 10 tabs open, clear the list of tabs
if (existingTabs.length > 10){
    existingTabs = [];
    localStorage.removeItem('tabs');
}
// Generate a unique ID for the current tab
const randomTabID = Math.floor(Math.random() * 1000000000)
let tabID = Math.max(...existingTabs.map(v=>1*v.split("_")[0]), 0) + 1;
const fullTabID = tabID + "_" + randomTabID;
// Add the tab ID to the list of tabs stored in local storage
existingTabs.push(fullTabID);
localStorage.setItem('tabs', JSON.stringify(existingTabs));

console.log("Tab ID: ", tabID);

// When the tab is closed or reloaded, decrement the count and notify other tabs
window.addEventListener('beforeunload', function () {
  tabs = localStorage.getItem('tabs');
  existingTabs = tabs?JSON.parse(tabs):[];
  existingTabs = existingTabs.filter(v=>v!==fullTabID);
  localStorage.setItem('tabs', JSON.stringify(existingTabs));
});
//__________________________________________ DEFERRED PROMISE __________________________________________________________
class DeferredPromise {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        })
    }
}

// _____________________________ default name _________________________________
let n = localStorage.getItem("name");
if (n && n.startsWith("anon")){
    n = null;
}
let name = n || ("anon" + Math.floor(Math.random() * 1000));


//______________________________________________________ CONFIGURATION _________________________________________________
let defaultConfig = {
    broker: 'wss://public:public@public.cloud.shiftr.io',
    stunServer: "stun:stun4.l.google.com:19302",
    topic: location.hostname + location.pathname.replace(/index\.html$/, "").replace(/[^a-zA-Z0-9]/g, "") + location.hash.replace("#", "").replace(/[^a-zA-Z0-9]/g, ""),
    name: name,
}


//______________________________________________________________________________________________________________________



class BaseMQTTRTCClient {
  constructor(name, userInfo, config){
    // specify a tabID to allow multiple tabs to be open at once
    name = name || defaultConfig.name
    // save the name to local storage to persist it
    localStorage.setItem("name", name);
    this.name = name + "_" + tabID;
    this.userInfo = userInfo || {};

    let {topic, broker, stunServer} = config || {};


    this.mqttBroker = broker || defaultConfig.broker;
    this.stunServer = stunServer || defaultConfig.stunServer;
    this.topic = topic || defaultConfig.topic;

    // bind methods to this
    // MQTT methods
    this.load = this.load.bind(this);
    this._onMQTTConnect = this._onMQTTConnect.bind(this);
    this.onConnectedToMQTT = this.onConnectedToMQTT.bind(this);
    this._onMQTTMessage = this._onMQTTMessage.bind(this);
    this.onMQTTMessage = this.onMQTTMessage.bind(this);
    this.beforeunload = this.beforeunload.bind(this);
    this.postPubliclyToMQTTServer = this.postPubliclyToMQTTServer.bind(this);
    for (let [k, v] of Object.entries(this.mqttHandlers)){
        this.mqttHandlers[k] = v.bind(this);
    }
    this.changeName = this.changeName.bind(this);
    this.recordNameChange = this.recordNameChange.bind(this);
    this.onNameChange = this.onNameChange.bind(this);


    // RTC connection methods
    this.shouldConnectToUser = this.shouldConnectToUser.bind(this);
    this.connectToUser = this.connectToUser.bind(this);
    this.connectionToUser = this.connectionToUser.bind(this);
    this.connectionsToUsers = this.connectionsToUsers.bind(this);
    this.disconnectFromUser = this.disconnectFromUser.bind(this);
    this.onConnectedToUser = this.onConnectedToUser.bind(this);
    this.onDisconnectedFromUser = this.onDisconnectedFromUser.bind(this);
    this.onrtcdisconnectedFromUser = this.onrtcdisconnectedFromUser.bind(this);

    // RTC send/receive methods
    this.sendOverRTC = this.sendOverRTC.bind(this);
    this.onrtcmessage = this.onrtcmessage.bind(this);
    this.onrtcerror = this.onrtcerror.bind(this);

    // initialize state tracking variables
    this.rtcConnections = {};
    this.knownUsers = {};

    // load the MQTT client
    this.load();
  }
  //________________________________________________________ MQTT BASICS _______________________________________________
  load(){
    if (!window.mqtt){
        // if the MQTT library isn't loaded yet byt the script tag in HTML, try again in 100ms
        console.warn("MQTT not loaded yet");
        setTimeout(this.load.bind(this), 100);
        return;
    }

    // connect to the MQTT broker
    this.client = mqtt.connect(this.mqttBroker, {clientId: 'javascript'});
    this.client.on('connect', this._onMQTTConnect.bind(this));
    this.client.on('message', this._onMQTTMessage.bind(this));
    window.addEventListener("beforeunload", this.beforeunload.bind(this));
  }
  _onMQTTConnect(){
    this.client.subscribe(this.topic);
    this.postPubliclyToMQTTServer("connectedToMQTT", this.userInfo);
    this.onConnectedToMQTT();
  }
    onConnectedToMQTT(){
        console.log("Connected to MQTT: " + this.topic + " as " + this.name);
    }
  _onMQTTMessage(t, payloadString){
        if (t === this.topic){
            let payload = JSON.parse(payloadString);
            if (payload.sender === this.name){
                return;
            }
            let subtopic = payload.subtopic;
            if (this.mqttHandlers[subtopic]){
                this.mqttHandlers[subtopic](payload);
            }else{
                this.onMQTTMessage(subtopic, payload.data, payload.sender, payload.timestamp);
                console.warn("Unhandled message: " + subtopic, payload);
            }
        }
    }
  onMQTTMessage(subtopic, data, sender, timestamp){
    console.log("Received message from " + sender + " on " + subtopic, data);
  }
  beforeunload(){
    this.sendOverRTC("beforeunload");
  }
  postPubliclyToMQTTServer(subtopic, data){
    let payload = {
        sender: this.name,
        timestamp: Date.now(),
        subtopic: subtopic,
        data: data || message
    }
    let payloadString = JSON.stringify(payload);
    this.client.publish(this.topic, payloadString);
  }

  //____________________________________________________________________________________________________________________
  mqttHandlers = {
    connectedToMQTT: payload => {
        console.log("Received notice that someone else connected:" + payload.sender, payload, payload.data);
        this.knownUsers[payload.sender] = payload.data;
        this.shouldConnectToUser(payload.sender, payload.data).then(r => {
            if (r){
                this.connectToUser(payload.sender);
            }
        })
    },
    nameChange: payload => {
        this.recordNameChange(data.oldName, data.newName);
    },
    beforeunload: payload => {
        this.disconnectFromUser(payload.sender);
        delete this.knownUsers[payload.sender];
    },
    RTCoffer: payload => {
        console.log("received RTCoffer", payload);
        let {offer, target} = payload.data;
        if (target != this.name){return};
        if (this.rtcConnections[payload.sender]){
            console.warn("Already have a connection to " + payload.sender + ". Closing and reopening.")
            this.rtcConnections[payload.sender].close();
        }
        this.rtcConnections[payload.sender] = new RTCConnection(this, payload.sender);
        this.rtcConnections[payload.sender].respondToOffer(offer);
    },
    RTCanswer: payload => {
        console.log("received RTCanswer", payload);
        let {answer, target} = payload.data;
        if (target != this.name){return};
        let rtcConnection = this.rtcConnections[payload.sender]; // Using the correct connection
        if (!rtcConnection){
            console.error("No connection found for " + payload.sender);
            return
        }
        rtcConnection.receiveAnswer(answer);
    },
    RTCiceCandidate: payload => {
        let rtcConnection = this.rtcConnections[payload.sender]; // Using the correct connection
        if (!rtcConnection){
            console.error("No connection found for " + payload.sender);
            rtcConnection = new RTCConnection(this, payload.sender);
            this.rtcConnections[payload.sender] = rtcConnection
        }
        rtcConnection.onReceivedIceCandidate(payload.data);
    }
  }
  shouldConnectToUser(user, userInfo){
    return Promise.resolve(true);
  }
  connectToUser(user){
    if (!this.connectionToUser(user)){
        this.rtcConnections[user] = new RTCConnection(this, user);
        this.rtcConnections[user].sendOffer();
        return this.rtcConnections[user];
    }
  }
  connectionToUser(user){
    let existingConnection = this.rtcConnections[user];
    if (existingConnection && existingConnection.peerConnection.connectionState === "connected"){
        return existingConnection
    }else if (existingConnection){
        console.warn("Already have a connection to " + user + " but it's not connected.", existingConnection.peerConnection.connectionState,"  Closing and reopening.");
        this.disconnectFromUser(user);
        return null;
    }
    return null;
  }
  connectionsToUsers(users){
    users = users || Object.keys(this.rtcConnections);
    if (typeof users === "string"){
        users = [users];
    }
    return users.filter(c => this.connectionToUser(c));
  }
  get connectedUsers(){
    return this.connectionsToUsers();
  }
  disconnectFromUser(user){
    console.warn("Closing connection to " + user);
    let rtcConnection = this.rtcConnections[user]
    if (rtcConnection){
        rtcConnection.close();
        delete this.rtcConnections[user];
        console.warn("Closed connection to " + user);
    }else{
        console.warn("No connection to close to " + user);
    }
  }
  onConnectedToUser(user){
    console.log("Connected to user ", user);
  }
  onrtcdisconnectedFromUser(user){
    if (!this.rtcConnections[user]){
        console.warn("Already disconnected from" + user);
        return;
    }
    console.log("Disconnected from user ", user);
    delete this.rtcConnections[user];
    if (this.onDisconnectedFromUser){
        this.onDisconnectedFromUser(user);
    }
  }
  onDisconnectedFromUser(user){
    console.log("Disconnected from user ", user);
  }

  changeName(newName){
    let oldName = this.name;
    this.name = newName + "_" + tabID;
    localStorage.setItem("name", newName);
    this.postPubliclyToMQTTServer("nameChange", {oldName: this.name, newName});
  }
  recordNameChange(oldName, newName){
    this.knownUsers[newName] = this.knownUsers[oldName];
    delete this.knownUsers[oldName];
    this.rtcConnections[newName] = this.rtcConnections[oldName];
    delete this.rtcConnections[oldName];
    this.onNameChange(oldName, newName);
  }
    onNameChange(oldName, newName){
        console.log(oldName + " changed name to " + newName);
    }
  //____________________________________________________________________________________________________________________
  sendOverRTC(channel, data, users){
    if (!channel){ throw new Error("No channel specified") }
    if (!this.rtcHandlers[channel]){throw new Error("Unsupported RTC channel: " + channel)}
    let handler = this.rtcHandlers[channel];
    data = data || channel;
    let serializedData = data
    if (handler && !handler.raw){
        serializedData = (handler.serializer || JSON.stringify)(data);
    }
    for (let user of this.connectionsToUsers(users)){
        this.rtcConnections[user].send(channel, serializedData);
    }
  }

  //____________________________________________________________________________________________________________________
  rtcHandlers = {
    connectedViaRTC: (data, sender) => { this.onConnectedToUser(sender) },
  }
  onrtcmessage(channel, data, sender){
    let handler = this.rtcHandlers[channel];
    let deserializedData = data;
    if (handler && !handler.raw){
        deserializedData = (handler.deserializer || JSON.parse)(data);
    }
    if (handler){
        handler(deserializedData, sender);
    }else{
        console.warn("No handler found for " + channel);
    }
  }
  onrtcerror(channel, error, sender){
    let handler = this.rtcHandlers[channel];
    if (handler && handler.error){
        handler.error(error, sender);
    }
  }
}


class RTCConnection {
    constructor(mqttClient, target){
        this.rtcConfiguration = { "iceServers": [{ "urls": mqttClient.stunServer }] }
        this.target = target;
        this.mqttClient = mqttClient;
        this.dataChannels = {};
        this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);
        this.peerConnection.onicecandidate = this.onicecandidate.bind(this);
        this.dataChannelDeferredPromises = Object.fromEntries(Object.entries(mqttClient.rtcHandlers).map(([name, handler]) => [name, new DeferredPromise()]));
        this.loadPromise = Promise.all(Object.values(this.dataChannelDeferredPromises).map((deferredPromise) => deferredPromise.promise));
        this.loaded = false;
        this.loadPromise.then((() => {this.loaded = true}).bind(this));

        this.peerConnection.ondatachannel = ((event) => {
            this.registerDataChannel(event.channel);
        }).bind(this);
        this.peerConnection.oniceconnectionstatechange = (function() {
            if (this.peerConnection.iceConnectionState === 'disconnected' ||
                this.peerConnection.iceConnectionState === 'failed' ||
                this.peerConnection.iceConnectionState === 'closed') {
                this.mqttClient.onDisconnectedFromUser(this.target);
            }
        }).bind(this);
    }
    registerDataChannel(dataChannel){
        dataChannel.onmessage = ((e) => {
            this.onmessage(e, dataChannel.label);
        }).bind(this);
        dataChannel.onerror = ((e) => {
            this.dataChannelDeferredPromises[dataChannel.label].reject(e);
            this.ondatachannelerror(e, dataChannel.label);
        }).bind(this);
        dataChannel.onopen = ((e) => {
            this.dataChannelDeferredPromises[dataChannel.label].resolve(e);
        }).bind(this);
        this.dataChannels[dataChannel.label] = dataChannel;
    }
    setupDataChannels(){
        for (let [name, dataChannelHandler] of Object.entries(this.mqttClient.rtcHandlers)){
            let dataChannel = this.peerConnection.createDataChannel(name);
            this.registerDataChannel(dataChannel);
        }
    }


    sendOffer(){
        this.setupDataChannels();
        this.peerConnection.createOffer()
          .then(offer => this.peerConnection.setLocalDescription(offer))
          .then(() => {
            // Send offer via MQTT
            console.log("Sending offer to " + this.target);
            this.mqttClient.postPubliclyToMQTTServer("RTCoffer", {"offer": this.peerConnection.localDescription, "target": this.target});
          });
    }
    respondToOffer(offer){
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
              .then(() => this.peerConnection.createAnswer())
              .then(answer => this.peerConnection.setLocalDescription(answer))
              .then((answer) => {
                // Send answer via MQTT
                this.mqttClient.postPubliclyToMQTTServer("RTCanswer", {
                    "answer": this.peerConnection.localDescription,
                    "target": this.target,
                });
              });
    }
    receiveAnswer(answer){
        if (this.peerConnection.signalingState !== 'have-local-offer') {
            console.warn("Wrong state " + this.peerConnection.signalingState);
            return;
        }
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        this.mqttClient.onConnectedToUser(this.target);
        this.loadPromise.then((() => this.send("connectedViaRTC", JSON.stringify("connectedViaRTC"))).bind(this));
    }
    send(channel, serializedData){
        let dataChannel = this.dataChannels[channel];
        if (!dataChannel){
            if (this.handlers[channel]){
                console.warn("handler found for ", channel, "but no data channel");
            }
            throw new Error("No data channel for " + channel);
        }
        if (dataChannel.readyState !== "open"){
            throw new Error("Channel not open: " + dataChannel.readyState);
        }
        dataChannel.send(serializedData);
    }
    onmessage(event, channel){
        this.mqttClient.onrtcmessage(channel, event.data, this.target);
    }

    onReceivedIceCandidate(data) {
        this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
    }

    onicecandidate(event){
        if (event.candidate) {
            // Send ICE candidate via MQTT
            this.mqttClient.postPubliclyToMQTTServer("RTCiceCandidate", event.candidate);
        }
    }
    ondatachannel(event){
        let dataChannel = event.channel;
        this.dataChannels[event.name] = dataChannel;
        dataChannel.onmessage = this.onmessage.bind(this);
    }
    ondatachannelerror(error, channelName){
        this.mqttClient.onrtcerror(channelName, error, this.target);
    }

    close(){
        if (this.closed){return}
        this.peerConnection.close();
        this.closed = true;
        this.peerConnection = null;
        this.mqttClient.onrtcdisconnectedFromUser(this.target);
    }
}


class PromisefulMQTTRTCClient extends BaseMQTTRTCClient {
  constructor(name, userInfo, config){
    // initialize state tracking variables
    super(name, userInfo, config);
    Object.assign(this.rtcHandlers, this.extraRTCHandlers);
    for (let [k, v] of Object.entries(this.rtcHandlers)){
        this.rtcHandlers[k] = v.bind(this);
    }

    this.questionPromises = {};
    this.latestPings = {};
    this.questionNumber = 0;

    this.mqttConnected = new DeferredPromise();
    this.nextUserConnection = new DeferredPromise();
    this.nextUserDisconnectionPromises = {}
    this.nextDMPromises = {};
    this.nextChatPromises = {};
    this.nextQuestionPromises = {};
    this.nextAnswerPromises = {};
    this.nextPingPromises = {};
    this.nextPongPromises = {};
    this.nextMQTTMessagePromises = {};


    this.onConnectedToMQTT = this.onConnectedToMQTT.bind(this);
    this.sendRTCDM = this.sendRTCDM.bind(this);
    this.onRTCDM = this.onRTCDM.bind(this);
    this.sendRTCChat = this.sendRTCChat.bind(this);
    this.onRTCChat = this.onRTCChat.bind(this);
    this.onConnectedToUser = this.onConnectedToUser.bind(this);
    this.onDisconnectedFromUser = this.onDisconnectedFromUser.bind(this);
    this.sendRTCQuestion = this.sendRTCQuestion.bind(this);
    this.onRTCQuestion = this.onRTCQuestion.bind(this);
    this.respondToQuestion = this.respondToQuestion.bind(this);
    this.onRTCAnswer = this.onRTCAnswer.bind(this);
    this.pingEveryone = this.pingEveryone.bind(this);
    this.ping = this.ping.bind(this);
    this.receivedPing = this.receivedPing.bind(this);
    this.receivedPong = this.receivedPong.bind(this);

    this.nextUserDisconnection = this.nextUserDisconnection.bind(this);
    this.nextMQTTMessage = this.nextMQTTMessage.bind(this);
    this.nextAnswer = this.nextAnswer.bind(this);
    this.nextQuestion = this.nextQuestion.bind(this);
    this.nextChat = this.nextChat.bind(this);
    this.nextDM = this.nextDM.bind(this);
    this.nextPing = this.nextPing.bind(this);
    this.nextPong = this.nextPong.bind(this);



  }

  extraRTCHandlers = {
    dm: (data, sender) => {
        this.onRTCDM(data, sender);
        if (this.nextDMPromises["anyone"]){
            this.nextDMPromises["anyone"].resolve([data, sender]);
            delete this.nextDMPromises["anyone"];
        }
        if (this.nextDMPromises[sender]){
            this.nextDMPromises[sender].resolve(data);
            delete this.nextDMPromises[sender];
        }
    },
    chat: (data, sender) => {
        this.onRTCChat(data, sender);
        if (this.nextChatPromises["anyone"]){
            this.nextChatPromises["anyone"].resolve([data, sender]);
            delete this.nextChatPromises["anyone"];
        }
        if (this.nextChatPromises[sender]){
            this.nextChatPromises[sender].resolve(data);
            delete this.nextChatPromises[sender];
        }
    },
    question: (data, sender) => {
        this.onRTCQuestion(data, sender);
        if (this.nextQuestionPromises["anyone"]){
            this.nextQuestionPromises["anyone"].resolve([data, sender]);
            delete this.nextQuestionPromises["anyone"];
        }
        if (this.nextQuestionPromises[sender]){
            this.nextQuestionPromises[sender].resolve(data);
            delete this.nextQuestionPromises[sender];
        }

    },
    answer: (data, sender) => {
        this.onRTCAnswer(data, sender);
        if (this.nextAnswerPromises["anyone"]){
            this.nextAnswerPromises["anyone"].resolve([data, sender]);
            delete this.nextAnswerPromises["anyone"];
        }
        if (this.nextAnswerPromises[sender]){
            this.nextAnswerPromises[sender].resolve(data);
            delete this.nextAnswerPromises[sender];
        }
    },
    ping: (data, sender) => {
        this.sendOverRTC("pong", null, sender);
        this.receivedPing(sender);
        if (this.nextPingPromises["anyone"]){
            this.nextPingPromises["anyone"].resolve([data, sender]);
            delete this.nextPingPromises["anyone"];
        }
        if (this.nextPingPromises[sender]){
            this.nextPingPromises[sender].resolve(data);
            delete this.nextPingPromises[sender];
        }
    },
    pong: (data, sender) => {
        this.latestPings[sender].resolve();
        this.receivedPong(sender);
        if (this.nextPongPromises["anyone"]){
            this.nextPongPromises["anyone"].resolve([data, sender]);
            delete this.nextPongPromises["anyone"];
        }
        if (this.nextPongPromises[sender]){
            this.nextPongPromises[sender].resolve(data);
            delete this.nextPongPromises[sender];
        }
    }
  }

  onConnectedToMQTT(){
    this.mqttConnected.resolve();
    console.log("Connected to MQTT");
  }
  postPubliclyToMQTTServer(subtopic, data){
    super.postPubliclyToMQTTServer(subtopic, data);
  }
  onMQTTMessage(subtopic, data, sender, timestamp){
    console.log("Received message from " + sender + " on " + subtopic, data);
    if (this.nextMQTTMessagePromises["anysubtopic"]){
        this.nextMQTTMessagePromises["anysubtopic"].resolve([data, sender, timestamp]);
        delete this.nextMQTTMessagePromises["anysubtopic"];
    }
    if (this.nextMQTTMessagePromises[subtopic]){
        this.nextMQTTMessagePromises[subtopic].resolve([data, sender, timestamp]);
        delete this.nextMQTTMessagePromises[subtopic];
    }
  }

 //__________________________________________________ RTC ______________________________________________________________
  onConnectedToUser(user){
    console.log("Connected to user ", user, this.connectedUsers, this.rtcConnections);
    this.nextUserConnection.resolve(user);
    this.nextUserConnection = new DeferredPromise();
  }
  onDisconnectedFromUser(user){
    console.log("Disconnected from user ", user);
    this.nextUserDisconnection.resolve(user);
    if (this.nextUserDisconnectionPromises["anyone"]){
        this.nextUserDisconnectionPromises["anyone"].resolve(user);
        delete this.nextUserDisconnectionPromises["anyone"];
    }
    if (this.nextUserDisconnectionPromises[user]){
        this.nextUserDisconnectionPromises[user].resolve(user);
        delete this.nextUserDisconnectionPromises[user];
    }
  }

  sendRTCDM(message, target){
    this.sendOverRTC("dm", message, target);
  }
  onRTCDM(message, sender){
    console.log("Received DM from " + sender, message);
  }
  nextDM(target='anyone'){
    this.nextDMPromises[target] = new DeferredPromise();
    return this.nextDMPromises[target].promise;
  }
  nextChat(target='anyone'){
    this.nextChatPromises[target] = new DeferredPromise();
    return this.nextChatPromises[target].promise;
  }
  nextQuestion(target='anyone'){
    this.nextQuestionPromises[target] = new DeferredPromise();
    return this.nextQuestionPromises[target].promise;
  }
    nextAnswer(target='anyone'){
        this.nextAnswerPromises[target] = new DeferredPromise();
        return this.nextAnswerPromises[target].promise;
    }
    nextPing(target='anyone'){
        this.nextPingPromises[target] = new DeferredPromise();
        return this.nextPingPromises[target].promise;
    }
    nextPong(target='anyone'){
        this.nextPongPromises[target] = new DeferredPromise();
        return this.nextPongPromises[target].promise;
    }
    nextUserDisconnection(target='anyone'){
        this.nextUserDisconnectionPromises[target] = new DeferredPromise();
        return this.nextUserDisconnectionPromises[target].promise;
    }
    nextMQTTMessage(subtopic='anysubtopic'){
        this.nextMQTTMessagePromises[subtopic] = new DeferredPromise();
        return this.nextMQTTMessagePromises[subtopic].promise;
    }


  sendRTCChat(message){
    this.sendOverRTC("chat", message);
  }
  onRTCChat(message, sender){
    console.log("Received chat from " + sender, message);
  }
  sendRTCQuestion(question, target){
    let n = this.questionNumber;
    this.questionNumber++;
    let p = new DeferredPromise();
    this.questionPromises[n] = p;
    let data = {n, question};
    this.sendOverRTC("question", data, target);
    return p.promise;
  }
  onRTCQuestion(data, sender){
    let {n, question} = data;
    console.log("Received question from " + sender, data);
    let answer = this.respondToQuestion(question, sender);
    this.sendOverRTC("answer", {n, answer, question}, sender);
  }
  respondToQuestion(question, sender){
    return "I don't know."
  }
  onRTCAnswer(data, sender){
    let {n, answer} = data;
    if (this.questionPromises[n]){
        this.questionPromises[n].resolve(answer);
        delete this.questionPromises[n];
    }else{
        console.warn("No promise found for question " + n);
    }
  }
  pingEveryone(){
    this.latestPings = {};
    for (let user of this.connectedUsers){
        this.ping(user);
    }
    return Promise.all(Object.values(this.latestPings).map((p) => p.promise));
  }
  ping(user){
    this.latestPings[user] = new DeferredPromise();
    this.sendOverRTC("ping", "ping", users);
    return this.latestPings[user].promise;
  }
  receivedPing(sender){
    console.log("Received ping from " + sender);
  }
  receivedPong(sender){
    console.log("Received pong from " + sender);
  }

}

class MQTTRTCClient extends PromisefulMQTTRTCClient {
    constructor(name, userInfo, config){
        // this.knownUsers = {name: userInfo, ...} of all users, even those we're not connected to
        // this.rtcConnections = {name: rtcConnection, ...} of active connections
        // this.connectedUsers = [name, ...] of all users we're connected to

        super(name, userInfo, config);

    }
    on(rtcevent, handler){
        if (rtcevent === "connectionrequest"){
            this.shouldConnectToUser = handler.bind(this);
        }else if(rtcevent === "connectedtopeer"){
            this.onConnectedToUser = handler.bind(this);
        }else if (rtcevent === "disconnectedfrompeer"){
            this.onDisconnectedFromUser = handler.bind(this);
        }else if (rtcevent === "namechange"){
            this.onNameChange = handler.bind(this);
        }else if (rtcevent === "dm"){
            this.onRTCDM = handler.bind(this);
        }else if (rtcevent === "chat"){
            this.onRTCChat = handler.bind(this);
        }else if (rtcevent === "question"){
            this.respondToQuestion = handler.bind(this);
        }else if (rtcevent === "answer"){
            this.onRTCAnswer = handler.bind(this);
        }else if (rtcevent === "ping"){
            this.receivedPing = handler.bind(this);
        }else if (rtcevent === "mqtt"){
            this.onMQTTMessage = handler.bind(this);
        }
    }

    shouldConnectToUser(user, userInfo){
        return super.shouldConnectToUser(user, userInfo);
      }

    changeName(newName){
        super.changeName(newName);
    }
    onNameChange(oldName, newName){
        super.onNameChange(oldName, newName);
    }

    onConnectedToMQTT(){console.log("Connected to MQTT");}
    onConnectedToUser(user){console.log("Connected to user ", user);}
    onDisconnectedFromUser(user){console.log("Disconnected from user ", user);}

    onRTCDM(data, sender){console.log("Received DM from " + sender, data);}
    onRTCChat(data, sender){console.log("Received chat from " + sender, data);}
    respondToQuestion(question, sender){return "I don't know";}

    pingEveryone(){
        let start = Date.now();
        return super.pingEveryone().then(() => {
            console.log("Pinged everyone in " + (Date.now() - start) + "ms");
        });
    }
    ping(user){
        // time the ping
        let start = Date.now();
        return super.ping(user).then(() => {
            console.log("Pinged " + user + " in " + (Date.now() - start) + "ms");
        });
    }
    receivedPing(sender){console.log("Received ping from " + sender);}

    // nextUserConnection is a promise that resolves when the client connects to a new user
    get nextDMPromise() {return this.nextDM();}
    get nextChatPromise() {return this.nextChat();}
    get nextQuestionPromise() {return this.nextQuestion();}
    get nextAnswerPromise() {return this.nextAnswer();}
    get nextPingPromise() {return this.nextPing();}
    get nextPongPromise() {return this.nextPong();}
    get nextUserDisconnectionPromise() {return this.nextUserDisconnection();}

    get connectedUsers(){
        return this.connectionsToUsers();
    }

    disconnectFromUser(user){
        super.disconnectFromUser(user);
        return this.nextUserDisconnection(user);
    }

    getPeer(user){
        return new Peer(this, user);
    }
    get peers(){
        return Object.fromEntries(Object.entries(this.connectedUsers).map(name => [name, new Peer(this, name)]));
    }
    get peerList(){
        return Object.values(this.peers);
    }
}

class Peer{
    constructor(mqttclient, name){
        this.mqttClient = mqttclient;
        this.target = name;
    }
    dm(message){
        return this.mqttClient.sendRTCDM(message, this.target);
    }
    chat(message){
        return this.mqttClient.sendRTCChat(message);
    }
    ask(question){
        return this.mqttClient.sendRTCQuestion(question, this.target);
    }
    ping(){
        return this.mqttClient.ping(this.target);
    }

}


//____________________________________________________________________________________________________________________
export {MQTTRTCClient, DeferredPromise, tabID, defaultConfig, existingTabs};