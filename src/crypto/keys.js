/**
 * Keys - Cryptographic key management for identity verification
 * 
 * Manages RSA-PSS key pairs for signing and verification.
 * Handles key generation, storage, and challenge/response operations.
 * 
 * @param {string} name - The name associated with these keys
 * @param {boolean|'force'} generate - Whether to generate new keys if none exist. 'force' will always generate.
 * @param {Object} dependencies - Injected dependencies
 * @param {StorageAdapter} [dependencies.storage] - Storage adapter for key persistence. Falls back to localStorage if available.
 * @param {Crypto} [dependencies.crypto] - Web Crypto API instance. Falls back to window.crypto if available.
 */

export class Keys {
  algorithm = {
    name: "RSA-PSS",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: {name: "SHA-256"},
  }
  extractable = true;
  keyUsages = ["sign", "verify"];

  constructor(name, generate=true, { storage = null, crypto = null } = {}) {
    this._name = null;
    this.name = name;
    
    // Use storage adapter if provided, otherwise fall back to localStorage
    this.storage = storage || (typeof localStorage !== 'undefined' ? {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key)
    } : null);
    
    // Use crypto if provided, otherwise fall back to window.crypto
    this.crypto = crypto || (typeof window !== 'undefined' && window.crypto ? window.crypto : null);
    
    if (!this.crypto || !this.crypto.subtle) {
      throw new Error("Web Crypto API not available. Please provide a crypto instance via constructor.");
    }

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
      if (!this.storage) {
        this._knownHostsStrings = {};
        this._knownHostsKeys = {};
      } else {
        this._knownHostsStrings = JSON.parse(this.storage.getItem("knownHostsStrings") || "{}");
        for (let [name, key] of Object.entries(this._knownHostsStrings)) {
          if (name.startsWith("anon")){
            delete this._knownHostsStrings[name];
          }
        }
        this._knownHostsKeys = {};
      }
      
      this._privateKey = keys.privateKey;
      this._publicKey = keys.publicKey;
      this._privateKeyString = keys.privateKeyString;
      this.publicKeyString = keys.publicKeyString;
      
      if (this.storage) {
        this.storage.setItem("privateKeyString", this._privateKeyString);
        this.storage.setItem("publicKeyString", this.publicKeyString);
      }
      
      this.loaded = true;
      this.loading = false;
      return this.publicKeyString;
    });
    return this.loadedPromise;
  }
  
  _loadKeys(generate=true) {
    if (!this.storage) {
      if (!generate) {
        throw new Error("No storage available and generate is false");
      }
      return this.generate();
    }
    
    let privateKeyString = this.storage.getItem("privateKeyString");
    let publicKeyString = this.storage.getItem("publicKeyString");
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
    return this.crypto.subtle.generateKey(
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
    return this.crypto.subtle.exportKey("jwk", key).then(JSON.stringify);
  }
  
  _loadPrivateKey(key){
    return this.crypto.subtle.importKey("jwk", JSON.parse(key), this.algorithm, this.extractable, ["sign"])
  }
  
  _loadPublicKey(key){
    return this.crypto.subtle.importKey("jwk", JSON.parse(key), this.algorithm, this.extractable, ["verify"])
  }
  
  getChallengeString() {
    return Array.from(this.crypto.getRandomValues(new Uint8Array(32))).map(b => String.fromCharCode(b)).join('');
  }
  
  sign(challenge) {
    if (this.loading && !this._loaded) {
      return this.loadedPromise.then(() => this.sign(challenge));
    }
    return this.crypto.subtle.sign(
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
      return this.crypto.subtle.verify(
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
    if (!this._knownHostsStrings) return matchingPeers;
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
    if (this.storage) {
      this.storage.setItem("knownHostsStrings", JSON.stringify(this._knownHostsStrings));
    }
    return true;
  }

  getPublicKey(peerName) {
    peerName = peerName.split("|")[0].split("(")[0].trim();
    let publicKey = this._knownHostsKeys?.[peerName];
    if (publicKey) { return Promise.resolve(publicKey); }
    let publicKeyString = this._knownHostsStrings?.[peerName];
    if (publicKeyString) {
      return this._loadPublicKey(publicKeyString).then((publicKey) => {
        if (!this._knownHostsKeys) this._knownHostsKeys = {};
        this._knownHostsKeys[peerName] = publicKey;
        return publicKey;
      });
    }
    return Promise.resolve(null);
  }
  
  getPublicKeyString(peerName) {
    peerName = peerName.split("|")[0].split("(")[0].trim();
    return this._knownHostsStrings?.[peerName] || null;
  }
  
  removePublicKey(peerName) {
    peerName = peerName.split("|")[0].split("(")[0].trim();
    if (this._knownHostsStrings) {
      delete this._knownHostsStrings[peerName];
    }
    if (this._knownHostsKeys) {
      delete this._knownHostsKeys[peerName];
    }
    if (this.storage) {
      this.storage.setItem("knownHostsStrings", JSON.stringify(this._knownHostsStrings || {}));
    }
  }

  get knownHosts() {
    if (!this._knownHostsStrings) return [];
    return Object.entries(this._knownHostsStrings).map(([name, key]) => {
      return name + "|" + key;
    });
  }
  
  clearOwnKeys() {
    if (this.storage) {
      this.storage.removeItem("privateKeyString");
      this.storage.removeItem("publicKeyString");
    }
    this._privateKey = null;
    this._publicKey = null;
    this._privateKeyString = null;
    this.publicKeyString = null;
  }
  
  clearKnownHosts() {
    if (this.storage) {
      this.storage.removeItem("knownHostsStrings");
    }
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

