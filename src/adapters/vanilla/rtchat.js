/**
 * RTChat - Complete chat application with video calling and identity verification
 * 
 * This is the main entry point for the RTChat application. It combines:
 * - ChatBox: UI for text messaging
 * - SignedMQTTRTCClient: Secure RTC client with cryptographic identity verification
 * - BasicVideoChat: Video calling interface
 * 
 * Usage:
 *   <!-- Auto-add to page -->
 *   <script type="module" src="./rtchat.js?add=true"></script>
 *   
 *   <!-- Or manually create -->
 *   <rtc-hat></rtc-hat>
 *   <script type="module">
 *     import { RTChat } from './rtchat.js';
 *     const chat = document.querySelector('rtc-hat');
 *   </script>
 * 
 * Features:
 * - Text chat with room-based messaging
 * - Video/audio calling between peers
 * - Cryptographic identity verification (RSA-PSS)
 * - Trust level management (strict, moderate, lax, etc.)
 * - Connection request prompts
 * - Validation notifications
 * - Persistent room/name settings in localStorage
 * 
 * Configuration:
 *   const chat = new RTChat({
 *     showRoom: true,        // Show/hide room name in header (default: true)
 *     allowRoomChange: true, // Allow editing room name (default: true)
 *     showRoomInput: true,   // Show/hide legacy room input field
 *     topic: 'myroom',       // Chat room name
 *     trustMode: 'moderate' // Trust level: 'strict', 'moderate', 'lax', 'unsafe', etc.
 *   });
 * 
 * Trust Modes:
 * - strict: Only trust known peers, prompt for others
 * - moderate: Trust known peers and aliases, prompt for suspicious cases
 * - lax: Trust most peers, prompt only for very suspicious cases
 * - unsafe: Trust everyone (not recommended)
 * 
 * Events:
 * - 'connectionrequest': Fired when a peer wants to connect (returns Promise<boolean>)
 * - 'validation': Fired when a peer is validated (peerName, trusted)
 * - 'validationfailure': Fired when validation fails (peerName, message)
 * - 'call': Fired when receiving a call (peerName, info, promises)
 * - 'callended': Fired when a call ends
 * 
 * @module rtchat
 */

import { ChatBox } from "../../ui/chat-box.js";
import { SignedMQTTRTCClient } from "../../core/signed-client.js";
import { BasicVideoChat } from "../../ui/video-chat.js";


class RTChat extends ChatBox {
    constructor(config, VC = BasicVideoChat) {
        // Must call super() first before accessing 'this'
        super(config || {});
        
        // Store config for later use (use this.config from parent, or merge with provided config)
        const providedConfig = config || {};
        this._config = { ...this.config, ...providedConfig };
        
        // Store VC for later use
        this._VC = VC;
        
        // Flag to track if we've applied auto-config
        this._autoConfigApplied = false;
        this._VC = VC;

        // Configure room display and editability
        this.showRoom = this._config.showRoom !== false; // Default: true
        this.allowRoomChange = this._config.allowRoomChange !== false; // Default: true

        // Note: chatRoomBox no longer exists - room input is now in ChatHeader component
        // The showRoomInput config is handled by ChatHeader's showRoom config
        
        this.prompt = this.prompt.bind(this);
        this.notify = this.notify.bind(this);
        this.connectionrequest = this.connectionrequest.bind(this);
        this._activeConnectionPrompts = new Map(); // Track active prompts by peer name
        
        // Use defaultRoom from config if provided, otherwise localStorage, otherwise 'chat'
        let topic = this._config.topic || localStorage.getItem('topic') || 'chat';
        // If topic is an object, extract the room
        if (typeof topic === 'object' && topic.room) {
            topic = topic.room;
        }
        
        // Set room in ChatHeader component
        if (this.chatHeaderComponent) {
            this.chatHeaderComponent.setRoom(topic);
        }
        
        // Listen for room change events from ChatHeader component
        if (this.chatHeaderComponent) {
            this.chatHeaderComponent.addEventListener('roomchange', (e) => {
                const newRoom = e.detail.room;
                localStorage.setItem('topic', newRoom);
                this.connectRTC(this._config);
            });
        }
        
        // Also listen for room change events from ChatBox (backward compatibility)
        this.addEventListener('roomchange', (e) => {
            const newRoom = e.detail.room;
            localStorage.setItem('topic', newRoom);
            this.connectRTC(this._config);
        });
        
        this.connectRTC = this.connectRTC.bind(this);
        this.connectRTC(this._config);
        // Don't add BasicVideoChat if ChatBox is using VideoStreamDisplay
        // ChatBox now handles video display internally, so we skip the legacy VC component
        // this.vc = new VC(this.rtc);
        // this.vc.hide();
        // this.chatVideo.appendChild(this.vc);
        this.lastValidated = "";

    }
    
    /**
     * Called when the element is connected to the DOM
     * Use this to apply auto-config that was set before element creation
     */
    connectedCallback() {
        // Check for auto-config from URL parameters (when ?add=true)
        // Check if there's a pending config in the queue
        if (autoConfigPending.length > 0 && !this._autoConfigApplied) {
            const autoConfig = autoConfigPending.shift(); // Get and remove first pending config
            this._autoConfigApplied = true;
            
            // Merge auto-config into existing config
            Object.assign(this.config, autoConfig);
            // Also update _config for RTChat-specific properties
            this._config = { ...this._config, ...autoConfig };
            
            // Re-apply config-dependent settings
            this.showRoom = this._config.showRoom !== false;
            this.allowRoomChange = this._config.allowRoomChange !== false;
            
            // Re-initialize with new config if needed
            if (this._config.topic) {
                let topic = this._config.topic;
                if (typeof topic === 'object' && topic.room) {
                    topic = topic.room;
                }
                // Set room in ChatHeader component
                if (this.chatHeaderComponent) {
                    this.chatHeaderComponent.setRoom(topic);
                }
                // Reconnect with new config
                if (this.connectRTC) {
                    this.connectRTC(this._config);
                }
            }
        }
        
        // Call parent's connectedCallback if it exists
        if (super.connectedCallback) {
            super.connectedCallback();
        }
    }
    
    connectRTC(config) {
        config = config || {};
        // Use topic from config if provided, otherwise localStorage, otherwise 'chat'
        let topic = config.topic || localStorage.getItem('topic') || 'chat';
        // If topic is an object, extract the room
        if (typeof topic === 'object' && topic.room) {
            topic = topic.room;
        }
        // Use new nested config format
        if (!config.topic || typeof config.topic === 'string') {
            config.topic = { room: config.topic || topic };
        } else if (!config.topic.room) {
            config.topic.room = topic;
        }
        config.trustMode = config.trustMode || 'moderate';
        this.rtc = new SignedMQTTRTCClient(config);
        this.rtc.shouldTrust = (peerName) => {return Promise.resolve(true)};
        this.rtc.on('connectionrequest', this.connectionrequest);
        // Note: Incoming calls are now handled by CallManager, not here
        // The 'call' event is handled by CallManager._handleIncomingCall which uses
        // CallUIInterface.showIncomingCallPrompt (implemented by CallManagement)
        // DO NOT add a direct 'call' event handler here - it will add prompts to messages!
        
        // Note: callended events are now handled by CallManager
        // DO NOT add cleanup here for pending calls - CallManager handles this

        this.rtc.on('validation', (peerName, trusted) => {
            if (trusted) {
                this.notify(`Trusted ${peerName}`);
            } else {
                this.notify(`Validated ${peerName}`);
            }
            // Update call button visibility if callButton exists (legacy support)
            if (this.callButton) {
                this.callButton.style.display = "block";
                this.callButton.title = `Call ${peerName}`;
            }
            //set help text to show the last validated peer
            this.lastValidated = peerName;
        })
        this.rtc.on('callended', ()=>{
            // Update button visibility if buttons exist (legacy support)
            if (this.callButton) {
                this.callButton.style.display = "block";
            }
            if (this.endCallButton) {
                this.endCallButton.style.display = "none";
            }
        });
        // Legacy call button handlers - only if vc exists (disabled since we're using ChatBox video display)
        // if (this.callButton && this.vc) {
        //     this.callButton.onclick = () => {
        //         this.callButton.style.display = "none";
        //         if (this.endCallButton) {
        //             this.endCallButton.style.display = "block";
        //         }
        //         this.vc.call(this.lastValidated);
        //     }
        // }
        // if (this.endCallButton && this.vc) {
        //     this.endCallButton.onclick = () => {
        //         this.vc.endCall();
        //     };
        // }
        this.rtc.on('validationfailure', (peerName, message) => {
            this.notify(`Validation failed for ${peerName}`);
        });
    }
    notify(message) {
        // Use ChatBox's cached messages element (cached as 'messages' -> this.messages)
        const messagesEl = this.messages || this.shadowRoot?.getElementById('messages');
        if (messagesEl) {
            let el = document.createElement('div');
            el.innerHTML = message;
            el.style.color = 'gray';
            el.style.fontSize = '0.8em';
            messagesEl.appendChild(el);
        } else {
            console.warn('Cannot display notification: messages element not found', message);
        }
    }

    /**
     * Show a missed call notification message
     * @param {string} peerName - Name of the peer
     * @param {string} direction - 'incoming' or 'outgoing'
     * @private
     */
    _showMissedCallMessage(peerName, direction) {
        const message = direction === 'incoming' 
            ? `Missed call from ${peerName}`
            : `${peerName} missed your call`;
        
        // Create a notification-style message element
        const messageEl = document.createElement('div');
        messageEl.style.color = '#666';
        messageEl.style.fontSize = '0.85em';
        messageEl.style.fontStyle = 'italic';
        messageEl.style.marginBottom = '5px';
        messageEl.style.padding = '5px';
        messageEl.style.backgroundColor = '#fff3cd';
        messageEl.style.borderLeft = '3px solid #ffc107';
        messageEl.style.borderRadius = '3px';
        messageEl.textContent = message;
        
        // Add to messages
        const messagesEl = this.messages || this.shadowRoot?.getElementById('messages');
        if (messagesEl) {
            messagesEl.appendChild(messageEl);
            // Auto-scroll to bottom
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }

    connectionrequest(peerName, info) {
        let {bareName, userInfo, providedPubKey, peerNames, knownPubKey, knownName, otherNamesForPubKey, otherPubKeyForName, completedChallenge,
        explanation, suspiciousness, category, trustLevel, trustLevelString} = info;
        console.log("connectionrequest", peerName, trustLevel, trustLevelString, explanation, info);

        // Check localStorage for auto-accept setting
        const autoAcceptEnabled = localStorage.getItem('rtchat_autoAccept') === 'true';
        if (autoAcceptEnabled) {
            console.log("Auto-accepting connection request from", peerName);
            return Promise.resolve(true);
        }

        // Remove existing prompt for this peer if it exists
        if (this._activeConnectionPrompts.has(peerName)) {
            const existingPrompt = this._activeConnectionPrompts.get(peerName);
            if (existingPrompt && existingPrompt.element && existingPrompt.element.parentNode) {
                existingPrompt.element.remove();
            }
            // Reject the old promise
            if (existingPrompt && existingPrompt.reject) {
                existingPrompt.reject(new Error('Replaced by new connection request'));
            }
            this._activeConnectionPrompts.delete(peerName);
        }

        // Ensure hint is defined (default to empty string if not set)
        const hint = info.hint || '';
        const promptText = `Do you want to connect to ${peerName}${hint}?`;
        
        // Create a new promise for this prompt
        let promptResolve, promptReject;
        const promptPromise = new Promise((resolve, reject) => {
            promptResolve = resolve;
            promptReject = reject;
        });
        
        // Show the prompt with three options and get the element
        const promptResult = this.prompt(promptText, true); // true = show auto-accept option
        const promptElement = promptResult.element;
        
        // Track this prompt
        this._activeConnectionPrompts.set(peerName, {
            element: promptElement,
            resolve: promptResolve,
            reject: promptReject
        });
        
        // When user responds, clean up
        promptResult.promise.then((result) => {
            this._activeConnectionPrompts.delete(peerName);
            promptResolve(result);
        }).catch((error) => {
            this._activeConnectionPrompts.delete(peerName);
            promptReject(error);
        });
        
        return promptPromise;
    }

    prompt(question, showAutoAccept = false) {
        let el = document.createElement('div');
        el.style.marginBottom = '10px';
        
        // Question text
        let questionEl = document.createElement('div');
        questionEl.innerHTML = question;
        questionEl.style.marginBottom = '8px';
        el.appendChild(questionEl);
        
        // Button container (on separate row)
        let buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';
        buttonContainer.style.flexWrap = 'wrap';
        
        let yes = document.createElement('button');
        yes.innerHTML = "Yes";
        let no = document.createElement('button');
        no.innerHTML = "No";
        
        buttonContainer.appendChild(yes);
        buttonContainer.appendChild(no);
        
        // Create promise first, then attach handlers
        let resolveFn, rejectFn;
        const promise = new Promise((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });
        
        yes.onclick = () => {
            el.remove();
            resolveFn(true);
        };
        no.onclick = () => {
            el.remove();
            rejectFn();
        };
        
        // Add auto-accept option if requested
        if (showAutoAccept) {
            let autoAccept = document.createElement('button');
            autoAccept.innerHTML = "Auto-accept everyone";
            autoAccept.onclick = () => {
                // Store preference in localStorage
                localStorage.setItem('rtchat_autoAccept', 'true');
                el.remove();
                resolveFn(true);
            };
            buttonContainer.appendChild(autoAccept);
        }
        
        el.appendChild(buttonContainer);
        const messagesEl = this.messages || this.shadowRoot?.getElementById('messages');
        if (messagesEl) {
            messagesEl.appendChild(el);
        }
        
        // Return both the promise and the element for tracking
        return {
            promise: promise,
            element: el
        };
    }

    promptWithOptions(question, options) {
        let el = document.createElement('div');
        el.style.marginBottom = '10px';
        
        // Question text
        let questionEl = document.createElement('div');
        questionEl.innerHTML = question;
        questionEl.style.marginBottom = '8px';
        el.appendChild(questionEl);
        
        // Button container (on separate row)
        let buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';
        buttonContainer.style.flexWrap = 'wrap';
        
        // Create promise first, then attach handlers
        let resolveFn, rejectFn;
        const promise = new Promise((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });
        
        // Create buttons for each option
        options.forEach(option => {
            let btn = document.createElement('button');
            btn.innerHTML = option.text;
            btn.onclick = () => {
                el.remove();
                resolveFn(option.value);
            };
            buttonContainer.appendChild(btn);
        });
        
        el.appendChild(buttonContainer);
        const messagesEl = this.messages || this.shadowRoot?.getElementById('messages');
        if (messagesEl) {
            messagesEl.appendChild(el);
        }
        
        // Return both the promise and the element for tracking
        return {
            promise: promise,
            element: el
        };
    }
}

window.RTChat = RTChat;
window.SignedMQTTRTCClient = SignedMQTTRTCClient;

// Global config queue for auto-config (before element creation)
// Store pending configs in an array - we'll match them to elements in connectedCallback
const autoConfigPending = [];

customElements.define('rtc-hat', RTChat);

// Get script URL - works for both ES modules and IIFE bundles
function getScriptUrl() {
    // For ES modules
    if (typeof import.meta !== 'undefined' && import.meta.url) {
        return import.meta.url;
    }
    // For IIFE bundles (regular script tags)
    if (typeof document !== 'undefined') {
        const script = document.currentScript || 
            Array.from(document.getElementsByTagName('script')).pop();
        if (script && script.src) {
            return script.src;
        }
    }
    // Fallback
    return window.location.href;
}

if (['t','true','yes','y','1'].includes((new URL(getScriptUrl()).searchParams.get('add') || "").toLowerCase())) {
    window.addEventListener('load', () => {
        const urlParams = new URL(getScriptUrl()).searchParams;
        
        // Parse search parameters
        const config = {};
        
        // showRoom: default true, set to false if 'false', '0', 'no', etc.
        const showRoomParam = urlParams.get('showRoom');
        if (showRoomParam !== null) {
            config.showRoom = !['false', '0', 'no', 'n', 'f'].includes(showRoomParam.toLowerCase());
        }
        
        // editableRoom (allowRoomChange): default true, set to false if 'false', '0', 'no', etc.
        const editableRoomParam = urlParams.get('editableRoom');
        if (editableRoomParam !== null) {
            config.allowRoomChange = !['false', '0', 'no', 'n', 'f'].includes(editableRoomParam.toLowerCase());
        }
        
        // defaultRoom: set the initial room/topic
        const defaultRoomParam = urlParams.get('defaultRoom');
        if (defaultRoomParam !== null) {
            config.topic = defaultRoomParam;
        }
        
        // Store config in pending queue BEFORE creating element
        if (Object.keys(config).length > 0) {
            autoConfigPending.push(config);
        }
        
        // Create element - constructor will run immediately
        // Don't set any properties on the element during or immediately after creation
        const chatElement = document.createElement('rtc-hat');
        
        // Append to DOM - this will trigger connectedCallback which will apply the config
        document.body.appendChild(chatElement);
    });
}

export { RTChat, SignedMQTTRTCClient, BasicVideoChat };