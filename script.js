// --- CONFIG ---
const APP_PREFIX = 'stranger_';
const CONTACTS_KEY = 'stranger_contacts';

// --- STATE ---
let myPhone = '';
let peer = null;
let conn = null; // Current active connection
let contacts = [];
let deferredPrompt; // For PWA install

// --- DOM ELEMENTS ---
const screens = {
    login: document.getElementById('login-screen'),
    dashboard: document.getElementById('dashboard-screen')
};
const inputs = {
    myPhone: document.getElementById('my-phone'),
    msg: document.getElementById('msg-input'),
    contactName: document.getElementById('new-contact-name'),
    contactPhone: document.getElementById('new-contact-phone')
};
const btns = {
    login: document.getElementById('btn-login'),
    addContact: document.getElementById('btn-add-contact'),
    send: document.getElementById('btn-send'),
    disconnect: document.getElementById('btn-disconnect'),
    install: document.getElementById('btn-install')
};
const ui = {
    displayPhone: document.getElementById('display-phone'),
    contactsList: document.getElementById('contacts-list'),
    chatHeader: document.getElementById('chat-header'),
    chatPartner: document.getElementById('chat-partner-id'),
    messages: document.getElementById('messages-container'),
    inputArea: document.getElementById('chat-input-area')
};

// --- PWA INIT ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(
            (reg) => console.log('SW Registered'),
            (err) => console.log('SW Failed', err)
        );
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btns.install.classList.remove('hidden');
});

btns.install.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    deferredPrompt = null;
    btns.install.classList.add('hidden');
});


// --- EVENTS ---
btns.login.addEventListener('click', handleLogin);
btns.addContact.addEventListener('click', handleAddContact);
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
    loadContacts(); // Load saved contacts
    startPeerSession(myPhone);
}

function startPeerSession(id) {
    ui.displayPhone.textContent = "Connecting...";

    peer = new Peer(APP_PREFIX + id, { debug: 1 });

    peer.on('open', (peerId) => {
        console.log('My PeerJS ID is: ' + peerId);
        ui.displayPhone.textContent = id;
        switchScreen('dashboard');
    });

    peer.on('connection', (connection) => {
        handleConnection(connection);
    });

    peer.on('error', (err) => {
        console.error(err);
        if (err.type === 'unavailable-id') {
            showToast('Number already online!', 'error');
            ui.displayPhone.textContent = "Error";
        } else {
            showToast('Connection Error: ' + err.type, 'error');
        }
    });
}

// --- CONTACTS SYSTEM ---

function loadContacts() {
    const stored = localStorage.getItem(CONTACTS_KEY);
    if (stored) {
        contacts = JSON.parse(stored);
        renderContacts();
    }
}

function handleAddContact() {
    const name = inputs.contactName.value.trim();
    const phone = inputs.contactPhone.value.trim().replace(/[^a-zA-Z0-9]/g, '');

    if (!name || !phone) return showToast('Enter Name and Phone', 'error');
    if (phone === myPhone) return showToast("Can't add yourself!", 'error');

    // Add to list
    contacts.push({ name, phone });
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));

    // Clear inputs
    inputs.contactName.value = '';
    inputs.contactPhone.value = '';

    renderContacts();
    showToast(`Added ${name}`);
}

function renderContacts() {
    ui.contactsList.innerHTML = '';
    contacts.forEach(c => {
        const li = document.createElement('li');
        li.className = 'contact-item';
        li.innerHTML = `
            <div class="contact-info">
                <span class="contact-name">${c.name}</span>
                <span class="contact-phone">#${c.phone}</span>
            </div>
            <button class="icon-btn" style="width:30px; height:30px; font-size:0.8rem">📞</button>
        `;
        li.onclick = () => connectToPeer(c.phone);
        ui.contactsList.appendChild(li);
    });
}

function connectToPeer(targetPhone) {
    if (!targetPhone) return;
    showToast(`Calling ${targetPhone}...`);

    const connection = peer.connect(APP_PREFIX + targetPhone);
    handleConnection(connection);
}

// --- CHAT LOGIC ---

function handleConnection(connection) {
    if (conn && conn.open) {
        connection.close();
        return;
    }

    conn = connection;

    conn.on('open', () => {
        setupChatUI(conn.peer.replace(APP_PREFIX, ''));
        showToast('Connected!');
    });

    conn.on('data', (data) => {
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

    conn.send({ type: 'msg', content: text });
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
