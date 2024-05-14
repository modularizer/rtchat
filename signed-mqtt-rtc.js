import { MQTTRTCClient } from "./mqtt-rtc.js";

class Keys {
    algorithm = {
      name: "RSA-PSS",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: {name: "SHA-256"},
    }
    extractable = true;
    keyUsages = ["sign", "verify"];

    constructor(name, generate=true) {
        this._name = null;
        this.name = name;

        this._loadKeys = this._loadKeys.bind(this);
        this.load = this.load.bind(this);
        this.generate = this.generate.bind(this);
        this._dumpKey = this._dumpKey.bind(this);
        this._loadPrivateKey = this._loadPrivateKey.bind(this);
        this._loadPublicKey = this._loadPublicKey.bind(this);
        this.sign = this.sign.bind(this);
        this.getChallengeString = this.getChallengeString.bind(this);
        this.verify = this.verify.bind(this);
        this.savePublicKey = this.savePublicKey.bind(this);
        this.savePublicKeyString = this.savePublicKeyString.bind(this);
        this.getPublicKey = this.getPublicKey.bind(this);
        this.clearOwnKeys = this.clearOwnKeys.bind(this);
        this.clearKnownHosts = this.clearKnownHosts.bind(this);
        this.getPeerNames = this.getPeerNames.bind(this);
        this.reset = this.reset.bind(this);

        this.loadedPromise = this.load(generate);
    }
    load(generate=true) {
        this.loading = true;
        this.loaded = false;
        this.loadedPromise = this._loadKeys(generate).then((keys) => {
            this._knownHostsStrings = JSON.parse(localStorage.getItem("knownHostsStrings") || "{}");
            this._knownHostsKeys = {};
            this._privateKey = keys.privateKey;
            this._publicKey = keys.publicKey;
            this._privateKeyString = keys.privateKeyString;
            this.publicKeyString = keys.publicKeyString;
            localStorage.setItem("privateKeyString", this._privateKeyString);
            localStorage.setItem("publicKeyString", this.publicKeyString);
            this.loaded = true;
            this.loading = false;
            return this.publicKeyString;
        });
        return this.loadedPromise;
    }
    _loadKeys(generate=true) {
        let privateKeyString = localStorage.getItem("privateKeyString");
        let publicKeyString = localStorage.getItem("publicKeyString");
        if (generate !== 'force' && publicKeyString && privateKeyString) {
            return this._loadPrivateKey(privateKeyString).then((privateKey) => {
                return this._loadPublicKey(publicKeyString).then((publicKey) => {
                    return {privateKey, publicKey, privateKeyString, publicKeyString};
                });
            })
        }
        if (!generate) {
            throw new Error("No keys found and generate is false");
        }
        return this.generate()
    }
    generate(){
        return window.crypto.subtle.generateKey(
            this.algorithm, this.extractable, this.keyUsages
        ).then((keys) => {
            return this._dumpKey(keys.privateKey).then(privateKeyString => {
                keys.privateKeyString = privateKeyString;
                return this._dumpKey(keys.publicKey).then(publicKeyString => {
                    keys.publicKeyString = publicKeyString;
                    return keys;
                });
            });
        });
    }
    _dumpKey(key){
        return window.crypto.subtle.exportKey("jwk", key).then(JSON.stringify);
    }
    _loadPrivateKey(key){
        return window.crypto.subtle.importKey("jwk", JSON.parse(key), this.algorithm, this.extractable, ["sign"])
    }
    _loadPublicKey(key){
        return window.crypto.subtle.importKey("jwk", JSON.parse(key), this.algorithm, this.extractable, ["verify"])
    }
    getChallengeString() {
        return Array.from(window.crypto.getRandomValues(new Uint8Array(32))).map(b => String.fromCharCode(b)).join('');
    }
    sign(challenge) {
        if (this.loading && !this._loaded) {
            return this.loadedPromise.then(() => this.sign(challenge));
        }
        return window.crypto.subtle.sign(
            {
                name: "RSA-PSS",
                saltLength: 32,
            },
            this._privateKey,
            new Uint8Array(challenge.split('').map((c) => c.charCodeAt(0))).buffer
        ).then((signature) => {
            return String.fromCharCode.apply(null, new Uint8Array(signature));
        });
    }
    verify(publicKeyString, signatureString, challenge) {
        return this._loadPublicKey(publicKeyString).then((publicKey) => {
            return window.crypto.subtle.verify(
                {
                    name: "RSA-PSS",
                    saltLength: 32,
                },
                publicKey,
                new Uint8Array(signatureString.split('').map((c) => c.charCodeAt(0))).buffer,
                new Uint8Array(challenge.split('').map((c) => c.charCodeAt(0))).buffer
            );
        });
    }
    getPeerNames(publicKeyString) {
        let matchingPeers = [];
        for (let [name, key] of Object.entries(this._knownHostsStrings)) {
            if (key === publicKeyString) {
                matchingPeers.push(name);
            }
        }
        return matchingPeers;
    }
    savePublicKey(peerName, publicKey) {
        peerName = peerName.split("|")[0].split("(")[0].trim();
        if (publicKey instanceof CryptoKey) {
            return this._dumpKey(publicKey).then((publicKeyString) => {
                this.savePublicKey(peerName, publicKeyString);
                this._knownHostsKeys[peerName] = publicKey;
                return true;
            });
        }else{
            return this.savePublicKeyString(peerName, publicKey);
        }
    }
    savePublicKeyString(peerName, publicKeyString) {
        peerName = peerName.split("|")[0].split("(")[0].trim();
        let matchingPeers = this.getPeerNames(publicKeyString);
        if (matchingPeers.length > 0) {
            console.error("Public key already registered for another peer", matchingPeers);
            throw new Error("Public key already registered for another peer");
        }
        this._knownHostsStrings[peerName] = publicKeyString;
        localStorage.setItem("knownHostsStrings", JSON.stringify(this._knownHostsStrings));
        return true;
    }

    getPublicKey(peerName) {
        peerName = peerName.split("|")[0].split("(")[0].trim();
        let publicKey = this._knownHostsKeys[peerName];
        if (publicKey) { return Promise.resolve(publicKey); }
        let publicKeyString = this._knownHostsStrings[peerName];
        if (publicKeyString) {
            return this._loadPublicKey(publicKeyString).then((publicKey) => {
                this._knownHostsKeys[peerName] = publicKey;
                return publicKey;
            });
        }
        return Promise.resolve(null);
    }
    getPublicKeyString(peerName) {
        peerName = peerName.split("|")[0].split("(")[0].trim();
        return this._knownHostsStrings[peerName];
    }
    removePublicKey(peerName) {
        peerName = peerName.split("|")[0].split("(")[0].trim();
        delete this._knownHostsStrings[peerName];
        delete this._knownHostsKeys[peerName];
        localStorage.setItem("knownHostsStrings", JSON.stringify(this._knownHostsStrings));
    }

    get knownHosts() {
        return Object.entries(this._knownHostsStrings).map(([name, key]) => {
            return name + "|" + key;
        });
    }
    clearOwnKeys() {
        localStorage.removeItem("privateKeyString");
        localStorage.removeItem("publicKeyString");
        this._privateKey = null;
        this._publicKey = null;
        this._privateKeyString = null;
        this.publicKeyString = null;
    }
    clearKnownHosts() {
        localStorage.removeItem("knownHostsStrings");
        this._knownHostsKeys = {};
        this._knownHostsStrings = {};
    }

    reset(){
        this.clearOwnKeys();
        this.clearKnownHosts();
    }

    get name(){return this._name}
    set name(name) {
        if (name.includes("|")) {
            throw new Error("Name cannot contain |");
        }
        this._name = name;
    }

    get identity() {
        if (!this.loaded){return null}
        let name = this.name.split("|")[0].split("(")[0].trim();
        return name + "|" + this.publicKeyString;
    }

    register(identity) {
        let [peerName, publicKeyString] = identity.split("|");
        return this.savePublicKeyString(peerName, publicKeyString);
    }
}



class SignedMQTTRTCClient extends MQTTRTCClient {
    constructor(name, userInfo, questionHandlers, config, generate=true, load=true) {
        super(name, userInfo, questionHandlers, config, false);
        this.keys = new Keys(this.name, generate);
        this.validatedPeers = [];

        this.shouldConnectToUser = this.shouldConnectToUser.bind(this);
        this.shouldConnectToKnownPeer = this.shouldConnectToKnownPeer.bind(this);
        this.shouldConnectToUnkownPeer = this.shouldConnectToUnkownPeer.bind(this);

        this.trust = this.trust.bind(this);
        this.register = this.register.bind(this);
        this.challenge = this.challenge.bind(this);
        this.untrust = this.untrust.bind(this);

        this.validatedCallbacks = [];
        this.failedCallbacks = [];

        this.on('identify', this._returnPublicKey.bind(this));
        this.on('challenge', this._sign.bind(this));
        this.on('connectedtopeer', (peerName)=>{
            setTimeout(()=> {this.trustOrChallenge.bind(this)(peerName)}, 500);
        });

        if (load) {
            this.keys.loadedPromise.then(() => {
                this.userInfo.publicKeyString = this.keys.publicKeyString;
                this.load();
            });
        }
    }
    verifyUser(channel, data, peerName) {
        console.log("Verifying user", channel, data, peerName);
        if (["question", "answer"].includes(channel) && ["identify", "challenge"].includes(data.question.topic)) {
            console.log("should be good", data.question.topic)
            return true;
        }
        return this.validatedPeers.includes(peerName);
    }

    shouldConnectToUser(peerName, userInfo) {
        if (!userInfo.publicKeyString) {
            console.error("No public key for " + peerName);
            return Promise.resolve(false);
        }
        let peerNames = this.keys.getPeerNames(userInfo.publicKeyString);
        if (peerNames) {
            return this.shouldConnectToKnownPeer(peerName, userInfo, peerNames);
        }else {
            return this.shouldConnectToUnkownPeer(peerName, userInfo);
        }
    }
    shouldConnectToKnownPeer(peerName, userInfo, peerNames) {
        return Promise.resolve(true);
    }
    shouldConnectToUnkownPeer(peerName, userInfo) {
        return Promise.resolve(false);
    }
    trustOrChallenge(peerName) {
        this.keys.getPublicKey(peerName).then((publicKey) => {
            if (!publicKey) {
                console.log("No public key found for " + peerName);
                let shouldTrust = this.shouldTrust(peerName);
                if (shouldTrust instanceof Promise) {
                    shouldTrust.then((trust) => {
                        if (trust) {
                            this.trust(peerName);
                        }else{
                            this.untrust(peerName);
                        }
                    });
                    return;
                }else if (shouldTrust) {
                    this.trust(peerName);
                }else{
                    this.untrust(peerName);
                }
            }else{
                this.challenge(peerName);
            }
        });
    }
    shouldTrust(peerName) {
        return true;
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
                console.error("Public key already exists for " + peerName, oldPublicKeyString, publicKeyString);
                throw new Error("Public key already exists for " + peerName);
            }
            return this.keys.verify(publicKeyString, signature, challengeString).then((valid) => {
                if (valid) {
                    console.log("Signature valid for " + peerName + ", trusting and saving public key");
                    this.keys.savePublicKeyString(peerName, publicKeyString);
                    this.onValidatedPeer(peerName, true);
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
                this.validatedPeers.push(peerName);
                this.onValidatedPeer(peerName);
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
        if (event === "validation") {
            this.validatedCallbacks.push(callback);
        }else if (event === "validationfailure") {
            this.failedCallbacks.push(callback);
        }else{
            return super.on(event, callback);
        }
    }

    onValidatedPeer(peerName, trusting=false) {
        if (trusting) {
            console.log("Trusting peer " + peerName + " is who they say they are.");
        }
        console.log("Peer " + peerName + " validated");
        this.validatedCallbacks.forEach((cb) => cb(peerName, trusting));
    }
    onValidationFailed(peerName) {
        console.error("Peer " + peerName + " validation failed");
        this.failedCallbacks.forEach((cb) => cb(peerName));
    }
    untrust(peerName) {
        /* remove a public key from a peer */
        this.keys.removePublicKey(peerName);
        if (this.validatedPeers.includes(peerName)) {
            this.validatedPeers = this.validatedPeers.filter((name) => name !== peerName);
        }
        console.error("Disconnecting from untrusted peer " + peerName);
        this.disconnectFromUser(peerName);
    }
    _sign(challengeString, peerName) {return this.keys.sign(challengeString);}
    register(identity) {return this.keys.register(identity);}
}

export { SignedMQTTRTCClient };


