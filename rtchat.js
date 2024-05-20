import { ChatBox } from "./chat-box.js";
import { SignedMQTTRTCClient } from "./signed-mqtt-rtc.js";
import { VideoChat } from "./video-chat.js";


class RTChat extends ChatBox {
    constructor() {
        super();
        this.prompt = this.prompt.bind(this);
        this.notify = this.notify.bind(this);
        this.connectionrequest = this.connectionrequest.bind(this);
        let topic = localStorage.getItem('topic') || 'chat';
        this.chatRoom.value = topic;
        this.chatRoom.addEventListener('change', () => {
            localStorage.setItem('topic', this.chatRoom.value);
            this.connectRTC();
        })
        this.connectRTC = this.connectRTC.bind(this);
        this.connectRTC();
        this.vc = null;
    }
    connectRTC() {
        let topic = localStorage.getItem('topic') || 'chat';
        this.rtc = new SignedMQTTRTCClient({
            trustMode: 'moderate',
            config: {topic}
        });
        this.rtc.shouldTrust = (peerName) => {return Promise.resolve(true)};
        this.rtc.on('connectionrequest', this.connectionrequest);
        this.incomingCalls = {};
        this.rtc.on('call', (peerName) => {
            let msg = `Accept call from ${peerName}`;
            return this.prompt(`Accept call from ${peerName}`).then(answer => {
                if (!this.vc) {
                    this.vc = new VideoChat(this.rtc);
                    this.chatVideo.appendChild(this.vc);
                }

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
            this.callButton.onclick = () => {
                if (!this.vc) {
                    this.vc = new VideoChat(this.rtc);
                    this.chatVideo.appendChild(this.vc);
                }
                console.warn("Calling", peerName);
                this.rtc.callUser(peerName);
            }
        })
//        this.callButton.style.display = "block";
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

if (['t','true','yes','y','1'].includes(new URL(import.meta.url).searchParams.get('add').toLowerCase())) {
    window.addEventListener('load', () => {
        document.body.appendChild(document.createElement('rtc-hat'));
    });
}