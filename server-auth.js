const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? ["https://gerenciador-parcerias-wls.onrender.com"] 
            : "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'wls-manager-secret-key-super-secure-2024';

// Arquivos de dados
const PARTNERSHIPS_FILE = path.join(__dirname, 'partnerships.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const ALLOWED_EMAILS_FILE = path.join(__dirname, 'allowed-emails.json');

// Dados em memória
let partnerships = [];
let users = [];
let allowedEmails = [];
let connectedUsers = new Map();

// Middleware de segurança
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // máximo 100 requests por IP
});
app.use('/api/', limiter);

// Rate limiting específico para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 tentativas de login
    message: { success: false, message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Carrega dados dos arquivos
async function loadData() {
    try {
        // Carrega parcerias
        if (await fs.pathExists(PARTNERSHIPS_FILE)) {
            const data = await fs.readJson(PARTNERSHIPS_FILE);
            partnerships = Array.isArray(data) ? data : [];
        } else {
            partnerships = [];
        }

        // Carrega usuários
        if (await fs.pathExists(USERS_FILE)) {
            const data = await fs.readJson(USERS_FILE);
            users = Array.isArray(data) ? data : [];
        } else {
            users = [];
        }

        // Carrega emails permitidos
        if (await fs.pathExists(ALLOWED_EMAILS_FILE)) {
            const data = await fs.readJson(ALLOWED_EMAILS_FILE);
            allowedEmails = Array.isArray(data) ? data : [];
        } else {
            // Emails padrão (você pode alterar aqui)
            allowedEmails = [
                { 
                    email: 'admin@wlsmanager.com', 
                    role: 'admin', 
                    addedAt: new Date().toISOString(),
                    addedBy: 'system'
                }
            ];
            await saveAllowedEmails();
        }

        console.log(`📂 Dados carregados:`);
        console.log(`   • ${partnerships.length} parcerias`);
        console.log(`   • ${users.length} usuários`);
        console.log(`   • ${allowedEmails.length} emails permitidos`);
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        partnerships = [];
        users = [];
        allowedEmails = [];
    }
}

// Salva dados nos arquivos
async function savePartnerships() {
    try {
        await fs.writeJson(PARTNERSHIPS_FILE, partnerships, { spaces: 2 });
        console.log(`💾 Parcerias salvas (${partnerships.length} registros)`);
    } catch (error) {
        console.error('❌ Erro ao salvar parcerias:', error);
    }
}

async function saveUsers() {
    try {
        await fs.writeJson(USERS_FILE, users, { spaces: 2 });
        console.log(`💾 Usuários salvos (${users.length} registros)`);
    } catch (error) {
        console.error('❌ Erro ao salvar usuários:', error);
    }
}

async function saveAllowedEmails() {
    try {
        await fs.writeJson(ALLOWED_EMAILS_FILE, allowedEmails, { spaces: 2 });
        console.log(`💾 Emails permitidos salvos (${allowedEmails.length} registros)`);
    } catch (error) {
        console.error('❌ Erro ao salvar emails permitidos:', error);
    }
}

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Token de acesso necessário' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

// Middleware para verificar se é admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado. Apenas administradores.' });
    }
    next();
};

// Gera ID único
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// =================== ROTAS DE AUTENTICAÇÃO ===================

// Registro
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email, senha e nome são obrigatórios' 
            });
        }

        // Verifica se o email está na lista de permitidos
        const allowedEmail = allowedEmails.find(ae => ae.email.toLowerCase() === email.toLowerCase());
        if (!allowedEmail) {
            return res.status(403).json({ 
                success: false, 
                message: 'Email não autorizado. Entre em contato com o administrador.' 
            });
        }

        // Verifica se o usuário já existe
        const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'Usuário já existe com este email' 
            });
        }

        // Hash da senha
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Cria novo usuário
        const newUser = {
            id: uuidv4(),
            email: email.toLowerCase(),
            name: name.trim(),
            password: hashedPassword,
            role: allowedEmail.role || 'user',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            isActive: true
        };

        users.push(newUser);
        await saveUsers();

        // Remove senha da resposta
        const { password: _, ...userResponse } = newUser;

        res.json({
            success: true,
            message: 'Usuário criado com sucesso',
            user: userResponse
        });
    } catch (error) {
        console.error('❌ Erro no registro:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email e senha são obrigatórios' 
            });
        }

        // Busca usuário
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Email ou senha incorretos' 
            });
        }

        // Verifica se o usuário está ativo
        if (!user.isActive) {
            return res.status(401).json({ 
                success: false, 
                message: 'Conta desativada. Entre em contato com o administrador.' 
            });
        }

        // Verifica senha
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Email ou senha incorretos' 
            });
        }

        // Atualiza último login
        user.lastLogin = new Date().toISOString();
        await saveUsers();

        // Gera token JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                name: user.name, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Remove senha da resposta
        const { password: _, ...userResponse } = user;

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Verificar token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// =================== ROTAS DE ADMINISTRAÇÃO ===================

// Listar usuários (apenas admin)
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    const usersResponse = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    });

    res.json({
        success: true,
        users: usersResponse,
        count: usersResponse.length
    });
});

// Listar emails permitidos (apenas admin)
app.get('/api/admin/allowed-emails', authenticateToken, requireAdmin, (req, res) => {
    res.json({
        success: true,
        allowedEmails: allowedEmails,
        count: allowedEmails.length
    });
});

// Adicionar email permitido (apenas admin)
app.post('/api/admin/allowed-emails', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email, role = 'user' } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email é obrigatório' 
            });
        }

        // Verifica se o email já está na lista
        const existingEmail = allowedEmails.find(ae => ae.email.toLowerCase() === email.toLowerCase());
        if (existingEmail) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email já está na lista de permitidos' 
            });
        }

        const newAllowedEmail = {
            email: email.toLowerCase(),
            role: role,
            addedAt: new Date().toISOString(),
            addedBy: req.user.email
        };

        allowedEmails.push(newAllowedEmail);
        await saveAllowedEmails();

        res.json({
            success: true,
            message: 'Email adicionado à lista de permitidos',
            allowedEmail: newAllowedEmail
        });
    } catch (error) {
        console.error('❌ Erro ao adicionar email permitido:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Remover email permitido (apenas admin)
app.delete('/api/admin/allowed-emails/:email', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email } = req.params;

        // Não permite remover o próprio email
        if (email.toLowerCase() === req.user.email.toLowerCase()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Não é possível remover seu próprio email' 
            });
        }

        const index = allowedEmails.findIndex(ae => ae.email.toLowerCase() === email.toLowerCase());
        if (index === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Email não encontrado na lista' 
            });
        }

        const removedEmail = allowedEmails.splice(index, 1)[0];
        await saveAllowedEmails();

        // Desativa usuário correspondente
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (user) {
            user.isActive = false;
            await saveUsers();
        }

        res.json({
            success: true,
            message: 'Email removido da lista de permitidos',
            removedEmail
        });
    } catch (error) {
        console.error('❌ Erro ao remover email permitido:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// =================== ROTAS DE PARCERIAS ===================

// Listar parcerias
app.get('/api/partnerships', authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: partnerships,
        count: partnerships.length,
        connectedUsers: connectedUsers.size
    });
});

// Criar parceria
app.post('/api/partnerships', authenticateToken, async (req, res) => {
    try {
        const newPartnership = {
            id: generateId(),
            projectName: req.body.projectName || '',
            numberOfWLs: parseInt(req.body.numberOfWLs) || 0,
            templateDescription: req.body.templateDescription || '',
            collectedWallets: req.body.collectedWallets || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: req.user.name,
            createdByEmail: req.user.email,
            lastModifiedBy: req.user.name,
            lastModifiedByEmail: req.user.email
        };

        partnerships.unshift(newPartnership);
        await savePartnerships();

        // Notifica todos os clientes conectados
        io.emit('partnershipAdded', {
            partnership: newPartnership,
            action: 'add',
            timestamp: new Date().toISOString(),
            user: req.user.name
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

// Atualizar parceria
app.put('/api/partnerships/:id', authenticateToken, async (req, res) => {
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
            lastModifiedBy: req.user.name,
            lastModifiedByEmail: req.user.email
        };

        partnerships[partnershipIndex] = updatedPartnership;
        await savePartnerships();

        // Notifica todos os clientes conectados
        io.emit('partnershipUpdated', {
            partnership: updatedPartnership,
            action: 'update',
            field: req.body.field || 'multiple',
            timestamp: new Date().toISOString(),
            user: req.user.name
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

// Remover parceria
app.delete('/api/partnerships/:id', authenticateToken, async (req, res) => {
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
        await savePartnerships();

        // Notifica todos os clientes conectados
        io.emit('partnershipDeleted', {
            partnershipId: id,
            action: 'delete',
            timestamp: new Date().toISOString(),
            user: req.user.name
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

// Limpar todas as parcerias (apenas admin)
app.delete('/api/partnerships', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const count = partnerships.length;
        partnerships = [];
        await savePartnerships();

        // Notifica todos os clientes conectados
        io.emit('allPartnershipsCleared', {
            action: 'clear_all',
            timestamp: new Date().toISOString(),
            user: req.user.name
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
        version: '2.0.0',
        uptime: process.uptime(),
        partnerships: partnerships.length,
        users: users.length,
        allowedEmails: allowedEmails.length,
        connectedUsers: connectedUsers.size,
        timestamp: new Date().toISOString()
    });
});

// =================== WEBSOCKET ===================

// Middleware de autenticação para WebSocket
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Token de acesso necessário'));
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return next(new Error('Token inválido'));
        }
        socket.user = user;
        next();
    });
});

io.on('connection', (socket) => {
    console.log(`🔗 Usuário conectado: ${socket.user.name} (${socket.user.email})`);

    // Registra usuário
    const user = {
        id: socket.id,
        userId: socket.user.id,
        name: socket.user.name,
        email: socket.user.email,
        role: socket.user.role,
        joinedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
    };
    
    connectedUsers.set(socket.id, user);
    
    // Envia dados iniciais para o usuário
    socket.emit('initialData', {
        partnerships: partnerships,
        connectedUsers: Array.from(connectedUsers.values()),
        user: socket.user
    });

    // Notifica outros usuários sobre nova conexão
    socket.broadcast.emit('userJoined', user);

    // Usuário está editando um campo
    socket.on('editing', (data) => {
        socket.broadcast.emit('userEditing', {
            user: user,
            partnershipId: data.partnershipId,
            field: data.field,
            timestamp: new Date().toISOString()
        });
    });

    // Usuário parou de editar
    socket.on('stopEditing', (data) => {
        socket.broadcast.emit('userStoppedEditing', {
            user: user,
            partnershipId: data.partnershipId,
            field: data.field,
            timestamp: new Date().toISOString()
        });
    });

    // Atualiza atividade do usuário
    socket.on('activity', () => {
        if (connectedUsers.has(socket.id)) {
            connectedUsers.get(socket.id).lastActivity = new Date().toISOString();
        }
    });

    // Desconexão
    socket.on('disconnect', () => {
        console.log(`👋 Usuário desconectado: ${user.name}`);
        connectedUsers.delete(socket.id);
        
        // Notifica outros usuários sobre desconexão
        socket.broadcast.emit('userLeft', user);
    });
});

// Rotas estáticas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Inicialização do servidor
async function startServer() {
    await loadData();
    
    server.listen(PORT, HOST, () => {
        console.log('');
        console.log('🚀 ==========================================');
        console.log('🤝 Gerenciador de Parcerias WLs v2.0');
        console.log('🔐 Sistema de Autenticação Ativado');
        console.log('🚀 ==========================================');
        console.log(`📡 Servidor rodando em: http://localhost:${PORT}`);
        console.log(`📊 Parcerias: ${partnerships.length}`);
        console.log(`👥 Usuários: ${users.length}`);
        console.log(`📧 Emails permitidos: ${allowedEmails.length}`);
        console.log(`🔗 WebSocket ativo para colaboração`);
        console.log('🚀 ==========================================');
        console.log('');
        console.log('🔑 Rotas disponíveis:');
        console.log('   • /              - Login');
        console.log('   • /dashboard     - Gerenciador (autenticado)');
        console.log('   • /admin         - Painel Admin');
        console.log('   • /api/auth/*    - Autenticação');
        console.log('   • /api/admin/*   - Administração');
        console.log('');
    });
}

// Backup automático a cada 10 minutos
setInterval(async () => {
    await savePartnerships();
    await saveUsers();
    await saveAllowedEmails();
}, 10 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando servidor...');
    await savePartnerships();
    await saveUsers();
    await saveAllowedEmails();
    console.log('💾 Dados salvos com sucesso');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Encerrando servidor...');
    await savePartnerships();
    await saveUsers();
    await saveAllowedEmails();
    console.log('💾 Dados salvos com sucesso');
    process.exit(0);
});

startServer().catch(console.error);