# ⚠️ Security Assessment for RTChat

RTChat is **INTENTIONALLY INSECURE**, prioritizing ease-of-use over protecting basic metadata about who you chat with and when.
- ⚠️ The connection process is **public and insecure**, exposing metadata like your **IP address**, port numbers, local IP address, and display name
- ✅ The actual WebRTC chats are **private and end-to-end encrypted**, just be sure you are talking to who you think you are talking to

### Why make an insecure tool?
Put simply, **developer ease-of-use:**
1. The developer does not need to host a backend server
   - Public MQTT/STUN servers allow each one person's browser tab to find another person's browser tab to talk to
   - There is no database storing your RTC chat messages
2. No backend server leads to some security wins:
   - No central authority reading or saving your end-to-end encrypted RTC chat messages or data streams
   - No database to get hacked
3. No passwords to lose
4. No false sense of security
   - A bad attempt at high-security is worse than a good attempt at low-security
5. Free and easy for the developer means they don't need to make money off of you

## ⚠️ What is NOT Secure (The signaling and connection process)

The signaling an connection process is **insecure** by default and **by design**. The whole point of this repo is making easy use cases easy.
RTChat was built for playing board games online, not as a top-secret communication method. **I understand people can figure out I am talking to my friend** (but they cant see what I am saying). That is okay with me.


**What Metadata is Exposed** (if someone subscribes to your MQTT topic):

- ⚠️ **User Identity**: Display names, tab IDs
- ⚠️ **Room/Topic Names**: Exact room identifiers
- ⚠️ **Connection Events**: Connect/disconnect/name changes with timestamps
- ⚠️ **Public Keys**: RSA-PSS public keys (if using SignedMQTTRTCClient)
- ⚠️ **IP Addresses**: **Your public IP address is exposed in ICE candidates** sent over MQTT
  - ICE candidates contain your public IP address (needed for WebRTC connection)
  - May also reveal local/private IP addresses (192.168.x.x, 10.x.x.x) in some cases
  - Port numbers are also visible
  - This can reveal approximate geographic location
- ⚠️ **WebRTC Signaling**: Offers, answers, ICE candidates (connection setup only, not data)
- ⚠️ **Connection Patterns**: Who connects to whom, timing, frequency, active users
- ⚠️ **MQTT Message Metadata**: Only the signaling messages sent over MQTT (connect, RTCOffer, etc.) - their subtopics, timestamps, and sender names

**What is NOT Exposed**:
- ❌ **MAC Addresses**: Not exposed (MAC addresses don't traverse the internet)
- ❌ **Hardware IDs**: Not directly exposed
- ❌ **Browser/OS details**: Not sent over MQTT (though could be inferred from other sources)

**Important**: RTC chat messages (sent via `sendOverRTC()`) are **NOT** sent over MQTT. Their metadata (channels, timestamps, sender names) is **NOT exposed** - only the MQTT signaling messages during connection setup are visible.


## ✅ What is Secure (the actual messages, chats, and streams)

- ✅ **WebRTC Data Channels**: Encrypted by default using DTLS  
- ✅ **WebRTC Media Streams**: Encrypted using SRTP  
- ✅ **Identity Verification**: `SignedMQTTRTCClient` provides RSA-PSS challenge/response over encrypted channels
- ⚠️ Just make sure you are talking to who you think you are (use Public Key verification)

**How Public Key Verification Works**:
1. Public keys exchanged via MQTT (visible, but OK - they're public)
2. After WebRTC connection, challenge sent over **encrypted** channel
3. Peer signs challenge with private key
4. You verify signature using stored public key
5. If valid, you know you're talking to the right person

**This prevents MITM**: Attacker can't impersonate without the private key, and challenge happens over encrypted WebRTC.


## ⚠️ What an attacker sees
```json
{
  "sender": "Alice(1)",
  "timestamp": 1234567890,
  "subtopic": "connect",
  "data": { "publicKeyString": "..." }
}
{
  "sender": "Bob(2)",
  "subtopic": "RTCOffer",
  "data": { "offer": { "target": "Alice(1)", ... } }
}
```

## ✅ What an attacker DOES NOT see (unless they convince you they're your friend)
- ❌ RTC chat message content (sent over encrypted WebRTC, not MQTT)
- ❌ RTC message metadata (channels, timestamps, sender names for chat/dm/etc., all encrypted)
- ❌ Video/audio stream content (encrypted SRTP)
- ❌ Private keys (never sent)
- ❌ Challenge/response signatures (encrypted WebRTC)



## ⚠️Other Security Concerns

- **STUN/TURN Servers** (MEDIUM): Can see connection attempts and IP addresses
- **Browser Storage** (MEDIUM): Private keys in localStorage vulnerable to XSS
- **No Authentication** (HIGH): Anyone can join any room
- **DoS** (HIGH): No rate limiting on public MQTT
- **MITM** (LOW with SignedMQTTRTCClient): Prevented by public key verification

## ✅ Secure Communication Setup
**To have secure communication despite insecure signaling:**
```javascript
import { SignedMQTTRTCClient } from '@rtchat/core';

const client = new SignedMQTTRTCClient({
  name: 'MyName',
  topic: { room: 'myroom' },
  trustMode: 'strict'  // Only trust verified peers
});

client.on('validation', (peerName, trusted) => {
  if (trusted) {
    console.log(`✅ Verified: Communication with ${peerName} is secure!`);
  }
});
```

**This Provides**:
- ✅ Content encryption (DTLS/SRTP)
- ✅ Identity verification (RSA-PSS challenge/response)
- ✅ MITM protection
- ✅ Secure communication once connected

**This Doesn't Provide**:
- ❌ Metadata privacy (connection patterns visible)
- ❌ Room access control
- ❌ Anonymity

## Use Cases

### ✅ Acceptable (with SignedMQTTRTCClient)
- Personal/private chats with verified keys
- Small trusted groups (metadata exposure OK)
- Content security priority over metadata privacy

### ✅ Acceptable (without key verification)
- Personal projects, demos
- Public chat rooms
- Educational purposes
- Prototyping

### ❌ NOT Acceptable
- Anonymous communication (metadata always visible)
- High-security applications requiring metadata privacy
- Compliance-regulated environments (HIPAA, GDPR, etc.)

## How to Harden (If Desired)

### Option 1: Private MQTT Broker with TLS
- **Trade-off**: Loses "no backend" benefit
- **Benefits**: Encrypted signaling, authentication, access control
- **Cost**: Requires running/maintaining broker

### Option 2: Encrypt MQTT Payloads
- **Trade-off**: Adds complexity, keeps serverless
- **Benefits**: Signaling encrypted, still uses public broker
- **Cost**: Key distribution problem

### Option 3: Room Passwords
- **Trade-off**: Minimal change
- **Benefits**: Basic access control
- **Cost**: Password visible on MQTT (not secure)

### Option 4: Encrypt Keys in Storage
- **Trade-off**: Better security, UX complexity
- **Benefits**: Keys protected from XSS
- **Cost**: User must manage password

### Option 5: TOR/Proxy
- **Trade-off**: Anonymity, complex setup
- **Benefits**: Hides IP addresses, metadata origin
- **Cost**: Performance impact

### Option 6: Client-Side Rate Limiting
- **Trade-off**: Reduces DoS impact
- **Benefits**: Simple to add
- **Cost**: Doesn't prevent others from flooding

## Recommendations

**Low Security**: Use as-is for demos, public chats, non-sensitive use cases

**Medium Security**: Private MQTT broker + TLS, SignedMQTTRTCClient, room passwords, encrypted keys

**High Security**: All of the above + access control, key rotation, audit logging. **Consider**: At this point, you might want a different architecture.

## Transparency Statement



## Conclusion

**Connection (MQTT)**: ⚠️ Insecure - metadata exposed  
**Communication (WebRTC)**: ✅ Secure - encrypted, verified identity

**If you use `SignedMQTTRTCClient`, verify public keys, and accept metadata exposure, you have:**
- ✅ Secure, encrypted communication
- ✅ Verified identity (know you're talking to the right person)
- ✅ MITM protection
- ✅ End-to-end encryption with no server in the middle

**The serverless, public-MQTT approach is a feature, not a bug** - it enables easy, no-backend communication. The trade-off is metadata exposure during connection, but the actual communication is secure if you verify keys properly.
