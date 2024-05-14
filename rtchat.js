import { ChatBox } from "./chat.js";
import { SignedMQTTRTCClient } from "./signed-mqtt-rtc.js";


class RTChat extends ChatBox {
    constructor() {
        super();
        this.prompt = this.prompt.bind(this);
        this.notify = this.notify.bind(this);
        this.shouldConnectToKnownPeer = this.shouldConnectToKnownPeer.bind(this);
        this.shouldConnectToUnknownPeer = this.shouldConnectToUnknownPeer.bind(this);

        let topic = localStorage.getItem('topic') || 'chat';
        this.chatRoom.value = topic;
        this.chatRoom.addEventListener('change', () => {
            localStorage.setItem('topic', this.chatRoom.value);
            this.connectRTC();
        })
        this.connectRTC = this.connectRTC.bind(this);
        this.connectRTC();
    }
    connectRTC() {
        let topic = localStorage.getItem('topic') || 'chat';
        this.rtc = new SignedMQTTRTCClient(null, {}, {}, {
            topic: topic
        });
        this.rtc.shouldTrust = (peerName) => {return Promise.resolve(true)};
        this.rtc.shouldConnectToKnownPeer = this.shouldConnectToKnownPeer.bind(this);
        this.rtc.shouldConnectToUnknownPeer = this.shouldConnectToUnknownPeer;
        this.rtc.on('validation', (peerName, trusted) => {
            if (trusted) {
                this.notify(`Trusted ${peerName}`);
            } else {
                this.notify(`Validated ${peerName}`);
            }
        })
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
    shouldConnectToKnownPeer(peerName, userInfo, peerNames) {
        let bareName = peerName.split('|')[0].split('(')[0].trim();
        if (peerNames.includes(bareName)) {
            let otherNames = peerNames.filter((name) => name !== bareName);
            let o = (otherNames.length > 1) ? (' (also known as ' + otherNames.join(', ') + ')') : '';
            this.notify('Connecting to ' + peerName + o);
            return Promise.resolve(true);
        }else{
            let otherNames = peerNames.filter((name) => name !== bareName);
            let o = (otherNames.length > 1) ? (" who's key matches " + otherNames.join(', ') + ')') : '';
            return this.prompt(`Do you want to connect to ${peerName}${o}?`);
        }
    }
    shouldConnectToUnknownPeer(peerName) {
        return this.prompt(`Do you want to connect to ${peerName} (who you have not met)?`);
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