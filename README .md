# ⚡ ZapFlow — WhatsApp SaaS Multi-Tenant

Plataforma completa de automação WhatsApp com campanhas, agendamento avançado, chatbot e gestão multi-tenant.

## 🎯 Características

### Para Clientes
- ✅ Conexão WhatsApp via QR Code (Evolution API + Baileys)
- 📱 Importação CSV/VCF com normalização BR + Uruguai
- 📣 Campanhas com delay humano aleatório (10–30s) + simula "digitando..."
- 📅 Agendamento: único, diário, semanal, múltiplos horários/dia
- 🤖 Chatbot: menu numerado, palavras-chave, fluxos multi-passo, mídia automática
- 📊 Relatórios em tempo real com confirmação de entrega
- 🖼️ Upload de mídia com legenda (imagem, vídeo, PDF)

### Para Você (Admin)
- 💳 Bloqueio automático por inadimplência
- 🔒 Suspensão pausa campanhas + desconecta WhatsApp
- 👥 Painel admin: listar, buscar, filtrar, suspender, reativar clientes
- 📈 Métricas da plataforma (total clientes, msgs/mês, uso)
- 🎛️ Limites por plano (msgs/mês, contatos, campanhas, delay mínimo)

## 🏗️ Stack Técnica

### Backend
- **Node.js 20** + Fastify + BullMQ
- **Evolution API** (multi-instância WhatsApp via Baileys)
- **Supabase** (Postgres + Auth + Storage + RLS)
- **Redis** (filas + cache)

### Frontend
- **Next.js 14** (App Router + React Server Components)
- **Tailwind CSS** (totalmente responsivo mobile/tablet/desktop)
- **Supabase Auth** (JWT + Row Level Security)

### Infra
- **Docker Compose** (7 serviços orquestrados)
- **Nginx** (reverse proxy + SSL + rate limiting)
- **Ubuntu 22.04 LTS** (VPS)
- **Let's Encrypt** (SSL automático com renovação via cron)

## 📂 Estrutura do Projeto

```
zapflow/
├── backend/              Node.js + Fastify
│   ├── src/
│   │   ├── server.js     ← entrada
│   │   ├── lib/          clients, phoneFilter
│   │   ├── middleware/   auth (JWT + tenant isolation)
│   │   ├── routes/       whatsapp, campaigns, contacts,
│   │   │                 automations, media, webhooks, admin
│   │   └── workers/      campaignWorker (dispatcher + scheduler)
│   └── Dockerfile
├── frontend/             Next.js 14 + Tailwind
│   ├── src/app/
│   │   ├── login/
│   │   └── dashboard/    painel completo responsivo
│   └── Dockerfile
├── admin/                Painel admin HTML puro
├── nginx/                Reverse proxy + SSL
├── migrations.sql        Schema completo Supabase
├── docker-compose.yml    Orquestração completa
├── setup.sh              Instalação automatizada VPS
└── DEPLOY_GUIDE.md       Guia passo a passo completo
```

## 🚀 Quick Start (desenvolvimento local)

### 1. Pré-requisitos
- Node.js 20+
- Docker + Docker Compose
- Conta Supabase (gratuita)

### 2. Supabase

1. Crie projeto em https://supabase.com
2. Execute `migrations.sql` no SQL Editor
3. Crie bucket `campaign-media` (público) no Storage
4. Copie credenciais (Settings → API)

### 3. Configurar `.env`

```bash
cp .env.example .env
nano .env
```

Preencha:
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
EVOLUTION_API_KEY=sua_chave_aqui
ADMIN_KEY=sua_chave_admin_aqui
```

### 4. Iniciar

```bash
docker-compose up -d
```

Acesse:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001/health
- Evolution: http://localhost:8080

## 📦 Deploy em Produção

Siga o **[DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)** — guia completo com:
- Setup VPS automatizado
- Configuração DNS
- SSL automático
- Scripts de operação (start, stop, logs, backup, block, unblock)
- Troubleshooting
- Monitoramento

**Resumo ultra-rápido:**

```bash
# 1. Na VPS
curl -fsSL https://url.do/setup.sh | bash

# 2. Preencher .env
nano /opt/zapflow/.env

# 3. Enviar código
scp -r ./zapflow root@IP:/opt/zapflow/

# 4. Obter SSL
bash /opt/zapflow/scripts/ssl.sh seudominio.com seu@email.com

# 5. Iniciar
bash /opt/zapflow/scripts/start.sh
```

## 🔒 Segurança

### Implementado
- ✅ JWT com Row Level Security (RLS) — cada tenant acessa apenas seus dados
- ✅ Service key separada da anon key (nunca exposta no frontend)
- ✅ Rate limiting por zona (30 req/min API, 120 req/min webhook)
- ✅ CORS configurado
- ✅ Headers de segurança (X-Frame-Options, CSP, etc)
- ✅ Firewall UFW (apenas 22, 80, 443 abertos)
- ✅ Containers rodando como usuário não-root
- ✅ Secrets via variáveis de ambiente (nunca no código)

### Recomendações adicionais
- 🔐 SSH com chave (desabilitar senha)
- 🌐 Cloudflare na frente (DDoS protection)
- 📧 2FA no Supabase
- 🔄 Backups diários automatizados (já configurado via cron)

## 🎛️ Planos e Limites

Configurados no `migrations.sql`:

| Plano      | Msgs/mês | Contatos | Campanhas | Delay mín |
|------------|----------|----------|-----------|-----------|
| Trial      | 500      | 200      | 2         | 15s       |
| Basic      | 1.000    | 500      | 3         | 12s       |
| Pro        | 10.000   | 10.000   | 10        | 8s        |
| Enterprise | Ilimitado| Ilimitado| 50        | 5s        |

Edite em: `backend/src/routes/admin.js` → função `unblock`

## 🤖 Comportamento Anti-Ban

Implementado no `campaignWorker.js`:

- ⏱️ Delay aleatório 10–30s com ruído gaussiano ±500ms
- ⌨️ Simula "digitando..." antes de enviar (1–7s baseado no tamanho da msg)
- 🕐 Respeita horário comercial (8h–20h configurável)
- 📅 Não envia em finais de semana (configurável)
- ⏸️ Pausa automaticamente fora do horário e retoma no dia seguinte
- 🔍 Verifica bloqueio de tenant a cada 50 mensagens
- ⚠️ Limite diário recomendado: 500–1000 msgs/número

## 📊 Monitoramento

### Health check

```bash
curl http://localhost:3001/health
```

Retorna:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "ts": "2025-02-17T...",
  "workers": {
    "campaign": "running",
    "scheduler": "running"
  }
}
```

### Logs em tempo real

```bash
bash scripts/logs.sh zf_backend
bash scripts/logs.sh zf_evolution
```

### Métricas de recursos

```bash
docker stats
```

### Alertas automáticos

Configurado via cron — registra em `/opt/zapflow/logs/health.log` se API cair.

Para alertas externos, use UptimeRobot (gratuito) monitorando:
- `https://api.seudominio.com/health`

## 🔧 Operações

### Bloquear cliente

```bash
bash scripts/block.sh <TENANT_UUID> "Inadimplência"
```

Efeito:
- Status → `suspended`
- Campanhas ativas → `paused`
- WhatsApp → desconecta

### Reativar cliente

```bash
bash scripts/unblock.sh <TENANT_UUID> pro 30
```

Efeito:
- Status → `active`
- Plano → `pro`
- Validade → +30 dias
- Contador de mensagens → zerado

### Backup manual

```bash
bash scripts/backup.sh
```

Salva em `/opt/zapflow/backups/` (mantém últimos 7).

Backup automático via cron: todo dia às 3h.

## 🐛 Problemas Comuns

### WhatsApp desconecta sozinho

**Causa:** WhatsApp Web tem limite de sessões simultâneas ou detectou comportamento suspeito.

**Solução:**
- Use número dedicado (não o pessoal)
- Respeite limites (500–1000 msgs/dia)
- Reconecte pelo painel

### Mensagens não enviam

**Verifique:**
1. WhatsApp está conectado?
2. Tenant está ativo (não suspenso)?
3. Worker está rodando? → `bash scripts/health.sh`
4. Há contatos na fila? → verifique no banco

### SSL expirou

Renovação automática, mas se falhar:

```bash
docker compose run --rm certbot renew
docker compose restart zf_nginx
```

### 502 Bad Gateway

Backend travado. Reinicie:

```bash
bash scripts/restart.sh zf_backend
bash scripts/logs.sh zf_backend  # veja o erro
```

## 📈 Roadmap

- [ ] Integração com Stripe/Mercado Pago
- [ ] Webhook de pagamento → ativa/bloqueia automaticamente
- [ ] Relatórios avançados (gráficos, CSV export)
- [ ] Templates de mensagem
- [ ] Variáveis customizadas por contato
- [ ] A/B testing de campanhas
- [ ] API pública para integrações
- [ ] App mobile (React Native)

## 📄 Licença

Proprietário — todos os direitos reservados.

## 🤝 Suporte

Para dúvidas sobre deploy, abra uma issue ou entre em contato.

---

**Construído com Node.js, Next.js, Supabase e muito ☕**
