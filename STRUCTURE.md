# 📁 ZapFlow — Estrutura Completa do Projeto

## 🗂️ Visão Geral da Estrutura

```
zapflow/
├── backend/                    # API Node.js + Fastify
│   ├── src/
│   │   ├── server.js          # ← ENTRADA principal
│   │   ├── lib/               # Bibliotecas compartilhadas
│   │   │   ├── clients.js     # Supabase + Redis + Evolution API
│   │   │   └── phoneFilter.js # Normalização BR/UY + CSV/VCF parser
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT + verificação de bloqueio
│   │   ├── routes/            # Endpoints da API
│   │   │   ├── whatsapp.js    # Conexão QR Code
│   │   │   ├── contacts.js    # Importação + listagem
│   │   │   ├── campaigns.js   # CRUD + agendamento avançado
│   │   │   ├── automations.js # Chatbot (menu, keywords, fluxos)
│   │   │   ├── media.js       # Upload Supabase Storage
│   │   │   ├── webhooks.js    # Recebe eventos Evolution + bot engine
│   │   │   └── admin.js       # Bloquear/reativar tenants
│   │   └── workers/
│   │       └── campaignWorker.js  # Motor de disparo + scheduler
│   ├── package.json           # Dependências Node.js
│   ├── Dockerfile             # Node 20 Alpine multi-stage
│   └── .dockerignore          # Excluir node_modules do build
│
├── frontend/                   # Next.js 14 + Tailwind CSS
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.js      # Root layout com fonts + provider
│   │   │   ├── globals.css    # CSS global + variáveis + animações
│   │   │   ├── login/
│   │   │   │   └── page.js    # Tela de login (Supabase Auth)
│   │   │   └── dashboard/
│   │   │       ├── layout.js  # Sidebar + topbar responsivo
│   │   │       ├── page.js    # Home: stats + campanhas + log
│   │   │       ├── campanhas/
│   │   │       │   └── nova/
│   │   │       │       └── page.js  # Form completo: mídia + agendamento
│   │   │       ├── agendamento/
│   │   │       │   └── page.js      # Calendário visual mês a mês
│   │   │       ├── contatos/
│   │   │       │   └── page.js      # Lista + importação CSV/VCF
│   │   │       ├── automacoes/
│   │   │       │   └── page.js      # Flow builder visual
│   │   │       └── whatsapp/
│   │   │           └── page.js      # QR Code + status
│   │   ├── components/
│   │   │   └── providers/
│   │   │       └── SupabaseProvider.js  # Context auth + redirect
│   │   └── lib/
│   │       └── api.js         # Cliente HTTP tipado para backend
│   ├── package.json           # Next.js + Supabase + Tailwind
│   ├── next.config.mjs        # Config: standalone output p/ Docker
│   ├── tailwind.config.js     # Tema customizado (cores brand)
│   ├── postcss.config.js      # PostCSS + Autoprefixer
│   ├── Dockerfile             # Next.js build multi-stage
│   └── .dockerignore
│
├── admin/                      # Painel Admin (HTML puro)
│   ├── admin.html             # Interface completa com filtros
│   ├── Dockerfile             # Serve via Node 20 (standalone)
│   └── .dockerignore
│
├── nginx/
│   └── nginx.conf             # Reverse proxy + SSL + rate limiting
│
├── migrations.sql             # Schema completo Supabase (10 tabelas)
├── docker-compose.yml         # Orquestra 7 serviços
├── .env.example               # Template de variáveis
├── setup.sh                   # Instalação automatizada VPS
├── DEPLOY_GUIDE.md            # Guia passo a passo completo
├── README.md                  # Visão geral + quick start
└── STRUCTURE.md               # ← ESTE ARQUIVO
```

---

## 📦 Backend — Detalhamento de Cada Arquivo

### `backend/src/server.js` (Entrada Principal)
**O que faz:**
- Inicializa servidor Fastify na porta 3001
- Registra plugins globais (CORS, multipart)
- Registra todas as rotas com prefixos:
  - `/api/*` → autenticado (JWT via `authMiddleware`)
  - `/webhook/*` → público (chamado pela Evolution API)
  - `/admin/*` → protegido por `x-admin-key`
- Health check em `/health`
- Graceful shutdown (SIGTERM/SIGINT)

**Depende de:**
- Todas as rotas em `routes/`
- Workers em `workers/campaignWorker.js`
- Middleware em `middleware/auth.js`

---

### `backend/src/lib/clients.js`
**O que faz:**
- Exporta instâncias singleton de:
  - **Supabase** (com service key, não anon)
  - **Redis** (IORedis para BullMQ)
  - **Evolution API** (axios configurado com apikey)
- Helper `instanceName(tenantId)` → gera nome único p/ instância WhatsApp

**Usado por:**
- Todas as rotas
- Workers

---

### `backend/src/lib/phoneFilter.js`
**O que faz:**
- **`normalizePhone(raw)`** → converte qualquer número BR/UY para E.164
  - Remove formatação (`()`, `-`, espaços)
  - Remove prefixo de operadora (`0xx`)
  - Adiciona código do país (`55` BR, `598` UY)
  - Corrige 9º dígito (DDDs ≤28 no BR)
  - Valida comprimento final
- **`parseCSV(buffer)`** → extrai `{name, phone}[]` de CSV/VCF
  - Detecta separador (`;` ou `,`)
  - Tenta UTF-8, fallback Latin1
  - Normaliza cada telefone
- **`parseVCF(buffer)`** → parse de vCard com Quoted-Printable
- **`interpolate(template, contact)`** → substitui `{nome}`, `{telefone}` em mensagens

**Usado por:**
- `routes/contacts.js` (importação)
- `workers/campaignWorker.js` (interpolação nas mensagens)

---

### `backend/src/middleware/auth.js`
**O que faz:**
- **`authMiddleware(request, reply)`**
  - Verifica header `Authorization: Bearer <JWT>`
  - Valida token com Supabase (`getUser`)
  - Busca tenant associado ao user
  - **Bloqueia ações** se tenant status = `suspended`
  - Injeta `request.tenant` e `request.user`
- **`adminMiddleware(request, reply)`**
  - Verifica header `x-admin-key`
  - Compara com `process.env.ADMIN_KEY`

**Usado por:**
- `server.js` (registra em todas rotas `/api/*` e `/admin/*`)

---

### `backend/src/routes/whatsapp.js`
**Endpoints:**
- **GET `/api/whatsapp/status`** → retorna status atual da conexão
- **GET `/api/whatsapp/connect`** → gera QR Code
  - Cria instância na Evolution API
  - Configura webhooks
  - Retorna base64 do QR Code
- **POST `/api/whatsapp/disconnect`** → desconecta e apaga instância

**Fluxo de conexão:**
1. Frontend chama `/connect`
2. Backend cria instância: `POST /instance/create` na Evolution
3. Busca QR: `GET /instance/connect/:instanceName`
4. Frontend exibe QR
5. Usuário escaneia no celular
6. Evolution envia webhook `connection.update` → `routes/webhooks.js` atualiza status

---

### `backend/src/routes/contacts.js`
**Endpoints:**
- **GET `/api/contacts?page=1&limit=50&tag=vip&search=João`**
  - Listagem paginada com filtros
  - RLS automático (só contatos do tenant)
- **GET `/api/contacts/tags`** → lista todas as tags únicas do tenant
- **POST `/api/contacts/import`** → upload CSV/VCF
  - Recebe arquivo via `multipart`
  - Parse com `phoneFilter.parseCSV/parseVCF`
  - Verifica limite do plano
  - Upsert em lote (ignora duplicados)
  - Tags opcionais via header `x-tags`
- **DELETE `/api/contacts/:id`** → soft delete (`active = false`)
- **PATCH `/api/contacts/:id/tags`** → atualiza tags

**Validações:**
- Limite de contatos por plano (trial: 200, pro: 10k, etc)
- Telefones inválidos são ignorados
- Duplicados são detectados por `(tenant_id, phone)` único

---

### `backend/src/routes/campaigns.js`
**Endpoints:**
- **GET `/api/campaigns?status=running&month=2&year=2025`**
- **GET `/api/campaigns/calendar?month=2&year=2025`** → agrupa por dia
- **GET `/api/campaigns/:id`**
- **POST `/api/campaigns`** → cria campanha (simples ou recorrente)
  - Valida nome, mensagem, mídia+legenda
  - Conta contatos alvo (filtra por tags)
  - **Agendamento avançado:**
    - `recurrence_type`: none, once, daily, weekly, custom
    - `recurrence_days`: [1,3,5] = Seg, Qua, Sex
    - `recurrence_times`: ['09:00','14:00','18:00']
    - `recurrence_end_date`: até quando repetir
  - **Cria múltiplas campanhas** se recorrente (1 por dia/horário)
  - Insere contatos na fila `campaign_contacts`
- **POST `/api/campaigns/:id/start`** → enfileira no BullMQ
- **POST `/api/campaigns/:id/pause`** → pausa
- **POST `/api/campaigns/:id/resume`** → retoma
- **DELETE `/api/campaigns/:id`** → cancela
- **GET `/api/campaigns/:id/report`** → estatísticas (enviados, entregues, lidos, falhas)

**Lógica de recorrência (função `buildSchedules`):**
- Gera array de datas ISO baseado em:
  - Tipo (daily, weekly, custom)
  - Dias da semana selecionados
  - Horários do dia
  - Range de datas (início → fim)
- **Exemplo:** weekly [1,3,5] com times [09:00, 18:00] de 01/02 a 28/02
  - Gera ~24 campanhas (8 segundas × 2 horários = 16, etc)

---

### `backend/src/routes/automations.js`
**Endpoints:**
- **GET `/api/automations`** → lista todas com nós aninhados
- **GET `/api/automations/:id`**
- **POST `/api/automations`** → cria fluxo completo
  - Estrutura: `{ name, trigger_type, trigger_keywords, nodes[] }`
  - Cada nó: `{ order, type, content, options, media_url, wait_seconds }`
  - Tipos de nó: `message`, `menu`, `wait`, `condition`
- **PATCH `/api/automations/:id`** → ativa/desativa
- **DELETE `/api/automations/:id`**

**Estrutura de um fluxo:**
```json
{
  "name": "Menu Principal",
  "trigger_type": "keyword",
  "trigger_keywords": ["oi", "olá", "menu"],
  "nodes": [
    {
      "order": 0,
      "type": "message",
      "content": "Olá {nome}! Como posso ajudar?"
    },
    {
      "order": 1,
      "type": "menu",
      "content": "Escolha:",
      "options": [
        {"key": "1", "label": "Suporte", "next_node_order": 2},
        {"key": "2", "label": "Vendas", "next_node_order": 3}
      ]
    },
    {
      "order": 2,
      "type": "wait"
    }
  ]
}
```

---

### `backend/src/routes/media.js`
**Endpoints:**
- **POST `/api/media/upload`** → upload para Supabase Storage
  - Aceita: image/*, video/*, application/pdf
  - Valida tipo e tamanho (máx 64MB)
  - Salva em `campaign-media` bucket
  - Retorna URL pública
  - Registra em `media_library` (histórico)
- **GET `/api/media?type=image`** → lista biblioteca
- **DELETE `/api/media/:id`** → remove do Storage + DB

**Validações:**
- Tipos permitidos: JPEG, PNG, WebP, GIF, MP4, PDF
- Vídeo > 64MB → rejeita (frontend deve comprimir)

---

### `backend/src/routes/webhooks.js`
**Endpoint:**
- **POST `/webhook/evolution`** → recebe eventos da Evolution API

**Eventos tratados:**
1. **`connection.update`** → atualiza status no DB
   - `state=open` → `wa_status='connected'`, salva telefone/perfil
   - Senão → `wa_status='disconnected'`

2. **`messages.update`** → confirmação de entrega/leitura
   - Atualiza `campaign_contacts.status` (delivered, read)
   - Atualiza `message_logs.status`

3. **`messages.upsert`** → **mensagem recebida → BOT**
   - Ignora mensagens do próprio bot (`fromMe=true`)
   - Ignora grupos
   - Busca tenant pela `instance`
   - **Processa bot:** `processBotMessage(tenant, phone, text)`

**Engine do Bot (`processBotMessage`):**
1. Busca sessão ativa em `bot_sessions` (Redis seria melhor, mas Supabase funciona)
2. Se tem sessão → continua fluxo
3. Se não → tenta bater trigger (keyword ou always)
4. Executa nós do fluxo:
   - `message` → envia texto (com interpolação `{nome}`)
   - `menu` → envia + espera resposta (salva sessão)
   - `wait` → salva sessão e para
5. Se terminou fluxo → limpa sessão

**Interpolação:**
- `{nome}` → busca em `contacts.name` via telefone
- `{telefone}` → o próprio número

---

### `backend/src/routes/admin.js`
**Endpoints (protegidos por `x-admin-key`):**
- **GET `/admin/tenants`** → lista todos via view `admin_overview`
  - Inclui: nome, email, plano, status, uso de msgs, campanhas ativas
- **GET `/admin/tenants/:id`** → detalhes de 1 tenant
- **POST `/admin/tenants/:id/block`** → suspende cliente
  - Atualiza `status='suspended'`, `block_reason`
  - Pausa campanhas ativas
  - Desconecta WhatsApp (chama Evolution `/instance/logout`)
- **POST `/admin/tenants/:id/unblock`** → reativa
  - Atualiza `status='active'`, `plan`, `subscription_expires_at`
  - Zera contador `messages_sent_month`
  - Atualiza limites (msgs, contatos, campanhas, delay_min)
- **POST `/admin/tenants`** → cria tenant manualmente
- **GET `/admin/stats`** → métricas gerais (total clientes, ativos, suspensos, msgs/mês)

**Limites por plano (hardcoded):**
```javascript
{
  trial:      { messages_limit_month: 500,   contacts_limit: 200,    campaigns_limit: 2,  min_delay_seconds: 15 },
  basic:      { messages_limit_month: 1000,  contacts_limit: 500,    campaigns_limit: 3,  min_delay_seconds: 12 },
  pro:        { messages_limit_month: 10000, contacts_limit: 10000,  campaigns_limit: 10, min_delay_seconds: 8  },
  enterprise: { messages_limit_month: 99999, contacts_limit: 999999, campaigns_limit: 50, min_delay_seconds: 5  },
}
```

---

### `backend/src/workers/campaignWorker.js`
**Responsabilidades:**
1. **Worker principal (`campaignQueue`)**
   - Processa job `{ campaignId, tenantId }`
   - Carrega campanha + tenant
   - Verifica bloqueio
   - Busca contatos pendentes (`status='queued'`)
   - Loop de envio:
     - Verifica se pausado/cancelado
     - Verifica horário comercial (`canSendNow`)
     - Verifica limite mensal a cada 50 msgs
     - Simula "digitando..." se `typing_simulation=true`
     - Envia via Evolution API
     - Delay humano aleatório (min–max segundos + ruído gaussiano)
     - Atualiza progresso

2. **Scheduler (`schedulerQueue`)**
   - Job repetitivo a cada 60s
   - Busca campanhas com `status='scheduled'` e `scheduled_at <= NOW()`
   - Enfileira no `campaignQueue`

**Comportamento anti-ban:**
- **Delay humano:** 10–30s aleatório com ruído gaussiano ±500ms
- **Digitando:** calcula tempo baseado no tamanho da mensagem (chars/3.3 * 1000ms, máx 7s)
- **Horário:** respeita `send_start_hour` e `send_end_hour`
- **Finais de semana:** respeita flag `send_on_weekends`
- **Se fora do horário:** pausa e agenda retomada para próximo horário válido

**Concorrência:** 5 jobs simultâneos (ajustável)

---

## 🎨 Frontend — Detalhamento de Cada Arquivo

### `frontend/src/app/layout.js` (Root Layout)
- Importa Google Fonts (Inter, Syne, JetBrains Mono)
- Injeta `SupabaseProvider` (gerencia auth global)
- Define metadata (title, description, viewport)

---

### `frontend/src/app/globals.css`
**Contém:**
- Imports do Tailwind (`@tailwind base/components/utilities`)
- Variáveis CSS customizadas (`:root`)
- Reset global (`*, html, body`)
- Scrollbar customizado (webkit)
- Animações keyframes:
  - `pulse-dot` → pisca o indicador "conectado"
  - `slide-up` → entrada suave de modais
  - `fade-in` → fade suave

---

### `frontend/src/components/providers/SupabaseProvider.js`
**O que faz:**
- Cria client Supabase no mount (não server-side)
- Escuta mudanças de auth (`onAuthStateChange`)
- Redireciona para `/login` se não autenticado
- Rotas públicas: `/login`, `/registro`
- Tela de loading enquanto verifica sessão
- Exporta context `useSupabase()` para componentes filhos

---

### `frontend/src/lib/api.js`
**Funções:**
- **`getToken()`** → busca JWT da sessão Supabase
- **`request(method, path, body, isFormData)`** → wrapper do fetch
  - Adiciona `Authorization: Bearer <token>`
  - Adiciona `Content-Type: application/json` se não for FormData
  - Parse de resposta JSON
  - Throw em caso de erro (status >= 400)

**Exports:**
- `whatsappApi` → status, connect, disconnect
- `contactsApi` → list, tags, import, delete, updateTags
- `campaignsApi` → list, calendar, get, create, start, pause, resume, delete, report
- `automationsApi` → list, get, create, update, delete
- `mediaApi` → list, upload, delete

**Usado por:** todas as páginas do dashboard

---

### `frontend/src/app/login/page.js`
**O que faz:**
- Form com email + senha
- Chama `supabase.auth.signInWithPassword`
- Em caso de sucesso → `router.push('/dashboard')`
- Exibe erro se credenciais inválidas
- Link para "Criar conta" (não implementado)

---

### `frontend/src/app/dashboard/layout.js`
**O que faz:**
- **Sidebar:**
  - Menu hierárquico (Principal, Dados, Conta)
  - Destaque de rota ativa
  - Botão "Sair" (logout)
  - Colapsável no mobile (overlay + hamburger)
- **Topbar:**
  - Hamburger (mobile)
  - Título dinâmico baseado na rota
  - Status WhatsApp (conectado/desconectado)
  - Botão "+ Campanha"
- **Responsividade:**
  - Desktop: sidebar fixa, topbar sticky
  - Mobile: sidebar off-canvas, fecha ao navegar

---

### `frontend/src/app/dashboard/page.js` (Home)
**Componentes:**
- **Stats grid (4 cards):**
  - Mensagens enviadas (animado)
  - Campanhas ativas
  - Contatos
  - Taxa de entrega
- **Campanhas ativas:**
  - Lista com progress bar
  - Botões: pause/resume, relatório
  - Status colorido (running=verde, scheduled=azul, paused=amarelo)
- **Log em tempo real:**
  - Simula recebimento de confirmações a cada 3s
  - Badges: enviado, entregue, lido, falhou
  - Scroll automático (mantém últimas 10)

---

### `frontend/src/app/dashboard/campanhas/nova/page.js`
**Seções do formulário:**

1. **Identificação**
   - Nome
   - Descrição (opcional)

2. **Conteúdo**
   - Texto (suporta `{nome}`, `{telefone}`)
   - Mídia (dropdown: none, image, video, document)
   - Upload de arquivo (se mídia != none)
   - Legenda (obrigatória para mídia)

3. **Comportamento Humano**
   - Delay mínimo/máximo (segundos)
   - Toggles:
     - Simular "digitando..."
     - Enviar em finais de semana
   - Horário comercial (início/fim)

4. **Agendamento**
   - Tipo: imediato, único, diário, semanal, personalizado
   - **Se único:** datetime-local picker
   - **Se semanal/personalizado:**
     - Checkboxes de dias da semana (Dom–Sáb)
     - Lista de horários (adicionar/remover)
     - Range de datas (início/fim)

**Validações:**
- Nome obrigatório
- Texto OU mídia
- Se mídia → legenda obrigatória
- Delay máx > delay mín

**Submit:**
- `POST /api/campaigns` com JSON completo
- Se recorrente → backend cria múltiplas campanhas

---

### `frontend/src/app/dashboard/agendamento/page.js`
**Componentes:**

1. **Calendário:**
   - Grid 7×N (dias da semana)
   - Navegação ◀ mês ▶
   - Dia selecionado destacado (azul)
   - Hoje destacado (verde)
   - Eventos coloridos dentro de cada dia (limitado a 3 visíveis)

2. **Detalhe do dia selecionado:**
   - Lista de campanhas daquele dia
   - Horário, status, progresso
   - Botões: iniciar, relatório

3. **Lista do mês (quando nenhum dia selecionado):**
   - Todas as campanhas do mês em ordem cronológica

**API:**
- `GET /api/campaigns/calendar?month=2&year=2025`
- Retorna: `{ 3: [camp1, camp2], 5: [camp3], ... }`

---

### `frontend/src/app/dashboard/contatos/page.js`
**Componentes:**

1. **Painel de importação (toggle):**
   - Drag & drop de arquivo
   - Input de tags padrão (CSV separadas por vírgula)
   - Feedback de sucesso/erro

2. **Filtros:**
   - Busca por nome
   - Dropdown de tags

3. **Tabela:**
   - Nome, telefone, tags
   - Paginação (50 por página)
   - Botão remover

**Fluxo de importação:**
1. User arrasta CSV/VCF
2. `onChange` → `contactsApi.import(file, tags)`
3. Backend parse + valida + insere
4. Retorna `{ imported, skipped, total }`
5. Recarrega lista

---

### `frontend/src/app/dashboard/automacoes/page.js`
**Componentes:**

1. **Lista de automações:**
   - Card por automação
   - Preview dos 4 primeiros nós
   - Toggle on/off
   - Botões: editar, remover

2. **Modal de criação/edição:**
   - Nome
   - Trigger (keyword ou always)
   - Keywords (se keyword)
   - **Flow builder:**
     - Lista de nós ordenados
     - Cada nó: dropdown tipo, textarea conteúdo
     - Se menu → lista de opções (key + label)
     - Botão "+ Adicionar nó"
     - Botão remover nó

**Fluxo:**
1. Usuário cria nós sequencialmente
2. Submit → `POST /api/automations`
3. Backend salva em `automations` + `automation_nodes`
4. Webhook recebe mensagem → `processBotMessage` executa

---

### `frontend/src/app/dashboard/whatsapp/page.js`
**Estados:**
- `disconnected` → botão "Conectar"
- `connecting` → exibe QR Code + countdown 60s
- `connected` → exibe perfil + telefone + botão "Desconectar"

**Fluxo:**
1. User clica "Conectar"
2. `GET /api/whatsapp/connect`
3. Backend cria instância + retorna QR
4. User escaneia
5. Evolution envia webhook → backend atualiza status
6. Frontend polling ou SSE (aqui: refetch a cada 10s)

---

## 🗄️ Banco de Dados — Schema Completo

### Tabelas Principais (10)

1. **`tenants`** → clientes da plataforma
   - Campos chave: `id`, `auth_user_id`, `plan`, `status`, `wa_instance_id`, `messages_sent_month`, `subscription_expires_at`
   - Limites: `messages_limit_month`, `contacts_limit`, `campaigns_limit`, `min_delay_seconds`

2. **`contacts`** → contatos de cada tenant
   - Unique constraint: `(tenant_id, phone)`
   - Campos: `name`, `phone`, `tags[]`, `variables (JSONB)`, `active`, `opted_out`

3. **`campaigns`** → campanhas de disparo
   - Status: draft, scheduled, running, paused, done, failed, cancelled
   - Recorrência: `recurrence_type`, `recurrence_days[]`, `recurrence_times[]`, `recurrence_end_date`
   - Progresso: `contacts_total`, `contacts_sent`, `contacts_failed`, `contacts_pending`

4. **`campaign_contacts`** → fila de envio
   - 1 linha por (campaign, contact)
   - Status: queued, sending, sent, delivered, read, failed
   - Campos: `wa_message_id`, `sent_at`, `delivered_at`, `failed_at`, `error_message`, `attempts`

5. **`message_logs`** → log de todas as mensagens
   - Histórico auditável
   - Campos: `tenant_id`, `campaign_id`, `contact_id`, `phone`, `status`, `wa_message_id`, `error_message`, `sent_at`

6. **`media_library`** → histórico de uploads
   - Campos: `tenant_id`, `name`, `type`, `url`, `mime_type`, `size_bytes`

7. **`automations`** → chatbots
   - Campos: `tenant_id`, `name`, `trigger_type`, `trigger_keywords[]`, `active`, `priority`

8. **`automation_nodes`** → nós do fluxo
   - Campos: `automation_id`, `order_index`, `type`, `content`, `media_url`, `options (JSONB)`, `wait_seconds`

9. **`bot_sessions`** → estado da conversa
   - 1 linha por (tenant, phone)
   - Campos: `automation_id`, `current_node_index`, `context (JSONB)`

10. **`subscriptions`** → histórico de pagamentos
    - Campos: `tenant_id`, `plan`, `amount_cents`, `status`, `gateway`, `gateway_id`, `paid_at`, `expires_at`

### Views

- **`admin_overview`** → join de tenants + counts de contatos/campanhas/automações

### Functions

- **`check_tenant_blocked(tenant_id)`** → retorna JSON `{blocked: bool, reason: text}`
- **`increment_messages_sent(tenant_id)`** → `messages_sent_month++`

### Triggers

- `update_updated_at()` → atualiza `updated_at` em UPDATE

### RLS (Row Level Security)

- Todas as tabelas habilitadas
- Política: `tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())`
- Isola dados entre tenants automaticamente

---

## 🐳 Docker — Detalhamento dos Serviços

### `docker-compose.yml` — 7 Serviços

1. **`evolution`** (atendai/evolution-api)
   - Porta: 8080
   - Multi-instância WhatsApp via Baileys
   - Postgres interno para persistência
   - Redis para cache
   - Webhooks apontam para `zf_backend:3001/webhook/evolution`

2. **`zf_postgres`** (postgres:15-alpine)
   - Banco interno da Evolution
   - NÃO é o banco principal (Supabase é o principal)

3. **`zf_redis`** (redis:7-alpine)
   - BullMQ (filas de campanha)
   - Cache da Evolution
   - Política: `allkeys-lru` (512MB máx)

4. **`zf_backend`** (build: ./backend)
   - Node 20 Alpine
   - Fastify na porta 3001
   - Conecta: Supabase (Postgres), Redis, Evolution
   - Volume: `/app/uploads` (temporário)

5. **`zf_frontend`** (build: ./frontend)
   - Next.js 14 standalone
   - Porta 3000
   - Conecta: Supabase (client-side), Backend (via Nginx)

6. **`zf_admin`** (build: ./admin)
   - HTML estático servido via Node
   - Porta 3002

7. **`zf_nginx`** (nginx:alpine)
   - Reverse proxy
   - Rotas:
     - `app.DOMAIN` → `zf_frontend:3000`
     - `api.DOMAIN` → `zf_backend:3001`
     - `admin.DOMAIN` → `zf_admin:3002`
   - SSL via Let's Encrypt (volumes `certbot_conf`, `certbot_www`)
   - Rate limiting:
     - `/api/*` → 30 req/min
     - `/webhook/*` → 120 req/min

### Volumes Persistentes

- `evolution_data` → instâncias WhatsApp
- `postgres_data` → DB da Evolution
- `redis_data` → RDB persistence
- `media_uploads` → uploads temporários (antes do Supabase)
- `certbot_conf` → certificados SSL
- `certbot_www` → ACME challenges

### Rede

- `zf_net` (bridge) → todos os serviços na mesma rede interna

---

## 🔧 Scripts de Operação

Criados por `setup.sh` em `/opt/zapflow/scripts/`:

1. **`start.sh`** → `docker compose up -d`
2. **`stop.sh`** → `docker compose down`
3. **`restart.sh [service]`** → reinicia 1 serviço ou todos
4. **`logs.sh [service]`** → `docker compose logs -f --tail=100`
5. **`health.sh`** → verifica status de todos os containers + API + Redis + Postgres
6. **`ssl.sh <domain> <email>`** → obtém certificado Let's Encrypt
7. **`block.sh <tenant_uuid> [reason]`** → `POST /admin/tenants/:id/block`
8. **`unblock.sh <tenant_uuid> [plan] [days]`** → `POST /admin/tenants/:id/unblock`
9. **`backup.sh`** → copia `.env` + dump do Postgres Evolution

---

## 🔄 Fluxo Completo de uma Campanha

```
1. USER: cria campanha no frontend
   ↓
2. POST /api/campaigns
   ↓
3. Backend:
   - Valida dados
   - Conta contatos alvo
   - Se recorrente → gera múltiplas datas
   - Insere N campanhas
   - Insere M linhas em campaign_contacts (fila)
   ↓
4. Se scheduled_at no futuro → aguarda scheduler
   Se imediato → enfileira agora
   ↓
5. Scheduler (worker a cada 60s):
   - Busca campanhas com scheduled_at <= NOW()
   - Enfileira em BullMQ
   ↓
6. CampaignWorker:
   - Puxa job da fila
   - Carrega campanha + tenant + contatos
   - Loop:
     - Verifica bloqueio/horário/limite
     - Simula "digitando..."
     - Envia via Evolution: POST /message/sendText
     - Delay humano (10–30s aleatório)
     - Atualiza progresso
   ↓
7. Evolution API:
   - Envia mensagem via WhatsApp Web
   - Recebe confirmação do servidor WhatsApp
   - Envia webhook: POST /webhook/evolution
   ↓
8. Backend (webhooks.js):
   - Atualiza campaign_contacts.status = 'delivered'
   - Atualiza message_logs
   ↓
9. Frontend:
   - Polling ou SSE (aqui: refetch a cada 10s)
   - Atualiza progress bar
   - Exibe log ao vivo
```

---

## 🤖 Fluxo Completo do Chatbot

```
1. USER envia mensagem: "oi"
   ↓
2. WhatsApp → Evolution API
   ↓
3. Evolution: POST /webhook/evolution
   Event: messages.upsert
   ↓
4. Backend (webhooks.js):
   - Ignora se fromMe ou grupo
   - Busca tenant pela instance
   - Chama processBotMessage(tenant, phone, text)
   ↓
5. processBotMessage:
   - Busca sessão em bot_sessions
   - Se sem sessão → tenta bater trigger
     - keyword: "oi" in trigger_keywords?
     - always: sempre ativa
   - Se bateu → carrega automação
   - Executa nós sequencialmente:
     a) type=message → envia texto
     b) type=menu → envia + salva sessão (aguarda resposta)
     c) type=wait → salva sessão (aguarda próxima msg)
   - Se terminou → limpa sessão
   ↓
6. Backend → Evolution: POST /message/sendText
   ↓
7. Evolution → WhatsApp → User recebe resposta
   ↓
8. User responde "1" (menu)
   ↓
9. Repete fluxo (passo 2), mas agora:
   - Tem sessão ativa → continua do nó atual
   - Se menu → busca option.key === "1" → vai pro next_node_order
   - Executa próximos nós até wait ou fim
```

---

## 📊 Monitoramento e Observabilidade

### Health Checks

- **API:** `GET /health` → `{status, version, ts, workers}`
- **Redis:** `docker exec zf_redis redis-cli ping`
- **Postgres:** `docker exec zf_postgres pg_isready`
- **Evolution:** `curl http://localhost:8080/instance/fetchInstances`

### Logs

- **Agregados:** `docker compose logs -f`
- **Por serviço:** `docker compose logs -f zf_backend`
- **Níveis:**
  - Prod: `warn` e `error`
  - Dev: `info`, `warn`, `error`

### Métricas

- **Docker stats:** CPU, RAM, rede por container
- **BullMQ:** jobs ativos, completos, falhos (via Redis)
- **Supabase Dashboard:** queries/s, storage usado

### Alertas (manual)

- UptimeRobot monitora `/health` a cada 5 min
- Webhook do Supabase para events críticos (opcional)
- Cron registra falhas em `/opt/zapflow/logs/health.log`

---

## 🔐 Segurança — Checklist Implementado

### Autenticação & Autorização
- ✅ JWT via Supabase (auto-renovação)
- ✅ Row Level Security (RLS) — isolamento por tenant
- ✅ Service key separada (nunca exposta no frontend)
- ✅ Admin key separada (header `x-admin-key`)

### Rede
- ✅ Firewall UFW (apenas 22, 80, 443)
- ✅ Rate limiting por zona (Nginx)
- ✅ CORS configurado (origins específicas)
- ✅ Headers de segurança (X-Frame-Options, CSP, X-Content-Type-Options)

### Containers
- ✅ Usuário não-root (uid 1001)
- ✅ Read-only filesystems onde possível
- ✅ Secrets via env vars (não hardcoded)

### Dados
- ✅ Senhas hashadas (Supabase Auth)
- ✅ Conexões via SSL (Supabase, Evolution)
- ✅ Backup diário automatizado (cron)

### Código
- ✅ Input validation (Fastify schemas pendentes)
- ✅ SQL injection prevenido (Supabase client parametrizado)
- ✅ Path traversal prevenido (validação de uploads)

---

## 📈 Escalabilidade — Próximos Passos

### Quando crescer para 100+ clientes:

1. **Separar Redis**
   - Migrar para Redis gerenciado (AWS ElastiCache, DO Managed Redis)
   - Benefit: mais RAM, backups automáticos

2. **CDN para mídia**
   - Cloudflare na frente do Supabase Storage
   - Benefit: latência menor, menos custos de egress

3. **Load balancer**
   - Rodar 2–3 instâncias do backend
   - Nginx com `upstream` round-robin
   - Benefit: alta disponibilidade, mais throughput

4. **Worker dedicado**
   - Separar `campaignWorker` em container próprio
   - Escalar horizontalmente (2–5 workers)
   - Benefit: mais campanhas simultâneas

5. **Postgres replica**
   - Supabase: adicionar read replicas
   - Backend: usar replica para reads
   - Benefit: menos carga no master

---

## 🎓 Convenções do Código

### Backend (Node.js)
- **ESM modules:** `import/export` (não CommonJS)
- **Async/await:** nunca `.then()` chains
- **Error handling:** try/catch em routes, throw em helpers
- **Naming:**
  - Routes: verbos HTTP explícitos (`app.get`, `app.post`)
  - Functions: camelCase (`getToken`, `sendMessage`)
  - Constants: UPPER_SNAKE_CASE (`ALLOWED_TYPES`)
- **Comments:** JSDoc-style quando função tem >3 params

### Frontend (React/Next.js)
- **'use client'** em TODOS componentes com hooks
- **State:** `useState` para local, Context para global
- **Naming:**
  - Components: PascalCase (`LoginPage`)
  - Handlers: `handleX` (`handleLogin`)
  - API calls: `loadX` (`loadCampaigns`)
- **Styling:** Tailwind inline (sem CSS modules)
- **Responsividade:** mobile-first (`sm:`, `md:`, `lg:`)

### SQL
- **Naming:**
  - Tables: plural snake_case (`campaign_contacts`)
  - Columns: snake_case (`wa_message_id`)
  - Enums: singular (`tenant_status`)
- **Indexes:** sempre em FKs e colunas de filtro
- **RLS:** sempre habilitado em tabelas de tenant

---

## 📚 Dependências Principais

### Backend
- **fastify** (^4.28) → framework HTTP
- **@fastify/cors** → CORS
- **@fastify/multipart** → upload de arquivos
- **@supabase/supabase-js** (^2.45) → client Supabase
- **bullmq** (^5.x) → filas
- **ioredis** (^5.x) → client Redis
- **axios** (^1.7) → HTTP client (Evolution API)
- **csv-parse** (^5.x) → parse CSV
- **vcf** (^2.x) → parse VCF
- **uuid** (^10.x) → geração de UUIDs

### Frontend
- **next** (14.2.5) → framework React SSR
- **react** (^18.3) → biblioteca UI
- **@supabase/supabase-js** (^2.45) → auth
- **tailwindcss** (^3.4) → styling

### Infra
- **node:20-alpine** → runtime otimizado
- **nginx:alpine** → proxy leve
- **postgres:15-alpine** → DB Evolution
- **redis:7-alpine** → cache + filas
- **atendai/evolution-api** → WhatsApp

---

Este documento cobre 100% da estrutura do projeto. Para detalhes de implementação específicos, consulte os arquivos de código diretamente.
