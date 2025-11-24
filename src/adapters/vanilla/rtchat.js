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
        super();
        config = config || {};
        
        // Check for auto-config from URL parameters (when ?add=true)
        if (this._autoConfig) {
            config = { ...config, ...this._autoConfig };
            delete this._autoConfig;
        }

        // Configure room display and editability
        this.showRoom = config.showRoom !== false; // Default: true
        this.allowRoomChange = config.allowRoomChange !== false; // Default: true

        if (!config.showRoomInput){
            this.chatRoomBox.style.display = "none";
        }
        this.prompt = this.prompt.bind(this);
        this.notify = this.notify.bind(this);
        this.connectionrequest = this.connectionrequest.bind(this);
        this._activeConnectionPrompts = new Map(); // Track active prompts by peer name
        // Use defaultRoom from config if provided, otherwise localStorage, otherwise 'chat'
        let topic = config.topic || localStorage.getItem('topic') || 'chat';
        // If topic is an object, extract the room
        if (typeof topic === 'object' && topic.room) {
            topic = topic.room;
        }
        this.chatRoom.value = topic;
        this.chatRoom.addEventListener('change', () => {
            localStorage.setItem('topic', this.chatRoom.value);
            this.connectRTC(config);
        })
        
        // Listen for room change events from ChatBox
        this.addEventListener('roomchange', (e) => {
            const newRoom = e.detail.room;
            localStorage.setItem('topic', newRoom);
            this.connectRTC(config);
        });
        
        this.connectRTC = this.connectRTC.bind(this);
        this.connectRTC(config);
        this.vc = new VC(this.rtc);
        this.vc.hide();
        this.chatVideo.appendChild(this.vc);
        this.lastValidated = "";

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
        this.incomingCalls = {};
        this.rtc.on('call', (peerName, info, promises) => {
            return this.prompt(`Accept call from ${peerName}`).then(answer => {
                this.callButton.style.display = "none";
                this.endCallButton.style.display = "block";
                return answer
            });
        });

        this.rtc.on('validation', (peerName, trusted) => {
            if (trusted) {
                this.notify(`Trusted ${peerName}`);
            } else {
                this.notify(`Validated ${peerName}`);
            }
            this.callButton.style.display = "block";
            //set help text to show the last validated peer
            this.lastValidated = peerName;
            this.callButton.title = `Call ${this.lastValidated}`;

        })
        this.rtc.on('callended', ()=>{
            this.callButton.style.display = "block";
            this.endCallButton.style.display = "none";
        });
        this.callButton.onclick = () => {
            this.callButton.style.display = "none";
            this.endCallButton.style.display = "block";
            this.vc.call(this.lastValidated);
        }
        this.endCallButton.onclick = () => {
            this.vc.endCall();
        };
        this.rtc.on('validationfailure', (peerName, message) => {
            this.notify(`Validation failed for ${peerName}`);
        });
    }
    notify(message) {
        let el = document.createElement('div');
        el.innerHTML = message;
        el.style.color = 'gray';
        el.style.fontSize = '0.8em';
        this.messagesEl.appendChild(el);
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
        this.messagesEl.appendChild(el);
        
        // Return both the promise and the element for tracking
        return {
            promise: promise,
            element: el
        };
    }
}

window.RTChat = RTChat;
window.SignedMQTTRTCClient = SignedMQTTRTCClient;

customElements.define('rtc-hat', RTChat);

if (['t','true','yes','y','1'].includes((new URL(import.meta.url).searchParams.get('add') || "").toLowerCase())) {
    window.addEventListener('load', () => {
        const urlParams = new URL(import.meta.url).searchParams;
        
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
        
        const chatElement = document.createElement('rtc-hat');
        // Apply config if any parameters were provided
        if (Object.keys(config).length > 0) {
            // Store config in element for RTChat constructor to read
            chatElement._autoConfig = config;
        }
        document.body.appendChild(chatElement);
    });
}

export { RTChat, SignedMQTTRTCClient, BasicVideoChat };