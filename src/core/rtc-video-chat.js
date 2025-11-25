/**
 * RTCVideoChat - Core logic for managing video streams and calls
 * 
 * This class manages MediaStream objects and call lifecycle without any UI dependencies.
 * It provides callbacks for UI updates, making it easy to integrate with any UI framework.
 * 
 * Note: This is a legacy component. New code should use CallManager instead.
 * 
 * Usage:
 *   import { RTCVideoChat } from './rtc-video-chat.js';
 *   
 *   const videoChat = new RTCVideoChat(rtcClient, {
 *     setLocalSrc: (stream) => { // update local video element
 *     },
 *     setRemoteSrc: (stream, peerName) => { // update remote video element
 *     },
 *     hide: () => { // hide video UI
 *     },
 *     show: () => { // show video UI
 *     }
 *   });
 * 
 * @module rtc-video-chat
 */

class RTCVideoChat {
  /**
   * Create a new RTCVideoChat instance
   * @param {Object} rtc - RTC client instance
   * @param {Function} setLocalSrc - Callback to set local video source
   * @param {Function} setRemoteSrc - Callback to set remote video source
   * @param {Function} hide - Callback to hide video UI
   * @param {Function} show - Callback to show video UI
   */
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

  call(peerName, promise = 'end') {
    this.pendingNames.push(peerName);
    let { start, end } = this.rtc.callUser(peerName);
    end = end.then(() => {
      this.close(peerName);
    });
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
    if (this.remoteStreams[peerName]) {
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
    if (rs) {
      try {
        rs.getTracks().forEach(track => track.stop());
      } catch (e) {
        // Ignore errors when stopping tracks
      }
      delete this.remoteStreams[peerName];
      this.setStreamCount(Object.keys(this.remoteStreams).length);
    }
  }

  setStreamCount(count) {
    if (!count) {
      if (this.localStream) {
        try {
          this.localStream.getTracks().forEach(track => track.stop());
        } catch (e) {
          // Ignore errors when stopping tracks
        }
        this.setLocalSrc(null);
        this.localStream = null;
      }
      this.setLocalSrc(null);
      this.localStream = null;
      this.hide();
    } else {
      this.show();
    }
  }

  hide() {
    // Override in subclass or via constructor
  }

  show() {
    // Override in subclass or via constructor
  }

  close() {
    // End all streams
    this.endCall();
  }
}

export { RTCVideoChat };


