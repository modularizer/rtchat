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
            for (let [name, key] of Object.entries(this._knownHostsStrings)) {
                if (name.startsWith("anon")){
                    delete this._knownHostsStrings[name];
                }
            }
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
    constructor(configuration) {
        let {name, userInfo, questionHandlers, handlers, topic, generate, load, trustMode} = configuration || {};
        if (load === undefined) {load = true;}
        if (generate === undefined) {generate = true;}


        super({name, userInfo, questionHandlers, handlers, configuration, load: false});
        this.keys = new Keys(this.name, generate);
        this.validatedPeers = [];

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
        // prompt whether to connect to a peer
        let answer = confirm("Do you want to connect to " + peerName + "?");
        return Promise.resolve(answer);
    }
    trustOrChallenge(peerName) {
        this.keys.getPublicKey(peerName).then((publicKey) => {
            if (!publicKey) {
                console.log("No public key found for " + peerName);
                let info = this.completeUserInfo[peerName];
                let trustLevel = info.trustLevel;


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
                console.error("Public key already exists for " + peerName, oldPublicKeyString, publicKeyString);
                throw new Error("Public key already exists for " + peerName);
            }
            return this.keys.verify(publicKeyString, signature, challengeString).then((valid) => {
                if (valid) {
                    console.log("Signature valid for " + peerName + ", trusting and saving public key");
                    this.keys.savePublicKeyString(peerName, publicKeyString);
                    this.onValidatedPeer(peerName, true);
                    this.validatedPeers.push(peerName);
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
                console.log("Validated peers", this.validatedPeers);
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
        if (event === "connectionrequest"){
            this.connectionrequest = callback;
        }else if (event === "validation") {
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


