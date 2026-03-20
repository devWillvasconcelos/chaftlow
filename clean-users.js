const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Configuração do MongoDB - use a mesma URL do seu server.js
const MONGODB_URI = 'mongodb://localhost:27017/chat_app';

// Modelos do MongoDB (copiados do server.js)
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

async function cleanDatabase() {
    try {
        console.log('🔄 Conectando ao MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Conectado ao MongoDB com sucesso!');
        
        // Perguntar confirmação
        console.log('\n⚠️  ATENÇÃO! Isso irá:');
        console.log('   - Apagar TODOS os usuários');
        console.log('   - Apagar TODAS as mensagens');
        console.log('   - Apagar TODAS as solicitações de amizade');
        console.log('   - Manter apenas as imagens na pasta uploads\n');
        
        // Contar registros antes
        const userCount = await User.countDocuments();
        const messageCount = await Message.countDocuments();
        const requestCount = await FriendRequest.countDocuments();
        
        console.log(`📊 Registros encontrados:`);
        console.log(`   👤 Usuários: ${userCount}`);
        console.log(`   💬 Mensagens: ${messageCount}`);
        console.log(`   🤝 Solicitações: ${requestCount}\n`);
        
        // Se não houver argumento --force, pedir confirmação
        if (!process.argv.includes('--force')) {
            console.log('🔴 Para executar sem confirmação, use: node clean-users.js --force\n');
            
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            const answer = await new Promise(resolve => {
                readline.question('❓ Digite "LIMPAR" para confirmar: ', resolve);
            });
            
            readline.close();
            
            if (answer !== 'LIMPAR') {
                console.log('❌ Operação cancelada.');
                await mongoose.disconnect();
                process.exit(0);
            }
        }
        
        console.log('\n🗑️  Limpando banco de dados...');
        
        // Apagar todos os usuários
        const deletedUsers = await User.deleteMany({});
        console.log(`   ✅ ${deletedUsers.deletedCount} usuários removidos`);
        
        // Apagar todas as mensagens
        const deletedMessages = await Message.deleteMany({});
        console.log(`   ✅ ${deletedMessages.deletedCount} mensagens removidas`);
        
        // Apagar todas as solicitações de amizade
        const deletedRequests = await FriendRequest.deleteMany({});
        console.log(`   ✅ ${deletedRequests.deletedCount} solicitações removidas`);
        
        console.log('\n✨ Banco de dados limpo com sucesso!');
        
        // Opção de limpar também as imagens
        if (process.argv.includes('--clean-uploads')) {
            const uploadDir = path.join(__dirname, 'public/uploads');
            
            if (fs.existsSync(uploadDir)) {
                console.log('\n🗑️  Limpando pasta de uploads...');
                
                const files = fs.readdirSync(uploadDir);
                let deletedFiles = 0;
                
                files.forEach(file => {
                    // Não apagar o default-avatar.png
                    if (file !== 'default-avatar.png') {
                        fs.unlinkSync(path.join(uploadDir, file));
                        deletedFiles++;
                    }
                });
                
                console.log(`   ✅ ${deletedFiles} arquivos de imagem removidos`);
                console.log('   ℹ️  default-avatar.png mantido');
            }
        } else {
            console.log('\nℹ️  Para limpar também as imagens, use: node clean-users.js --force --clean-uploads');
        }
        
        await mongoose.disconnect();
        console.log('\n👋 Desconectado do MongoDB.');
        
    } catch (error) {
        console.error('❌ Erro ao limpar banco de dados:', error);
    }
}

// Executar limpeza
cleanDatabase();