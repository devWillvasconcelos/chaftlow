const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb://localhost:27017/chat_app';

const userSchema = new mongoose.Schema({
    username: String,
    online: Boolean,
    lastSeen: Date
});

const User = mongoose.model('User', userSchema);

async function diagnosticFinal() {
    console.log('🔍 DIAGNÓSTICO FINAL\n');
    
    try {
        // 1. Conectar ao MongoDB
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Conectado ao MongoDB\n');

        // 2. Verificar usuários no banco
        const users = await User.find({});
        console.log('📊 BANCO DE DADOS:');
        users.forEach(u => {
            console.log(`   ${u.username}: ${u.online ? '🟢 ONLINE' : '🔴 OFFLINE'} (Último visto: ${u.lastSeen || 'N/A'})`);
        });

        // 3. Verificar se o servidor está rodando
        console.log('\n🔌 Verificando servidor...');
        const http = require('http');
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/socket.io/?EIO=4&transport=polling',
            method: 'GET',
            timeout: 2000
        };

        const req = http.request(options, (res) => {
            console.log(`   ✅ Servidor respondendo na porta 3000 (Status: ${res.statusCode})`);
            
            // 4. Sugestões
            console.log('\n📝 SOLUÇÕES:');
            console.log('   1. O servidor está rodando? Execute: npm start');
            console.log('   2. O MongoDB está rodando? Execute: mongod');
            console.log('   3. Faça login no chat com admin (PIN: 123456)');
            console.log('   4. Verifique os logs do servidor');
            console.log('   5. Se ainda não funcionar, execute: npm run reset');
            
            process.exit(0);
        });

        req.on('error', (error) => {
            console.log(`   ❌ Servidor NÃO está respondendo na porta 3000`);
            console.log(`   Erro: ${error.message}`);
            console.log('\n▶️ Execute: npm start');
            process.exit(1);
        });

        req.end();

    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

diagnosticFinal();