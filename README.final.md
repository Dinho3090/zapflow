# ⚡ ZapFlow — Plataforma SaaS Multi-Tenant para WhatsApp

[![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/license-Proprietário-red.svg)]()

> Sistema completo de automação WhatsApp com chatbot, campanhas recorrentes, agendamento avançado e gestão multi-tenant.

---

## 🎯 O que é o ZapFlow?

ZapFlow é uma plataforma SaaS **white-label** para agências e empresas que precisam gerenciar **disparos em massa WhatsApp** para múltiplos clientes simultaneamente.

### ✨ Diferenciais

- 🏢 **Multi-tenant Isolation**: Cada cliente opera em ambiente isolado (RLS)
- 🤖 **Chatbot Avançado**: Menus numerados + palavras-chave + fluxos multi-passo
- 📅 **Agendamento Inteligente**: Diário, semanal, personalizado + múltiplos horários/dia
- 🎭 **Comportamento Humano**: Delay aleatório + simula "digitando..." para evitar ban
- 👨‍💼 **Painel Admin**: Suspender/reativar clientes com 1 clique
- 📊 **Relatórios Completos**: Analytics por campanha + taxa de entrega/leitura

---

## 📋 Índice

1. [Características](#-características)
2. [Stack Técnica](#️-stack-técnica)
3. [Quick Start](#-quick-start)
4. [Estrutura do Projeto](#-estrutura-do-projeto)
5. [Funcionalidades](#-funcionalidades)
6. [Documentação](#-documentação)
7. [Deploy](#-deploy-em-produção)
8. [Troubleshooting](#-troubleshooting)
9. [Roadmap](#-roadmap)
10. [Licença](#-licença)

---

## 🚀 Características

### Para Clientes (Dashboard)

✅ Conexão WhatsApp via QR Code (Evolution API + Baileys)  
✅ Importação CSV/VCF com normalização automática (Brasil + Uruguai)  
✅ Campanhas com mídia (imagem, vídeo, PDF) + legenda  
✅ Agendamento avançado:
  - Único (escolhe data/hora)
  - Diário (repete todo dia)
  - Semanal (escolhe dias da semana)
  - Personalizado (múltiplos horários por dia)
✅ Chatbot visual:
  - Menu numerado (1-Suporte, 2-Vendas)
  - Palavras-chave (usuário digita "oi" → resposta automática)
  - Fluxos multi-passo (conversa guiada)
  - Respostas com mídia automática
✅ Relatórios em tempo real com confirmação de entrega/leitura  
✅ Calendário visual mensal com todos os agendamentos  

### Para Você (Admin)

✅ Painel administrativo Next.js (não HTML estático)  
✅ Lista todos os clientes com filtros (ativos, trial, suspensos)  
✅ Suspender cliente:
  - Pausa campanhas ativas automaticamente
  - Desconecta WhatsApp
  - Registra motivo (inadimplência, violação, etc)
✅ Reativar cliente:
  - Escolhe plano (trial, basic, pro, enterprise)
  - Define validade (dias)
  - Zera contador de mensagens
✅ Métricas da plataforma (total clientes, mensagens/mês, uso)  

---

## 🛠️ Stack Técnica

### Backend
- **Node.js 20** + **Fastify 4** (mais rápido que Express)
- **BullMQ** (filas assíncronas com Redis)
- **Supabase** (PostgreSQL + Auth JWT + Storage + RLS)
- **Evolution API v2** (multi-instância WhatsApp via Baileys)

### Frontend
- **Next.js 14** (App Router + React 18)
- **Tailwind CSS** (tema dark customizado)
- **Supabase Auth** (JWT + Row Level Security)

### Infra
- **Docker Compose** (7 serviços orquestrados)
- **Nginx** (reverse proxy + SSL + rate limiting)
- **Redis 7** (BullMQ + cache Evolution)
- **PostgreSQL 15** (Evolution interno)

---

## 🏃 Quick Start

### Pré-requisitos

- Docker Desktop instalado
- Node.js 20+ (se rodar sem Docker)
- Conta Supabase (gratuita)

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/zapflow.git
cd zapflow
```

### 2. Configure o Supabase

1. Crie projeto em https://supabase.com
2. No **SQL Editor**, execute `migrations.sql` (inteiro)
3. No **Storage**, crie bucket `campaign-media` (público)
4. Em **Settings → API**, copie:
   - URL
   - anon key
   - service_role key

### 3. Configure o `.env`

```bash
cp .env.example .env
nano .env
```

Preencha as credenciais do Supabase que copiou no passo 2.

### 4. Inicie os serviços

```bash
docker-compose up -d
```

### 5. Acesse

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001/health
- **Evolution API**: http://localhost:8080
- **Admin**: http://localhost:3002

### 6. Crie sua conta

1. Acesse http://localhost:3000/registro
2. Preencha: nome empresa, email, senha
3. Conta criada com plano Trial (7 dias grátis)
4. Faça login

### 7. Conecte WhatsApp

1. Vá em **WhatsApp** (sidebar)
2. Clique **Conectar via QR Code**
3. Escaneie com seu celular
4. Status muda para "Conectado" (verde)

### 8. Teste uma campanha

1. Vá em **Contatos** → Importe um CSV:
   ```csv
   João Silva;5511987654321
   Maria Santos;5521912345678
   ```
2. Vá em **Campanhas** → **+ Nova**
3. Preencha:
   - Nome: Teste Local
   - Mensagem: `Olá {nome}! Teste do ZapFlow.`
   - Agendamento: Envio imediato
4. **Criar Campanha**
5. Acompanhe no Dashboard (tempo real)

---

## 📂 Estrutura do Projeto

```
zapflow/
├── backend/              # API Fastify + Workers
│   ├── src/
│   │   ├── server.js     # ← Entrada
│   │   ├── lib/          # Clients (Supabase, Redis, Evolution)
│   │   ├── middleware/   # Auth JWT + verificação tenant
│   │   ├── routes/       # 8 rotas (whatsapp, campaigns, contacts, etc)
│   │   └── workers/      # Campaign dispatcher + scheduler
│   └── Dockerfile
├── frontend/             # Next.js 14 + Tailwind
│   ├── src/app/
│   │   ├── login/
│   │   ├── registro/
│   │   └── dashboard/    # 10 páginas funcionais
│   └── Dockerfile
├── admin/                # Painel admin (Next.js separado)
│   └── src/app/
│       └── page.js       # Lista tenants, suspender, reativar
├── nginx/
│   └── nginx.conf        # Proxy reverso + SSL
├── docker-compose.yml    # 7 serviços orquestrados
├── migrations.sql        # Schema completo Supabase
└── .env.example
```

---

## 💡 Funcionalidades

### Campan

has

**Criação:**
- Texto puro ou com variáveis (`{nome}`, `{telefone}`)
- Upload de mídia (imagem, vídeo até 64MB, PDF)
- Legenda obrigatória para mídia
- Tags para segmentação

**Agendamento:**
- **Imediato**: Inicia agora
- **Único**: Data/hora específica
- **Diário**: Repete todo dia em horário fixo
- **Semanal**: Escolhe dias (Seg, Qua, Sex) + horário
- **Personalizado**: Múltiplos horários/dia + range de datas

**Comportamento Anti-Ban:**
- Delay aleatório: 10-30s + ruído gaussiano (±500ms)
- Simula "digitando...": calcula tempo baseado no tamanho da msg
- Horário comercial: só envia entre 8h-20h (configurável)
- Finais de semana: opcional (padrão: não envia)

### Chatbot

**Triggers:**
- **Palavra-chave**: Usuário digita "oi", "olá", "menu" → bot responde
- **Always**: Responde toda mensagem recebida

**Tipos de Nó:**
- **Message**: Envia texto (suporta variáveis `{nome}`)
- **Menu**: Lista numerada (1-Suporte, 2-Vendas, 3-Horários)
- **Wait**: Aguarda próxima mensagem do usuário

**Exemplo de Fluxo:**
```
1. Message: "Olá {nome}! Como posso ajudar?"
2. Menu: "Escolha: 1-Suporte 2-Vendas 3-Sair"
3. Wait (aguarda resposta)
4. Message (baseado na escolha): "Ótimo! Vou te ajudar com..."
```

### Relatórios

- Total de campanhas concluídas
- Mensagens enviadas/entregues/lidas/falhas
- Taxa de entrega e leitura
- Timeline de cada campanha
- Exportar (CSV - em desenvolvimento)

---

## 📚 Documentação

### Documentos Técnicos Completos

| Documento | Descrição |
|-----------|-----------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Arquitetura técnica completa com diagramas, decisões arquiteturais, fluxos de dados |
| **[STRUCTURE.md](./STRUCTURE.md)** | Estrutura de arquivos detalhada, explicação de cada componente, convenções de código |
| **[DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)** | Guia passo a passo de deploy em VPS (Ubuntu 22.04) |
| **[LOCAL_SETUP.md](./LOCAL_SETUP.md)** | Setup para desenvolvimento local com Docker |

### Diagramas

- Arquitetura de alto nível (7 camadas)
- Fluxo de criação de campanha (9 passos)
- Fluxo do chatbot (9 passos)
- Fluxo de confirmação de entrega
- Diagrama ER (10 tabelas)

---

## 🚀 Deploy em Produção

### Opção 1: VPS Manual (Recomendado)

Siga o **[DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)** completo.

**Resumo ultra-rápido:**

```bash
# 1. Na VPS Ubuntu 22.04
curl -fsSL https://url.do/setup.sh | bash

# 2. Preencher .env
nano /opt/zapflow/.env

# 3. Enviar código
scp -r ./zapflow/* root@IP:/opt/zapflow/

# 4. Obter SSL
bash /opt/zapflow/scripts/ssl.sh seudominio.com seu@email.com

# 5. Iniciar
bash /opt/zapflow/scripts/start.sh
```

### Opção 2: Cloud Run / Heroku / Railway

(Em desenvolvimento - contributions welcome)

---

## 🐛 Troubleshooting

### WhatsApp desconecta sozinho

**Causa:** Limite de sessões WhatsApp Web ou comportamento suspeito detectado.

**Solução:**
- Use número dedicado (não o pessoal)
- Respeite limites: 500-1000 msgs/dia
- Aumente delays (15-45s)
- Reconecte pelo painel

### Campanha não inicia

**Verifique:**
1. WhatsApp está conectado? (status verde)
2. Tenant está ativo? (não suspenso)
3. Worker rodando? `docker logs zf_backend`
4. Fila travada? `docker exec zf_redis redis-cli LLEN bull:campaign:wait`

### "502 Bad Gateway"

**Causa:** Backend travado.

**Solução:**
```bash
cd /opt/zapflow
bash scripts/restart.sh zf_backend
bash scripts/logs.sh zf_backend  # veja o erro
```

### Mensagens não enviam

**Verifique:**
```bash
# 1. Logs do worker
docker logs zf_backend | grep "Campaign"

# 2. Status da fila
docker exec zf_redis redis-cli
> LLEN bull:campaign:wait
> LLEN bull:campaign:active

# 3. Banco (campanhas pendentes)
# No Supabase SQL Editor:
SELECT id, name, status, scheduled_at 
FROM campaigns 
WHERE status IN ('scheduled', 'running')
ORDER BY scheduled_at;
```

---

## 🗺️ Roadmap

### v1.1 (Q2 2025)
- [ ] Integração Stripe/Mercado Pago
- [ ] Webhook de pagamento (ativa/bloqueia automaticamente)
- [ ] Templates de mensagem salvos
- [ ] Variáveis customizadas por contato

### v1.2 (Q3 2025)
- [ ] A/B testing de campanhas
- [ ] Relatórios avançados (gráficos, export CSV)
- [ ] API pública para integrações
- [ ] Webhooks customizáveis

### v2.0 (Q4 2025)
- [ ] App mobile (React Native)
- [ ] Chatbot com IA (GPT-4)
- [ ] Multi-canal (Telegram, Instagram)
- [ ] White-label completo (logo, domínio, cores)

---

## 🤝 Contribuindo

Contributions são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Add: NovaFeature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

### Guidelines

- Siga as convenções de código (ver STRUCTURE.md)
- Adicione testes se possível
- Atualize a documentação
- Mantenha commits atômicos e descritivos

---

## 📄 Licença

**Proprietário** — Todos os direitos reservados.

Para licenciamento comercial, entre em contato: contato@zapflow.com

---

## 📞 Suporte

- 📧 Email: suporte@zapflow.com
- 💬 Discord: [zapflow.gg](https://discord.gg/zapflow)
- 📖 Docs: [docs.zapflow.com](https://docs.zapflow.com)

---

## ⭐ Se este projeto te ajudou, considere dar uma estrela!

**Construído com ❤️ usando Node.js, Next.js, Supabase e muito ☕**

---

### 🙏 Agradecimentos

- [Evolution API](https://github.com/EvolutionAPI/evolution-api) - WhatsApp multi-instância
- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web protocol
- [Supabase](https://supabase.com) - Backend as a Service
- [Fastify](https://www.fastify.io) - Fast and low overhead web framework
- [Next.js](https://nextjs.org) - The React Framework for Production

---

**Versão:** 1.0.0  
**Última atualização:** 2025-02-21
