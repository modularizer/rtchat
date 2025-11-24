/**
 * MQTT-RTC Client Library - Core peer-to-peer communication system
 * 
 * This module provides a complete implementation for establishing peer-to-peer connections
 * using MQTT for signaling and WebRTC for direct communication. It handles connection
 * management, data channels, video/audio calls, and message passing.
 * 
 * Architecture:
 * - BaseMQTTRTCClient: Base class with MQTT and WebRTC connection logic
 * - PromisefulMQTTRTCClient: Adds promise-based APIs for async operations
 * - MQTTRTCClient: High-level client with event callbacks and peer management
 * - RTCConnection: Manages individual WebRTC peer connections
 * - Peer: Convenience wrapper for interacting with a specific peer
 * 
 * Usage:
 *   import { MQTTRTCClient } from './mqtt-rtc.js';
 *   
 *   const client = new MQTTRTCClient({
 *     name: 'MyName',
 *     topic: 'myroom',
 *     broker: 'wss://broker.example.com',
 *     stunServer: 'stun:stun.example.com:19302'
 *   });
 * 
 *   client.on('connectedtopeer', (user) => {
 *     console.log('Connected to', user);
 *   });
 * 
 *   client.on('chat', (message, sender) => {
 *     console.log(`${sender}: ${message}`);
 *   });
 * 
 *   // Send a message to all connected peers
 *   client.sendRTCChat('Hello everyone!');
 * 
 *   // Get a peer object for direct interaction
 *   const peer = client.getPeer('OtherUser');
 *   peer.dm('Private message');
 *   peer.ask('What is 2+2?').then(answer => console.log(answer));
 * 
 * Features:
 * - Automatic connection establishment via MQTT signaling
 * - WebRTC data channels for messaging
 * - Video/audio calling support
 * - Question/answer system for RPC-like communication
 * - Ping/pong for connection health checks
 * - Tab ID management for multiple tabs
 * - Message compression using LZ-String
 * - Connection history tracking
 * 
 * Configuration:
 * - broker: MQTT broker URL (default: public cloud.shiftr.io)
 * - stunServer: STUN server for NAT traversal (default: Google STUN)
 * - baseTopic: Base MQTT topic prefix (default: 'mrtchat')
 * - topic: Room/channel identifier (auto-derived from URL by default)
 * - name: User identifier (auto-generated if not provided)
 * 
 * @module mqtt-rtc
 */

// Import new refactored modules
import { RTCConfig } from '../config/rtc-config.js';
import { LocalStorageAdapter } from '../storage/local-storage-adapter.js';
import { TabManager } from './tab-manager.js';
import { MQTTLoader } from './mqtt-loader.js';
import { EventEmitter } from '../utils/event-emitter.js';
import { DeferredPromise } from '../utils/deferred-promise.js';



//______________________________________________________________________________________________________________________



// EventEmitter is now imported above

class BaseMQTTRTCClient extends EventEmitter {
  constructor(userConfig){
    super(); // Initialize EventEmitter
    userConfig = userConfig || {};
    
    // Use RTCConfig system (always available now)
    const config = userConfig instanceof RTCConfig ? userConfig : new RTCConfig(userConfig);
    const configObj = config.getConfig();
    
    // Initialize storage adapter
    const storage = userConfig.storage || new LocalStorageAdapter();
    
    // Initialize tab manager
    let tabManager = null;
    if (configObj.tabs.enabled) {
      tabManager = new TabManager(storage, configObj);
    }
    
    // Initialize MQTT loader
    const mqttLoader = new MQTTLoader(configObj);
    
    // Set properties from config
    const tabIDValue = tabManager ? tabManager.getTabID() : null;
    this.name = configObj.name + (tabIDValue ? ('(' + tabIDValue + ')') : '');
    this.userInfo = configObj.userInfo || {};
    this.mqttBroker = configObj.mqtt.broker;
    this.iceServers = configObj.webrtc.iceServers;
    this.baseTopic = configObj.topic.base;
    this.topic = config.topic;
    this.config = config;
    this.storage = storage;
    this.tabManager = tabManager;
    this.mqttLoader = mqttLoader;
    this.maxHistoryLength = configObj.history.maxLength;
    
    // Save name to storage if not anonymous
    if (!configObj.name.startsWith("anon") && !configObj.name.startsWith("User #")) {
      storage.setItem("name", configObj.name);
      storage.setItem("rtchat_name", configObj.name);
    }
    
    // Load flag
    const load = userConfig.load !== false;

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
    this.isConnectedToUser = this.isConnectedToUser.bind(this);

    this.sendOverRTC = this.sendOverRTC.bind(this);
    this.onrtcmessage = this.onrtcmessage.bind(this);
    this.onrtcerror = this.onrtcerror.bind(this);

    // initialize state tracking variables
    this.rtcConnections = {};
    this.knownUsers = {};
    this.pendingIceCandidates = {};


    this.mqttHistory = [];
    this.announceInterval = null; // For periodic announcements

    // load the MQTT client
    if (load){
        this.load();
    }
    
    // Optional window.rtc assignment (can be disabled via config)
    const assignToWindow = userConfig.assignToWindow !== false;
    
    if (assignToWindow && typeof window !== 'undefined') {
      if (window.rtc){
        let old = window.rtc;
        console.warn("RTC already exists. Saving old RTC object to window.rtc.old,", old);
        let oldName = old.name;
        window.rtc = {
            oldName: old,
            name: this
        }
      }else{
        window.rtc = this;
      }
    }
  }
  //________________________________________________________ MQTT BASICS _______________________________________________
  async load(){
    // Use MQTTLoader (always available now)
    await this.mqttLoader.load();
    const mqtt = this.mqttLoader.getMQTT();
    if (!mqtt) {
      throw new Error('MQTT library not available');
    }
    
    const configObj = this.config.getConfig();
    const clientId = configObj.mqtt?.clientId || (this.baseTopic + this.name);
    const mqttOptions = {
      clientId: clientId,
      username: configObj.mqtt.username,
      password: configObj.mqtt.password,
      reconnectPeriod: configObj.mqtt.reconnectPeriod,
      connectTimeout: configObj.mqtt.connectTimeout
    };
    
    this.client = mqtt.connect(this.mqttBroker, mqttOptions);
    this.client.on('connect', this._onMQTTConnect.bind(this));
    this.client.on('message', this._onMQTTMessage.bind(this));
    
    if (typeof window !== 'undefined') {
      window.addEventListener("beforeunload", this.beforeunload.bind(this));
    }
  }
  _onMQTTConnect(){
    this.client.subscribe(this.topic, ((err)=>{
    if (!err) {
        console.log("subscribed to ", this.topic);
        // Send initial connect message immediately after subscription is confirmed
        // This ensures we announce our presence as soon as we're ready to receive messages
        this.postPubliclyToMQTTServer("connect", this.userInfo);
        this.onConnectedToMQTT();
        
        // Also set up periodic announcements to catch any missed connections
        // This handles race conditions when two users connect simultaneously
        // Announce every 3 seconds for the first 15 seconds, then every 30 seconds
        // Only announce if we don't have active connections (to reduce noise)
        let announcementCount = 0;
        this.announceInterval = setInterval(() => {
          // Only send periodic announcements if we have no active connections
          // This reduces unnecessary connect messages when already connected
          const hasActiveConnections = Object.keys(this.rtcConnections).some(user => {
            const conn = this.rtcConnections[user];
            return conn && conn.peerConnection.connectionState === "connected";
          });
          
          if (!hasActiveConnections || announcementCount < 5) {
            this.postPubliclyToMQTTServer("connect", this.userInfo);
          }
          
          announcementCount++;
          // After 5 announcements (15 seconds), switch to less frequent announcements
          if (announcementCount >= 5 && this.announceInterval) {
            clearInterval(this.announceInterval);
            // Switch to less frequent announcements (every 30 seconds, only if no connections)
            this.announceInterval = setInterval(() => {
              const hasActiveConnections = Object.keys(this.rtcConnections).some(user => {
                const conn = this.rtcConnections[user];
                return conn && conn.peerConnection.connectionState === "connected";
              });
              if (!hasActiveConnections) {
                this.postPubliclyToMQTTServer("connect", this.userInfo);
              }
            }, 30000);
          }
        }, 3000);
    }else {
        console.error("Error subscribing to " + this.topic, err);
    }
    }).bind(this));


  }
    onConnectedToMQTT(){
        console.log("Connected to MQTT: " + this.topic + " as " + this.name);
        this.emit('mqttconnected', this.topic, this.name);
    }
  _onMQTTMessage(t, payloadString){
        if (t === this.topic){
            let payload;
            try{
                // Use MQTTLoader for decompression
                const decompressed = this.mqttLoader.decompress(payloadString);
                payload = typeof decompressed === 'string' ? JSON.parse(decompressed) : decompressed;
            }catch(e){
                // Fallback to uncompressed if decompression fails
                payload = JSON.parse(payloadString);
            }
            if (payload.sender === this.name){
                return;
            }
            let subtopic = payload.subtopic;
            payload.sent = false;
            payload.receiveTimestamp = Date.now();
            this.mqttHistory.push(payload);
            while (this.mqttHistory.length > this.maxHistoryLength){
                this.mqttHistory.shift();
            }
            console.log("Received MQTT message on " + this.topic  + " subtopic " + subtopic + " from " + payload.sender, payload.data);
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
    this.emit('mqttmessage', subtopic, data, sender, timestamp);
  }
  beforeunload(){
    this.postPubliclyToMQTTServer("unload", "disconnecting");
    
    // Cleanup tab manager if using new system
    if (this.tabManager) {
      this.tabManager.cleanup();
    }
  }
  
  disconnect(){
    // Cleanup connections
    for (let user of Object.keys(this.rtcConnections)) {
      this.disconnectFromUser(user);
    }
    
    // Stop periodic announcements
    if (this.announceInterval) {
      clearInterval(this.announceInterval);
      this.announceInterval = null;
    }
    
    // Cleanup MQTT client
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    
    // Cleanup tab manager
    if (this.tabManager) {
      this.tabManager.cleanup();
    }
  }
  postPubliclyToMQTTServer(subtopic, data){
    let payload = {
        sender: this.name,
        timestamp: Date.now(),
        subtopic: subtopic,
        data: data
    }
    let payloadString = JSON.stringify(payload);
    let originalLength = payloadString.length;
    
    // Use MQTTLoader's compression if available
    if (this.mqttLoader) {
      const compressed = this.mqttLoader.compress(payloadString);
      if (compressed !== payloadString) {
        payloadString = compressed;
      }
    }
    
    console.log("Sending message to " + this.topic + " subtopic " + subtopic, data);
    this.client.publish(this.topic, payloadString);
    payload.sent = true;
    this.mqttHistory.push(payload);
    while (this.mqttHistory.length > this.maxHistoryLength){
        this.mqttHistory.shift();
    }
  }

  //____________________________________________________________________________________________________________________
  mqttHandlers = {
    connect: payload => {//connection
        console.log("Received notice that someone else connected:" + payload.sender, payload, payload.data);
        
        // Check if we're already connected and the connection is healthy
        const existingConnection = this.rtcConnections[payload.sender];
        if (existingConnection) {
            const connectionState = existingConnection.peerConnection.connectionState;
            const iceConnectionState = existingConnection.peerConnection.iceConnectionState;
            
            // If connection is healthy, ignore this connect message (likely a periodic announcement)
            if (connectionState === "connected" && 
                (iceConnectionState === "connected" || iceConnectionState === "completed")) {
                console.log("Already connected to " + payload.sender + ", ignoring connect message");
                this.knownUsers[payload.sender] = payload.data; // Update user info
                return;
            }
            
            // Connection exists but is broken, disconnect it
            if (connectionState === "failed" || connectionState === "closed" ||
                iceConnectionState === "failed" || iceConnectionState === "closed") {
                console.warn("Connection to " + payload.sender + " is broken, disconnecting");
                this.disconnectFromUser(payload.sender);
            } else {
                // Connection is in progress (connecting, etc.), don't interfere
                console.log("Connection to " + payload.sender + " is in progress (" + connectionState + "), ignoring");
                this.knownUsers[payload.sender] = payload.data; // Update user info
                return;
            }
        }
        
        this.knownUsers[payload.sender] = payload.data;
        this.shouldConnectToUser(payload.sender, payload.data).then(r => {
            if (r){
                this.connectToUser(payload.sender);
            }
        })
    },
    nameChange: payload => {//name
        this.recordNameChange(payload.data.oldName, payload.data.newName);
    },
    unload: payload => {
        this.disconnectFromUser(payload.sender);
        delete this.knownUsers[payload.sender];
    },
    RTCOffer: payload => {//rtc offer
        this.shouldConnectToUser(payload.sender, payload.data.userInfo).then(r => {
            if (r){
                if (payload.data.offer.target != this.name){return};
                if (this.rtcConnections[payload.sender]){
                    console.warn("Already have a connection to " + payload.sender + ". Closing and reopening.")
                    this.rtcConnections[payload.sender].close();
                }
                this.rtcConnections[payload.sender] = new RTCConnection(this, payload.sender);
                this.rtcConnections[payload.sender].respondToOffer(payload.data.offer.localDescription);
                let pendingIceCandidate = this.pendingIceCandidates[payload.sender];
                if (pendingIceCandidate){
                    console.log("Found pending ice candidate for " + payload.sender);
                    this.rtcConnections[payload.sender].onReceivedIceCandidate(pendingIceCandidate);
                    delete this.pendingIceCandidates[payload.sender];
                }
            }else{
                console.warn("Not connecting to " + payload.sender);
                // TODO: actually reject offer
            }
        });

    },

    RTCIceCandidate: payload => {//rtc ice candidate
        if (payload.data){
            let rtcConnection = this.rtcConnections[payload.sender]; // Using the correct connection
            if (!rtcConnection){
    //            console.error("No connection found for " + payload.sender);
                this.pendingIceCandidates[payload.sender] = payload.data;
    //            rtcConnection = new RTCConnection(this, payload.sender);
    //            this.rtcConnections[payload.sender] = rtcConnection
            }else{
                rtcConnection.onReceivedIceCandidate(payload.data);
            }
        }
    },
    RTCAnswer: payload => {//rtc answer
        if (payload.data.target != this.name){return};
        let rtcConnection = this.rtcConnections[payload.sender]; // Using the correct connection
        if (!rtcConnection){
            console.error("No connection found for " + payload.sender);
            return
        }
        rtcConnection.receiveAnswer(payload.data.localDescription);
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
    if (this.rtcConnections[user]){
        this.rtcConnections[user].endCall();
    }
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
    if (this.rtcConnections[user]){
        console.warn("Already connected to " + user);
        try{
            this.disconnectFromUser(user);
        }catch{}
        delete this.rtcConnections[user];
    }
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
        console.warn("Already have a connection to " + user + " but it's not connected.", existingConnection.peerConnection.connectionState);
        if (existingConnection.peerConnection.connectionState == "failed"){
            console.warn("Connection failed. Closing and reopening.");
            this.disconnectFromUser(user);
            return null;
        }


        return existingConnection;

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
    this.emit('connectedtopeer', user);
  }
  isConnectedToUser(user){
    return this.rtcConnections[user] && this.rtcConnections[user].peerConnection.connectionState === "connected";
  }
  onrtcdisconnectedFromUser(user){
    if (!this.rtcConnections[user]){
        console.warn("Already disconnected from" + user);
        return;
    }
    console.log("Disconnected from user ", user);
    delete this.rtcConnections[user];
    this.onDisconnectedFromUser(user);
  }
  onDisconnectedFromUser(user){
    console.log("Disconnected from user ", user);
    this.emit('disconnectedfrompeer', user);
  }

  changeName(newName){
    let oldName = this.name;
    const tabID = this.tabManager ? this.tabManager.getTabID() : (typeof tabID !== 'undefined' ? tabID : null);
    this.name = newName + (tabID ? ('(' + tabID + ')') : '');
    
    // Use storage adapter if available, otherwise use localStorage
    if (this.storage) {
      this.storage.setItem("name", newName);
      this.storage.setItem("rtchat_name", newName);
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem("name", newName);
    }
    
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
            const sendResult = this.rtcConnections[user].send(channel, serializedData);
            // If send returns a promise (channel not ready), handle it
            if (sendResult && typeof sendResult.then === 'function') {
                sendResult.catch(err => {
                    console.error(`Failed to send on channel ${channel} to ${user}:`, err);
                });
            }
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
    // Emit generic RTC message event
    this.emit('rtcmessage', channel, deserializedData, sender);
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
        // Use iceServers array if available, otherwise fall back to stunServer
        const iceServers = mqttClient.iceServers || 
          (mqttClient.stunServer ? [{ urls: mqttClient.stunServer }] : 
           [{ urls: "stun:stun4.l.google.com:19302" }]);
        
        this.rtcConfiguration = { 
          iceServers: iceServers,
          iceTransportPolicy: mqttClient.config?.getConfig()?.webrtc?.iceTransportPolicy || 'all',
          bundlePolicy: mqttClient.config?.getConfig()?.webrtc?.bundlePolicy || 'balanced',
          rtcpMuxPolicy: mqttClient.config?.getConfig()?.webrtc?.rtcpMuxPolicy || 'require'
        };
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

        this.pendingStreamIceCandidate = null;
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
            this.mqttClient.postPubliclyToMQTTServer("RTCOffer", {userInfo: this.mqttClient.userInfo, offer: {"localDescription": this.peerConnection.localDescription, "target": this.target}});
          });
        this.sentOffer = true;
    }
    respondToOffer(offer){
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
              .then(() => this.peerConnection.createAnswer())
              .then(answer => this.peerConnection.setLocalDescription(answer))
              .then((answer) => {
                // Send answer via MQTT
                this.mqttClient.postPubliclyToMQTTServer("RTCAnswer", {
                    "localDescription": this.peerConnection.localDescription,
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
        // Wait for all data channels to be ready before notifying connection
        this.loadPromise.then((() => {
            this.send("connectedViaRTC", null);
            this.mqttClient.onConnectedToUser(this.target);
        }).bind(this));
    }
    send(channel, serializedData){
        let dataChannel = this.dataChannels[channel];
        if (!dataChannel){
            if (this.mqttClient.rtcHandlers[channel]){
                console.warn("handler found for ", channel, "but no data channel");
            }
            throw new Error("No data channel for " + channel);
        }
        
        // If channel is not open, wait for it to open
        if (dataChannel.readyState !== "open"){
            if (dataChannel.readyState === "closed") {
                throw new Error("Channel closed: " + channel);
            }
            // Channel is connecting, wait for it to open
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Channel ${channel} did not open within 10 seconds`));
                }, 10000);
                
                const onOpen = () => {
                    clearTimeout(timeout);
                    dataChannel.removeEventListener('open', onOpen);
                    dataChannel.removeEventListener('error', onError);
                    try {
                        dataChannel.send(serializedData);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                };
                
                const onError = (e) => {
                    clearTimeout(timeout);
                    dataChannel.removeEventListener('open', onOpen);
                    dataChannel.removeEventListener('error', onError);
                    reject(new Error(`Channel ${channel} error: ${e.message || e}`));
                };
                
                dataChannel.addEventListener('open', onOpen);
                dataChannel.addEventListener('error', onError);
            });
        }
        
        dataChannel.send(serializedData);
    }
    onmessage(event, channel){
        if (channel === "streamoffer"){
            console.log("received stream offer", event.data)
            let {offer, streamInfo} = JSON.parse(event.data);
            this.mqttClient.callFromUser(this.target, {video: true, audio: true}, this.initiatedCall, this.callPromises).then(stream => {
                if (!this.streamConnection){
                    this.streamConnection = this._makeStreamConnection(stream);
                }
                return this.streamConnection;
            }).catch(e => {
                this.streamConnectionPromise.reject(e);
                this.streamPromise.reject(e);
            }).then(streamConnection => {
                streamConnection.setRemoteDescription(new RTCSessionDescription(offer))
                    .then(() => this.streamConnection.createAnswer())
                    .then(answer => this.streamConnection.setLocalDescription(answer))
                    .then(() => {
                        // Send answer via MQTT
                        console.log("Sending stream answer", this.streamConnection.localDescription);
                        this.send("streamanswer", JSON.stringify({"answer": this.streamConnection.localDescription}));
                        if (this.pendingStreamIceCandidate){
                            console.log("Found pending stream ice candidate");
                            this.streamConnection.addIceCandidate(new RTCIceCandidate(this.pendingStreamIceCandidate));
                            this.pendingStreamIceCandidate = null;
                        }
                    });
            });

        }else if (channel === "streamanswer"){
            console.log("received stream answer", event.data)
            let {answer} = JSON.parse(event.data);
            this.streamConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }else if (channel === "streamice"){
            console.log("received stream ice", event.data)
            if (event.data){
                if (this.streamConnection){
                    this.streamConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(event.data)));
                }else{
                    this.pendingStreamIceCandidate = JSON.parse(event.data);
                }
            }
        }else if (channel === "endcall"){
            this._closeCall();
        }else{
            this.mqttClient.onrtcmessage(channel, event.data, this.target);
        }
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
        this.pendingStreamIceCandidate = null;
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
//        if (event.candidate && !this.sentice) {
//            this.sentice = true;
            // Send ICE candidate via MQTT
            this.mqttClient.postPubliclyToMQTTServer("RTCIceCandidate", event.candidate);
//        }
    }
    onstreamicecandidate(event){
        if (event.candidate) {
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
    constructor(config){
    config = config || {};
    let {name, userInfo, questionHandlers, handlers, load} = config;
    if (load === undefined){
        load = true;
    }

    config.load = false;
    // initialize state tracking variables
    super(config);

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
    // Call parent to emit event
    super.onMQTTMessage(subtopic, data, sender, timestamp);
  }

 //__________________________________________________ RTC ______________________________________________________________
  onConnectedToUser(user){
    console.log("Connected to user ", user);
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
    constructor(config){
        config = config || {};
        let {name, userInfo, questionHandlers, handlers, load} = config;
        // this.knownUsers = {name: userInfo, ...} of all users, even those we're not connected to
        // this.rtcConnections = {name: rtcConnection, ...} of active connections
        // this.connectedUsers = [name, ...] of all users we're connected to
        if (load === undefined){
            load = true;
        }
        config.load = false;
        super(config);
        

        if (load){
            this.load();
        }

    }
    on(rtcevent, handler){
        // Use EventEmitter for standard events, but handle special cases
        if (rtcevent === "connectionrequest"){
            // Special case: connectionrequest sets shouldConnectToUser
            this.shouldConnectToUser = handler.bind(this);
            // Also register as event listener for consistency
            return super.on(rtcevent, handler);
        }else if (rtcevent === "call"){
            // Special case: call sets acceptCallFromUser
            this.acceptCallFromUser = handler.bind(this);
            // Also register as event listener
            return super.on(rtcevent, handler);
        }else if (rtcevent === "callended"){
            // Special case: callended sets oncallended
            this.oncallended = handler.bind(this);
            // Also register as event listener
            return super.on(rtcevent, handler);
        }else if (rtcevent === "question"){
            // Question handlers are registered via addQuestionHandler
            this.addQuestionHandler(rtcevent, handler);
            // Also emit events for consistency
            return super.on(rtcevent, handler);
        }else{
            // All other events use EventEmitter
            return super.on(rtcevent, handler);
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
        this.emit('namechange', oldName, newName);
    }

    onConnectedToMQTT(){
        console.log("Connected to MQTT");
        this.emit('mqttconnected');
    }
    onConnectedToUser(user){
        console.log("Connected to user ", user);
        this.emit('connectedtopeer', user);
    }
    onDisconnectedFromUser(user){
        console.log("Disconnected from user ", user);
        this.emit('disconnectedfrompeer', user);
    }
    onRTCDM(data, sender){
        this.emit('dm', data, sender);
    }
    onRTCChat(data, sender){
        this.emit('chat', data, sender);
    }
    addQuestionHandler(name, handler){
        super.addQuestionHandler(name, handler);
    }
    oncallconnected(sender, {localStream, remoteStream}){
        this.emit('callconnected', sender, {localStream, remoteStream});
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
        this.emit('ping', sender);
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
// Export main classes
export {MQTTRTCClient, BaseMQTTRTCClient, PromisefulMQTTRTCClient, RTCConnection, Peer, DeferredPromise};
export { RTCConfig, LocalStorageAdapter, TabManager, MQTTLoader };