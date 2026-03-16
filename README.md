# Young Money - Integrado com TubeCoin Bot

Aplicação integrada que combina a tela de tarefas do Young Money com redirecionamento automático para o TubeCoin Bot após conclusão.

## 🎯 Características

- ✅ **Tela de Missões**: 2 cliques + 20 impressões (Monetag)
- ✅ **Sincronização Automática**: Verifica progresso a cada 5 segundos
- ✅ **Design Moderno**: Visual neon com animações suaves
- ✅ **Redirecionamento Inteligente**: Abre TubeCoin Bot ao completar
- ✅ **Suporte Telegram**: Integração com Telegram Web App

## 🚀 Como Usar

### Localmente

```bash
# Instalar dependências
npm install

# Rodar servidor
npm start

# Acessar
http://localhost:3000?user_id=123456789
```

### No Railway

1. Faça push para GitHub
2. Conecte o repositório no Railway
3. Deploy automático
4. Acesse com `?user_id=SEU_ID`

## 📋 Fluxo de Funcionamento

1. Usuário acessa a página com `?user_id=123456789`
2. Clica em "Iniciar Tarefas"
3. SDK Monetag é carregado
4. Aplicação verifica progresso a cada 5 segundos
5. Quando completa 2 cliques + 20 impressões:
   - Mostra mensagem de sucesso
   - Exibe botão "Abrir TubeCoin Bot"
   - Ao clicar, redireciona para o script

## ⚙️ Configurações

Edite `public/index.html` linha 45-54:

```javascript
const CONFIG = {
    MAX_CLICKS: 2,
    MAX_IMPRESSIONS: 20,
    ZONE_ID: '10325249',
    SDK_URL: 'https://libtl.com/sdk.js',
    MONETAG_API: 'https://monetag-postback-server-production.up.railway.app',
    SCRIPT_URL: 'https://tubecoin.com.br', // ← Mude aqui
    CHECK_INTERVAL: 5000
};
```

## 🔧 Variáveis de Ambiente

- `PORT`: Porta do servidor (padrão: 3000)

## 📱 URLs

- **Desenvolvimento**: `http://localhost:3000?user_id=123456789`
- **Produção**: `https://seu-dominio.com?user_id=123456789`

## 🔗 APIs Utilizadas

- **Monetag**: `https://monetag-postback-server-production.up.railway.app/api/stats/user/{userId}`
- **TubeCoin Bot**: Redirecionamento para script externo

## 📝 Estrutura

```
youngmoney-integrated/
├── public/
│   └── index.html          # Aplicação frontend
├── server.js               # Servidor Express
├── package.json            # Dependências
└── README.md               # Este arquivo
```

## 🛡️ Segurança

- ✅ Validação de user_id na URL
- ✅ Bloqueio de DevTools
- ✅ Proteção contra clique direito
- ✅ Anti-tampering

## 📞 Suporte

Para dúvidas ou problemas, verifique:
1. Se o `user_id` está correto na URL
2. Se a API Monetag está respondendo
3. Se o JavaScript está habilitado
4. Logs do console (F12 em desenvolvimento)

---

**Desenvolvido por**: Carlos20473736  
**Última atualização**: 2026-03-16
