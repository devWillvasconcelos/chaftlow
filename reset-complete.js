const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const MONGODB_URI = 'mongodb://localhost:27017/chat_app';

const userSchema = new mongoose.Schema({
    username: String,
    pin: String,
    online: Boolean,
    lastSeen: Date
});

const messageSchema = new mongoose.Schema({
    chatId: String,
    from: String,
    text: String
});

const friendRequestSchema = new mongoose.Schema({
    from: String,
    to: String,
    status: String
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

async function resetCompleto() {
    console.log('🔄 RESET COMPLETO DO SISTEMA\n');
    
    try {
        // Conectar ao MongoDB
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Conectado ao MongoDB\n');

        // 1. Apagar TUDO
        console.log('🗑️ Apagando dados existentes...');
        await User.deleteMany({});
        await Message.deleteMany({});
        await FriendRequest.deleteMany({});
        console.log('   ✅ Todos os dados foram apagados\n');

        // 2. Criar usuários de teste
        console.log('📝 Criando usuários de teste...');
        
        const testUsers = ['admin', 'will', 'maria', 'joao', 'ana'];
        
        for (const username of testUsers) {
            const hashedPin = await bcrypt.hash('123456', 10);
            const user = new User({
                username,
                pin: hashedPin,
                online: false,
                lastSeen: new Date()
            });
            await user.save();
            console.log(`   ✅ ${username} criado (PIN: 123456)`);
        }

        // 3. Verificar resultado
        const users = await User.find({});
        console.log('\n📊 USUÁRIOS CRIADOS:');
        users.forEach(u => {
            console.log(`   👤 ${u.username} - Status: ${u.online ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
        });

        console.log('\n✅ Reset completo realizado com sucesso!');
        console.log('\n📝 INSTRUÇÕES:');
        console.log('   1. Inicie o servidor: npm start');
        console.log('   2. Abra o navegador em http://localhost:3000');
        console.log('   3. Faça login com admin (PIN: 123456)');
        console.log('   4. Abra outro navegador em modo anônimo');
        console.log('   5. Faça login com will (PIN: 123456)');
        console.log('   6. Verifique se ambos aparecem como ONLINE');

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado do MongoDB');
    }
}

resetCompleto();