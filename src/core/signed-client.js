/**
 * Signed MQTT-RTC Client - Secure peer-to-peer communication with identity verification
 * 
 * Extends MQTTRTCClient with cryptographic identity verification using RSA-PSS keys.
 * Implements a challenge/response system to verify peer identities and prevent impersonation.
 * 
 * Usage:
 *   import { SignedMQTTRTCClient } from './signed-mqtt-rtc.js';
 *   
 *   const client = new SignedMQTTRTCClient({
 *     name: 'MyName',
 *     trustMode: 'moderate',  // Trust configuration
 *     generate: true          // Generate new keys if none exist
 *   });
 * 
 *   client.on('validation', (peerName, trusted) => {
 *     console.log(`Peer ${peerName} validated, trusted: ${trusted}`);
 *   });
 * 
 *   client.on('validationfailure', (peerName, message) => {
 *     console.error(`Validation failed for ${peerName}: ${message}`);
 *   });
 * 
 * Identity System:
 * - Each client generates an RSA-PSS key pair (2048-bit)
 * - Public keys are stored in localStorage (knownHostsStrings)
 * - Private keys are stored encrypted in localStorage
 * - Identity = name + "|" + publicKeyString
 * 
 * Trust Levels:
 * - reject: Do not connect
 * - promptandtrust: Prompt user, then trust if challenge passes
 * - connectandprompt: Connect first, then prompt to trust
 * - connectandtrust: Connect and automatically trust
 * 
 * Trust Modes (pre-configured trust level mappings):
 * - strict: Only auto-trust "the one and only" known peers
 * - moderate: Trust known peers and aliases, prompt for others
 * - lax: Trust most cases, prompt only for suspicious ones
 * - unsafe: Trust everyone (not recommended)
 * - rejectall: Reject all connections
 * 
 * User Categories (automatic detection):
 * - theoneandonly: Known key and name match perfectly
 * - knownwithknownaliases: Known key, but also known by other names
 * - possiblenamechange: Known key, but different name
 * - possiblesharedpubkey: Known key with multiple other names
 * - nameswapcollision: Suspicious name/key mismatch
 * - pretender: Unknown key using a known name
 * - nevermet: Completely new peer
 * 
 * Challenge/Response Flow:
 * 1. When connecting, peers exchange public keys via MQTT
 * 2. After WebRTC connection, challenge is sent via RTC
 * 3. Peer signs challenge with private key
 * 4. Signature is verified using stored public key
 * 5. If valid, peer is added to validatedPeers list
 * 
 * Methods:
 * - trust(peerName): Trust a peer and save their public key
 * - challenge(peerName): Challenge a peer to prove identity
 * - untrust(peerName): Remove trust and disconnect
 * - register(identity): Register a peer's identity (name|publicKey)
 * - reset(): Clear all keys and known hosts
 * 
 * @module signed-mqtt-rtc
 */

import { MQTTRTCClient } from "./mqtt-rtc-client.js";
import { RTCConfig } from "../config/rtc-config.js";
import { Keys } from "../crypto/keys.js";

let trustLevels = {
    reject: 0, // do not even connect
    promptandtrust: 1, // prompt whether to connect and then trust (assuming they pass the challenge)
    connectandprompt: 2, // connect and then prompt whether to trust
    connectandtrust: 3 // connect and trust
}

let suspicionLevels = {
        trusted: 0,
        nonsuspicious: 1,
        slightlyodd: 2,
        odd: 3,
        veryodd: 4
    }

class SignedMQTTRTCClient extends MQTTRTCClient {
    constructor(userConfig) {
        userConfig = userConfig || {};
        
        // Extract config values
        const config = userConfig instanceof RTCConfig ? userConfig : new RTCConfig(userConfig);
        const configObj = config.getConfig();
        const generate = userConfig.generate !== false;
        const load = configObj.load !== false;
        const trustMode = userConfig.trustMode || configObj.trustMode || "strict";
        const name = config.name;
        const autoAcceptConnections = configObj.connection?.autoAcceptConnections ?? false;

        // Prepare config for parent (don't pass load flag, we'll handle it)
        super({ ...userConfig, load: false });
        
        // Get name from config or use the one we extracted
        const finalName = name || (this.name ? this.name.split('(')[0] : 'User');
        
        // Initialize keys with storage adapter and crypto from config
        const storage = this.storage || (typeof localStorage !== 'undefined' ? {
          getItem: (key) => localStorage.getItem(key),
          setItem: (key, value) => localStorage.setItem(key, value),
          removeItem: (key) => localStorage.removeItem(key)
        } : null);
        
        // Get crypto from config
        const crypto = configObj.crypto || (typeof window !== 'undefined' && window.crypto ? window.crypto : null);
        
        this.keys = new Keys(finalName, generate, { storage, crypto });
        this.validatedPeers = [];

        // Set up trust configuration
        if (trustMode === undefined) {trustMode = "strict";}
        if (this.trustConfigs[trustMode]){
            this.trustConfig = this.trustConfigs[trustMode];
        }else{
            this.trustConfig = trustMode;
        }
        if (!this.trustConfig || Object.keys(this.userCategories).map((category) => this.trustConfig[category]).some((level) => level === undefined)){
            throw new Error("Invalid trust mode");
        }
        this.completeUserInfo = {};

        this.shouldConnectToUser = this.shouldConnectToUser.bind(this);
        this.checkTrust = this.checkTrust.bind(this);
        this._getFullUserInfo = this._getFullUserInfo.bind(this);

        this.trust = this.trust.bind(this);
        this.register = this.register.bind(this);
        this.challenge = this.challenge.bind(this);
        this.untrust = this.untrust.bind(this);
        
        // Store auto-accept setting
        this.autoAcceptConnections = autoAcceptConnections;

        this.addQuestionHandler('identify', this._returnPublicKey.bind(this));
        this.addQuestionHandler('challenge', this._sign.bind(this));
        this.on('connectedtopeer', (peerName)=>{
            // Only validate if not already validated to prevent infinite loops
            if (!this.validatedPeers.includes(peerName)) {
                setTimeout(()=> {this.trustOrChallenge.bind(this)(peerName)}, 1000);
            }
        });

        if (load) {
            this.keys.loadedPromise.then(() => {
                this.userInfo.publicKeyString = this.keys.publicKeyString;
                this.load();
            });
        }
    }
    verifyUser(channel, data, peerName) {
        console.log("Verifying user", channel, data, peerName, this.validatedPeers);
        if (["question", "answer"].includes(channel) && ["identify", "challenge"].includes(data.question.topic)) {
            return true;
        }
        return this.validatedPeers.includes(peerName);
    }

    _getFullUserInfo(peerName, userInfo) {
        let _bareName = peerName.split('|')[0].split('(')[0].trim();
        if (_bareName.startsWith("anon")) {
            return {
                peerName: peerName,
                bareName: _bareName,
                userInfo: userInfo,
                providedPubKey: false,
                knownPubKey: false,
                knownName: false,
                otherNamesForPubKey: [],
                otherPubKeyForName: null,
                completedChallenge: false,
                explanation: "anonymous",
                suspiciousness: suspicionLevels.nonsuspicious,
                category: "nevermet",
                hint: "anon"
            }
        }
        let providedPubKey = !!userInfo.publicKeyString;
        let peerNames = providedPubKey?this.keys.getPeerNames(userInfo.publicKeyString):[];
        let _opk = this.keys.getPublicKeyString(_bareName);
        let info = {
            peerName: peerName,
            bareName: _bareName,
            userInfo: userInfo,
            providedPubKey: providedPubKey,
            knownPubKey: (peerNames.length > 0), // bool of whether the public key is known
            knownName: peerNames.includes(_bareName), // bool of whether the public key is known under the name provided
            otherNamesForPubKey: peerNames.filter((name) => name !== _bareName), // array of other names the public key is known under as well (if any)
            otherPubKeyForName: (_opk && (_opk !== userInfo.publicKeyString)) ? _opk : null, // public key string for the name provided (if different from the public key string provided)
            completedChallenge: false // bool of whether the challenge has been completed
        }
        let category = this.categorizeUser(info);
        info.explanation = category.explanation;
        info.suspiciousness = category.suspiciousness;
        info.category = category.category;

        let hint = '';
        if (info.category === 'theoneandonly'){
            hint = '';
        }else if (['knownwithknownaliases', 'possiblenamechange', 'possiblesharedpubkey'].includes(info.category)){
            hint = ` who is known as ${info.otherNamesForPubKey.join(', ')}`;
        }else if (info.category === 'nameswapcollision'){
            hint = `it appears ${info.otherNamesForPubKey[0]} (who you know) is using ${peerName}'s public key to impersonate them'`;
        }else if (info.category === 'pretender'){
            hint = ` who is pretending to be ${info.otherNamesForPubKey[0]}`;
        }else if (info.category === 'nevermet'){
            hint = ` who you have not met`;
        }
        hint = hint? ` (${hint})`: '';
        info.hint = hint;

        return info
    }

    shouldConnectToUser(peerName, userInfo) {
        console.log("Checking if we should connect to user", peerName, userInfo);
        let info = this._getFullUserInfo(peerName, userInfo);
        console.log("info", info)
        let trustLevel = this.checkTrust(info);

        info.trustLevel = trustLevel;
        info.trustLevelString = Object.keys(this.trustLevels).find((key) => this.trustLevels[key] === trustLevel);

        if (this.completeUserInfo[peerName] && this.isConnectedToUser(peerName)) {
            console.warn("Rejecting connection to " + peerName + " because we are already connected to someone with that name");
            return Promise.resolve(false);
        }
        this.completeUserInfo[peerName] = info;

        if (trustLevel === trustLevels.reject) {
            console.error("Rejecting connection to " + peerName);
            return Promise.resolve(false);
        }else if ([trustLevels.doubleprompt, trustLevels.promptandtrust].includes(trustLevel)) {
            return this.connectionrequest(peerName, info).then((connect) => {
                if (connect) {
                    console.log("Decided to connect to " + peerName);
                }else{
                    console.log("Decided not to connect to " + peerName);
                }
                return connect;
            }, (e)=> {console.log("Error in connection request", e); return false});
        }else{
            console.log("will connect to " + peerName);
            return Promise.resolve(true);
        }
    }
    trustLevels = trustLevels
    suspicionLevels = suspicionLevels
    userCategories = {
        theoneandonly: {knownPubKey: true, knownName: true, otherNamesForPubKey: false, otherPubKeyForName: false,
            explanation: "you know this person by the public key provided and don't now anyone else by this name or public key",
            suspiciousness: suspicionLevels.trusted,
            category: "theoneandonly"
        },
        knownwithknownaliases: {knownPubKey: true, knownName: true, otherNamesForPubKey: true, otherPubKeyForName: false,
            explanation: "you know this person by the public key provided, but you also know them by other names",
            suspiciousness: suspicionLevels.slightlyodd,
            category: "knownwithknownaliases"
        },
        possiblenamechange: {knownPubKey: true, knownName: false, otherNamesForPubKey: 1, otherPubKeyForName: false,
            explanation: "you recognize the public key but know it by a different name",
            suspiciousness: suspicionLevels.slightlyodd,
            category: "possiblenamechange"
        },
        possiblesharedpubkey: {knownPubKey: true, knownName: false, otherNamesForPubKey: true, otherPubKeyForName: false,
            explanation: "you recognize the public key but know it by more than one other name",
            suspiciousness: suspicionLevels.slightlyodd,
            category: "possiblesharedpubkey"
        },
        nameswapcollision: {knownPubKey: true, knownName: false, otherNamesForPubKey: true, otherPubKeyForName: true,
            explanation: "someone you know tried to change their name to the name of someone else you know",
            suspiciousness: suspicionLevels.odd,
            category: "nameswapcollision"
        },
        //___________________________________________________________________________________
        pretender: {knownPubKey: false, knownName: false, otherNamesForPubKey: false, otherPubKeyForName: true,
            explanation: "someone you don't know is using the name of someone you do know",
            suspiciousness: suspicionLevels.veryodd,
            category: "pretender"
        },
        nevermet: {knownPubKey: false, knownName: false, otherNamesForPubKey: false, otherPubKeyForName: false,
            explanation: "you don't know anyone with this pub key or name, you probably just haven't met yet",
            suspiciousness: suspicionLevels.notsuspicious,
            category: "nevermet"
        }
    }


    trustConfigs = {
        alwaysprompt: {
            theoneandonly: trustLevels.promptandtrust,
            knownwithknownaliases: trustLevels.promptandtrust,
            possiblenamechange: trustLevels.promptandtrust,
            possiblesharedpubkey: trustLevels.promptandtrust,
            nameswapcollision: trustLevels.promptandtrust,
            pretender: trustLevels.promptandtrust,
            nevermet: trustLevels.promptandtrust
        },
        strict: {
            theoneandonly: trustLevels.connectandtrust,
            knownwithknownaliases: trustLevels.promptandtrust,
            possiblenamechange: trustLevels.promptandtrust,
            possiblesharedpubkey: trustLevels.promptandtrust,
            nameswapcollision: trustLevels.promptandtrust,
            pretender: trustLevels.promptandtrust,
            nevermet: trustLevels.promptandtrust
        },
        strictandquiet: {
            theoneandonly: trustLevels.connectandtrust,
            knownwithknownaliases: trustLevels.reject,
            possiblenamechange: trustLevels.reject,
            possiblesharedpubkey: trustLevels.reject,
            nameswapcollision: trustLevels.reject,
            pretender: trustLevels.reject,
            nevermet: trustLevels.promptandtrust
        },
        moderate: {
            theoneandonly: trustLevels.connectandtrust,
            knownwithknownaliases: trustLevels.connectandtrust,
            possiblenamechange: trustLevels.connectandtrust,
            possiblesharedpubkey: trustLevels.connectandtrust,
            nameswapcollision: trustLevels.promptandtrust,
            pretender: trustLevels.promptandtrust,
            nevermet: trustLevels.promptandtrust
        },
        moderateandquiet: {
            theoneandonly: trustLevels.connectandtrust,
            knownwithknownaliases: trustLevels.connectandtrust,
            possiblenamechange: trustLevels.connectandtrust,
            possiblesharedpubkey: trustLevels.connectandtrust,
            nameswapcollision: trustLevels.reject,
            pretender: trustLevels.reject,
            nevermet: trustLevels.promptandtrust
        },
        lax: {
            theoneandonly: trustLevels.connectandtrust,
            knownwithknownaliases: trustLevels.connectandtrust,
            possiblenamechange: trustLevels.connectandtrust,
            possiblesharedpubkey: trustLevels.connectandtrust,
            nameswapcollision: trustLevels.promptandtrust,
            pretender: trustLevels.promptandtrust,
            nevermet: trustLevels.connectandtrust
        },
        unsafe:{
            theoneandonly: trustLevels.connectandtrust,
            knownwithknownaliases: trustLevels.connectandtrust,
            possiblenamechange: trustLevels.connectandtrust,
            possiblesharedpubkey: trustLevels.connectandtrust,
            nameswapcollision: trustLevels.connectandtrust,
            pretender: trustLevels.connectandtrust,
            nevermet: trustLevels.connectandtrust
        },
        rejectall: {
            theoneandonly: trustLevels.reject,
            knownwithknownaliases: trustLevels.reject,
            possiblenamechange: trustLevels.reject,
            possiblesharedpubkey: trustLevels.reject,
            nameswapcollision: trustLevels.reject,
            pretender: trustLevels.reject,
            nevermet: trustLevels.reject
        }
    }
    categorizeUser(info){
        if (info.knownPubKey){// we know this pubkey
            if (info.knownName) { // we know this pubkey by this name (but maybe other names too?)
                if (info.otherPubKeyForName) {
                    throw new Error("knownName should mean that this name matches the pubkey so therefore otherPubKeyForName should be null");
                }else{ // we don't know of any other pubkeys for this name
                    if (info.otherNamesForPubKey.length === 0) { // we don't know of any other names for this pubkey
                        return this.userCategories.theoneandonly;
                    }else{ // we know of other names for this pubkey (and we know this name as well)
                        return this.userCategories.knownwithknownaliases;
                    }
                }
            }else{ // we know this pubkey but not by this name
                if (info.otherNamesForPubKey.length === 0) {
                    throw new Error("knownPubKey should mean that this pubkey matches at least one name so if knownName is false then there should be at least one other name for this pubkey");
                }else if (info.otherNamesForPubKey.length === 1) { // we know this pubkey by one other name
                    if (info.otherPubKeyForName) {
                        return this.userCategories.nameswapcollision; // we know this pubkey by one other name and we know another pubkey by this name : VERY SUSPICIOUS
                    }else{
                        return this.userCategories.possiblenamechange; // we know this pubkey by one other name and we don't know another pubkey by this name
                    }
                }else{// we know this pubkey by more than one other name
                    if (info.otherPubKeyForName) {
                        return this.userCategories.nameswapcollision; // we know this pubkey by more than one other name and we know another pubkey by this name : VERY SUSPICIOUS
                    }else{
                        return this.userCategories.possiblesharedpubkey; // we know this pubkey by more than one other name and we don't know another pubkey by this name
                    }
                }
            }
        }else{
            if (info.otherPubKeyForName) {
                return this.userCategories.pretender;
            }else{
                return this.userCategories.nevermet;
            }
        }
    }

    checkTrust({peerName, bareName, userInfo, providedPubKey, peerNames, knownPubKey, knownName, otherNamesForPubKey, otherPubKeyForName, completedChallenge,
        explanation, suspiciousness, category}) {
        console.log("Checking trust for " + peerName, category, this.trustConfig)
        return this.trustConfig[category];
    }
    connectionrequest(peerName, info) {
        // If auto-accept is enabled, automatically accept
        if (this.autoAcceptConnections) {
            console.log("Auto-accepting connection request from", peerName);
            return Promise.resolve(true);
        }
        
        // Otherwise, prompt whether to connect to a peer
        // This can be overridden by listening to the 'connectionrequest' event
        let answer = confirm("Do you want to connect to " + peerName + "?");
        return Promise.resolve(answer);
    }
    trustOrChallenge(peerName) {
        this.keys.getPublicKey(peerName).then((publicKey) => {
            if (!publicKey) {
                console.log("No public key found for " + peerName);
                let info = this.completeUserInfo[peerName];
                
                // If info doesn't exist, create it with default values
                if (!info) {
                    info = this._getFullUserInfo(peerName, {});
                    const trustLevel = this.checkTrust(info);
                    info.trustLevel = trustLevel;
                    info.trustLevelString = Object.keys(this.trustLevels).find((key) => this.trustLevels[key] === trustLevel);
                    this.completeUserInfo[peerName] = info;
                }
                
                const trustLevel = info.trustLevel;

                if ([this.trustLevels.reject].includes(trustLevel)) {
                    console.error("Rejecting connection to " + peerName);
                    this.untrust(peerName);
                    return;
                }else if ([this.trustLevels.connectandprompt].includes(trustLevel)) {
                    this.connectionrequest(peerName, info).then((connect) => {
                        if (connect) {
                            this.trust(peerName);
                        }else{
                            this.untrust(peerName);
                        }
                    });
                    return;
                }else if ([this.trustLevels.promptandtrust, this.trustLevels.connectandtrust].includes(trustLevel)) {
                    this.trust(peerName);
                }
            }else{
                this.challenge(peerName);
            }
        });
    }
    _returnPublicKey(challenge, senderName) {
        console.log("Challenge received from " + senderName);
        return this.keys.sign(challenge).then((signature) => {
            let answer =  {publicKeyString: this.keys.publicKeyString, signature: signature};
            console.log("Returning public key to " + senderName, answer);
            return answer;
        });
    }
    reset(){
        this.keys.reset();
        this.validatedPeers = [];
    }
    trust(peerName){
        /* trust a peer, assuming they give you a public key they are abe to sign, save that public key to their name */
        let oldPublicKeyString = this.keys.getPublicKeyString(peerName);
        let challengeString = this.keys.getChallengeString();
        return this.sendRTCQuestion("identify", challengeString, peerName).then(({publicKeyString, signature}) => {
             if (oldPublicKeyString && (oldPublicKeyString !== publicKeyString)) {
                console.error("Public key changed for " + peerName, oldPublicKeyString, publicKeyString);
                throw new Error("Public key changed for " + peerName);
            }
            return this.keys.verify(publicKeyString, signature, challengeString).then((valid) => {
                if (valid) {
                    console.log("Signature valid for " + peerName + ", trusting and saving public key");
                    // Check if this public key is already registered to a different name
                    const existingPeers = this.keys.getPeerNames(publicKeyString);
                    if (existingPeers.length > 0 && !existingPeers.includes(peerName)) {
                        // Public key is registered to a different name - update the mapping
                        console.log("Public key already registered to", existingPeers, "updating to", peerName);
                        // Remove old name mappings
                        existingPeers.forEach(oldName => {
                            delete this.keys._knownHostsStrings[oldName];
                        });
                        // Update storage after removing old mappings
                        if (this.keys.storage) {
                            this.keys.storage.setItem("knownHostsStrings", JSON.stringify(this.keys._knownHostsStrings));
                        }
                    }
                    this.keys.savePublicKeyString(peerName, publicKeyString);
                    // Only add to validatedPeers if not already there (prevent duplicates)
                    if (!this.validatedPeers.includes(peerName)) {
                        this.validatedPeers.push(peerName);
                        this.onValidatedPeer(peerName, true);
                    }
                    return true;
                } else {
                    console.error("Signature invalid for " + peerName);
                    this.untrust(peerName);
                    this.onValidationFailed(peerName);
                    return false;
                }
            });
        })
    }

    challenge(peerName) {
        /* challenge a peer to prove they have the private key corresponding to the public key you have saved for them */
        let publicKeyString = this.keys.getPublicKeyString(peerName);
        let challengeString = this.keys.getChallengeString();
        return this.sendRTCQuestion("challenge", challengeString, peerName).then((signature) => {
            return this.keys.verify(publicKeyString, signature, challengeString).then((valid) => {
                console.log("Signature valid for " + peerName, valid);
                // Only add to validatedPeers if not already there (prevent duplicates)
                if (!this.validatedPeers.includes(peerName)) {
                    this.validatedPeers.push(peerName);
                    console.log("Validated peers", this.validatedPeers);
                    this.onValidatedPeer(peerName);
                }

                return valid;
            }, (err) => {
                console.error("Error verifying signature of "+ peerName, err);
                this.untrust(peerName);
                this.onValidationFailed(peerName);
                throw err;
            });
        });
    }
    on(event, callback) {
        if (event === "connectionrequest"){
            this.connectionrequest = callback;
            return super.on(event, callback);
        }else{
            return super.on(event, callback);
        }
    }

    onValidatedPeer(peerName, trusting=false) {
        if (trusting) {
            console.log("Trusting peer " + peerName + " is who they say they are.");
        }
        console.log("Peer " + peerName + " validated");
        this.emit('validation', peerName, trusting);
        // Don't emit connectedtopeer here - it causes infinite loops
        // ChatManager now listens to 'validation' events to add users after validation
    }
    onValidationFailed(peerName, message) {
        console.error("Peer " + peerName + " validation failed" + (message ? ": " + message : ""));
        this.emit('validationfailure', peerName, message);
    }
    untrust(peerName) {
        /* remove a public key from a peer */

        this.keys.removePublicKey(peerName);
        console.error("Untrusting peer " + peerName, this.validatedPeers);
        if (this.validatedPeers.includes(peerName)) {
            this.validatedPeers = this.validatedPeers.filter((name) => name !== peerName);
        }
        console.error("Disconnecting from untrusted peer " + peerName, this.validatedPeers);
        this.disconnectFromUser(peerName);
    }
    _sign(challengeString, peerName) {return this.keys.sign(challengeString);}
    register(identity) {return this.keys.register(identity);}
}

export { SignedMQTTRTCClient };


