class ChatBox extends HTMLElement {
  primaryUserColor = 'lightblue';
  userColors = [
    'lightcoral',
    'lightseagreen',
    'lightsalmon',
    'lightgreen',
  ]
  constructor() {
    super();
    this._rtc = null;

    this.name = "?"
    this.history = [];
    this.activeUsers = [];

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>

        .rounded {
            border-radius: 5px;
        }
        #chat-container {
          position: fixed;
          bottom: 0.5em;
          right: 0.5em;
          border: 1px solid #ccc;
          background-color: #f9f9f9;
          border-radius: 10px;
          min-width: 300px;
        }
        #chat-header {
          cursor: pointer;
          background-color: ${this.primaryUserColor};
          padding: 10px;
          font-weight: bold;
          border-top-left-radius: 10px;
        }
        #chat-body {
          max-height: 40vh;
          overflow: auto;
          display: none;
          padding: 10px;
        }
        #active-users {
          font-size: 0.8em;
        }
        #messages {
          margin-bottom: 10px;
        }

        @media only screen and (max-width: 1000px){
          * {
            font-size: 3em; /* twice as big as the default size */
            #chat-container {
                min-width: 50vw !important;
            }
          }

        }

      </style>
      <div id="chat-container">
        <div id="chat-header">
            <div>
                room: <input id="chat-room" style="width: 100px" class="rounded">
            </div>
            <div>
                name: <input id="chat-name" style="width: 100px" class="rounded">
            </div>
        </div>

        <div id="chat-video"></div>
        <div id="chat-body">
          <div id="active-users"></div>
          <div id="messages"></div>
          <button id="call-button" style="display: none;color:green">&#x260E;</button>
          <button id="end-call-button" style="display: none;color:red">&#x260E;</button>
          <input id="input-message" type="text" placeholder="Type a message...">
          <button id="emoji-button" style="display: inline-block">👋</button>
          <button id="clear-button">🗑️</button>
        </div>
      </div>
    `;

    // Elements
    this.chatHeader = this.shadowRoot.getElementById('chat-header');
    this.chatVideo = this.shadowRoot.getElementById('chat-video');
    this.callButton = this.shadowRoot.getElementById('call-button');
    this.endCallButton = this.shadowRoot.getElementById('end-call-button');
    this.chatBody = this.shadowRoot.getElementById('chat-body');
    this.chatRoom = this.shadowRoot.getElementById('chat-room');
    this.chatName = this.shadowRoot.getElementById('chat-name');
    this.activeUsersEl = this.shadowRoot.getElementById('active-users');
    this.messagesEl = this.shadowRoot.getElementById('messages');
    this.emojiButton = this.shadowRoot.getElementById('emoji-button');
    this.inputMessage = this.shadowRoot.getElementById('input-message');
    this.clearButton = this.shadowRoot.getElementById('clear-button');
    this.clearButton.addEventListener('click', () => {
        this.messagesEl.innerHTML = "";
    })


    this.emojiButton.addEventListener('click', ()=>{this.sendMessage("👋");});

    this.chatName.value = localStorage.getItem("name") || "?";
    this.chatName.addEventListener('change', (() => {
        console.log("Name changed to " + this.chatName.value);
        if (this.rtc){
            this.rtc.changeName(this.chatName.value);
            this.name = this.rtc.name;
            this.chatName.value = this.name;
        }else{
            this.name = this.chatName.value;
        }
    }).bind(this));


    this.sendMessage = this.sendMessage.bind(this);

    this.inputMessage.addEventListener('keydown', (e) => {
        if (e.key === "Enter" && !e.ctrlKey){
            this.sendMessage();
        }
        e.stopPropagation();
    })

    // Event listeners
    this.chatHeader.addEventListener('click', () => this.toggleChat());

    // Load initial history
    this.history.forEach((entry) => this.appendMessage(entry));

    this.chatBody.style.display = "block";

  }
  get rtc(){return this._rtc}
  set rtc(rtc){
    this._rtc = rtc;
    this.send = rtc.sendRTCChat;
    this.name = rtc.name;
    this.chatName.value = this.name;
    this.chatRoom.value = rtc.topic.substring(rtc.baseTopic.length);
    rtc.on('chat', this.receiveRTCChat.bind(this));
    rtc.on('connectedtopeer', this.onConnectedToUser.bind(this));
    rtc.on('disconnectedfrompeer', this.onDisconnectedFromUser.bind(this));
//    rtc.onRTCChat = (message, sender) => {this.receive.bind(this)({data: message, sender: sender, timestamp: Date.now()})};
//    rtc.onConnectedToUser = this.onConnectedToUser.bind(this);
//    rtc.onDisconnectedFromUser = this.onDisconnectedFromUser.bind(this);
  }
  receiveRTCChat(message, sender){
    this.receive({data: message, sender: sender, timestamp: Date.now()});
  }
  setHistory(history){
    this.history = history;
    this.history.forEach((entry) => this.appendMessage(entry));
  }

  send(message){
    console.warn("No MQTT connection");
  }
  receive({data, sender, timestamp}) {
    this.history.push({ data, sender, timestamp });
    this.appendMessage({ data, sender, timestamp });
  }

  toggleChat() {
    this.chatBody.style.display = this.chatBody.style.display === 'none' ? 'block' : 'none';
  }

  sendMessage(data) {
    data = data || this.inputMessage.value;
    this.send(data);
    this.appendMessage({ data, sender: this.name + "( You )", timestamp: new Date() });
    this.inputMessage.value = '';
  }

  appendMessage({ data, sender, timestamp }) {
        // Create a message element with a chat bubble style
        const messageEl = document.createElement('div');
        messageEl.style.padding = '5px 10px';
        messageEl.style.margin = '5px';
        messageEl.style.borderRadius = '10px';
        messageEl.style.maxWidth = '60%';
        messageEl.innerText = data;

        // Check the sender and adjust the alignment and color
        if (sender === this.name + "( You )") {
            messageEl.style.backgroundColor = this.primaryUserColor;
            messageEl.style.color = 'white';
            messageEl.style.marginLeft = 'auto';  // Aligns the bubble to the right
        } else {
            messageEl.style.backgroundColor = this.userColors[this.activeUsers.indexOf(sender)];
            messageEl.style.color = 'black';
            messageEl.style.marginRight = 'auto';  // Aligns the bubble to the left
        }

        // Hover effect to show timestamp
        messageEl.title = new Date(timestamp).toLocaleString();  // Showing timestamp on hover

        // Append the chat bubble to the messages container
        this.messagesEl.appendChild(messageEl);
    }

  onConnectedToUser(user) {
    this.activeUsers.push(user);
    let bubble = document.createElement('p');
    bubble.style.backgroundColor = this.userColors[this.activeUsers.indexOf(user)];
//    bubble.style.width = '20px';
    bubble.style.height = '20px';
    bubble.style.borderRadius = '5px';
    bubble.style.padding = '0px 5px';
    bubble.style.display = 'inline-block';
    bubble.style.textAlign = 'center';
    bubble.style.lineHeight = '20px'; // Vertically center the text
    bubble.style.color = 'white'; // Ensuring text is visible against background
    bubble.style.fontSize = '12px'; // Smaller font size for small bubbles
    bubble.style.cursor = 'pointer'; // Change cursor on hover to indicate interactivity
    bubble.style.overflow = 'hidden'; // Prevents text from spilling out
    bubble.style.whiteSpace = 'nowrap'; // Keeps the content on a single line
    bubble.innerText = user; // Showing the first character of the username

    // Tooltip to show the full username on hover
    bubble.title = user;

    // Optionally, add event listener for further interaction
    bubble.addEventListener('click', () => {
        alert('User: ' + user);
    });

    this.activeUsersEl.appendChild(bubble);
}


  onDisconnectedFromUser(user) {
    try{
    let oldColor = this.userColors[this.activeUsers.indexOf(user)];

    //remove bubble
    this.activeUsersEl.removeChild(this.activeUsersEl.children[this.activeUsers.indexOf(user)]);
    //remove old color and move to end
    this.userColors = this.userColors.filter((color) => color !== oldColor).concat([oldColor]);
    this.activeUsers = this.activeUsers.filter((u) => u !== user);
    }catch{}
  }


}
customElements.define('chat-box', ChatBox);

export { ChatBox };