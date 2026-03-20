const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configuração do MongoDB
const MONGODB_URI = 'mongodb://localhost:27017/chat_app';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Conectado ao MongoDB com sucesso!');
}).catch(err => {
    console.error('❌ Erro ao conectar ao MongoDB:', err);
});

// Modelos do MongoDB
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    pin: { type: String, required: true },
    image: { type: String, default: '/uploads/default-avatar.png' },
    friends: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    online: { type: Boolean, default: false }
});

const messageSchema = new mongoose.Schema({
    chatId: { type: String, required: true, index: true },
    from: { type: String, required: true },
    fromImage: String,
    to: String,
    text: String,
    image: String,
    type: { type: String, default: 'text' },
    timestamp: { type: Date, default: Date.now }
});

const friendRequestSchema = new mongoose.Schema({
    from: { type: String, required: true },
    fromImage: String,
    to: { type: String, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

// Criar diretório de uploads
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 Diretório de uploads criado');
}

// Configuração do multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const isValid = allowedTypes.test(file.mimetype);
        isValid ? cb(null, true) : cb(new Error('Apenas imagens são permitidas!'));
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// Rotas de upload
app.post('/upload-profile', upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
        res.json({ imageUrl: `/uploads/${req.file.filename}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/upload-chat-image', upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
        res.json({ imageUrl: `/uploads/${req.file.filename}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== CONTROLE DE STATUS ONLINE =====
const onlineUsers = new Map(); // socketId -> username
const userSockets = new Map(); // username -> socketId

// ===== FUNÇÃO PARA BROADCAST DO STATUS - CORRIGIDA =====
async function broadcastUserStatus() {
    try {
        // Buscar todos os usuários do banco
        const allUsers = await User.find({}).lean();
        
        // CRIAR LISTA USANDO O MAPA onlineUsers (FONTE DA VERDADE)
        const userList = allUsers.map(u => {
            const isOnline = onlineUsers.has(u.username); // VERDADEIRO se estiver no mapa
            return {
                username: u.username,
                image: u.image,
                online: isOnline, // USA O MAPA, NÃO O BANCO
                lastSeen: u.lastSeen,
                friends: u.friends || []
            };
        });
        
        console.log('\n📢 BROADCAST DE STATUS (CORRETO):');
        userList.forEach(u => {
            console.log(`   ${u.username}: ${u.online ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
        });
        
        // Enviar para todos os clientes
        io.emit('users-update', userList);
        
    } catch (error) {
        console.error('❌ Erro no broadcast:', error);
    }
}

// ===== FUNÇÃO PARA SINCRONIZAR STATUS =====
async function syncUserStatus() {
    try {
        const dbUsers = await User.find({}).lean();
        
        for (const dbUser of dbUsers) {
            const isOnline = onlineUsers.has(dbUser.username);
            
            // Só atualiza se o status for diferente
            if (dbUser.online !== isOnline) {
                await User.findOneAndUpdate(
                    { username: dbUser.username },
                    { 
                        online: isOnline,
                        lastSeen: isOnline ? new Date() : dbUser.lastSeen
                    }
                );
            }
        }
        
        console.log('🔄 Status sincronizado:', Array.from(onlineUsers.values())
            .map(u => `${u}: 🟢`).join(', '));
            
    } catch (error) {
        console.error('❌ Erro ao sincronizar status:', error);
    }
}

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
    console.log(`🔌 Nova conexão: ${socket.id}`);

    // Login
    socket.on('login', async (data) => {
        try {
            const { username, pin, image } = data;
            console.log(`📝 Login: ${username}`);
            
            if (!username || !pin) {
                return socket.emit('login-error', 'Preencha todos os campos!');
            }
            
            if (pin.length !== 6 || !/^\d+$/.test(pin)) {
                return socket.emit('login-error', 'PIN deve ter 6 dígitos!');
            }
            
            let user = await User.findOne({ username });
            
            if (user) {
                const isValid = await bcrypt.compare(pin, user.pin);
                if (!isValid) return socket.emit('login-error', 'PIN incorreto!');
                user.image = image || user.image;
            } else {
                const hashedPin = await bcrypt.hash(pin, 10);
                user = new User({
                    username,
                    pin: hashedPin,
                    image: image || '/uploads/default-avatar.png'
                });
            }
            
            // Remover conexão anterior se existir
            const oldSocketId = userSockets.get(username);
            if (oldSocketId && oldSocketId !== socket.id) {
                onlineUsers.delete(oldSocketId);
                userSockets.delete(username);
                io.to(oldSocketId).emit('force-logout');
            }
            
            // Adicionar aos maps de online
            onlineUsers.set(socket.id, username);
            userSockets.set(username, socket.id);
            
            // Atualizar banco
            user.online = true;
            user.lastSeen = new Date();
            await user.save();
            
            console.log(`✅ ${username} logado. Usuários online agora:`, Array.from(onlineUsers.values()));
            
            // Buscar mensagens recentes
            const recentMessages = await Message.find({ chatId: 'general' })
                .sort({ timestamp: -1 }).limit(50).lean();
            
            // Buscar todos os usuários
            const allUsers = await User.find({}).lean();
            
            // Criar lista de usuários usando o mapa onlineUsers
            const userList = allUsers.map(u => ({
                username: u.username,
                image: u.image,
                online: onlineUsers.has(u.username), // USA O MAPA
                lastSeen: u.lastSeen,
                friends: u.friends || []
            }));
            
            socket.emit('login-success', {
                user: {
                    username: user.username,
                    image: user.image,
                    friends: user.friends || []
                },
                messages: recentMessages.reverse(),
                users: userList
            });
            
            // Broadcast da atualização
            await broadcastUserStatus();
            
        } catch (error) {
            console.error('❌ Erro no login:', error);
            socket.emit('login-error', 'Erro interno');
        }
    });

    // General message
    socket.on('general-message', async (data) => {
        try {
            const username = onlineUsers.get(socket.id);
            if (!username) return;
            
            const user = await User.findOne({ username });
            if (!user) return;
            
            const message = new Message({
                chatId: 'general',
                from: username,
                fromImage: user.image,
                text: data.text || '',
                image: data.image || null,
                type: data.image ? 'image' : 'text'
            });
            
            await message.save();
            
            io.emit('general-message', {
                id: message._id,
                username: message.from,
                userImage: message.fromImage,
                text: message.text,
                image: message.image,
                timestamp: message.timestamp,
                type: message.type
            });
        } catch (error) {
            console.error('❌ Erro ao salvar mensagem:', error);
        }
    });

    // Clear general chat
    socket.on('clear-general-chat', async (data) => {
        try {
            const username = onlineUsers.get(socket.id);
            if (!username) return;
            
            await Message.deleteMany({ chatId: 'general' });
            
            const systemMessage = new Message({
                chatId: 'general',
                from: 'system',
                text: `🧹 Chat limpo por ${data.clearBy}`,
                type: 'system'
            });
            
            await systemMessage.save();
            
            io.emit('chat-cleared', {
                message: {
                    id: systemMessage._id,
                    username: 'system',
                    text: systemMessage.text,
                    timestamp: systemMessage.timestamp,
                    type: 'system'
                }
            });
        } catch (error) {
            console.error('❌ Erro ao limpar chat:', error);
        }
    });

    // Friend request
    socket.on('send-friend-request', async (data) => {
        try {
            const username = onlineUsers.get(socket.id);
            if (!username) return;
            
            const { to } = data;
            
            const request = new FriendRequest({
                from: username,
                to,
                status: 'pending'
            });
            
            await request.save();
            
            const toSocketId = userSockets.get(to);
            if (toSocketId) {
                io.to(toSocketId).emit('friend-request-received', { from: username });
            }
            
            socket.emit('friend-request-sent', { to });
        } catch (error) {
            console.error('❌ Erro ao enviar solicitação:', error);
        }
    });

    // Accept friend request
    socket.on('accept-friend-request', async (data) => {
        try {
            const username = onlineUsers.get(socket.id);
            if (!username) return;
            
            const { from } = data;
            
            await FriendRequest.findOneAndUpdate(
                { from, to: username, status: 'pending' },
                { status: 'accepted' }
            );
            
            await User.findOneAndUpdate(
                { username },
                { $addToSet: { friends: from } }
            );
            
            await User.findOneAndUpdate(
                { username: from },
                { $addToSet: { friends: username } }
            );
            
            await broadcastUserStatus();
            
            socket.emit('friend-request-handled', { action: 'accepted', from });
        } catch (error) {
            console.error('❌ Erro ao aceitar solicitação:', error);
        }
    });

    // Reject friend request
    socket.on('reject-friend-request', async (data) => {
        try {
            const username = onlineUsers.get(socket.id);
            if (!username) return;
            
            const { from } = data;
            
            await FriendRequest.findOneAndUpdate(
                { from, to: username, status: 'pending' },
                { status: 'rejected' }
            );
            
            socket.emit('friend-request-handled', { action: 'rejected', from });
        } catch (error) {
            console.error('❌ Erro ao rejeitar solicitação:', error);
        }
    });

    // Remove friend
    socket.on('remove-friend', async (data) => {
        try {
            const username = onlineUsers.get(socket.id);
            if (!username) return;
            
            const { friend } = data;
            
            await User.findOneAndUpdate(
                { username },
                { $pull: { friends: friend } }
            );
            
            await User.findOneAndUpdate(
                { username: friend },
                { $pull: { friends: username } }
            );
            
            await broadcastUserStatus();
            
            socket.emit('friend-removed', { friend });
        } catch (error) {
            console.error('❌ Erro ao remover amigo:', error);
        }
    });

    // Start private chat
    socket.on('start-private-chat', async (data) => {
        try {
            const username = onlineUsers.get(socket.id);
            if (!username) return;
            
            const { with: otherUser } = data;
            const chatId = [username, otherUser].sort().join('-');
            
            const messages = await Message.find({ chatId })
                .sort({ timestamp: 1 })
                .limit(50)
                .lean();
            
            socket.emit('private-chat-started', {
                with: otherUser,
                messages,
                chatId
            });
        } catch (error) {
            console.error('❌ Erro ao iniciar chat privado:', error);
        }
    });

    // Private message
    socket.on('private-message', async (data) => {
        try {
            const username = onlineUsers.get(socket.id);
            if (!username) return;
            
            const { to, text, image, chatId } = data;
            
            const user = await User.findOne({ username });
            
            const message = new Message({
                chatId,
                from: username,
                fromImage: user.image,
                to,
                text: text || '',
                image: image || null,
                type: image ? 'image' : 'text'
            });
            
            await message.save();
            
            const messageData = {
                id: message._id,
                from: username,
                fromImage: user.image,
                to,
                text: message.text,
                image: message.image,
                timestamp: message.timestamp,
                type: message.type
            };
            
            const toSocketId = userSockets.get(to);
            if (toSocketId) {
                io.to(toSocketId).emit('private-message', messageData);
            }
            
            socket.emit('private-message-sent', messageData);
        } catch (error) {
            console.error('❌ Erro ao enviar mensagem privada:', error);
        }
    });

    // Typing indicator
    socket.on('typing', (data) => {
        const username = onlineUsers.get(socket.id);
        if (!username) return;
        
        const { to, isTyping } = data;
        const toSocketId = userSockets.get(to);
        
        if (toSocketId) {
            io.to(toSocketId).emit('user-typing', { from: username, isTyping });
        }
    });

    // Get users
    socket.on('get-users', async () => {
        await broadcastUserStatus();
    });

    // Logout
    socket.on('logout', () => handleDisconnect(socket));

    // Disconnect
    socket.on('disconnect', () => handleDisconnect(socket));

    async function handleDisconnect(socket) {
        try {
            const username = onlineUsers.get(socket.id);
            if (username) {
                console.log(`📴 Desconectando: ${username}`);
                
                // Remover dos maps
                onlineUsers.delete(socket.id);
                userSockets.delete(username);
                
                // Atualizar banco
                await User.findOneAndUpdate(
                    { username },
                    { 
                        online: false,
                        lastSeen: new Date()
                    }
                );
                
                console.log(`✅ ${username} desconectado. Usuários online agora:`, Array.from(onlineUsers.values()));
                
                // Broadcast da atualização
                await broadcastUserStatus();
            }
        } catch (error) {
            console.error('❌ Erro ao desconectar:', error);
        }
    }
});

// Sincronizar status a cada 5 segundos
setInterval(syncUserStatus, 5000);

// Criar imagem padrão
const defaultAvatarPath = path.join(uploadDir, 'default-avatar.png');
if (!fs.existsSync(defaultAvatarPath)) {
    const defaultSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#CCCCCC"/><text x="50" y="70" font-size="50" text-anchor="middle" fill="#666666" font-family="Arial">?</text></svg>';
    fs.writeFileSync(defaultAvatarPath, defaultSvg);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Acesse: http://localhost:${PORT}\n`);
});