// _____________________________________________ tab ID _______________________________________________________________

// find the id of all the tabs open
let existingTabs = JSON.parse(localStorage.getItem('tabs') || '[]');

console.log("Existing tabs initial load: ", existingTabs);
let timeNow = Date.now();
for (let existingTabID of existingTabs){
    let ts = localStorage.getItem("tabpoll_" + existingTabID);
    if (ts){
        let lastUpdateTime = new Date(1 * ts);
        if ((lastUpdateTime == "Invalid Date") || ((timeNow - lastUpdateTime) > 300)){
            console.log("removing tab", existingTabID, lastUpdateTime, (timeNow - lastUpdateTime))
            localStorage.removeItem("tabpoll_" + existingTabID);
            existingTabs = existingTabs.filter(v=>v!==existingTabID);
            localStorage.setItem('tabs', JSON.stringify(existingTabs));
        }
    }else{
        console.warn("No timestamp found for tab " + existingTabID);
        localStorage.removeItem("tabpoll_" + existingTabID);
        existingTabs = existingTabs.filter(v=>v!==existingTabID);
        localStorage.setItem('tabs', JSON.stringify(existingTabs));
    }
}
existingTabs = JSON.parse(localStorage.getItem('tabs') || '[]');

console.log("Existing tabs filtered: ", existingTabs);

let maxTabID = existingTabs.length?(Math.max(...existingTabs)):-1;
let minTabID = existingTabs.length?(Math.min(...existingTabs)):-1;
let tabID = (minTabID<10)?(maxTabID + 1):0;
existingTabs.push(tabID);
localStorage.setItem('tabs', JSON.stringify(existingTabs));


localStorage.setItem("tabpoll_" + tabID, Date.now().toString());
let tabInterval = setInterval(() => {
    localStorage.setItem("tabpoll_" + tabID, Date.now().toString());
}, 250);
console.log("Tab ID: ", tabID);

// When the tab is closed or reloaded, decrement the count and notify other tabs
//window.addEventListener('beforeunload', function () {
//  console.log("beforeunload of tab " + tabID);
//  clearInterval(tabInterval);
//  localStorage.setItem('tabs', JSON.stringify(JSON.parse(localStorage.getItem('tabs') || '[]').filter(v=>v!==tabID)));
//});
//___________________________________________________________________________________________________________________

// automatically load the MQTT library
let script = document.createElement('script');
script.src = "https://unpkg.com/mqtt/dist/mqtt.min.js";
document.head.appendChild(script);

let lz = true;
if (lz){
    let lzStringScript = document.createElement('script');
    lzStringScript.src = "https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js";
    document.head.appendChild(lzStringScript);
}




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
    baseTopic: "mrtchat",
    topic: (["localhost", "127.0.0.1", "modularizer.github.io"].includes(location.hostname)?"":location.hostname) + location.pathname.replace("rtchat/","").replace("index.html", "").replace(".html", "").replace(/[^a-zA-Z0-9]/g, "") + location.hash.replace("#", "").replace(/[^a-zA-Z0-9]/g, ""),
    name: name,
}


//______________________________________________________________________________________________________________________



class BaseMQTTRTCClient {
  constructor({name, userInfo, config, load}){
    // specify a tabID to allow multiple tabs to be open at once
    if (load === undefined){
        load = true;
    }

    name = name || defaultConfig.name
    if (name.includes("(") || name.includes(")") || name.includes("|")){
        throw new Error("Name cannot contain (, ), or |")
    }
    if (name != name.trim()){
        throw new Error("Name cannot have leading or trailing spaces")
    }
    if (!name.startsWith("anon")){
        // save the name to local storage to persist it
        localStorage.setItem("name", name);
    }
    this.name = name + (tabID?('(' + tabID + ')'):''); // add the tab ID to the name
    this.userInfo = userInfo || {};

    let {baseTopic, topic, broker, stunServer} = config || {};

    console.log("Config: ", config, topic);


    this.mqttBroker = broker || defaultConfig.broker;
    this.stunServer = stunServer || defaultConfig.stunServer;
    this.baseTopic = baseTopic || defaultConfig.baseTopic;
    this.topic = this.baseTopic + (topic || defaultConfig.topic);

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
    this.callUser = this.callUser.bind(this);
    this.callFromUser = this.callFromUser.bind(this);
    this.acceptCallFromUser = this.acceptCallFromUser.bind(this);
    this.oncallconnected = this.oncallconnected.bind(this);

    this.sendOverRTC = this.sendOverRTC.bind(this);
    this.onrtcmessage = this.onrtcmessage.bind(this);
    this.onrtcerror = this.onrtcerror.bind(this);

    // initialize state tracking variables
    this.rtcConnections = {};
    this.knownUsers = {};

    // load the MQTT client
    if (load){
        this.load();
    }
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
    this.client = mqtt.connect(this.mqttBroker, {clientId: this.baseTopic + this.name});
    this.client.on('connect', this._onMQTTConnect.bind(this));
    this.client.on('message', this._onMQTTMessage.bind(this));
    window.addEventListener("beforeunload", this.beforeunload.bind(this));
  }
  _onMQTTConnect(){
    this.client.subscribe(this.topic);
    this.postPubliclyToMQTTServer("c", this.userInfo);
    this.onConnectedToMQTT();
  }
    onConnectedToMQTT(){
        console.log("Connected to MQTT: " + this.topic + " as " + this.name);
    }
  _onMQTTMessage(t, payloadString){
        if (t === this.topic){
            let payload;
            try{
                let d = LZString.decompressFromUint8Array(payloadString);
                payload = JSON.parse(d);
            }catch(e){
                payload = JSON.parse(payloadString)
            }
            payload = {
                sender: payload.s,
                timestamp: payload.n,
                subtopic: payload.t,
                data: payload.d
            }
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
    this.postPubliclyToMQTTServer("bu", "disconnecting");
  }
  postPubliclyToMQTTServer(subtopic, data){
    let payload = {
        s: this.name,
        n: Date.now(),
        t: subtopic,
        d: data || message
    }
    let payloadString = JSON.stringify(payload);
    let originalLength = payloadString.length;
    if (window.LZString){
        let compressed = LZString.compressToUint8Array(payloadString);
        payloadString = compressed;
    }
    console.log("Sending message to " + this.topic + " on " + subtopic, data);
    this.client.publish(this.topic, payloadString);
  }

  //____________________________________________________________________________________________________________________
  mqttHandlers = {
    c: payload => {//connection
        console.log("Received notice that someone else connected:" + payload.sender, payload, payload.data);
        this.knownUsers[payload.sender] = payload.data;
        this.shouldConnectToUser(payload.sender, payload.data).then(r => {
            if (r){
                this.connectToUser(payload.sender);
            }
        })
    },
    nc: payload => {//name
        this.recordNameChange(data.oldName, data.newName);
    },
    bu: payload => {
        this.disconnectFromUser(payload.sender);
        delete this.knownUsers[payload.sender];
    },
    ro: payload => {//rtc offer
        console.log("received RTCoffer", payload);
        this.shouldConnectToUser(payload.sender, payload.data.userInfo).then(r => {
            if (r){
                let {o, t} = payload.data.offer;
                if (t != this.name){return};
                if (this.rtcConnections[payload.sender]){
                    console.warn("Already have a connection to " + payload.sender + ". Closing and reopening.")
                    this.rtcConnections[payload.sender].close();
                }
                this.rtcConnections[payload.sender] = new RTCConnection(this, payload.sender);
                this.rtcConnections[payload.sender].respondToOffer(o);
            }else{
                console.warn("Not connecting to " + payload.sender);
                // TODO: actually reject offer
            }
        });

    },
    ra: payload => {//rtc answer
        console.log("received RTCanswer", payload);
        let {a, t} = payload.data;
        if (t != this.name){return};
        let rtcConnection = this.rtcConnections[payload.sender]; // Using the correct connection
        if (!rtcConnection){
            console.error("No connection found for " + payload.sender);
            return
        }
        rtcConnection.receiveAnswer(a);
    },
    ri: payload => {//rtc ice candidate
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

  callUser(user, callInfo){
    let callStartPromise;
    if (callInfo instanceof MediaStream){
        let localStream = callInfo;
        callStartPromise = this.rtcConnections[user].startCall(localStream).then(remoteStream => {
            return {localStream, remoteStream};
        })
    }else{
        callInfo = callInfo || {video: true, audio: true}
        callStartPromise = navigator.mediaDevices.getUserMedia(callInfo).then(localStream => {
            return this.rtcConnections[user].startCall(localStream).then(remoteStream => {
                return {localStream, remoteStream};
            });
        });
    }
    let callEndPromise = this.rtcConnections[user].callEndPromise.promise;
    return {start: callStartPromise, end: callEndPromise};
  }
  endCallWithUser(user){
    console.log("Ending call with " + user);
    this.rtcConnections[user].endCall();
  }
  callFromUser(user, callInfo, initiatedCall, promises){
    callInfo = callInfo || {video: true, audio: true}
    if (initiatedCall){
        return navigator.mediaDevices.getUserMedia(callInfo)
    }else{
        return this.acceptCallFromUser(user, callInfo, promises).then(r=> {
            if (r){
                return navigator.mediaDevices.getUserMedia(callInfo)
            }else{
                return Promise.reject("Call rejected");
            }
        })
    }
  }
  oncallended(user){
    console.log("Call ended with " + user);
  }
  acceptCallFromUser(user, callInfo, promises){
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
        if (!this.verifyUser(channel, data, user)){
            console.warn("Not connected to " + user);
            continue;
        }else{
            this.rtcConnections[user].send(channel, serializedData);
        }
    }
  }
  verifyUser(channel, data, user){
    return true;
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

        this.startCall = this.startCall.bind(this);
        this.onTrack = this.onTrack.bind(this);
        this.sentOffer = false;

        this.streamChannels = ["streamice", "streamoffer", "streamanswer", "endcall"];

        this.dataChannelDeferredPromises = Object.fromEntries(Object.entries(mqttClient.rtcHandlers).map(([name, handler]) => [name, new DeferredPromise()]));
        this.streamChannels.forEach(channel => this.dataChannelDeferredPromises[channel] = new DeferredPromise());

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

        this.streamConnection = null;
        this.remoteStream = null;
        this.localStream = null;
        this.sendstreamice = false;
        this.initiatedCall = false;
        this.streamConnectionPromise = new DeferredPromise();
        this.streamPromise = new DeferredPromise();
        this.callEndPromise = new DeferredPromise();
        this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};
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
        this.streamChannels.forEach(channel => {
            let dataChannel = this.peerConnection.createDataChannel(channel);
            this.registerDataChannel(dataChannel);
        });
    }

    startCall(stream){
        this.initiatedCall = true;
        let streamInfo = {video: true, audio: true};//TODO: read from stream
        this.streamConnection = this._makeStreamConnection(stream);

        this.streamConnection.createOffer()
            .then(offer => this.streamConnection.setLocalDescription(offer))
            .then(() => {
                // Send offer via MQTT
                this.send("streamoffer", JSON.stringify({"offer": this.streamConnection.localDescription, "streamInfo": streamInfo}));
            });

         this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};

        return this.streamPromise.promise;
    }
    _makeStreamConnection(stream){
        if (this.streamConnection){
            console.warn("Already have a stream connection");
            return;
        }
        this.localStream = stream
        this.streamConnection = new RTCPeerConnection(this.rtcConfiguration);

        stream.getTracks().forEach(track => this.streamConnection.addTrack(track, stream));

        this.streamConnection.onicecandidate = this.onstreamicecandidate.bind(this);
        this.streamConnection.ontrack = this.onTrack;
        this.streamConnectionPromise.resolve(this.streamConnection);
        this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};
        return this.streamConnection;
    }
    onTrack(event){
        console.warn("Track event", event);
        this.remoteStream = event.streams[0];
        let d = {
            localStream: this.localStream,
            remoteStream: this.remoteStream
        }
        this.streamPromise.resolve(d);
        this.mqttClient.oncallconnected(this.target, d);
    }
    sendOffer(){
        this.setupDataChannels();
        this.peerConnection.createOffer()
          .then(offer => this.peerConnection.setLocalDescription(offer))
          .then(() => {
            // Send offer via MQTT
            console.log("Sending offer to " + this.target);
            this.mqttClient.postPubliclyToMQTTServer("ro", {userInfo: this.mqttClient.userInfo, offer: {"o": this.peerConnection.localDescription, "t": this.target}});
          });
        this.sentOffer = true;
    }
    respondToOffer(offer){
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
              .then(() => this.peerConnection.createAnswer())
              .then(answer => this.peerConnection.setLocalDescription(answer))
              .then((answer) => {
                // Send answer via MQTT
                this.mqttClient.postPubliclyToMQTTServer("ra", {
                    "a": this.peerConnection.localDescription,
                    "t": this.target,
                });
              });
    }
    receiveAnswer(answer){
        if (this.peerConnection.signalingState !== 'have-local-offer') {
            console.warn("Wrong state " + this.peerConnection.signalingState);
            return;
        }
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        this.loadPromise.then((() => this.send("connectedViaRTC", null)).bind(this));
        this.mqttClient.onConnectedToUser(this.target);
    }
    send(channel, serializedData){
        let dataChannel = this.dataChannels[channel];
        if (!dataChannel){
            if (this.mqttClient.rtcHandlers[channel]){
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
        if (channel === "streamoffer"){
            console.log("received stream offer", event.data)
            let {offer, streamInfo} = JSON.parse(event.data);
            this.getCall().then(streamConnection => {
                streamConnection.setRemoteDescription(new RTCSessionDescription(offer))
                    .then(() => this.streamConnection.createAnswer())
                    .then(answer => this.streamConnection.setLocalDescription(answer))
                    .then(() => {
                        // Send answer via MQTT
                        console.log("Sending stream answer", this.streamConnection.localDescription);
                        this.send("streamanswer", JSON.stringify({"answer": this.streamConnection.localDescription}));
                    });
            });

        }else if (channel === "streamanswer"){
            console.log("received stream answer", event.data)
            let {answer} = JSON.parse(event.data);
            this.streamConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }else if (channel === "streamice"){
            console.log("received stream ice", event.data)
            this.getCall().then(streamConnection => {
                streamConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(event.data)));
            });
        }else if (channel === "endcall"){
            this._closeCall();
        }else{
            this.mqttClient.onrtcmessage(channel, event.data, this.target);
        }
    }

    getCall(){
        console.log("Getting call", this.streamConnection, this.streamConnectionPromise);
        if (this.streamConnection){
            return Promise.resolve(this.streamConnection);
        }
        if (this.callRinging){
            return this.streamConnectionPromise.promise;
        }
        this.callRinging = true;
        return this.mqttClient.callFromUser(this.target, {video: true, audio: true}, this.initiatedCall, this.callPromises).then(stream => {
                if (!this.streamConnection){
                    this.streamConnection = this._makeStreamConnection(stream);
                }
                return this.streamConnection;
            }).catch(e => {
                this.streamConnectionPromise.reject(e);
                this.streamPromise.reject(e);
            });
    }
    endCall(){
        this.send("endcall", null);
        this._closeCall();
    }
    _closeCall(){
        if (this.streamConnection){
            this.streamConnection.close();
            this.localStream.getTracks().forEach(track => track.stop());
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
            this.localStream = null;
        }
        this.callEndPromise.resolve();
        this.callEndPromise = new DeferredPromise();
        this.callRinging = false;
        this.initiatedCall = false;
        this.streamConnection = null;
        this.sentstreamice = false;
        this.streamConnectionPromise = new DeferredPromise();
        this.streamPromise = new DeferredPromise();
        this.callEndPromise = new DeferredPromise();
        this.callPromises = {start: this.streamPromise.promise, end: this.callEndPromise.promise};

        this.mqttClient.oncallended(this.target);
    }

    onReceivedIceCandidate(data) {
        this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
    }

    onicecandidate(event){
        if (event.candidate) {
            // Send ICE candidate via MQTT
            this.mqttClient.postPubliclyToMQTTServer("ri", event.candidate);
        }
    }
    onstreamicecandidate(event){
        if (event.candidate && !this.sentstreamice) {
            this.sentstreamice = true;
            // Send ICE candidate via RTC
            console.log("Sending stream ice", this, event.candidate);
            this.send("streamice", JSON.stringify(event.candidate));
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
    constructor({name, userInfo, questionHandlers, handlers, config, load}){
    if (load === undefined){
        load = true;
    }

    // initialize state tracking variables
    super({name, userInfo, config, load: false});

    Object.assign(this.rtcHandlers, this.extraRTCHandlers);
    Object.assign(this.rtcHandlers, handlers || {});
    for (let [k, v] of Object.entries(this.rtcHandlers)){
        this.rtcHandlers[k] = v.bind(this);
    }

    if (questionHandlers){
        this.questionHandlers = questionHandlers;
    }else if (!this.questionHandlers){
        this.questionHandlers = {};
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

    this.addQuestionHandler = this.addQuestionHandler.bind(this);

    if (load){
        this.load();
    }
  }
  addQuestionHandler(name, handler){
        this.questionHandlers[name] = handler;
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
    },
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
  sendRTCQuestion(topic, content, target){
    let question = {topic, content};
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
    if (answer instanceof Promise){
        answer.then((a) => {
            this.sendOverRTC("answer", {n, answer: a, question}, sender);
        });
    }else{
        this.sendOverRTC("answer", {n, answer, question}, sender);
    }
  }
  respondToQuestion(question, sender){
    let {topic, content} = question;
    if (this.questionHandlers[topic]){
        return this.questionHandlers[topic](content, sender);
    }else{
        console.warn("No handler found for question " + topic);
        throw new Error("No handler found for question " + topic);
    }
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
    constructor({name, userInfo, questionHandlers, handlers, config, load}){
        // this.knownUsers = {name: userInfo, ...} of all users, even those we're not connected to
        // this.rtcConnections = {name: rtcConnection, ...} of active connections
        // this.connectedUsers = [name, ...] of all users we're connected to
        if (load === undefined){
            load = true;
        }

        super({name, userInfo, questionHandlers, config, load: false});
        this.onConnectedCallbacks = [];
        this.onDisconnectedCallbacks = [];
        this.onNameChangeCallbacks = [];
        this.onDMCallbacks = [];
        this.onChatCallbacks = [];
        this.receivePingCallbacks = [];
        this.onRTCQuestionCallbacks = [];
        this.onRTCAnswerCallbacks = [];
        this.onMQTTMessageCallbacks = [];
        this.onCallConnectedCallbacks = [];

        if (load){
            this.load();
        }

    }
    on(rtcevent, handler){
        if (rtcevent === "connectionrequest"){
            this.shouldConnectToUser = handler.bind(this);
        }else if(rtcevent === "connectedtopeer"){
            this.onConnectedCallbacks.push(handler.bind(this));
        }else if (rtcevent === "disconnectedfrompeer"){
            this.onDisconnectedCallbacks.push(handler.bind(this));
        }else if (rtcevent === "namechange"){
            this.onNameChangeCallbacks.push(handler.bind(this));
        }else if (rtcevent === "dm"){
            this.onDMCallbacks.push(handler.bind(this));
        }else if (rtcevent === "chat"){
            this.onChatCallbacks.push(handler.bind(this));
        }else if (rtcevent === "question"){
//            this.respondToQuestion = handler.bind(this);
        }else if (rtcevent === "answer"){
            this.onRTCAnswerCallbacks.push(handler.bind(this));
        }else if (rtcevent === "ping"){
            this.receivedPingCallbacks.push(handler.bind(this));
        }else if (rtcevent === "mqtt"){
            this.onMQTTMessageCallbacks.push(handler.bind(this));
        }else if (rtcevent === "callconnected"){
            this.onCallConnectedCallbacks.push(handler.bind(this));
        }else if (rtcevent === "call"){
            this.acceptCallFromUser = handler.bind(this);
        }else if (rtcevent === "callended"){
            this.oncallended = handler.bind(this);
        }else{
            this.addQuestionHandler(rtcevent, handler);
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
    onConnectedToUser(user){
        console.log("Connected to user ", user);
        this.onConnectedCallbacks.forEach(h => h(user));
    }
    onDisconnectedFromUser(user){
        console.log("Disconnected from user ", user);
        this.onDisconnectedCallbacks.forEach(h => h(user));
    }
    onRTCDM(data, sender){
        console.log("Received DM from " + sender, data);
        this.onDMCallbacks.forEach(h => h(data, sender));
    }
    onRTCChat(data, sender){
        console.log("Received chat from " + sender, data);
        this.onChatCallbacks.forEach(h => h(data, sender));
    }
    addQuestionHandler(name, handler){
        super.addQuestionHandler(name, handler);
    }
    oncallconnected(sender, {localStream, remoteStream}){
        console.warn("call connected", sender, localStream, remoteStream);
        this.onCallConnectedCallbacks.forEach(h => h(sender, {localStream, remoteStream}));
    }

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
    receivedPing(sender){
        console.log("Received ping from " + sender);
        this.receivedPingCallbacks.forEach(h => h(sender));
    }

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
    send(data, channel = 'chat', users){
        return super.sendOverRTC(channel, data, users);
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