# 🏗️ ZapFlow — Arquitetura Técnica Completa

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura de Alto Nível](#arquitetura-de-alto-nível)
3. [Stack Tecnológica](#stack-tecnológica)
4. [Componentes Principais](#componentes-principais)
5. [Fluxo de Dados](#fluxo-de-dados)
6. [Modelos de Dados](#modelos-de-dados)
7. [APIs e Integrações](#apis-e-integrações)
8. [Segurança](#segurança)
9. [Escalabilidade](#escalabilidade)
10. [Decisões Arquiteturais](#decisões-arquiteturais)

---

## 🎯 Visão Geral

### O que é o ZapFlow?

ZapFlow é uma plataforma SaaS multi-tenant de automação WhatsApp construída para agências e empresas que precisam gerenciar disparos em massa, chatbots e campanhas recorrentes para múltiplos clientes simultaneamente.

### Objetivos de Negócio

- **Multi-tenant Isolation**: Cada cliente opera em um ambiente completamente isolado
- **Escalabilidade**: Suportar 50-100 clientes por servidor (4GB RAM)
- **Automação Inteligente**: Chatbots com fluxos complexos + comportamento anti-ban
- **Gestão Simplificada**: Painel admin centralizado para suspender/reativar/monitorar

### Principais Características Técnicas

- **Arquitetura baseada em eventos** via webhooks da Evolution API
- **Sistema de filas** com BullMQ para processamento assíncrono
- **RLS (Row Level Security)** no Supabase para isolamento de dados
- **Simulação de comportamento humano** para evitar banimento
- **Agendamento avançado** com recorrência (diária, semanal, personalizada)

---

## 🏛️ Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CAMADA DE APRESENTAÇÃO                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐        ┌──────────────────┐                  │
│  │  Frontend Next.js │        │   Admin Panel    │                  │
│  │   (Port 3000)    │        │   (Port 3002)    │                  │
│  │                  │        │                  │                  │
│  │ • Dashboard      │        │ • Tenant Mgmt    │                  │
│  │ • Campanhas      │        │ • Block/Unblock  │                  │
│  │ • Automações     │        │ • Analytics      │                  │
│  │ • Calendário     │        │                  │                  │
│  └────────┬─────────┘        └────────┬─────────┘                  │
│           │                           │                             │
└───────────┼───────────────────────────┼─────────────────────────────┘
            │                           │
            │    HTTPS (Nginx)          │ Admin Key
            ▼                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       CAMADA DE APLICAÇÃO                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              Backend API (Fastify - Port 3001)             │    │
│  │                                                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │   Routes     │  │  Middleware  │  │   Workers    │   │    │
│  │  │              │  │              │  │              │   │    │
│  │  │ • WhatsApp   │  │ • Auth JWT   │  │ • Campaign   │   │    │
│  │  │ • Campaigns  │  │ • Tenant     │  │   Dispatcher │   │    │
│  │  │ • Contacts   │  │   Check      │  │ • Scheduler  │   │    │
│  │  │ • Automations│  │ • Rate Limit │  │              │   │    │
│  │  │ • Webhooks   │  │              │  │              │   │    │
│  │  │ • Admin      │  │              │  │              │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │    │
│  └────────────────────────────────────────────────────────────┘    │
│           │                    │                    │               │
└───────────┼────────────────────┼────────────────────┼───────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CAMADA DE SERVIÇOS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  Evolution API   │  │   Redis (BullMQ) │  │   Supabase       │ │
│  │  (Port 8080)     │  │   (Port 6379)    │  │   (Cloud)        │ │
│  │                  │  │                  │  │                  │ │
│  │ • Multi-Instance │  │ • Job Queues     │  │ • PostgreSQL     │ │
│  │ • WhatsApp Web   │  │ • Campaign Queue │  │ • Auth (JWT)     │ │
│  │ • Webhooks       │  │ • Scheduler      │  │ • Storage        │ │
│  │ • QR Code Gen    │  │ • Caching        │  │ • RLS Policies   │ │
│  └────────┬─────────┘  └──────────────────┘  └────────┬─────────┘ │
│           │                                            │            │
└───────────┼────────────────────────────────────────────┼────────────┘
            │                                            │
            ▼                                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CAMADA DE DADOS                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐                  ┌──────────────────┐        │
│  │  PostgreSQL      │                  │  Supabase Storage│        │
│  │  (Evolution)     │                  │  (Mídia)         │        │
│  │                  │                  │                  │        │
│  │ • Instances      │                  │ • Imagens        │        │
│  │ • Messages       │                  │ • Vídeos         │        │
│  │ • Sessions       │                  │ • PDFs           │        │
│  └──────────────────┘                  └──────────────────┘        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    CAMADA DE COMUNICAÇÃO                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                    ┌──────────────────────┐                         │
│                    │   WhatsApp Servers   │                         │
│                    │   (Meta/Facebook)    │                         │
│                    └──────────────────────┘                         │
│                              ▲                                       │
│                              │ WhatsApp Web Protocol (Baileys)      │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
                               │
                    ┌──────────▼──────────┐
                    │   Evolution API     │
                    │   Multi-Instance    │
                    └─────────────────────┘
```

---

## 🛠️ Stack Tecnológica

### Backend
```yaml
Runtime:
  - Node.js: 20 LTS
  - Package Manager: npm

Framework:
  - Fastify: 4.28+ (HTTP server - mais rápido que Express)
  - Plugins:
    - @fastify/cors: CORS handling
    - @fastify/multipart: File uploads

Queue System:
  - BullMQ: 5.x (Filas assíncronas)
  - IORedis: 5.x (Cliente Redis)

Database:
  - Supabase/PostgreSQL: 15 (via @supabase/supabase-js)
  - Políticas RLS para isolamento multi-tenant

WhatsApp:
  - Evolution API: v2.1.1 (Baileys wrapper)
  - Axios: 1.7 (HTTP client para Evolution)

Utilities:
  - csv-parse: Parse de CSV
  - vcf: Parse de VCF (vCard)
  - uuid: Geração de IDs únicos
```

### Frontend
```yaml
Framework:
  - Next.js: 14.2.5 (App Router)
  - React: 18.3

Styling:
  - Tailwind CSS: 3.4
  - Custom theme (dark mode)

Auth:
  - Supabase Auth (JWT)
  - Row Level Security

State Management:
  - React Hooks (useState, useEffect)
  - Context API (Supabase Provider)

Build:
  - Standalone output mode (para Docker)
  - PostCSS + Autoprefixer
```

### Infrastructure
```yaml
Containerization:
  - Docker: 24+
  - Docker Compose: v2

Proxy:
  - Nginx: Alpine (reverse proxy + SSL)
  - Let's Encrypt (Certbot)

Cache/Queues:
  - Redis: 7 Alpine
  - Persistence: AOF + RDB

Database:
  - PostgreSQL: 15 Alpine (Evolution interno)
  - Supabase PostgreSQL (dados principais)
```

---

## 🧩 Componentes Principais

### 1. Backend API (Fastify)

#### Estrutura de Diretórios
```
backend/
├── src/
│   ├── server.js                 # ← Entry point
│   ├── lib/
│   │   ├── clients.js            # Singletons (Supabase, Redis, Evolution)
│   │   └── phoneFilter.js        # Normalização telefones BR/UY
│   ├── middleware/
│   │   └── auth.js               # JWT validation + tenant check
│   ├── routes/
│   │   ├── whatsapp.js           # QR Code + status
│   │   ├── contacts.js           # Import CSV/VCF
│   │   ├── campaigns.js          # CRUD + scheduling
│   │   ├── automations.js        # Chatbot flows
│   │   ├── media.js              # Upload para Supabase Storage
│   │   ├── webhooks.js           # Evolution events + bot engine
│   │   ├── admin.js              # Tenant management
│   │   └── register.js           # User signup
│   └── workers/
│       └── campaignWorker.js     # Dispatcher + scheduler
├── package.json
└── Dockerfile
```

#### Responsabilidades

**server.js**
- Inicializa Fastify
- Registra plugins (CORS, multipart)
- Registra rotas com prefixos
- Graceful shutdown (SIGTERM/SIGINT)

**lib/clients.js**
- Exporta instâncias singleton
- Supabase (com service key)
- Redis (IORedis)
- Evolution API (Axios configurado)

**middleware/auth.js**
```javascript
authMiddleware(request, reply)
  1. Extrai token do header Authorization
  2. Valida JWT com Supabase
  3. Busca tenant associado ao user
  4. Verifica se tenant está ativo (não suspended)
  5. Bloqueia se limite mensal atingido
  6. Injeta req.tenant e req.user
```

**routes/campaigns.js**
- Endpoint mais complexo
- Suporta recorrência avançada:
  - `none`: Envio imediato
  - `once`: Agendamento único
  - `daily`: Repete todo dia
  - `weekly`: Repete dias específicos da semana
  - `custom`: Combinação livre
- Gera múltiplas campanhas se recorrente
- Insere fila de contatos em `campaign_contacts`

**workers/campaignWorker.js**
```javascript
Funções principais:
  - processCampaign(job): Processa 1 campanha
  - humanDelay(): Gera delay aleatório (10-30s + ruído)
  - simulateTyping(text): Calcula tempo de digitação
  - canSendNow(): Verifica horário comercial
  - sendMessage(): Envia via Evolution API
  
Comportamento anti-ban:
  - Delay aleatório com distribuição gaussiana
  - Simulação de "digitando..."
  - Respeita horário comercial
  - Não envia em finais de semana (configurável)
  - Pausa se fora do horário
```

---

### 2. Frontend (Next.js 14)

#### Estrutura de Páginas
```
frontend/src/app/
├── layout.js                     # Root layout (fonts, provider)
├── globals.css                   # Tailwind + custom vars
├── login/
│   └── page.js                   # Login form (Supabase Auth)
├── registro/
│   └── page.js                   # Signup form + tenant creation
└── dashboard/
    ├── layout.js                 # Sidebar + topbar
    ├── page.js                   # Home (stats + active campaigns)
    ├── campanhas/
    │   └── nova/page.js          # Campaign creation form
    ├── agendamento/
    │   └── page.js               # Calendar view
    ├── contatos/
    │   └── page.js               # Contacts list + import
    ├── automacoes/
    │   └── page.js               # Chatbot flow builder
    ├── relatorios/
    │   └── page.js               # Analytics dashboard
    ├── midia/
    │   └── page.js               # Media library
    ├── whatsapp/
    │   └── page.js               # QR Code connection
    ├── assinatura/
    │   └── page.js               # Plan & billing
    └── config/
        └── page.js               # Account settings
```

#### Padrões de Design

**Responsividade**
- Mobile-first (breakpoints: sm, md, lg)
- Sidebar colapsável (hamburger menu)
- Grid adaptativo (1 → 2 → 4 colunas)

**Componentes Reutilizáveis**
```javascript
// Exemplo de padrão usado:
function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`font-display text-3xl font-bold ${color}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
```

**State Management**
- useState para estado local
- useEffect para side effects
- Context API para auth (Supabase Provider)
- Nenhuma lib adicional (Redux, Zustand, etc)

**API Communication**
```javascript
// lib/api.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function request(method, path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  return res.json();
}

export const campaignsApi = {
  list: (params) => request('GET', '/api/campaigns?'+new URLSearchParams(params)),
  create: (data) => request('POST', '/api/campaigns', data),
  // ...
};
```

---

### 3. Evolution API

#### O que é?
- Wrapper Node.js sobre a biblioteca Baileys
- Permite múltiplas instâncias WhatsApp simultâneas
- Cada instância = 1 número conectado
- API REST para controle

#### Arquitetura Interna
```
┌─────────────────────────────────────────┐
│         Evolution API (Express)         │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Instance Manager                │ │
│  │   (Gerencia N instâncias)         │ │
│  └───────────────────────────────────┘ │
│           │         │         │         │
│           ▼         ▼         ▼         │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│   │Instance │ │Instance │ │Instance │ │
│   │tenant_1 │ │tenant_2 │ │tenant_3 │ │
│   │         │ │         │ │         │ │
│   │ Baileys │ │ Baileys │ │ Baileys │ │
│   │ Socket  │ │ Socket  │ │ Socket  │ │
│   └────┬────┘ └────┬────┘ └────┬────┘ │
│        │           │           │       │
└────────┼───────────┼───────────┼───────┘
         │           │           │
         ▼           ▼           ▼
    WhatsApp    WhatsApp    WhatsApp
     Server      Server      Server
```

#### Endpoints Principais
```bash
# Criar instância
POST /instance/create
{
  "instanceName": "tenant_uuid_here",
  "qrcode": true,
  "integration": "WHATSAPP-BAILEYS"
}

# Buscar QR Code
GET /instance/connect/:instanceName

# Enviar mensagem
POST /message/sendText/:instanceName
{
  "number": "5511999999999",
  "text": "Olá!"
}

# Desconectar
DELETE /instance/logout/:instanceName
```

#### Webhooks Enviados
```javascript
// connection.update
{
  "event": "connection.update",
  "instance": "tenant_uuid",
  "data": {
    "state": "open", // ou "close"
    "statusReason": 200
  }
}

// messages.upsert (mensagem recebida)
{
  "event": "messages.upsert",
  "instance": "tenant_uuid",
  "data": {
    "key": { "remoteJid": "5511999999999@s.whatsapp.net", ... },
    "message": { "conversation": "oi" },
    "messageTimestamp": 1234567890
  }
}

// messages.update (confirmação)
{
  "event": "messages.update",
  "data": {
    "key": { ... },
    "update": { "status": 3 } // 1=sent, 2=delivered, 3=read
  }
}
```

---

### 4. Supabase (Backend as a Service)

#### Serviços Utilizados

**PostgreSQL**
- Banco relacional principal
- 10 tabelas + 1 view
- RLS habilitado em todas as tabelas
- Functions: `check_tenant_blocked()`, `increment_messages_sent()`
- Triggers: `update_updated_at`

**Auth**
- JWT generation
- Email/password authentication
- `auth.users` table
- Session management

**Storage**
- Bucket: `campaign-media` (público)
- Suporta: images, videos, PDFs
- CDN integrado
- Políticas de acesso por tenant

**Row Level Security (RLS)**
```sql
-- Exemplo de política em todas as tabelas:
CREATE POLICY "tenant_isolation" ON campaigns
  FOR ALL
  USING (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE auth_user_id = auth.uid()
    )
  );
```

#### Por que Supabase?
| Requisito | Solução Supabase |
|-----------|------------------|
| Multi-tenant isolation | RLS policies |
| Auth sem code | Supabase Auth (JWT) |
| File storage | Supabase Storage (S3-like) |
| Realtime (opcional) | Supabase Realtime |
| Backups automáticos | Inclusos no plano |
| SSL built-in | Sim |
| CDN global | Sim |

---

## 🔄 Fluxo de Dados

### Fluxo 1: Criação de Campanha

```
┌──────────┐
│  User    │ Preenche formulário: nome, mensagem, mídia, agendamento
└────┬─────┘
     │ POST /api/campaigns
     ▼
┌─────────────────────┐
│  Backend (Fastify)  │
├─────────────────────┤
│ 1. authMiddleware   │ → Valida JWT, busca tenant
│ 2. Valida dados     │ → Nome, mensagem, mídia obrigatórios
│ 3. Upload mídia     │ → Se houver, salva no Supabase Storage
│ 4. Conta contatos   │ → Filtra por tags (se especificado)
│ 5. Calcula datas    │ → Se recorrente, gera array de datas
│ 6. Insere campaign  │ → 1 ou N campanhas (se recorrente)
│ 7. Insere queue     │ → campaign_contacts (fila)
│ 8. Enfileira job    │ → Se imediato, enfileira no Redis
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│  Redis (BullMQ)     │
├─────────────────────┤
│ Queue: campaign     │
│ Job: {              │
│   campaignId: uuid, │
│   tenantId: uuid    │
│ }                   │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│  Campaign Worker    │
├─────────────────────┤
│ 1. Puxa job         │
│ 2. Carrega campanha │
│ 3. Carrega contatos │
│ 4. Loop:            │
│    - Verifica status│
│    - Verifica horário
│    - Simula typing │
│    - Envia mensagem │
│    - Delay humano   │
│    - Atualiza DB    │
└────┬────────────────┘
     │ POST /message/sendText/:instance
     ▼
┌─────────────────────┐
│  Evolution API      │
├─────────────────────┤
│ 1. Valida apikey    │
│ 2. Busca instância  │
│ 3. Envia via Baileys│
└────┬────────────────┘
     │ WebSocket (Baileys protocol)
     ▼
┌─────────────────────┐
│  WhatsApp Servers   │
└─────────────────────┘
```

### Fluxo 2: Mensagem Recebida (Chatbot)

```
┌─────────────────────┐
│  WhatsApp Servers   │ User envia "oi"
└────┬────────────────┘
     │ WebSocket
     ▼
┌─────────────────────┐
│  Evolution API      │
├─────────────────────┤
│ 1. Baileys recebe   │
│ 2. Emite evento     │
│ 3. Chama webhook    │
└────┬────────────────┘
     │ POST /webhook/evolution
     │ Event: messages.upsert
     ▼
┌──────────────────────┐
│  Backend (Webhooks) │
├──────────────────────┤
│ 1. Valida evento     │
│ 2. Ignora se fromMe  │
│ 3. Busca tenant      │
│ 4. processBotMessage │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│  Bot Engine                          │
├──────────────────────────────────────┤
│ 1. Busca sessão (bot_sessions)       │
│ 2. Se sem sessão:                    │
│    - Busca automação ativa           │
│    - Tenta bater trigger:            │
│      • keyword: "oi" in keywords?    │
│      • always: sempre ativa          │
│    - Se bateu → inicia fluxo         │
│ 3. Se tem sessão:                    │
│    - Continua do nó atual            │
│    - Se menu → busca option.key      │
│    - Vai pro next_node_order         │
│ 4. Executa nós sequencialmente:      │
│    - type=message → envia texto      │
│    - type=menu → envia + salva sessão│
│    - type=wait → salva sessão        │
│ 5. Se terminou → limpa sessão        │
└────┬─────────────────────────────────┘
     │ POST /message/sendText/:instance
     ▼
┌─────────────────────┐
│  Evolution API      │ Envia resposta do bot
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│  WhatsApp Servers   │ User recebe resposta
└─────────────────────┘
```

### Fluxo 3: Confirmação de Entrega

```
┌─────────────────────┐
│  WhatsApp Servers   │ Confirma entrega
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│  Evolution API      │ Recebe confirmação via Baileys
├─────────────────────┤
│ Event:              │
│ messages.update     │
│ status: 2 (delivered)
└────┬────────────────┘
     │ POST /webhook/evolution
     ▼
┌──────────────────────┐
│  Backend (Webhooks) │
├──────────────────────┤
│ 1. Valida evento     │
│ 2. Extrai wa_message_id
│ 3. Atualiza campaign_contacts:
│    status = 'delivered'
│ 4. Atualiza message_logs
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│  Supabase            │
├──────────────────────┤
│ campaign_contacts    │
│ SET status='delivered'
│ WHERE wa_message_id=X│
└──────────────────────┘
```

---

## 🗄️ Modelos de Dados

### Diagrama ER Simplificado

```
┌──────────────┐
│   tenants    │────────┐
└──────────────┘        │
       │                │ 1:N
       │ 1:N            │
       │                │
       ▼                ▼
┌──────────────┐  ┌──────────────┐
│   contacts   │  │  campaigns   │
└──────────────┘  └──────────────┘
                         │
                         │ 1:N
                         ▼
                  ┌──────────────────┐
                  │campaign_contacts │
                  └──────────────────┘
                  
┌──────────────┐
│  tenants     │────────┐
└──────────────┘        │ 1:N
                        │
                        ▼
                 ┌──────────────┐
                 │ automations  │
                 └──────────────┘
                        │
                        │ 1:N
                        ▼
                 ┌─────────────────┐
                 │automation_nodes │
                 └─────────────────┘
```

### Schema Detalhado

#### tenants
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT DEFAULT 'trial', -- trial, basic, pro, enterprise
  status TEXT DEFAULT 'trial', -- trial, active, suspended
  
  -- WhatsApp
  wa_instance_id TEXT,
  wa_status TEXT DEFAULT 'disconnected',
  wa_phone TEXT,
  wa_profile_name TEXT,
  wa_connected_at TIMESTAMPTZ,
  
  -- Limits
  messages_limit_month INTEGER DEFAULT 500,
  contacts_limit INTEGER DEFAULT 200,
  campaigns_limit INTEGER DEFAULT 2,
  min_delay_seconds INTEGER DEFAULT 15,
  
  -- Usage
  messages_sent_month INTEGER DEFAULT 0,
  billing_cycle_start DATE DEFAULT CURRENT_DATE,
  
  -- Subscription
  subscription_expires_at TIMESTAMPTZ,
  blocked_at TIMESTAMPTZ,
  block_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_tenants_auth_user ON tenants(auth_user_id);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_wa_instance ON tenants(wa_instance_id);
```

#### campaigns
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft', -- draft, scheduled, running, paused, done, failed, cancelled
  
  -- Content
  message_text TEXT,
  media_type TEXT, -- none, image, video, document
  media_url TEXT,
  media_caption TEXT,
  
  -- Behavior
  delay_min_seconds INTEGER DEFAULT 10,
  delay_max_seconds INTEGER DEFAULT 30,
  typing_simulation BOOLEAN DEFAULT true,
  send_start_hour INTEGER DEFAULT 8,
  send_end_hour INTEGER DEFAULT 20,
  send_on_weekends BOOLEAN DEFAULT false,
  
  -- Targeting
  target_tags TEXT[],
  
  -- Recurrence
  recurrence_type TEXT DEFAULT 'none', -- none, once, daily, weekly, custom
  recurrence_days INTEGER[], -- [0,1,2,3,4,5,6] = Dom a Sáb
  recurrence_times TEXT[], -- ['09:00', '14:00', '18:00']
  recurrence_end_date DATE,
  
  -- Stats
  contacts_total INTEGER DEFAULT 0,
  contacts_sent INTEGER DEFAULT 0,
  contacts_delivered INTEGER DEFAULT 0,
  contacts_read INTEGER DEFAULT 0,
  contacts_failed INTEGER DEFAULT 0,
  contacts_pending INTEGER DEFAULT 0,
  
  -- Timestamps
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_campaigns_tenant_month ON campaigns(tenant_id, created_at);
```

#### campaign_contacts (Fila)
```sql
CREATE TABLE campaign_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued', -- queued, sending, sent, delivered, read, failed
  wa_message_id TEXT,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_status ON campaign_contacts(campaign_id, status);
CREATE INDEX idx_campaign_contacts_wa_msg ON campaign_contacts(wa_message_id);
```

#### automations
```sql
CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- keyword, always, menu
  trigger_keywords TEXT[], -- ['oi', 'ola', 'menu']
  active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Maior prioridade = executa primeiro
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automations_tenant ON automations(tenant_id);
CREATE INDEX idx_automations_active ON automations(tenant_id, active, priority DESC);
```

#### automation_nodes
```sql
CREATE TABLE automation_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID REFERENCES automations(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  type TEXT NOT NULL, -- message, menu, wait, condition
  content TEXT,
  media_url TEXT,
  options JSONB, -- [{ key: '1', label: 'Suporte', next_node_order: 2 }]
  wait_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_nodes_automation ON automation_nodes(automation_id, order_index);
```

#### bot_sessions
```sql
CREATE TABLE bot_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  automation_id UUID REFERENCES automations(id) ON DELETE CASCADE,
  current_node_index INTEGER DEFAULT 0,
  context JSONB DEFAULT '{}', -- { lastMenuChoice: '1', userName: 'João' }
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_bot_sessions_tenant_phone ON bot_sessions(tenant_id, phone);
CREATE INDEX idx_bot_sessions_expires ON bot_sessions(expires_at);
```

---

## 🔌 APIs e Integrações

### API Interna (Backend → Evolution)

**Base URL:** `http://evolution:8080` (dentro do Docker)

**Headers:**
```
apikey: {EVOLUTION_API_KEY}
Content-Type: application/json
```

**Endpoints Utilizados:**

```javascript
// 1. Criar Instância
POST /instance/create
{
  "instanceName": "tenant_abc123",
  "qrcode": true,
  "integration": "WHATSAPP-BAILEYS",
  "webhookUrl": "http://zf_backend:3001/webhook/evolution",
  "webhookByEvents": true,
  "webhookEvents": [
    "QRCODE_UPDATED",
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "CONNECTION_UPDATE",
    "SEND_MESSAGE"
  ]
}

// 2. Buscar QR Code
GET /instance/connect/tenant_abc123
Response: {
  "base64": "data:image/png;base64,iVBOR...",
  "code": "1234567890ABCDEF..."
}

// 3. Enviar Mensagem de Texto
POST /message/sendText/tenant_abc123
{
  "number": "5511999999999",
  "textMessage": {
    "text": "Olá! Como posso ajudar?"
  }
}

// 4. Enviar Imagem
POST /message/sendMedia/tenant_abc123
{
  "number": "5511999999999",
  "mediaMessage": {
    "mediatype": "image",
    "media": "https://bucket.supabase.co/image.jpg",
    "caption": "Confira nossa promoção!"
  }
}

// 5. Logout
DELETE /instance/logout/tenant_abc123
```

### API Externa (Frontend → Backend)

**Base URL:** `http://localhost:3001` (dev) ou `https://api.seudominio.com` (prod)

**Auth:** `Authorization: Bearer {JWT_TOKEN}`

**Endpoints Documentados:**

```yaml
# WhatsApp
GET    /api/whatsapp/status
GET    /api/whatsapp/connect
POST   /api/whatsapp/disconnect

# Contacts
GET    /api/contacts?page=1&limit=50&tag=vip&search=João
GET    /api/contacts/tags
POST   /api/contacts/import (multipart/form-data)
DELETE /api/contacts/:id
PATCH  /api/contacts/:id/tags

# Campaigns
GET    /api/campaigns?status=running&month=2&year=2025
GET    /api/campaigns/calendar?month=2&year=2025
GET    /api/campaigns/:id
POST   /api/campaigns
POST   /api/campaigns/:id/start
POST   /api/campaigns/:id/pause
POST   /api/campaigns/:id/resume
DELETE /api/campaigns/:id
GET    /api/campaigns/:id/report

# Automations
GET    /api/automations
GET    /api/automations/:id
POST   /api/automations
PATCH  /api/automations/:id
DELETE /api/automations/:id

# Media
GET    /api/media?type=image
POST   /api/media/upload (multipart/form-data)
DELETE /api/media/:id

# Webhooks (público - sem auth)
POST   /webhook/evolution

# Admin (header: x-admin-key)
GET    /admin/tenants
GET    /admin/tenants/:id
POST   /admin/tenants/:id/block
POST   /admin/tenants/:id/unblock
POST   /admin/tenants
GET    /admin/stats
```

### Webhook Evolution → Backend

**Endpoint:** `POST /webhook/evolution`

**Eventos Recebidos:**

```javascript
// 1. CONNECTION_UPDATE
{
  "event": "connection.update",
  "instance": "tenant_abc123",
  "data": {
    "state": "open", // ou "close"
    "statusReason": 200
  }
}
→ Atualiza tenants.wa_status

// 2. QRCODE_UPDATED
{
  "event": "qrcode.updated",
  "instance": "tenant_abc123",
  "data": {
    "qrcode": {
      "base64": "data:image...",
      "code": "..."
    }
  }
}
→ Retorna QR para frontend

// 3. MESSAGES_UPSERT (recebida)
{
  "event": "messages.upsert",
  "instance": "tenant_abc123",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "ABCD1234"
    },
    "message": {
      "conversation": "oi"
    },
    "messageTimestamp": 1234567890,
    "pushName": "João Silva"
  }
}
→ Processa bot engine

// 4. MESSAGES_UPDATE (confirmação)
{
  "event": "messages.update",
  "instance": "tenant_abc123",
  "data": [{
    "key": { "id": "MSG_ID" },
    "update": {
      "status": 2 // 1=sent, 2=delivered, 3=read
    }
  }]
}
→ Atualiza campaign_contacts.status
```

---

## 🔒 Segurança

### Camadas de Segurança

#### 1. Autenticação e Autorização

**JWT (JSON Web Token)**
```javascript
// Fluxo:
1. User faz login → Supabase Auth gera JWT
2. Frontend armazena JWT (session storage)
3. Todas requests incluem: Authorization: Bearer {JWT}
4. Backend valida JWT com Supabase:
   const { data: { user } } = await supabase.auth.getUser(token)
5. Backend busca tenant associado ao user
6. Request prossegue com req.tenant e req.user injetados
```

**Admin Key**
```javascript
// Rotas admin protegidas por header separado:
Header: x-admin-key: {ADMIN_KEY}

// Middleware verifica:
if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
  return reply.code(403).send({ error: 'Forbidden' });
}
```

#### 2. Row Level Security (RLS)

**Supabase RLS habilitado em TODAS as tabelas:**

```sql
-- Exemplo: contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON contacts
  FOR ALL
  USING (
    tenant_id IN (
      SELECT id FROM tenants 
      WHERE auth_user_id = auth.uid()
    )
  );

-- Garante que cada tenant só acessa seus próprios dados
-- Funciona automaticamente em:
-- • SELECT
-- • INSERT (se inserir tenant_id diferente → negado)
-- • UPDATE
-- • DELETE
```

**Políticas Específicas:**

```sql
-- Admin pode ver tudo (service key bypass RLS)
-- Tenants veem apenas seus dados
-- Public não vê nada (sem política = negado por padrão)
```

#### 3. Rede e Infraestrutura

**Firewall (UFW)**
```bash
# Apenas 3 portas abertas:
22/tcp  → SSH (só seu IP se configurado)
80/tcp  → HTTP (redirect para HTTPS)
443/tcp → HTTPS (Nginx)

# Portas internas (não expostas):
3000 → Frontend (só via Nginx)
3001 → Backend (só via Nginx)
3002 → Admin (só via Nginx)
6379 → Redis (só Docker network)
5432 → Postgres (só Docker network)
8080 → Evolution (só Docker network)
```

**Rate Limiting (Nginx)**
```nginx
# API normal
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;

# Webhooks (maior limite)
limit_req_zone $binary_remote_addr zone=webhook:10m rate=120r/m;

location /api/ {
  limit_req zone=api burst=20 nodelay;
  proxy_pass http://zf_backend:3001;
}

location /webhook/ {
  limit_req zone=webhook burst=50 nodelay;
  proxy_pass http://zf_backend:3001;
}
```

**Headers de Segurança**
```nginx
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()";
```

#### 4. Dados

**Senhas e Secrets**
- Senhas hashadas (Supabase Auth usa bcrypt)
- Service keys e API keys via variáveis de ambiente (nunca no código)
- `.env` nunca comitado no Git (`.gitignore`)
- Rotate keys periodicamente

**Conexões SSL/TLS**
- Supabase: sempre HTTPS
- Evolution API: HTTP interno (rede Docker), HTTPS externo (Nginx)
- Frontend ↔ Backend: HTTPS (Nginx)

**Backup**
- Supabase: backup automático (retention 7 dias no free tier)
- Postgres Evolution: backup manual via script (`/opt/zapflow/scripts/backup.sh`)
- Mídia: Supabase Storage (redundância automática)

#### 5. Código

**Input Validation**
```javascript
// Fastify schemas (opcional mas recomendado):
const createCampaignSchema = {
  body: {
    type: 'object',
    required: ['name', 'message_text'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      message_text: { type: 'string', minLength: 1 },
      delay_min_seconds: { type: 'integer', minimum: 5, maximum: 120 },
      // ...
    }
  }
};

app.post('/api/campaigns', { schema: createCampaignSchema }, handler);
```

**SQL Injection Protection**
```javascript
// Supabase client usa parameterized queries automaticamente:
await supabase
  .from('campaigns')
  .select('*')
  .eq('tenant_id', tenantId) // ← Safe, não usa string concatenation
  .eq('name', userInput);     // ← Safe
```

**XSS Protection**
- React escapa automaticamente JSX
- Tailwind CSS inline (sem `dangerouslySetInnerHTML`)
- Nenhum `eval()` ou `new Function()`

---

## 📈 Escalabilidade

### Capacidade Atual (1 VPS 4GB RAM)

```yaml
Tenants simultâneos: 50-80
Campanhas ativas: 10-20 simultâneas
Mensagens/hora: 3.000-5.000
Contatos no banco: 500.000+
```

### Gargalos Identificados

| Componente | Limite Atual | Bottleneck |
|------------|--------------|------------|
| Evolution API | 50-80 instâncias | Memória (cada instância ~50MB) |
| Worker (BullMQ) | 5 concurrent jobs | CPU (single process) |
| Redis | Ilimitado prático | RAM (maxmemory 512MB) |
| Supabase Free | 500MB DB, 1GB Storage | Plano gratuito |

### Estratégias de Escalonamento

#### Vertical Scaling (Curto Prazo)
```yaml
# Upgrade VPS:
CPU: 2 → 4 cores
RAM: 4GB → 8GB
Disk: 40GB → 80GB SSD

# Benefícios:
- 100-150 tenants
- 20-30 campanhas simultâneas
- 10.000 msgs/hora
```

#### Horizontal Scaling (Médio Prazo)

**1. Separar Workers**
```yaml
# VPS 1: API + Frontend + Admin
services:
  - zf_backend (apenas rotas)
  - zf_frontend
  - zf_admin
  - zf_nginx

# VPS 2: Workers Dedicados
services:
  - zf_worker_1 (5 concurrent)
  - zf_worker_2 (5 concurrent)
  - zf_worker_3 (5 concurrent)
  → 15 campanhas simultâneas
```

**2. Load Balancer**
```nginx
# Nginx upstream
upstream backend {
  least_conn; # ou ip_hash
  server vps1:3001;
  server vps2:3001;
  server vps3:3001;
}

# Alta disponibilidade
# Distribuição de carga
```

**3. Redis Gerenciado**
```yaml
# Migrar para:
- AWS ElastiCache
- DigitalOcean Managed Redis
- Upstash (serverless)

# Benefícios:
- Mais RAM (8GB+)
- Backups automáticos
- Alta disponibilidade
```

**4. Supabase Pro**
```yaml
# Upgrade plan:
DB: 500MB → 8GB
Storage: 1GB → 100GB
Bandwidth: 2GB → 50GB/mês
Backups: 7 dias → 30 dias
```

#### Database Scaling (Longo Prazo)

**Read Replicas**
```javascript
// Supabase: adicionar replicas
// Usar replica para reads, master para writes

// Backend:
const masterClient = createClient(URL, SERVICE_KEY);
const replicaClient = createClient(REPLICA_URL, SERVICE_KEY);

// Reads:
const campaigns = await replicaClient.from('campaigns').select('*');

// Writes:
await masterClient.from('campaigns').insert(data);
```

**Sharding (se >1M tenants)**
```yaml
# Dividir tenants por região:
Shard 1: Brasil (tenants_br)
Shard 2: América Latina (tenants_latam)
Shard 3: USA/Europa (tenants_global)

# Roteamento por tenant_id prefix
```

### Monitoramento para Escalar

```javascript
// Métricas críticas:
- CPU usage > 80% sustained
- Memory usage > 85%
- Redis queue depth > 1000 jobs
- Campaign worker lag > 5 min
- Evolution instances > 70% capacity

// Alertas:
→ Upgrade vertical se any metric triggered por >1h
→ Escalar horizontal se triggered por >24h
```

---

## 🤔 Decisões Arquiteturais

### 1. Por que Fastify em vez de Express?

**Escolha:** Fastify

**Razões:**
- **Performance:** 2-3x mais rápido que Express (benchmarks)
- **Schema Validation:** Built-in (Express precisa de middleware externo)
- **TypeScript-first:** Melhor suporte nativo
- **Plugins modernos:** Ecosistema mais recente
- **Async/await nativo:** Express ainda luta com promises

**Trade-off:**
- Ecosistema menor que Express
- Menos tutoriais/exemplos
- ✅ Aceitável: performance compensa

### 2. Por que BullMQ em vez de Celery/Sidekiq/Kafka?

**Escolha:** BullMQ

**Razões:**
- **Node.js nativo:** Sem context switch (Python/Ruby)
- **Redis:** Já usado como cache, aproveita mesma infra
- **Simplicidade:** Menos overhead que Kafka
- **Retry/delay built-in:** Features necessárias incluídas
- **Dashboard:** Bull Board para monitoramento

**Alternativas consideradas:**
- Kafka: overkill para volume atual
- AWS SQS: vendor lock-in + custos
- RabbitMQ: mais complexo que Redis

### 3. Por que Supabase em vez de PostgreSQL + Auth0 + S3?

**Escolha:** Supabase

**Razões:**
- **All-in-one:** Postgres + Auth + Storage + Realtime
- **RLS nativo:** Multi-tenant isolation sem código
- **Hosted:** Menos DevOps
- **CDN incluído:** Storage com CDN global
- **Backups automáticos:** Inclusos no plano

**Trade-off:**
- Vendor lock-in moderado
- Menos controle sobre infraestrutura
- ✅ Aceitável: produtividade > controle

### 4. Por que Evolution API em vez de Green API / Twilio?

**Escolha:** Evolution API (Baileys)

**Razões:**
- **Open Source:** Self-hosted, sem custos por mensagem
- **Multi-instância:** 1 API gerencia N números
- **WhatsApp Web Protocol:** Não é API oficial (mais flexível)
- **Controle total:** Hosted na própria VPS

**Alternativas consideradas:**
- Green API: R$ 0,10/msg → R$ 10k/mês para 100k msgs
- Twilio: R$ 0,25/msg → R$ 25k/mês
- Wppconnect: menos mantido

**Riscos:**
- WhatsApp pode banir (mitiga com delays humanos)
- Não é API oficial (pode quebrar)
- ✅ Aceitável: custo 0 > risco controlável

### 5. Por que Next.js em vez de React SPA?

**Escolha:** Next.js 14 (App Router)

**Razões:**
- **SSR built-in:** SEO + performance
- **File-based routing:** Menos boilerplate
- **API routes:** Backend leve se precisar
- **Image optimization:** Automática
- **Standalone mode:** Docker otimizado

**Trade-off:**
- Mais opinionado que React puro
- Curva de aprendizado (App Router novo)
- ✅ Aceitável: produtividade > flexibilidade

### 6. Por que Docker Compose em vez de Kubernetes?

**Escolha:** Docker Compose

**Razões:**
- **Simplicidade:** Deploy em 1 comando
- **Recursos:** 7 serviços cabem em 1 VPS 4GB
- **DevOps:** Menos conhecimento necessário
- **Custo:** Kubernetes = mínimo 3 nodes

**Quando migrar para K8s:**
- >10 VPS
- Múltiplas regiões geográficas
- Alta disponibilidade crítica
- >100 req/s sustentados

### 7. Por que Normalização de Telefone Manual?

**Escolha:** Implementar phoneFilter.js

**Razões:**
- **BR-specific:** Código de operadora, 9º dígito
- **UY support:** Clientes na fronteira
- **Libs insuficientes:** libphonenumber não cobre edge cases BR
- **Controle:** Ajuste fino de regras

**Implementação:**
```javascript
// phoneFilter.js
export function normalizePhone(raw) {
  // Remove formatação
  let clean = raw.replace(/\D/g, '');
  
  // Remove operadora (0xx)
  clean = clean.replace(/^0(\d{2})/, '$1');
  
  // DDI
  if (clean.length === 11 && clean[0] !== '0') {
    clean = '55' + clean; // Brasil
  } else if (clean.length === 9 && clean[0] === '9') {
    clean = '598' + clean; // Uruguai
  }
  
  // 9º dígito (DDDs ≤28 no BR)
  if (clean.startsWith('55')) {
    const ddd = parseInt(clean.substring(2, 4));
    if (ddd <= 28 && clean.length === 12) {
      clean = clean.substring(0, 4) + '9' + clean.substring(4);
    }
  }
  
  return clean;
}
```

### 8. Por que Comportamento Humano em vez de Rate Limit Simples?

**Escolha:** Delay aleatório + typing simulation

**Razões:**
- **Anti-ban:** WhatsApp detecta padrões robóticos
- **Delay fixo:** 10s entre mensagens = suspicious
- **Delay aleatório + noise:** Parece humano
- **Typing:** "digitando..." antes de enviar = +realismo

**Implementação:**
```javascript
function humanDelay(min, max) {
  const base = Math.random() * (max - min) + min;
  const noise = (Math.random() - 0.5) * 1; // ±500ms
  return (base + noise) * 1000;
}

function simulateTyping(text) {
  const chars = text.length;
  const wpm = 60; // palavras por minuto médio
  const cps = (wpm * 5) / 60; // chars por segundo
  return Math.min(7000, (chars / cps) * 1000);
}

// Uso:
await typing(text);
await sleep(humanDelay(10, 30));
await sendMessage(text);
```

---

## 📊 Comparação com Alternativas

### vs. N8N (Low-Code)

| Aspecto | ZapFlow | N8N |
|---------|---------|-----|
| Multi-tenant | ✅ Nativo | ❌ Precisa código custom |
| WhatsApp | ✅ Evolution integrado | ⚠️ Via nodes (mais complexo) |
| Performance | ✅ Otimizado (Fastify) | ⚠️ Overhead workflow engine |
| Chatbot | ✅ Nativo com sessões | ⚠️ Precisa state externo |
| Customização | ✅ Total (código) | ⚠️ Limitado a nodes |
| Deploy | ✅ Docker simples | ✅ Docker simples |

**Conclusão:** ZapFlow vence se precisa multi-tenant + chatbot avançado.

### vs. ManyChat / Chatfuel

| Aspecto | ZapFlow | ManyChat |
|---------|---------|----------|
| Custo | ✅ Self-hosted ($0) | ❌ $15-150/mês por conta |
| WhatsApp | ✅ Ilimitado | ❌ Limitado por plano |
| Multi-tenant | ✅ Sim | ❌ Não (1 conta = 1 bot) |
| Customização | ✅ Total | ⚠️ Visual builder |
| Dados | ✅ Seu servidor | ❌ Servidor deles |

**Conclusão:** ZapFlow vence se precisa white-label + múltiplos clientes.

### vs. Twilio + Custom Code

| Aspecto | ZapFlow | Twilio |
|---------|---------|--------|
| Custo/msg | ✅ $0 | ❌ $0.25/msg |
| Setup | ✅ Pronto | ⚠️ Build do zero |
| API oficial | ❌ Não (Baileys) | ✅ Sim |
| Risco ban | ⚠️ Existe | ✅ Zero |
| Escalabilidade | ⚠️ Manual | ✅ Infinita |

**Conclusão:** ZapFlow se custo > risco. Twilio se compliance > custo.

---

## 🎓 Referências e Recursos

### Documentação Oficial
- [Fastify](https://www.fastify.io/docs/latest/)
- [Next.js 14](https://nextjs.org/docs)
- [Supabase](https://supabase.com/docs)
- [Evolution API](https://doc.evolution-api.com/)
- [BullMQ](https://docs.bullmq.io/)
- [Baileys](https://github.com/WhiskeySockets/Baileys)

### Artigos Técnicos
- [Multi-tenant Architecture Patterns](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/overview)
- [Row Level Security in PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [WhatsApp Web Reverse Engineering](https://github.com/sigalor/whatsapp-web-reveng)

### Repositórios Similares
- [WPPConnect](https://github.com/wppconnect-team/wppconnect)
- [Baileys](https://github.com/WhiskeySockets/Baileys)
- [Evolution API](https://github.com/EvolutionAPI/evolution-api)

---

**Documentação gerada em:** 2025-02-21  
**Versão do Sistema:** 1.0.0  
**Última Atualização:** 2025-02-21
