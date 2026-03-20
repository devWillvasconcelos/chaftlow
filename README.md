# 💬 ChatFlow - Chat em Tempo Real

[![Version](https://img.shields.io/badge/version-0.9.0--beta-blue.svg)](https://github.com/devWillvasconcelos/chaftlow)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-black.svg)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 📱 Sobre o Projeto

**ChatFlow** é uma plataforma de chat em tempo real inspirada no WhatsApp, desenvolvida para demonstrar na prática os conceitos de comunicação bidirecional com WebSockets, persistência de dados com MongoDB e desenvolvimento full-stack moderno.

O projeto simula toda a experiência de um aplicativo de mensagens real, com interface intuitiva, sistema de amizades, notificações em tempo real e muito mais.

![ChatFlow Demo](https://via.placeholder.com/800x400?text=ChatFlow+Demo)

## ✨ Funcionalidades

### 🔐 Autenticação
- Login seguro com PIN de 6 dígitos
- Upload de foto de perfil
- Avatar padrão com ícone Bootstrap
- Persistência de dados com MongoDB

### 💬 Chat Geral
- Mensagens em tempo real com todos os usuários
- Upload de imagens
- Comando `/clear` para limpar o chat
- Mensagem de sistema "Chat limpo por [usuário]"

### 🤝 Sistema de Amizades
- Adicionar e remover amigos
- Solicitações de amizade com notificações
- Badge de solicitações pendentes
- Lista de amigos com status online

### 💭 Chat Privado
- Conversas exclusivas entre amigos
- Indicador de digitação em tempo real
- Badges de mensagens não lidas
- Histórico de conversas persistente
- Scroll infinito para mensagens antigas

### 🟢 Status em Tempo Real
- Indicador online/offline instantâneo
- Último visto
- Atualização automática sem refresh
- Pontinho verde animado para usuários online

### 🔔 Notificações
- Sistema de toasts para feedback
- Notificações de novas mensagens
- Notificações de solicitações de amizade
- Clique na notificação para abrir o chat

### 📱 Interface
- Design moderno e limpo
- Totalmente responsivo (mobile, tablet, desktop)
- Animações suaves
- Cores gradientes roxas
- Scrollbar personalizada

## 🛠️ Tecnologias Utilizadas

### Backend
| Tecnologia | Descrição |
|------------|-----------|
| **Node.js** | Ambiente de execução JavaScript |
| **Express** | Framework web para APIs |
| **Socket.IO** | Comunicação em tempo real via WebSockets |
| **MongoDB** | Banco de dados NoSQL |
| **Mongoose** | Modelagem de dados ODM |
| **Multer** | Upload e gerenciamento de arquivos |
| **Bcrypt** | Criptografia de PINs |
| **CORS** | Controle de acesso entre origens |

### Frontend
| Tecnologia | Descrição |
|------------|-----------|
| **HTML5** | Estrutura semântica |
| **CSS3** | Estilização responsiva e animações |
| **JavaScript** | Lógica do cliente e manipulação da DOM |
| **Socket.IO Client** | Conexão em tempo real com o servidor |
| **Font Awesome** | Biblioteca de ícones moderna |

## 📁 Estrutura do Projeto
chatflow/
│
├── public/ # Frontend
│ ├── index.html # Página principal
│ ├── styles.css # Estilos CSS
│ ├── script.js # Lógica do cliente
│ └── uploads/ # Imagens enviadas
│
├── scripts/ # Scripts utilitários
│ ├── reset-complete.js # Reset completo do banco
│ ├── clean-users.js # Limpar usuários
│ └── diagnostic-final.js # Diagnóstico de status
│
├── server.js # Servidor principal
├── package.json # Dependências
├── .gitignore # Arquivos ignorados
└── README.md # Documentação

text

## 🚀 Como Executar

### Pré-requisitos

- [Node.js](https://nodejs.org/) (v18 ou superior)
- [MongoDB](https://www.mongodb.com/) (v6 ou superior)
- [Git](https://git-scm.com/) (opcional)

### Passo a Passo

1. **Clone o repositório**
```bash
git clone https://github.com/devWillvasconcelos/chaftlow.git
cd chaftlow
Instale as dependências

bash
npm install
Inicie o MongoDB

bash
# Em outro terminal
mongod
Execute o servidor

bash
npm start
Acesse no navegador

text
http://localhost:3000
Usuários de Teste
Usuário	PIN
admin	123456
will	123456
maria	123456
joao	123456
ana	123456
📊 Comandos Disponíveis
No Terminal
bash
# Iniciar servidor
npm start

# Modo desenvolvimento (auto-reload)
npm run dev

# Resetar banco de dados
node scripts/reset-complete.js

# Diagnosticar status
node scripts/diagnostic-final.js
No Chat Geral
text
/clear - Limpa todas as mensagens do chat geral
🔧 Configuração
Variáveis de Ambiente (opcional)
Crie um arquivo .env na raiz do projeto:

env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chat_app
Personalização
Cores: Edite as variáveis CSS no public/styles.css

Limites de upload: Altere em server.js na configuração do multer

Limite de mensagens: Modifique limit(50) nas consultas

🚧 Status do Projeto
Versão Beta v0.9.0 - Em desenvolvimento ativo

Funcionalidades Implementadas ✅
Login com PIN e foto de perfil

Chat geral em tempo real

Sistema de amizades

Chat privado com indicador de digitação

Upload de imagens

Status online/offline

Notificações em tempo real

Badges de mensagens não lidas

Comando /clear

Design responsivo

Próximas Funcionalidades 🔄
Criptografia de ponta a ponta

Modo noturno

Grupos de conversa

Mensagens de voz

Videochamada

Deploy em nuvem

PWA (Progressive Web App)

🤝 Contribuindo
Contribuições são sempre bem-vindas!

Fork o projeto

Crie sua branch (git checkout -b feature/AmazingFeature)

Commit suas mudanças (git commit -m 'Add some AmazingFeature')

Push para a branch (git push origin feature/AmazingFeature)

Abra um Pull Request

📝 Licença
Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

📞 Contato
Desenvolvedor: Will Vasconcelos

https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white
https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white
https://img.shields.io/badge/Email-D14836?style=flat&logo=gmail&logoColor=white

🙏 Agradecimentos
Socket.IO - Pela incrível biblioteca de WebSockets

MongoDB - Pelo banco de dados flexível

Font Awesome - Pelos ícones maravilhosos

Comunidade Open Source por todo o suporte
