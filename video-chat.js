class VideoChat extends HTMLElement {
    constructor(rtc, peerName) {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                #container {
                    position: relative;
                    width: 100%;
                    max-width: 640px; /* Adjust as needed */
                    margin: auto;
                }

                #remoteVideo {
                    width: 100%;
                    height: auto;
                }

                #localVideo {
                    position: absolute;
                    width: 25%; /* Adjust as needed */
                    top: 10px; /* Adjust as needed */
                    right: 10px; /* Adjust as needed */
                    border: 2px solid white;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                }
            </style>
            <div id="container">
                <video id="remoteVideo" autoplay playsinline></video>
                <video id="localVideo" autoplay playsinline muted></video>
            </div>
        `;
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
}

customElements.define('video-chat', VideoChat);

export { VideoChat };