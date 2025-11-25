/**
 * BasicVideoChat - Web Component UI for displaying video
 * 
 * This is a UI component that uses RTCVideoChat (from core) for business logic.
 * It provides a Web Component interface for video calling.
 * 
 * Usage:
 *   import { BasicVideoChat } from './video-chat.js';
 *   import { RTCVideoChat } from '../core/rtc-video-chat.js';
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
 * @module video-chat
 */

import { RTCVideoChat } from '../core/rtc-video-chat.js';


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

export { BasicVideoChat };