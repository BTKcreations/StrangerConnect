
// --- CONFIG ---
const APP_PREFIX = 'stranger_';

// --- STATE ---
let myPhone = '';
let peer = null;
let conn = null; // Current active connection

// --- DOM ELEMENTS ---
const screens = {
    login: document.getElementById('login-screen'),
    dashboard: document.getElementById('dashboard-screen')
};
const inputs = {
    myPhone: document.getElementById('my-phone'),
    remotePhone: document.getElementById('remote-phone'),
    msg: document.getElementById('msg-input')
};
const btns = {
    login: document.getElementById('btn-login'),
    connect: document.getElementById('btn-connect'),
    send: document.getElementById('btn-send'),
    disconnect: document.getElementById('btn-disconnect')
};
const ui = {
    displayPhone: document.getElementById('display-phone'),
    chatHeader: document.getElementById('chat-header'),
    chatPartner: document.getElementById('chat-partner-id'),
    messages: document.getElementById('messages-container'),
    inputArea: document.getElementById('chat-input-area')
};

// --- EVENTS ---
btns.login.addEventListener('click', handleLogin);
btns.connect.addEventListener('click', handleManualConnect);
btns.send.addEventListener('click', sendMessage);
btns.disconnect.addEventListener('click', closeConnection);
inputs.msg.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});


// --- LOGIC ---

function handleLogin() {
    const phone = inputs.myPhone.value.trim().replace(/[^a-zA-Z0-9]/g, ''); // Simple sanitize
    if (phone.length < 3) return showToast('Invalid Phone Number', 'error');

    myPhone = phone;
    startPeerSession(myPhone);
}

function startPeerSession(id) {
    ui.displayPhone.textContent = "Connecting...";

    // Initialize PeerJS (Connect to free cloud)
    // IMPORTANT: IDs must be strings.
    // Using a sanitized phone number as the ID allows for easy manual connection.
    peer = new Peer(APP_PREFIX + id, {
        debug: 2
    });

    peer.on('open', (peerId) => {
        // Success
        console.log('My PeerJS ID is: ' + peerId);
        ui.displayPhone.textContent = id; // Show simple phone, hide prefix
        switchScreen('dashboard');
    });

    peer.on('connection', (connection) => {
        // Incoming connection!
        handleConnection(connection);
    });

    peer.on('error', (err) => {
        console.error(err);
        if (err.type === 'unavailable-id') {
            showToast('Number already online! Close other tabs.', 'error');
            ui.displayPhone.textContent = "Error";
            // Wait and try again? Or just stop.
        } else {
            showToast('Connection Error: ' + err.type, 'error');
        }
    });
}

function handleManualConnect() {
    const targetPhone = inputs.remotePhone.value.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!targetPhone) return;
    if (targetPhone === myPhone) return showToast("You can't call yourself!", 'error');

    showToast(`Calling ${targetPhone}...`);

    const connection = peer.connect(APP_PREFIX + targetPhone);

    // PeerJS connection setup is async, but the object is returned immediately
    handleConnection(connection);
}

function handleConnection(connection) {
    // If we already have a chat, maybe close it?
    if (conn && conn.open) {
        connection.close(); // Busy
        return;
    }

    conn = connection;

    conn.on('open', () => {
        setupChatUI(conn.peer.replace(APP_PREFIX, '')); // Strip prefix for display
        showToast('Connected!');
    });

    conn.on('data', (data) => {
        // Assume data is object { type: 'msg', content: '...' }
        if (data.type === 'msg') {
            addMessage('received', data.content);
        }
    });

    conn.on('close', () => {
        showToast('Call ended.');
        resetChatUI();
    });

    conn.on('error', (err) => console.error('Connection error:', err));
}

function sendMessage() {
    const text = inputs.msg.value.trim();
    if (!text || !conn || !conn.open) return;

    // Send
    conn.send({ type: 'msg', content: text });

    // Local Echo
    addMessage('sent', text);
    inputs.msg.value = '';
}

function closeConnection() {
    if (conn) conn.close();
    resetChatUI();
}

// --- UI HELPERS ---

function switchScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

function setupChatUI(partnerName) {
    ui.chatPartner.textContent = partnerName;
    ui.chatHeader.classList.remove('hidden');
    ui.inputArea.classList.remove('disabled');
    ui.messages.innerHTML = '';

    // Focus input
    setTimeout(() => inputs.msg.focus(), 100);
}

function resetChatUI() {
    conn = null;
    ui.chatHeader.classList.add('hidden');
    ui.inputArea.classList.add('disabled');
    ui.messages.innerHTML = '<div class="placeholder-text">Chat ended.</div>';
}

function addMessage(type, text) {
    const div = document.createElement('div');
    div.classList.add('message', type);
    div.textContent = text;
    ui.messages.appendChild(div);
    ui.messages.scrollTop = ui.messages.scrollHeight;
}

function showToast(msg, type = 'info') {
    const area = document.getElementById('notification-area');
    const toast = document.createElement('div');
    toast.classList.add('toast');
    if (type === 'error') toast.style.background = '#ef4444';
    toast.textContent = msg;
    area.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

