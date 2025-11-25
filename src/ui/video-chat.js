/**
 * BasicVideoChat - Web Component UI for displaying video
 * 
 * HTMLElement-based implementation that extends VideoChatHTMLElementBase,
 * which provides both HTMLElement functionality and VideoChatBase contract.
 * 
 * This is a UI component that uses RTCVideoChat (from core) for business logic.
 * It provides a Web Component interface for video calling.
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
 * @module video-chat
 */

import { VideoChatHTMLElementBase } from './base-html/video-chat-html-base.js';

class BasicVideoChat extends VideoChatHTMLElementBase {
    constructor(rtc, options = {}) {
        super(rtc, options);
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
        this.localVideo = this.queryRoot('#localVideo');
        this.remoteVideo = this.queryRoot('#remoteVideo');
        this.container = this.queryRoot('#container');
        
        // Initialize RTCVideoChat after DOM is set up
        this._initializeRTCVideoChat(rtc);
    }
    
    /**
     * Initialize the component
     * @protected
     */
    _initialize() {
        // Component is ready after shadow DOM is set up
    }
    
    /**
     * Get the container element
     * Implements VideoChatHTMLElementBase._getContainer
     * @returns {HTMLElement|null} Container element
     * @protected
     */
    _getContainer() {
        return this.container;
    }
    /**
     * Set the local video source (MediaStream)
     * Implements VideoChatBase.setLocalSrc
     * @param {MediaStream|null} src - MediaStream to display, or null to clear
     */
    setLocalSrc(src) {
        if (this.localVideo) {
            this.localVideo.srcObject = src;
        }
    }
    
    /**
     * Set the remote video source (MediaStream)
     * Implements VideoChatBase.setRemoteSrc
     * @param {MediaStream|null} src - MediaStream to display, or null to clear
     */
    setRemoteSrc(src) {
        if (this.remoteVideo) {
            this.remoteVideo.srcObject = src;
        }
    }
    
    /**
     * Hide the video chat UI
     * Implements VideoChatBase.hide
     */
    hide() {
        if (this.container) {
            this.container.style.display = "none";
        }
    }
    
    /**
     * Show the video chat UI
     * Implements VideoChatBase.show
     */
    show() {
        if (this.container) {
            this.container.style.display = "flex";
        }
    }
    
    /**
     * Handle window resize
     * Overrides VideoChatHTMLElementBase.resize
     */
    resize() {
        super.resize(this._window);
    }
    
    /**
     * Cleanup when element is disconnected
     */
    disconnectedCallback() {
        super.disconnectedCallback();
    }

}

if (!customElements.get('video-chat')) {
  customElements.define('video-chat', BasicVideoChat);
}

export { BasicVideoChat };