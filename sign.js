
function loadKeys(generate=true) {
    let localPrivateKey = localStorage.getItem("privateKey");
    let localPublicKey = localStorage.getItem("publicKey");
    if (generate !== 'force' && localPrivateKey && localPublicKey) {
        return loadPrivateKey(localPrivateKey).then((privateKey) => {
            return loadPublicKey(localPublicKey).then((publicKey) => {
                console.log("Loaded keys from local storage");
                return {privateKey, publicKey};
            });
        });
    }
    if (!generate) {
        throw new Error("No keys found and generate is false");
    }
    return generateKeys().then((keys) => {
        dumpKey(keys.privateKey).then(v => localStorage.setItem("privateKey", v));
        dumpKey(keys.publicKey).then(v => localStorage.setItem("publicKey", v));
        return keys;
    });
}

let algorithm = {
  name: "RSA-PSS",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: {name: "SHA-256"},
}
let extractable = true;
let keyUsages = ["sign", "verify"];


function generateKeys() {
   try{
   console.log("Generating keys");
  return window.crypto.subtle.generateKey(
    algorithm, extractable, keyUsages
  );
  }catch(e){
        console.error("Error generating keys", e);
        return null;

  }
}

function dumpKey(key){
    console.log("Dumping key", key);
    try{
        let promise = window.crypto.subtle.exportKey("jwk", key).then(JSON.stringify).catch((e) => {console.error("Error exporting key", e); throw e;});
        return promise;
    }catch(e){
        console.error("Error dumping key", e);
        return null;
    }
}
function loadPrivateKey(key){
    try {
        return window.crypto.subtle.importKey("jwk", JSON.parse(key), algorithm, extractable, ["sign"]).catch((e) => {console.error("Error importing key", e); throw e;});
    }catch(e){
        return null;
    }
}
function loadPublicKey(key){
    return window.crypto.subtle.importKey("jwk", JSON.parse(key), algorithm, extractable, ["verify"]).catch((e) => {console.error("Error importing key", e); throw e;});
}

window.dumpKey = dumpKey;
window.loadPrivateKey = loadPrivateKey;
window.loadPublicKey = loadPublicKey;
window.generateKeys = generateKeys;
window.loadKeys = loadKeys;

function makeChallenge(){
    let data = window.crypto.getRandomValues(new Uint8Array(32))
    //get challenge as a string
    let challenge = Array.from(data).map(b => String.fromCharCode(b)).join('');
    return challenge;
}


function signData(challenge, privateKey = null) {

  if (!privateKey) {
    privateKey = localStorage.getItem("privateKey");
    if (privateKey) {
        privateKey = loadKey(privateKey);
    }
  }
  if (!privateKey) {
      throw new Error("No private key found");
  }
  let data = new Uint8Array(challenge.split('').map((c) => c.charCodeAt(0))).buffer;
  console.log("Signing data", challenge, privateKey);

  return window.crypto.subtle.sign(
    {
      name: "RSA-PSS",
      saltLength: 32,
    },
    privateKey,
    data
  ).then((signature) => {
    //convert ArrayBuffer to string
    let signatureString = String.fromCharCode.apply(null, new Uint8Array(signature));
//    let signature2 = new Uint8Array(signatureString.split('').map((c) => c.charCodeAt(0))).buffer;
//    if (signature != signature2) {
//        console.error("Signature mismatch", signature, signature2);
//        throw new Error("Signature mismatch");
//    }
    return signatureString;
  });
}

function savePublicKey(peerName, publicKey) {
    let knownHosts = JSON.parse(localStorage.getItem("knownHosts") || "{}");
    knownHosts[peerName] = dumpKey(publicKey);
    localStorage.setItem("knownHosts", JSON.stringify(knownHosts));
}

function getPublicKey(peerName) {
    let knownHosts = JSON.parse(localStorage.getItem("knownHosts") || "{}");
    if (!knownHosts[peerName]) {
        return Promise.resolve(null);
    }
    return loadPublicKey(knownHosts[peerName]);
}

function verifySignature(publicKey, signatureString, challenge) {
  let signature = new Uint8Array(signatureString.split('').map((c) => c.charCodeAt(0))).buffer;
  let data = new Uint8Array(challenge.split('').map((c) => c.charCodeAt(0))).buffer;
  return window.crypto.subtle.verify(
    {
      name: "RSA-PSS",
      saltLength: 32,
    },
    publicKey,
    signature,
    data
  );
}




class RTCSigner  {
    constructor(rtc, generate=true) {
        this.loaded = false;
        this.loadedPromise = new Promise((resolve, reject) => {
            loadKeys(generate).then((keys) => {
                this.publicKey = keys.publicKey;
                this._privateKey = keys.privateKey;
                this.loaded = true;
                resolve(true);
            });
        });
        this._rtc = null;
        this.validatedPeers = [];
        this.rtc = rtc;

        this.trust = this.trust.bind(this);
        this.register = this.register.bind(this);
        this.challenge = this.challenge.bind(this);
        this.untrust = this.untrust.bind(this);
        this.unregister = this.unregister.bind(this);
        this.reset = this.reset.bind(this);
        this.clearPeerKeys = this.clearPeerKeys.bind(this);
        this.clearOwnKeys = this.clearOwnKeys.bind(this);
    }
    get rtc() {
        return this._rtc;
    }
    set rtc(rtc) {
        if (!this.loaded) {
            this.loadedPromise.then(() => {
                this.rtc = rtc;
            });
            return;
        }
        this._rtc = rtc;
        rtc.on('identify', this._returnPublicKey.bind(this));
        rtc.on('challenge', this._sign.bind(this));
        for (let peerName of this.rtc.connectedUsers) {
            this.trustOrChallenge(peerName);
        }
        rtc.on('connectedtopeer', (peerName) => {
            setTimeout((() => {
                this.trustOrChallenge(peerName);

            }).bind(this), 1000);
        });
    }
    trustOrChallenge(peerName) {
        getPublicKey(peerName).then((publicKey) => {
            if (!publicKey) {
                console.log("No public key found for " + peerName);
                if (confirm("Do you want to trust " + peerName + " (who you have never met) is who they say they are?")) {
                    this.trust(peerName);
                }
            }else{
                this.challenge(peerName);
            }
        });
    }
    _returnPublicKey(challenge, senderName) {
        return dumpKey(this.publicKey).then((dumpedKey) => {
            return signData(challenge, this._privateKey).then((signature) => {
                let answer =  {"dumpedPublicKey": dumpedKey, "signature": signature};
                return answer;
            });
        });
    }

    clearPeerKeys() {
        localStorage.removeItem("knownHosts");
    }
    clearOwnKeys() {
        localStorage.removeItem("privateKey");
        localStorage.removeItem("publicKey");
    }
    reset(){
        this.clearPeerKeys();
        this.clearOwnKeys();
        let keys = loadKeys();
        this.publicKey = keys.publicKey;
        this._privateKey = keys.privateKey;
        this.validatedPeers = [];
    }
    trust(peerName){
        /* trust a peer, assuming they give you a public key they are abe to sign, save that public key to their name */
        let oldPublicKey = JSON.parse(localStorage.getItem("knownHosts") || "{}")[peerName];
        if (oldPublicKey) {
            throw new Error("Public key already exists for " + peerName);
        }
        let challenge = makeChallenge();
        console.log("Requesting public key from " + peerName);
        this.rtc.sendRTCQuestion("identify", challenge, peerName).then(({dumpedPublicKey, signature}) => {
            loadPublicKey(dumpedPublicKey).then((publicKey) => {
                let knownHosts = JSON.parse(localStorage.getItem("knownHosts") || "{}");

                verifySignature(publicKey, signature, challenge).then((valid) => {
                    if (valid) {
                        console.log("Signature valid for " + peerName + ", trusting and saving public key");
                        this.validatedPeers.push(peerName);
                        this.register(peerName, publicKey);
                    } else {
                        console.error("Signature invalid for " + peerName);
                    }
                }).catch((err) => {
                    console.error("Error verifying signature of "+ peerName, err);
                    this.untrust(peerName);
                    throw err;
                });
            });
        })
    }
    register(peerName, publicKey) {
        /* register a public key for a peer */
        if (!publicKey) {
            throw new Error("No public key provided for " + peerName);
        }
        let knownHosts = JSON.parse(localStorage.getItem("knownHosts") || "{}");
        if (Object.values(knownHosts).includes(publicKey)) {
            console.error("Public key already registered for another peer");
            this.untrust(peerName);
            throw new Error("Public key already registered for another peer");
        }
        savePublicKey(peerName, publicKey);
    }
    challenge(peerName) {
        /* challenge a peer to prove they have the private key corresponding to the public key you have saved for them */
        getPublicKey(peerName).then((publicKey) => {
            console.log("Challenging " + peerName);
            return this.rtc.sendRTCQuestion("challenge", challenge, peerName).then((signature) => {
                return verifySignature(publicKey, signature, challenge).then((valid) => {
                    console.log("Signature valid for " + peerName, valid);
                    this.validatedPeers.push(peerName);
                    return valid;
                }, (err) => {
                    console.error("Error verifying signature of "+ peerName, err);
                    this.untrust(peerName);
                    throw err;
                });
            });
        });
    }
    untrust(peerName) {
        /* remove a public key from a peer */
        if (this.validatedPeers.includes(peerName)) {
            this.validatedPeers = this.validatedPeers.filter((name) => name !== peerName);
        }
        console.error("Disconnecting from untrusted peer " + peerName);
        this.rtc.disconnectFromUser(peerName);
    }
    unregister(peerName) {
        /* remove a public key from a peer */
        let knownHosts = JSON.parse(localStorage.getItem("knownHosts") || "{}");
        delete knownHosts[peerName];
        localStorage.setItem("knownHosts", JSON.stringify(knownHosts));
    }
    _sign(challenge, peerName) {
        // always sign challenges when requested
        return signData(challenge, this._privateKey);
    }

    get knownHosts() {
        return JSON.parse(localStorage.getItem("knownHosts") || "{}");
    }
}

export {RTCSigner};


