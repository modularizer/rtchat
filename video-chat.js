class VideoChat extends HTMLElement {
    constructor(rtc, peerName) {
        super();
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
        window.addEventListener('resize', this.resize.bind(this));
        this.show = this.show.bind(this);
        this.close = this.close.bind(this);
        this._rtc = null;
        if (rtc) {
            this.rtc = rtc;
        }
        this.calling = null;
        this.peerName = peerName;
        window.vc = this;
    }
    get rtc() {
        if (!this._rtc) {
            throw new Error("RTC not set");
        }
        return this._rtc;
    }
    set rtc(rtc) {
        this._rtc = rtc;
        rtc.on('callconnected', this.show);
    }
    get name() {
        return this.rtc.name;
    }
    call(peerName, promise='end') {
        peerName = peerName || this.peerName;
        this.calling = peerName;
        let {start, end} = this.rtc.callUser(peerName);
        end = end.then((() => {
            this.calling = null;
            this.close();
        }).bind(this));
        if (promise === 'end') {
            return end;
        }
        return start;
    }
    endCall() {
        this.rtc.endCallWithUser(this.calling);
        this.calling = null;
    }

    get localVideo() {
        return this.shadowRoot.getElementById('localVideo');
    }

    get remoteVideo() {
        return this.shadowRoot.getElementById('remoteVideo');
    }

    show(name, streams) {
        if (streams instanceof Promise) {
            streams.then(streams => this.show(streams));
            return;
        }
        let {localStream, remoteStream} = streams;
        console.log("Showing streams", localStream, remoteStream);
        this.localVideo.srcObject = localStream;
        this.remoteVideo.srcObject = remoteStream;
    }
    close() {
        // end the streams
        this.localVideo.srcObject = null;
        this.remoteVideo.srcObject = null;
    }
    resize() {
        // Optionally adjust the size based on the window size or other conditions
        const container = this.shadowRoot.getElementById('container');
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Example: Adjust max-width/max-height based on conditions
        container.style.maxWidth = width > 600 ? '50vw' : '80vw';
        container.style.maxHeight = height > 600 ? '50vh' : '80vh';
    }

    // Don't forget to remove the event listener when the element is disconnected
    disconnectedCallback() {
        window.removeEventListener('resize', this.resize.bind(this));
    }

}

customElements.define('video-chat', VideoChat);

export { VideoChat };