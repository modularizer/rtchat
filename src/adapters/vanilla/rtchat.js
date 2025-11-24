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
 *     showRoomInput: true,  // Show/hide room input field
 *     topic: 'myroom',      // Chat room name
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

        if (!config.showRoomInput){
            this.chatRoomBox.style.display = "none";
        }
        this.prompt = this.prompt.bind(this);
        this.notify = this.notify.bind(this);
        this.connectionrequest = this.connectionrequest.bind(this);
        let topic = localStorage.getItem('topic') || 'chat';
        this.chatRoom.value = topic;
        this.chatRoom.addEventListener('change', () => {
            localStorage.setItem('topic', this.chatRoom.value);
            this.connectRTC(config);
        })
        this.connectRTC = this.connectRTC.bind(this);
        this.connectRTC(config);
        this.vc = new VC(this.rtc);
        this.vc.hide();
        this.chatVideo.appendChild(this.vc);
        this.lastValidated = "";

    }
    connectRTC(config) {
        config = config || {};
        let topic = localStorage.getItem('topic') || 'chat';
        config.topic = config.topic || topic;
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


        return this.prompt(`Do you want to connect to ${peerName}${info.hint}?`);
    }

    prompt(question) {
        let promise = new Promise((resolve, reject) => {
            let el = document.createElement('div');
            el.innerHTML = question;
            let yes = document.createElement('button');
            yes.innerHTML = "Yes";
            yes.onclick = () => {
                el.remove();
                resolve(true);
            };
            let no = document.createElement('button');
            no.innerHTML = "No";
            no.onclick = () => {
                el.remove();
                reject();
            };
            el.appendChild(yes);
            el.appendChild(no);
            this.messagesEl.appendChild(el);
        });
        return promise;
    }
}

window.RTChat = RTChat;
window.SignedMQTTRTCClient = SignedMQTTRTCClient;

customElements.define('rtc-hat', RTChat);

if (['t','true','yes','y','1'].includes((new URL(import.meta.url).searchParams.get('add') || "").toLowerCase())) {
    window.addEventListener('load', () => {
        document.body.appendChild(document.createElement('rtc-hat'));
    });
}

export { RTChat, SignedMQTTRTCClient, BasicVideoChat };