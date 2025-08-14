# 🤝 Gerenciador Colaborativo de Parcerias e WLs

Sistema web colaborativo em tempo real para gerenciar parcerias e whitelists (WLs) em comunidades. Permite que múltiplos usuários editem e visualizem as informações simultaneamente.

## 🚀 Recursos Principais

- ✅ **Colaboração em Tempo Real** - WebSocket para sincronização instantânea
- ✅ **Edição Inline** - Clique para editar diretamente nas células
- ✅ **Indicadores de Edição** - Veja quem está editando cada campo em tempo real
- ✅ **Persistência de Dados** - Banco de dados JSON no servidor
- ✅ **Interface Responsiva** - Funciona em desktop e mobile
- ✅ **Notificações** - Feedback visual para todas as ações
- ✅ **Reconexão Automática** - Mantém a sincronização mesmo com quedas de conexão

## 📋 Funcionalidades

### Gestão de Parcerias
- **Nome do Projeto** - Campo de texto editável
- **Número de WLs** - Campo numérico para quantidade de whitelists
- **Descrição dos Templates** - Área de texto para descrições detalhadas
- **Wallets Coletadas** - Lista de endereços de carteiras (uma por linha)
- **Ações** - Botões para editar e apagar parcerias

### Colaboração
- **Usuários Online** - Contador de usuários conectados
- **Indicação de Edição** - Mostra quando outros usuários estão editando
- **Sincronização Automática** - Mudanças aparecem imediatamente para todos
- **Notificações de Atividade** - Alertas sobre ações de outros usuários

## 🛠️ Instalação e Configuração

### Pré-requisitos
- Node.js (versão 16 ou superior)
- NPM ou Yarn

### Passos de Instalação

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Iniciar o servidor:**
   ```bash
   npm start
   ```

3. **Para desenvolvimento (com auto-reload):**
   ```bash
   npm run dev
   ```

4. **Acessar o sistema:**
   - Abra o navegador em: `http://localhost:3000`
   - Digite seu nome para entrar no sistema colaborativo

## 🌐 Como Usar

### Para o Time

1. **Acesso Simultâneo:**
   - Cada membro do time acessa `http://localhost:3000`
   - Digita seu nome para identificação
   - Começa a colaborar imediatamente

2. **Editando Dados:**
   - Clique em qualquer campo para editar
   - As mudanças são salvas automaticamente ao sair do campo
   - Outros usuários veem as mudanças em tempo real

3. **Adicionando Parcerias:**
   - Clique em "➕ Adicionar Nova Parceria"
   - Preencha os campos necessários
   - A parceria aparece para todos imediatamente

4. **Removendo Dados:**
   - Use o botão "🗑️ Apagar" para remover parcerias específicas
   - Use "🗑️ Limpar Tudo" para resetar toda a tabela

### Indicadores Visuais

- 🟢 **Verde** - Conectado ao servidor
- 🔴 **Vermelho** - Desconectado (tentando reconectar)
- 🟡 **Amarelo** - Outro usuário editando este campo
- 👥 **Contador** - Número de usuários online

## ⚙️ Configuração Avançada

### Mudando a Porta
```bash
PORT=8080 npm start
```

### Dados Persistentes
- Os dados são salvos automaticamente em `partnerships.json`
- Backup automático a cada 5 minutos
- Dados preservados entre reinicializações do servidor

### Logs do Servidor
- Conexões de usuários são logadas
- Todas as operações (criar, editar, apagar) são registradas
- Erros são capturados e logados para debug

## 🔧 Estrutura do Projeto

```
/
├── server.js              # Servidor backend (Node.js + Express + Socket.IO)
├── index.html             # Frontend colaborativo
├── package.json           # Dependências e scripts
├── partnerships.json      # Banco de dados (criado automaticamente)
└── README.md             # Esta documentação
```

## 🚀 Deploy em Produção

### Opção 1: Servidor Local (Rede Interna)
```bash
# Instalar dependências
npm install

# Iniciar em modo produção
npm start

# Acessar via IP da máquina
# Ex: http://192.168.1.100:3000
```

### Opção 2: Heroku
```bash
# Instalar Heroku CLI e fazer login
heroku create seu-gerenciador-wls

# Deploy
git add .
git commit -m "Deploy inicial"
git push heroku main

# Abrir aplicação
heroku open
```

### Opção 3: VPS/Cloud
1. Copie os arquivos para seu servidor
2. Execute `npm install`
3. Configure um processo manager como PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "gerenciador-wls"
   pm2 startup
   pm2 save
   ```

## 🛡️ Segurança

- **Validação de Dados** - Todos os inputs são validados
- **Escape HTML** - Proteção contra XSS
- **CORS Configurado** - Controle de acesso
- **Rate Limiting** - Proteção contra spam (implementável)

## 🔧 Troubleshooting

### Problema: "Não consegue conectar"
- Verifique se o servidor está rodando (`npm start`)
- Confirme a porta (padrão: 3000)
- Verifique firewall/antivírus

### Problema: "Dados não sincronizam"
- Verifique conexão com internet
- Recarregue a página (F5)
- Verifique logs do servidor

### Problema: "Usuários não aparecem online"
- Confirme que todos estão acessando o mesmo servidor
- Verifique se o WebSocket está funcionando (logs do browser)

## 📞 Suporte

Para problemas ou sugestões:
1. Verifique os logs do servidor no terminal
2. Abra as ferramentas de desenvolvedor no navegador (F12)
3. Documente o erro e os passos para reproduzi-lo

## 🔄 Atualizações Futuras

Recursos planejados:
- [ ] Autenticação de usuários
- [ ] Permissões por função (admin/editor/viewer)
- [ ] Histórico de mudanças
- [ ] Export/Import de dados
- [ ] Temas customizáveis
- [ ] Notificações por email
- [ ] API REST completa
- [ ] Dashboard de analytics

---

### 💡 Dicas de Uso

**Atalhos do Teclado:**
- `Ctrl + N` - Nova parceria
- `Ctrl + Shift + Delete` - Limpar tudo

**Melhores Práticas:**
- Mantenha nomes de projeto descritivos
- Use uma wallet por linha no campo "Wallets Coletadas"
- Comunique mudanças importantes para o time
- Faça backup regular dos dados (partnerships.json)

**Performance:**
- O sistema suporta centenas de parcerias simultâneas
- WebSocket mantém baixa latência
- Dados são compactados automaticamente

---

🎉 **Sistema pronto para uso colaborativo!** 🎉