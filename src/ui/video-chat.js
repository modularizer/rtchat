/**
 * Video Chat Components - WebRTC video calling interface
 * 
 * Provides video calling functionality with local and remote video streams.
 * Consists of two classes:
 * - RTCVideoChat: Core logic for managing video streams and calls
 * - BasicVideoChat: Web Component UI for displaying video
 * 
 * Usage:
 *   import { BasicVideoChat } from './video-chat.js';
 *   
 *   const videoChat = new BasicVideoChat(rtcClient, {
 *     window: window,        // Optional: inject window object
 *     assignToWindow: false // Optional: disable window.vc assignment
 *   });
 *   document.body.appendChild(videoChat);
 * 
 *   // Start a call
 *   videoChat.call('PeerName').then(() => {
 *     console.log('Call started');
 *   });
 * 
 *   // End a call
 *   videoChat.endCall('PeerName');
 * 
 * Features:
 * - Local video preview (small overlay)
 * - Remote video display (main view)
 * - Automatic stream management
 * - Multiple peer support
 * - Call state management
 * - Responsive layout
 * 
 * RTCVideoChat (Core Logic):
 * - Manages MediaStream objects (local and remote)
 * - Handles call lifecycle (start, accept, end)
 * - Integrates with RTC client for signaling
 * - Provides callbacks for UI updates (setLocalSrc, setRemoteSrc, hide, show)
 * 
 * BasicVideoChat (Web Component):
 * - Custom element: <video-chat></video-chat>
 * - Displays video elements with proper styling
 * - Handles window resizing (via injected window object)
 * - Auto-hides when no active calls
 * 
 * Integration:
 * The video chat automatically receives 'callconnected' events from the RTC client
 * and displays the video streams. It also handles 'calldisconnected' events.
 * 
 * @module video-chat
 */

class RTCVideoChat  {
    constructor(rtc, setLocalSrc, setRemoteSrc, hide, show) {
        this.setLocalSrc = setLocalSrc;
        this.setRemoteSrc = setRemoteSrc;


        this.accept = this.accept.bind(this);
        this.close = this.close.bind(this);
        this.closeCall = this.closeCall.bind(this);
        this.endCall = this.endCall.bind(this);
        this.setStreamCount = this.setStreamCount.bind(this);

        this._rtc = null;
        if (rtc) {
            this.rtc = rtc;
        }
        this.pendingNames = [];

        this.localStream = null;
        this.remoteStreams = {};

        if (hide) {
            this.hide = hide;
        }
        if (show) {
            this.show = show;
        }
    }
    get rtc() {
        if (!this._rtc) {
            throw new Error("RTC not set");
        }
        return this._rtc;
    }
    set rtc(rtc) {
        this._rtc = rtc;
        rtc.on('callconnected', this.accept);
        rtc.on('calldisconnected', this.endCall);
    }
    get name() {
        return this.rtc.name;
    }
    call(peerName, promise='end') {
        this.pendingNames.push(peerName);
        let {start, end} = this.rtc.callUser(peerName);
        end = end.then((() => {
            this.close(peerName);
        }).bind(this));
        if (promise === 'end') {
            return end;
        }
        return start;
    }
    endCall(peerName = 'all') {
        if (peerName === 'all') {
            for (let name of Object.keys(this.remoteStreams)) {
                this.endCall(name);
            }
        }
        if (this.remoteStreams[peerName]){
            this.rtc.endCallWithUser(peerName);
        }
        this.closeCall(peerName);
    }

    accept(name, streams) {
        if (streams instanceof Promise) {
            streams.then(streams => this.accept(name, streams));
            return;
        }
        if (this.pendingNames.includes(name)) {
            this.pendingNames = this.pendingNames.filter(n => n !== name);
        }

        if (!this.localStream) {
            this.localStream = streams.localStream;
            this.setLocalSrc(this.localStream);
        }
        this.setRemoteSrc(streams.remoteStream, name);
        this.remoteStreams[name] = streams.remoteStream;
        this.setStreamCount(Object.keys(this.remoteStreams).length);
    }
    closeCall(peerName) {
        this.pendingNames = this.pendingNames.filter(name => name !== peerName);
        this.setRemoteSrc(null, peerName);
        let rs = this.remoteStreams[peerName];
        if (rs){
            try {
                rs.getTracks().forEach(track => track.stop());
            }catch{}
            delete this.remoteStreams[peerName];
            this.setStreamCount(Object.keys(this.remoteStreams).length);
        }
    }
    setStreamCount(count) {
        if (!count) {
            if (this.localStream) {
                try{
                    this.localStream.getTracks().forEach(track => track.stop());
                }catch{}
                this.setLocalSrc(null);
                this.localStream = null;
            }
            this.setLocalSrc(null);
            this.localStream = null;
            this.hide();
        }else{
            this.show();
        }
    }
    hide() {

    }
    show() {

    }
    close() {
        // end the streams
        this.endCall();
    }
}


class BasicVideoChat extends HTMLElement {
    constructor(rtc, options = {}) {
        super();
        
        // Inject window object or use global window
        this._window = options.window || (typeof window !== 'undefined' ? window : null);
        this._assignToWindow = options.assignToWindow !== false;
        
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                #container {
                    position: relative;
                    width: 100%;
                    height: 100%; /* Full height of the container */
                    max-width: 50vw;
                    max-height: 50vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                #remoteVideo, #localVideo {
                    max-width: 100%;
                    height: auto; /* Maintain aspect ratio */
                }

                #remoteVideo {
                    width: 100%; /* Full width of the container */
                    max-width: 50vw;
                    max-height: 50vh;
                }

                #localVideo {
                    position: absolute;
                    width: 20%; /* Smaller size for local video */
                    top: 10px;
                    right: 10px;
                    border: 2px solid white;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                    max-height: 100%;
                }

            </style>
            <div id="container">
                <video id="remoteVideo" autoplay playsinline></video>
                <video id="localVideo" autoplay playsinline muted></video>
            </div>
        `;
        this.localVideo = this.shadowRoot.getElementById('localVideo');
        this.remoteVideo = this.shadowRoot.getElementById('remoteVideo');
        this.container = this.shadowRoot.getElementById('container');
        this.setLocalSrc = this.setLocalSrc.bind(this);
        this.setRemoteSrc = this.setRemoteSrc.bind(this);
        this.hide = this.hide.bind(this);
        this.show = this.show.bind(this);
        this.resize = this.resize.bind(this);
        
        // Add resize listener if window is available
        if (this._window) {
            this._window.addEventListener('resize', this.resize);
        }
        
        this.rtcVC = new RTCVideoChat(rtc,
            this.setLocalSrc,
            this.setRemoteSrc,
            this.hide,
            this.show
        );
        
        // Optional window assignment
        if (this._assignToWindow && this._window) {
            this._window.vc = this;
        }

        this.call = this.rtcVC.call.bind(this.rtcVC);
        this.endCall = this.rtcVC.endCall.bind(this.rtcVC);
        this.hide = this.rtcVC.hide.bind(this.rtcVC);
        this.show = this.rtcVC.show.bind(this.rtcVC);
        return this;
    }
    setLocalSrc(src) {
        this.localVideo.srcObject = src;
    }
    setRemoteSrc(src) {
        this.remoteVideo.srcObject = src;
    }
    hide() {
        this.container.style.display = "none";
    }
    show() {
        this.container.style.display = "flex";
    }
    resize() {
        if (!this._window) return;
        
        // Optionally adjust the size based on the window size or other conditions
        const width = this._window.innerWidth;
        const height = this._window.innerHeight;

        // Example: Adjust max-width/max-height based on conditions
        this.container.style.maxWidth = width > 600 ? '50vw' : '80vw';
        this.container.style.maxHeight = height > 600 ? '50vh' : '80vh';
    }

    // Don't forget to remove the event listener when the element is disconnected
    disconnectedCallback() {
        if (this._window) {
            this._window.removeEventListener('resize', this.resize);
        }
    }

}

customElements.define('video-chat', BasicVideoChat);

export { BasicVideoChat, RTCVideoChat };