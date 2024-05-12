import { ChatBox } from "./chat.js";
import { MQTTRTCClient } from "./mqtt-rtc.js";


class RTChat extends ChatBox {
    constructor() {
        super();
        this.rtc = new MQTTRTCClient();
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