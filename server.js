const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'partnerships.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Banco de dados em memória com backup em arquivo
let partnerships = [];
let connectedUsers = new Map();

// Carrega dados do arquivo ao iniciar
async function loadData() {
    try {
        if (await fs.pathExists(DB_FILE)) {
            const data = await fs.readJson(DB_FILE);
            partnerships = Array.isArray(data) ? data : [];
            console.log(`📂 Carregados ${partnerships.length} registros do banco de dados`);
        } else {
            partnerships = [];
            console.log('📂 Criando novo banco de dados');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        partnerships = [];
    }
}

// Salva dados no arquivo
async function saveData() {
    try {
        await fs.writeJson(DB_FILE, partnerships, { spaces: 2 });
        console.log(`💾 Dados salvos (${partnerships.length} registros)`);
    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error);
    }
}

// Gera ID único
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Rotas da API
app.get('/api/partnerships', (req, res) => {
    res.json({
        success: true,
        data: partnerships,
        count: partnerships.length,
        connectedUsers: connectedUsers.size
    });
});

app.post('/api/partnerships', async (req, res) => {
    try {
        const newPartnership = {
            id: generateId(),
            projectName: req.body.projectName || '',
            numberOfWLs: parseInt(req.body.numberOfWLs) || 0,
            templateDescription: req.body.templateDescription || '',
            collectedWallets: req.body.collectedWallets || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: req.body.userName || 'Usuário Anônimo'
        };

        partnerships.unshift(newPartnership);
        await saveData();

        // Notifica todos os clientes conectados
        io.emit('partnershipAdded', {
            partnership: newPartnership,
            action: 'add',
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            data: newPartnership,
            message: 'Parceria criada com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao criar parceria:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.put('/api/partnerships/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const partnershipIndex = partnerships.findIndex(p => p.id === id);

        if (partnershipIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Parceria não encontrada'
            });
        }

        // Atualiza os campos fornecidos
        const updatedPartnership = {
            ...partnerships[partnershipIndex],
            ...req.body,
            updatedAt: new Date().toISOString(),
            updatedBy: req.body.userName || 'Usuário Anônimo'
        };

        partnerships[partnershipIndex] = updatedPartnership;
        await saveData();

        // Notifica todos os clientes conectados
        io.emit('partnershipUpdated', {
            partnership: updatedPartnership,
            action: 'update',
            field: req.body.field || 'multiple',
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            data: updatedPartnership,
            message: 'Parceria atualizada com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar parceria:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.delete('/api/partnerships/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const partnershipIndex = partnerships.findIndex(p => p.id === id);

        if (partnershipIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Parceria não encontrada'
            });
        }

        const deletedPartnership = partnerships[partnershipIndex];
        partnerships.splice(partnershipIndex, 1);
        await saveData();

        // Notifica todos os clientes conectados
        io.emit('partnershipDeleted', {
            partnershipId: id,
            action: 'delete',
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            data: deletedPartnership,
            message: 'Parceria removida com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao remover parceria:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

app.delete('/api/partnerships', async (req, res) => {
    try {
        const count = partnerships.length;
        partnerships = [];
        await saveData();

        // Notifica todos os clientes conectados
        io.emit('allPartnershipsCleared', {
            action: 'clear_all',
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: `${count} parcerias removidas com sucesso`
        });
    } catch (error) {
        console.error('❌ Erro ao limpar parcerias:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Status do servidor
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        server: 'Gerenciador de Parcerias WLs',
        version: '1.0.0',
        uptime: process.uptime(),
        partnerships: partnerships.length,
        connectedUsers: connectedUsers.size,
        timestamp: new Date().toISOString()
    });
});

// WebSocket para comunicação em tempo real
io.on('connection', (socket) => {
    console.log(`🔗 Novo usuário conectado: ${socket.id}`);

    // Registra usuário
    socket.on('register', (userData) => {
        const user = {
            id: socket.id,
            name: userData.name || `Usuário ${socket.id.substr(0, 6)}`,
            joinedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };
        
        connectedUsers.set(socket.id, user);
        
        // Envia dados iniciais para o novo usuário
        socket.emit('initialData', {
            partnerships: partnerships,
            connectedUsers: Array.from(connectedUsers.values())
        });

        // Notifica outros usuários sobre nova conexão
        socket.broadcast.emit('userJoined', user);
        
        console.log(`👤 Usuário registrado: ${user.name}`);
    });

    // Usuário está editando um campo
    socket.on('editing', (data) => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            socket.broadcast.emit('userEditing', {
                user: user,
                partnershipId: data.partnershipId,
                field: data.field,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Usuário parou de editar
    socket.on('stopEditing', (data) => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            socket.broadcast.emit('userStoppedEditing', {
                user: user,
                partnershipId: data.partnershipId,
                field: data.field,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Atualiza atividade do usuário
    socket.on('activity', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            user.lastActivity = new Date().toISOString();
        }
    });

    // Desconexão
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            console.log(`👋 Usuário desconectado: ${user.name}`);
            connectedUsers.delete(socket.id);
            
            // Notifica outros usuários sobre desconexão
            socket.broadcast.emit('userLeft', user);
        }
    });
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicialização do servidor
async function startServer() {
    await loadData();
    
    server.listen(PORT, () => {
        console.log('');
        console.log('🚀 ==========================================');
        console.log('🤝 Gerenciador de Parcerias WLs');
        console.log('🚀 ==========================================');
        console.log(`📡 Servidor rodando em: http://localhost:${PORT}`);
        console.log(`📊 Parcerias carregadas: ${partnerships.length}`);
        console.log(`🔗 WebSocket ativo para sincronização em tempo real`);
        console.log('🚀 ==========================================');
        console.log('');
        console.log('💡 Comandos úteis:');
        console.log('   • npm start     - Inicia o servidor');
        console.log('   • npm run dev   - Inicia com auto-reload');
        console.log('   • Ctrl+C        - Para o servidor');
        console.log('');
    });
}

// Backup automático a cada 5 minutos
setInterval(saveData, 5 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando servidor...');
    await saveData();
    console.log('💾 Dados salvos com sucesso');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Encerrando servidor...');
    await saveData();
    console.log('💾 Dados salvos com sucesso');
    process.exit(0);
});

startServer().catch(console.error);