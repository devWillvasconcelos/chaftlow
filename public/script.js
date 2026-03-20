const socket = io();
let currentUser = null;
let currentChat = 'general';
let privateChats = new Map();
let typingTimeout = null;
let friendRequests = [];
let messageHistory = new Map();
let loadingMoreMessages = false;
let hasMoreMessages = true;
let processedMessageIds = new Set();

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const usernameInput = document.getElementById('username');
const pinInput = document.getElementById('pin');
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');
const loginError = document.getElementById('loginError');
const currentUserImage = document.getElementById('currentUserImage');
const currentUsername = document.getElementById('currentUsername');
const usersList = document.getElementById('usersList');
const chatsList = document.getElementById('chatsList');
const generalMessages = document.getElementById('generalMessages');
const generalMessageInput = document.getElementById('generalMessageInput');
const sendGeneralBtn = document.getElementById('sendGeneralBtn');
const attachImageBtn = document.getElementById('attachImageBtn');
const imageInput = document.getElementById('imageInput');
const searchUsers = document.getElementById('searchUsers');
const onlineCount = document.getElementById('onlineCount');
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const friendRequestsBadge = document.getElementById('friendRequestsBadge');
const friendRequestsList = document.getElementById('friendRequestsList');

// Templates
const messageTemplate = document.getElementById('messageTemplate');
const privateChatTemplate = document.getElementById('privateChatTemplate');
const privateChatsContainer = document.getElementById('private-chats-container');

// ===== SISTEMA DE NOTIFICAÇÕES =====
class NotificationSystem {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
        this.notifications = [];
    }

    show(options) {
        const { title, message, avatar = null, type = 'info', duration = 5000, onClick = null } = options;
        const id = Date.now() + Math.random();
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.dataset.id = id;

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'notification-avatar';
        
        if (avatar && !avatar.includes('placeholder') && avatar !== 'null') {
            const img = document.createElement('img');
            img.src = avatar;
            img.alt = title;
            img.onerror = () => avatarDiv.innerHTML = '<i class="fas fa-user-circle"></i>';
            avatarDiv.appendChild(img);
        } else {
            avatarDiv.innerHTML = '<i class="fas fa-user-circle"></i>';
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'notification-content';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'notification-title';
        titleDiv.textContent = title;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'notification-message';
        messageDiv.textContent = message;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'notification-time';
        timeDiv.textContent = this.formatTime(new Date());
        
        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(messageDiv);
        contentDiv.appendChild(timeDiv);

        const closeBtn = document.createElement('span');
        closeBtn.className = 'notification-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.remove(id);
        };

        notification.appendChild(avatarDiv);
        notification.appendChild(contentDiv);
        notification.appendChild(closeBtn);

        if (onClick) {
            notification.addEventListener('click', () => {
                onClick();
                this.remove(id);
            });
        }

        this.container.appendChild(notification);
        setTimeout(() => this.remove(id), duration);
        this.notifications.push({ id, element: notification });
        
        return id;
    }

    remove(id) {
        const index = this.notifications.findIndex(n => n.id === id);
        if (index !== -1) {
            const notification = this.notifications[index].element;
            notification.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => {
                notification.remove();
                this.notifications.splice(index, 1);
            }, 300);
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
}

const notifications = new NotificationSystem();

// ===== CONEXÃO SOCKET =====
socket.on('connect', () => console.log('✅ Conectado ao servidor'));
socket.on('connect_error', (error) => {
    console.error('❌ Erro de conexão:', error);
    showError('Erro ao conectar ao servidor');
});

// ===== LOGIN =====
async function handleLogin() {
    const username = usernameInput.value.trim();
    const pin = pinInput.value.trim();
    
    if (!username || !pin) return showError('Preencha todos os campos!');
    if (pin.length !== 6 || !/^\d+$/.test(pin)) return showError('PIN deve ter 6 dígitos numéricos!');
    
    const avatarImg = avatarPreview.querySelector('img');
    const image = avatarImg ? avatarImg.src : null;
    
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    loginBtn.disabled = true;
    
    socket.emit('login', { username, pin, image });
}

loginBtn.addEventListener('click', handleLogin);
usernameInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleLogin());
pinInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleLogin());

socket.on('login-success', (data) => {
    currentUser = data.user;
    loginScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar no Chat';
    loginBtn.disabled = false;
    
    processedMessageIds.clear();
    updateCurrentUserAvatar();
    currentUsername.textContent = currentUser.username;
    
    if (data.messages?.length) {
        data.messages.forEach(msg => {
            processedMessageIds.add(msg.id);
            addMessageToGeneral(msg);
        });
    }
    
    if (data.users) updateUsersList(data.users);
    scrollToBottom(generalMessages);
});

socket.on('login-error', (error) => {
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar no Chat';
    loginBtn.disabled = false;
    showError(error);
});

// ===== UPLOAD DE AVATAR =====
avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) return showError('A imagem deve ter no máximo 5MB');
    if (!file.type.startsWith('image/')) return showError('O arquivo deve ser uma imagem');
    
    const avatarLabel = document.querySelector('.avatar-label');
    const originalText = avatarLabel.innerHTML;
    avatarLabel.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    avatarLabel.style.pointerEvents = 'none';
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch('/upload-profile', { method: 'POST', body: formData });
        const data = await response.json();
        
        if (data.imageUrl) {
            const img = document.createElement('img');
            img.src = data.imageUrl;
            img.style.cssText = 'width:100%; height:100%; object-fit:cover';
            avatarPreview.innerHTML = '';
            avatarPreview.appendChild(img);
            avatarPreview.dataset.image = data.imageUrl;
            showSuccess('Foto de perfil atualizada!');
        }
    } catch (error) {
        showError('Erro ao fazer upload da imagem');
    } finally {
        avatarLabel.innerHTML = originalText;
        avatarLabel.style.pointerEvents = 'auto';
        avatarInput.value = '';
    }
});

function updateCurrentUserAvatar() {
    const avatarContainer = document.querySelector('.user-avatar');
    if (!avatarContainer) return;
    
    avatarContainer.innerHTML = '';
    
    if (currentUser.image && !currentUser.image.includes('placeholder') && currentUser.image !== 'null') {
        const img = document.createElement('img');
        img.src = currentUser.image;
        img.alt = currentUser.username;
        img.onerror = () => avatarContainer.innerHTML = '<i class="fas fa-user-circle"></i>';
        avatarContainer.appendChild(img);
    } else {
        avatarContainer.innerHTML = '<i class="fas fa-user-circle"></i>';
    }
}

function showError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
    setTimeout(() => {
        loginError.style.display = 'none';
        loginError.textContent = '';
    }, 3000);
}

// ===== LOGOUT =====
logoutBtn.addEventListener('click', () => {
    socket.emit('logout');
    loginScreen.style.display = 'flex';
    chatScreen.style.display = 'none';
    currentUser = null;
    usernameInput.value = '';
    pinInput.value = '';
    avatarPreview.innerHTML = '<i class="fas fa-user-circle"></i>';
    processedMessageIds.clear();
});

// ===== TABS =====
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// ===== STATUS ONLINE/OFFLINE =====
socket.on('users-update', (users) => {
    console.log('\n📊 ATUALIZAÇÃO DE STATUS:');
    users.forEach(u => {
        console.log(`   ${u.username}: ${u.online ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
    });
    
    updateUsersList(users);
    updateChatStatus(users);
    
    // Forçar atualização visual após 100ms
    setTimeout(forceStatusUpdate, 100);
});

function updateUsersList(users) {
    if (!currentUser) return;
    
    const filteredUsers = users.filter(u => u.username !== currentUser.username);
    
    const onlineUsersCount = filteredUsers.filter(u => u.online).length;
    onlineCount.textContent = `${onlineUsersCount} online`;
    
    const searchTerm = searchUsers?.value.toLowerCase() || '';
    const filtered = filteredUsers.filter(u => 
        u.username.toLowerCase().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        usersList.innerHTML = '<div class="empty-state"><i class="fas fa-users-slash"></i><p>Nenhum usuário encontrado</p></div>';
        return;
    }
    
    usersList.innerHTML = filtered.map(user => {
        const isFriend = currentUser.friends?.includes(user.username);
        const hasPendingRequest = friendRequests.some(r => r.from === user.username);
        
        // CORES DIRETAMENTE NO ESTILO INLINE - SEM DEPENDER DE CSS
        const statusColor = user.online ? '#10B981' : '#9CA3AF';
        const statusText = user.online ? '🟢 Online' : '🔴 Offline';
        const dotColor = user.online ? '#10B981' : '#9CA3AF';
        const dotShadow = user.online ? '0 0 0 2px white, 0 0 0 3px #10B981' : '0 0 0 2px white';
        
        return `
        <div class="user-item" data-username="${user.username}" data-online="${user.online}">
            <div class="user-avatar-container">
                ${user.image && !user.image.includes('placeholder') && user.image !== 'null' 
                    ? `<img src="${user.image}" alt="${user.username}" onerror="this.parentElement.innerHTML='<i class=\'fas fa-user-circle\'></i>'">` 
                    : `<i class="fas fa-user-circle"></i>`
                }
            </div>
            <div class="user-details">
                <span class="user-name">${user.username}</span>
                <span class="user-status" style="color: ${statusColor}; font-weight: ${user.online ? 'bold' : 'normal'}; display: flex; align-items: center; gap: 4px;">
                    ${statusText}
                </span>
                ${isFriend ? '<span class="friend-badge"><i class="fas fa-check-circle"></i> Amigo</span>' : ''}
            </div>
            <div class="user-actions">
                ${!isFriend 
                    ? `<button class="friend-action-btn ${hasPendingRequest ? 'pending' : 'add'}" 
                            onclick="sendFriendRequest('${user.username}')" ${hasPendingRequest ? 'disabled' : ''}>
                        <i class="fas ${hasPendingRequest ? 'fa-clock' : 'fa-user-plus'}"></i>
                       </button>`
                    : `<button class="friend-action-btn remove" onclick="removeFriend('${user.username}')">
                        <i class="fas fa-user-minus"></i>
                       </button>`
                }
                <button class="chat-action-btn" onclick="startPrivateChat('${user.username}')">
                    <i class="fas fa-comment"></i>
                </button>
            </div>
            <div class="status-dot" style="width: 10px; height: 10px; border-radius: 50%; background: ${dotColor}; box-shadow: ${dotShadow};"></div>
        </div>
    `}).join('');
}

function updateChatStatus(users) {
    users.forEach(user => {
        const chatWindow = document.getElementById(`chat-${user.username}`);
        if (chatWindow) {
            const statusElement = chatWindow.querySelector('.chat-user-status');
            if (statusElement) {
                const statusColor = user.online ? '#10B981' : '#9CA3AF';
                const statusText = user.online ? '🟢 Online' : '🔴 Offline';
                statusElement.textContent = statusText;
                statusElement.style.color = statusColor;
                statusElement.style.fontWeight = user.online ? 'bold' : 'normal';
            }
        }
    });
}

// Função para forçar atualização do status via JavaScript
function forceStatusUpdate() {
    console.log('🔧 Forçando atualização visual do status...');
    
    document.querySelectorAll('.user-item').forEach(item => {
        const isOnline = item.dataset.online === 'true';
        const statusSpan = item.querySelector('.user-status');
        const statusDot = item.querySelector('.status-dot');
        
        if (statusSpan) {
            statusSpan.style.color = isOnline ? '#10B981' : '#9CA3AF';
            statusSpan.style.fontWeight = isOnline ? 'bold' : 'normal';
            statusSpan.innerHTML = isOnline ? '🟢 Online' : '🔴 Offline';
        }
        
        if (statusDot) {
            statusDot.style.background = isOnline ? '#10B981' : '#9CA3AF';
            statusDot.style.boxShadow = isOnline ? '0 0 0 2px white, 0 0 0 3px #10B981' : '0 0 0 2px white';
        }
    });
}

// Verificar status a cada 2 segundos para garantir
setInterval(() => {
    if (currentUser) {
        forceStatusUpdate();
    }
}, 2000);

// ===== SISTEMA DE AMIGOS =====
function sendFriendRequest(username) { socket.emit('send-friend-request', { to: username }); }
function acceptFriendRequest(username) { socket.emit('accept-friend-request', { from: username }); }
function rejectFriendRequest(username) { socket.emit('reject-friend-request', { from: username }); }

socket.on('friend-request-sent', (data) => {
    showSuccess(`Solicitação enviada para ${data.to}`);
    updateUsersListFromCurrent();
});

socket.on('friend-request-received', (request) => {
    if (!friendRequests.some(r => r.from === request.from)) {
        friendRequests.push(request);
        updateFriendRequestsBadge();
        showFriendRequestNotification(request);
    }
});

socket.on('friend-request-accepted', (data) => {
    showSuccess(`${data.by} aceitou sua solicitação!`);
    currentUser.friends = currentUser.friends ? [...currentUser.friends, data.by] : [data.by];
    updateUsersListFromCurrent();
});

socket.on('friend-request-handled', (data) => {
    showMessage(data.action === 'accepted' ? `Você aceitou a solicitação de ${data.from}` : `Solicitação de ${data.from} rejeitada`);
    friendRequests = friendRequests.filter(r => r.from !== data.from);
    updateFriendRequestsBadge();
    updateUsersListFromCurrent();
});

socket.on('friend-removed', (data) => {
    showMessage(`Amigo ${data.friend} removido`);
    currentUser.friends = currentUser.friends?.filter(f => f !== data.friend) || [];
    updateUsersListFromCurrent();
});

socket.on('friend-error', (error) => showError(error));

function removeFriend(username) {
    if (confirm(`Remover ${username} dos seus amigos?`)) {
        socket.emit('remove-friend', { friend: username });
    }
}

function updateFriendRequestsBadge() {
    if (!friendRequestsBadge) return;
    
    if (friendRequests.length > 0) {
        friendRequestsBadge.textContent = friendRequests.length;
        friendRequestsBadge.style.display = 'inline';
        
        if (friendRequestsList) {
            friendRequestsList.innerHTML = friendRequests.map(req => `
                <div class="friend-request-item">
                    <div class="avatar-container">
                        ${req.fromImage && !req.fromImage.includes('placeholder') && req.fromImage !== 'null'
                            ? `<img src="${req.fromImage}" alt="${req.from}" onerror="this.parentElement.innerHTML='<i class=\'fas fa-user-circle\'></i>'">`
                            : '<i class="fas fa-user-circle"></i>'
                        }
                    </div>
                    <span>${req.from}</span>
                    <div class="request-actions">
                        <button onclick="acceptFriendRequest('${req.from}')" class="accept-btn"><i class="fas fa-check"></i></button>
                        <button onclick="rejectFriendRequest('${req.from}')" class="reject-btn"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            `).join('');
        }
    } else {
        friendRequestsBadge.style.display = 'none';
        if (friendRequestsList) friendRequestsList.innerHTML = '<div class="no-requests">Nenhuma solicitação pendente</div>';
    }
}

function showFriendRequestNotification(request) {
    const notification = document.createElement('div');
    notification.className = 'friend-request-notification';
    notification.innerHTML = `
        <div class="avatar-container">
            ${request.fromImage && !request.fromImage.includes('placeholder') && request.fromImage !== 'null'
                ? `<img src="${request.fromImage}" alt="${request.from}" onerror="this.parentElement.innerHTML='<i class=\'fas fa-user-circle\'></i>'">`
                : '<i class="fas fa-user-circle"></i>'
            }
        </div>
        <div><strong>${request.from}</strong><p>enviou uma solicitação de amizade</p></div>
        <button onclick="acceptFriendRequest('${request.from}')"><i class="fas fa-check"></i></button>
        <button onclick="rejectFriendRequest('${request.from}')"><i class="fas fa-times"></i></button>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

function showSuccess(message) { notifications.show({ title: 'Sucesso', message, type: 'success', duration: 3000 }); }
function showMessage(message) { notifications.show({ title: 'Informação', message, type: 'info', duration: 3000 }); }
function updateUsersListFromCurrent() { socket.emit('get-users'); }

// ===== SEARCH =====
searchUsers?.addEventListener('input', () => {
    const term = searchUsers.value.toLowerCase();
    document.querySelectorAll('.user-item').forEach(user => {
        const name = user.querySelector('.user-name').textContent.toLowerCase();
        user.style.display = name.includes(term) ? 'flex' : 'none';
    });
});

// ===== CHAT GERAL =====
sendGeneralBtn.addEventListener('click', sendGeneralMessage);
generalMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (generalMessageInput.value.trim() === '/clear') {
            clearGeneralChat();
        } else {
            sendGeneralMessage();
        }
    }
});

function clearGeneralChat() {
    if (confirm('Limpar todas as mensagens?')) {
        socket.emit('clear-general-chat', { clearBy: currentUser.username });
        generalMessageInput.value = '';
    }
}

socket.on('chat-cleared', (data) => {
    generalMessages.innerHTML = '';
    addMessageToGeneral(data.message);
    showMessage('Chat geral foi limpo');
});

attachImageBtn.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) return showError('A imagem deve ter no máximo 5MB');
    if (!file.type.startsWith('image/')) return showError('O arquivo deve ser uma imagem');
    
    const originalIcon = attachImageBtn.innerHTML;
    attachImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    attachImageBtn.disabled = true;
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch('/upload-chat-image', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.imageUrl) {
            socket.emit('general-message', { text: '', image: data.imageUrl });
            showSuccess('Imagem enviada!');
        }
    } catch (error) {
        showError('Erro ao enviar imagem');
    } finally {
        attachImageBtn.innerHTML = originalIcon;
        attachImageBtn.disabled = false;
        imageInput.value = '';
    }
});

function sendGeneralMessage() {
    const text = generalMessageInput.value.trim();
    if (!text || text === '/clear') return;
    socket.emit('general-message', { text });
    generalMessageInput.value = '';
    generalMessageInput.focus();
}

socket.on('general-message', (message) => {
    if (processedMessageIds.has(message.id)) return;
    processedMessageIds.add(message.id);
    addMessageToGeneral(message);
    if (message.username !== currentUser?.username) {
        showMessageNotification({ from: message.username, fromImage: message.userImage, text: message.text, type: message.type }, 'general');
    }
});

function addMessageToGeneral(message) {
    if (document.getElementById(`msg-${message.id}`)) return;
    const msgEl = createMessageElement(message);
    msgEl.id = `msg-${message.id}`;
    generalMessages.appendChild(msgEl);
    scrollToBottom(generalMessages);
}

// ===== FUNÇÃO PARA NOTIFICAÇÃO DE MENSAGEM =====
function showMessageNotification(message, chatUser) {
    const isOwn = message.from === currentUser?.username;
    if (isOwn || document.hasFocus()) return;

    notifications.show({
        title: message.from,
        message: message.type === 'image' ? '📸 Enviou uma imagem' : message.text,
        avatar: message.fromImage,
        type: 'info',
        duration: 5000,
        onClick: () => {
            if (chatUser === 'general') {
                document.querySelectorAll('.chat-window').forEach(w => w.classList.remove('active'));
                document.getElementById('general-chat').classList.add('active');
                currentChat = 'general';
            } else {
                startPrivateChat(chatUser);
            }
        }
    });
}

// ===== CHATS PRIVADOS =====
window.startPrivateChat = (username) => {
    if (username === currentUser?.username) return showError('Não pode conversar consigo mesmo');
    socket.emit('start-private-chat', { with: username });
};

socket.on('private-chat-started', (data) => {
    const { with: otherUser, messages, chatId } = data;
    
    if (!privateChats.has(otherUser)) createPrivateChatWindow(otherUser, chatId);
    
    if (messages?.length) {
        if (!messageHistory.has(chatId)) messageHistory.set(chatId, []);
        messageHistory.set(chatId, messages);
        messages.forEach(msg => {
            processedMessageIds.add(msg.id);
            addPrivateMessage(msg, otherUser);
        });
    }
    
    openPrivateChat(otherUser);
    updateChatsList();
});

function createPrivateChatWindow(otherUser, chatId) {
    const template = privateChatTemplate.content.cloneNode(true);
    const chatWindow = template.querySelector('.chat-window');
    chatWindow.id = `chat-${otherUser}`;
    
    const chatUserImage = chatWindow.querySelector('.chat-user-image');
    const chatUserName = chatWindow.querySelector('.chat-user-name');
    const chatAvatarContainer = chatWindow.querySelector('.chat-avatar');
    const chatUserStatus = chatWindow.querySelector('.chat-user-status');
    
    const userImage = getUserImage(otherUser);
    if (userImage && !userImage.includes('placeholder') && userImage !== 'null') {
        chatUserImage.src = userImage;
        chatUserImage.style.display = 'block';
        chatUserImage.onerror = () => {
            chatUserImage.style.display = 'none';
            chatAvatarContainer.innerHTML = '<i class="fas fa-user-circle"></i>';
        };
    } else {
        chatUserImage.style.display = 'none';
        chatAvatarContainer.innerHTML = '<i class="fas fa-user-circle"></i>';
    }
    
    chatUserName.textContent = otherUser;
    
    const userItem = document.querySelector(`.user-item[data-username="${otherUser}"]`);
    const isOnline = userItem?.dataset.online === 'true';
    
    chatUserStatus.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
    chatUserStatus.style.color = isOnline ? '#10B981' : '#9CA3AF';
    
    const backBtn = chatWindow.querySelector('.back-to-general');
    backBtn.addEventListener('click', () => {
        document.querySelectorAll('.chat-window').forEach(w => w.classList.remove('active'));
        document.getElementById('general-chat').classList.add('active');
        currentChat = 'general';
    });
    
    const input = chatWindow.querySelector('.private-message-input');
    const sendBtn = chatWindow.querySelector('.send-private-btn');
    const attachBtn = chatWindow.querySelector('.attach-private-btn');
    const privImageInput = chatWindow.querySelector('.private-image-input');
    const messagesContainer = chatWindow.querySelector('.messages-container');
    
    messagesContainer.id = `messages-${otherUser}`;
    
    input.addEventListener('input', () => {
        socket.emit('typing', { to: otherUser, isTyping: true });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => socket.emit('typing', { to: otherUser, isTyping: false }), 1000);
    });
    
    const sendMessage = () => {
        const text = input.value.trim();
        if (!text) return;
        socket.emit('private-message', { to: otherUser, text, chatId });
        input.value = '';
        input.focus();
        setTimeout(() => scrollToBottom(messagesContainer), 50);
    };
    
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
    
    messagesContainer.addEventListener('scroll', () => {
        if (messagesContainer.scrollTop === 0 && !loadingMoreMessages && hasMoreMessages) {
            loadMoreMessages(otherUser, chatId);
        }
    });
    
    attachBtn.addEventListener('click', () => privImageInput.click());
    
    privImageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) return showError('A imagem deve ter no máximo 5MB');
        if (!file.type.startsWith('image/')) return showError('O arquivo deve ser uma imagem');
        
        const originalIcon = attachBtn.innerHTML;
        attachBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        attachBtn.disabled = true;
        
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const response = await fetch('/upload-chat-image', { method: 'POST', body: formData });
            const data = await response.json();
            if (data.imageUrl) {
                socket.emit('private-message', { to: otherUser, text: '', image: data.imageUrl, chatId });
                showSuccess('Imagem enviada!');
            }
        } catch (error) {
            showError('Erro ao enviar imagem');
        } finally {
            attachBtn.innerHTML = originalIcon;
            attachBtn.disabled = false;
            privImageInput.value = '';
        }
    });
    
    privateChatsContainer.appendChild(chatWindow);
    privateChats.set(otherUser, { chatId, messages: [] });
}

function loadMoreMessages(username, chatId) {
    if (loadingMoreMessages || !hasMoreMessages) return;
    loadingMoreMessages = true;
    
    const chatWindow = document.getElementById(`chat-${username}`);
    const messagesContainer = chatWindow.querySelector('.messages-container');
    const currentScrollHeight = messagesContainer.scrollHeight;
    
    setTimeout(() => {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-messages';
        loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
        messagesContainer.prepend(loadingDiv);
        
        setTimeout(() => {
            loadingDiv.remove();
            const newScrollHeight = messagesContainer.scrollHeight;
            messagesContainer.scrollTop = newScrollHeight - currentScrollHeight;
            loadingMoreMessages = false;
            if (Math.random() > 0.7) hasMoreMessages = false;
        }, 1000);
    }, 500);
}

socket.on('private-message', (message) => {
    if (processedMessageIds.has(message.id)) return;
    processedMessageIds.add(message.id);
    
    const otherUser = message.from === currentUser?.username ? message.to : message.from;
    addPrivateMessage(message, otherUser);
    updateChatsList();
    
    if (message.from !== currentUser?.username) showMessageNotification(message, otherUser);
    
    if (currentChat !== otherUser) {
        const chatItem = document.querySelector(`.chat-item[data-user="${otherUser}"]`);
        if (chatItem) {
            chatItem.classList.add('has-new-message');
            if (!chatItem.querySelector('.message-badge')) {
                const badge = document.createElement('span');
                badge.className = 'badge message-badge';
                badge.textContent = '1';
                chatItem.querySelector('.avatar-container').appendChild(badge);
            }
        }
    }
});

socket.on('private-message-sent', (message) => {
    if (processedMessageIds.has(message.id)) return;
    processedMessageIds.add(message.id);
    addPrivateMessage(message, message.to);
});

function addPrivateMessage(message, chatUser) {
    const chatWindow = document.getElementById(`chat-${chatUser}`);
    if (!chatWindow || document.getElementById(`msg-${message.id}`)) return;
    
    const messagesContainer = chatWindow.querySelector('.messages-container');
    const msgEl = createMessageElement(message);
    msgEl.id = `msg-${message.id}`;
    messagesContainer.appendChild(msgEl);
    
    const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
    if (message.from === currentUser?.username || isNearBottom) scrollToBottom(messagesContainer);
}

socket.on('user-typing', (data) => {
    const chatWindow = document.getElementById(`chat-${data.from}`);
    if (chatWindow) {
        const indicator = chatWindow.querySelector('.typing-indicator');
        if (indicator) indicator.textContent = data.isTyping ? 'Digitando...' : '';
    }
});

// ===== CRIAÇÃO DE MENSAGEM =====
function createMessageElement(message) {
    const template = messageTemplate.content.cloneNode(true);
    const messageDiv = template.querySelector('.message');
    
    const isOwn = message.username === currentUser?.username || message.from === currentUser?.username;
    messageDiv.classList.add(isOwn ? 'own-message' : 'other-message');
    
    if (message.type === 'system' || message.username === 'system') {
        messageDiv.classList.add('system-message');
        messageDiv.classList.remove('own-message', 'other-message');
        
        const avatar = template.querySelector('.message-avatar');
        avatar.style.display = 'none';
        
        template.querySelector('.message-author').textContent = '🔔 Sistema';
        template.querySelector('.message-time').textContent = formatTime(new Date(message.timestamp));
        template.querySelector('.message-body').innerHTML = `<em>${message.text}</em>`;
        
        return messageDiv;
    }
    
    const avatar = template.querySelector('.message-avatar');
    const username = message.username || message.from;
    const userImage = message.userImage || message.fromImage;
    
    if (userImage && !userImage.includes('placeholder') && userImage !== 'null' && userImage !== '') {
        avatar.src = userImage;
        avatar.alt = username;
        avatar.onerror = function() {
            this.style.display = 'none';
            const icon = document.createElement('i');
            icon.className = 'fas fa-user-circle';
            icon.style.cssText = 'font-size:40px; color:#667eea';
            this.parentElement.insertBefore(icon, this);
        };
    } else {
        avatar.style.display = 'none';
        const icon = document.createElement('i');
        icon.className = 'fas fa-user-circle';
        icon.style.cssText = 'font-size:40px; color:#667eea';
        avatar.parentElement.insertBefore(icon, avatar);
    }
    
    template.querySelector('.message-author').textContent = username;
    template.querySelector('.message-time').textContent = formatTime(new Date(message.timestamp));
    
    const body = template.querySelector('.message-body');
    body.innerHTML = '';
    
    if (message.type === 'image' || message.image) {
        const img = document.createElement('img');
        img.src = message.image || message.text;
        img.alt = 'Imagem';
        img.style.cssText = 'max-width:100%; max-height:200px; border-radius:5px; cursor:pointer';
        img.onclick = () => window.open(img.src, '_blank');
        body.appendChild(img);
    } else {
        body.textContent = message.text;
    }
    
    return messageDiv;
}

function formatTime(date) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom(element) {
    setTimeout(() => {
        try { element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' }); } 
        catch { element.scrollTop = element.scrollHeight; }
    }, 50);
}

function openPrivateChat(username) {
    document.querySelectorAll('.chat-window').forEach(w => w.classList.remove('active'));
    const chatWindow = document.getElementById(`chat-${username}`);
    if (chatWindow) {
        chatWindow.classList.add('active');
        currentChat = username;
        
        const chatItem = document.querySelector(`.chat-item[data-user="${username}"]`);
        if (chatItem) {
            chatItem.classList.remove('has-new-message');
            chatItem.querySelector('.message-badge')?.remove();
        }
        
        setTimeout(() => chatWindow.querySelector('.private-message-input')?.focus(), 300);
    }
}

function updateChatsList() {
    const chats = Array.from(privateChats.keys());
    
    if (chats.length === 0) {
        chatsList.innerHTML = '<div class="empty-state"><i class="fas fa-comment-slash"></i><p>Nenhuma conversa ainda</p><span>Adicione amigos para começar</span></div>';
        return;
    }
    
    chatsList.innerHTML = chats.map(username => {
        const userImage = getUserImage(username);
        return `
        <div class="chat-item" data-user="${username}" onclick="openPrivateChat('${username}')">
            <div class="avatar-container">
                ${userImage && !userImage.includes('placeholder') && userImage !== 'null'
                    ? `<img src="${userImage}" alt="${username}" onerror="this.parentElement.innerHTML='<i class=\'fas fa-user-circle\'></i>'">`
                    : '<i class="fas fa-user-circle"></i>'
                }
            </div>
            <div class="chat-info">
                <span class="chat-name">${username}</span>
                <span class="last-message">Clique para abrir o chat</span>
            </div>
        </div>
    `}).join('');
}

function getUserImage(username) {
    const userItem = document.querySelector(`.user-item[data-username="${username}"]`);
    if (userItem) {
        const img = userItem.querySelector('.user-avatar-container img');
        return img?.src && !img.src.includes('placeholder') ? img.src : null;
    }
    return null;
}

socket.on('error', (error) => {
    console.error('❌ Erro do socket:', error);
    showError(error);
});