import { ChatBox } from "./chat.js";
import { MQTTRTCClient } from "./mqtt-rtc.js";
import { RTCSigner } from "./sign.js";


class RTChat extends ChatBox {
    constructor() {
        super();
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
        this.rtc = new MQTTRTCClient(null, {}, {}, {
            topic: topic
        });
        this.signer = new RTCSigner(this.rtc);
        this.signer.shouldTrust = this.shouldTrust.bind(this);
        this.signer.on('validation', (peerName, trusted) => {
            if (trusted) {
                this._addMessage(`Trusted ${peerName}`);
            } else {
                this._addMessage(`Validated ${peerName}`);
            }
        })
        this.signer.on('validationfailure', (peerName, message) => {
            this._addMessage(`Validation failed for ${peerName}`);
        });
    }
    _addMessage(message) {
        let el = document.createElement('div');
        el.innerHTML = message;
        el.style.color = 'gray';
        el.style.fontSize = '0.8em';
        this.messagesEl.appendChild(el);
    }
    shouldTrust(peerName) {
        let promise = new Promise((resolve, reject) => {
            let el = document.createElement('div');
            el.innerHTML = `Do you trust ${peerName}?`;
            let yes = document.createElement('button');
            yes.innerHTML = "Yes";
            yes.onclick = () => {
                this.signer.trust(peerName);
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

window.ChatBox = ChatBox;
window.RTChat = RTChat;
window.MQTTRTCClient = MQTTRTCClient;

customElements.define('rtc-hat', RTChat);

if (['t','true','yes','y','1'].includes(new URL(import.meta.url).searchParams.get('add').toLowerCase())) {
    window.addEventListener('load', () => {
        document.body.appendChild(document.createElement('rtc-hat'));
    });
}