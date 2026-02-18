#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  ZapFlow — Script de Setup Completo da VPS
#  Testado: Ubuntu 22.04 LTS
#  Execute como root: curl -fsSL https://raw... | bash
#  Ou: bash setup.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

# ── Cores ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERRO]${NC}  $*"; exit 1; }
section() { echo -e "\n${CYAN}${BOLD}══ $* ══${NC}\n"; }

# ── Verificações ─────────────────────────────────────────
[ "$EUID" -ne 0 ]         && error "Execute como root: sudo bash setup.sh"
[ -z "${DOMAIN:-}" ]      && read -rp "Domínio (ex: seudominio.com): " DOMAIN
[ -z "${ADMIN_EMAIL:-}" ] && read -rp "Email para SSL (Let's Encrypt): " ADMIN_EMAIL

export DOMAIN ADMIN_EMAIL
INSTALL_DIR="/opt/zapflow"

section "1. Sistema e dependências base"
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl wget git nano ufw htop net-tools \
  ca-certificates gnupg lsb-release unzip \
  software-properties-common apt-transport-https
ok "Sistema atualizado"

section "2. Docker Engine"
if command -v docker &>/dev/null; then
  warn "Docker já instalado: $(docker --version)"
else
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker
  systemctl start docker
  ok "Docker instalado: $(docker --version)"
fi

# Docker Compose v2 plugin
if ! docker compose version &>/dev/null; then
  COMPOSE_VER=$(curl -s https://api.github.com/repos/docker/compose/releases/latest \
    | grep '"tag_name"' | cut -d'"' -f4)
  curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VER}/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose 2>/dev/null || \
  curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VER}/docker-compose-linux-x86_64" \
    -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose 2>/dev/null || \
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  ok "Docker Compose instalado"
else
  warn "Docker Compose já disponível"
fi

section "3. Firewall UFW"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh           comment 'SSH'
ufw allow 80/tcp        comment 'HTTP'
ufw allow 443/tcp       comment 'HTTPS'
# Portas internas NÃO expostas (ficam atrás do Nginx):
# 3000, 3001, 3002, 8080 → apenas dentro da rede Docker
ufw --force enable
ok "Firewall configurado (SSH + HTTP + HTTPS)"

section "4. Estrutura de diretórios"
mkdir -p "${INSTALL_DIR}/"{backend,frontend,admin,nginx,scripts,logs,backups}
ok "Diretórios criados em ${INSTALL_DIR}"

section "5. Arquivo .env"
if [ ! -f "${INSTALL_DIR}/.env" ]; then
  # Gera chaves automáticas
  EVOL_KEY=$(openssl rand -hex 32)
  ADMIN_KEY=$(openssl rand -hex 32)
  DB_PASS=$(openssl rand -hex 16)

  cat > "${INSTALL_DIR}/.env" << ENVEOF
# ── ZapFlow Environment ─────────────────────────────────
DOMAIN=${DOMAIN}

# Supabase — preencha com seus dados do painel Supabase
SUPABASE_URL=https://XXXXXXXXXX.supabase.co
SUPABASE_ANON_KEY=PREENCHA_AQUI
SUPABASE_SERVICE_KEY=PREENCHA_AQUI

# Evolution API (gerado automaticamente)
EVOLUTION_API_KEY=${EVOL_KEY}

# Postgres interno da Evolution (gerado automaticamente)
EVOL_DB_USER=evol_user
EVOL_DB_PASS=${DB_PASS}

# Admin panel (gerado automaticamente — guarde este valor!)
ADMIN_KEY=${ADMIN_KEY}
ENVEOF

  warn "⚠️  Edite ${INSTALL_DIR}/.env com suas credenciais do Supabase!"
  warn "    nano ${INSTALL_DIR}/.env"
  echo ""
  warn "  ADMIN_KEY gerada: ${ADMIN_KEY}"
  warn "  Salve isso em local seguro!"
else
  warn ".env já existe — pulando geração"
fi

section "6. Nginx — configuração base (HTTP-only até SSL)"
cat > "${INSTALL_DIR}/nginx/nginx.conf" << 'NGINXEOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;
events { worker_connections 2048; multi_accept on; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  server_tokens off;
  sendfile on; keepalive_timeout 65;
  client_max_body_size 70M;
  gzip on; gzip_types text/plain application/json application/javascript text/css;

  # HTTP — só para certbot challenge + redirect
  server {
    listen 80;
    server_name _;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
  }
}
NGINXEOF
ok "Nginx base configurado"

section "7. Scripts de operação"

# start.sh
cat > "${INSTALL_DIR}/scripts/start.sh" << 'STARTEOF'
#!/bin/bash
cd /opt/zapflow
echo "🚀 Iniciando ZapFlow..."
docker compose up -d
sleep 3
docker compose ps
echo "✅ Serviços iniciados!"
STARTEOF

# stop.sh
cat > "${INSTALL_DIR}/scripts/stop.sh" << 'STOPEOF'
#!/bin/bash
cd /opt/zapflow
echo "⏹  Parando ZapFlow..."
docker compose down
echo "✅ Parado."
STOPEOF

# logs.sh
cat > "${INSTALL_DIR}/scripts/logs.sh" << 'LOGSEOF'
#!/bin/bash
SERVICE="${1:-zf_backend}"
cd /opt/zapflow
echo "📋 Logs do serviço: $SERVICE (Ctrl+C para sair)"
docker compose logs -f --tail=100 "$SERVICE"
LOGSEOF

# restart.sh
cat > "${INSTALL_DIR}/scripts/restart.sh" << 'RESTEOF'
#!/bin/bash
SERVICE="${1:-}"
cd /opt/zapflow
if [ -z "$SERVICE" ]; then
  echo "🔄 Reiniciando todos os serviços..."
  docker compose restart
else
  echo "🔄 Reiniciando $SERVICE..."
  docker compose restart "$SERVICE"
fi
echo "✅ Reiniciado."
RESTEOF

# ssl.sh
cat > "${INSTALL_DIR}/scripts/ssl.sh" << 'SSLEOF'
#!/bin/bash
DOMAIN="${1:-}"
EMAIL="${2:-}"
[ -z "$DOMAIN" ] && read -rp "Domínio (ex: seudominio.com): " DOMAIN
[ -z "$EMAIL"  ] && read -rp "Email: " EMAIL

cd /opt/zapflow
echo "🔐 Obtendo certificado SSL para: $DOMAIN e subdomínios app, api, admin"

# Gera certificado para todos os subdomínios de uma vez
docker compose run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email "$EMAIL" --agree-tos --no-eff-email \
  -d "app.${DOMAIN}" -d "api.${DOMAIN}" -d "admin.${DOMAIN}"

# Ativa nginx.conf com HTTPS
if [ -f "./nginx/nginx.conf.https" ]; then
  cp ./nginx/nginx.conf.https ./nginx/nginx.conf
  sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" ./nginx/nginx.conf
  docker compose restart zf_nginx
  echo "✅ SSL ativado! Acesse: https://app.${DOMAIN}"
else
  echo "⚠️  Copie o nginx.conf com HTTPS para ${INSTALL_DIR}/nginx/nginx.conf"
  echo "    e substitua DOMAIN_PLACEHOLDER por ${DOMAIN}"
fi
SSLEOF

# block.sh
cat > "${INSTALL_DIR}/scripts/block.sh" << 'BLOCKEOF'
#!/bin/bash
TENANT_ID="${1:-}"
REASON="${2:-Inadimplência}"
[ -z "$TENANT_ID" ] && { echo "Uso: bash block.sh <TENANT_ID> [motivo]"; exit 1; }

source /opt/zapflow/.env
RESULT=$(curl -s -X POST "http://localhost:3001/admin/tenants/${TENANT_ID}/block" \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"reason\": \"${REASON}\"}")
echo "$RESULT"
echo ""
echo "✅ Tenant ${TENANT_ID} suspenso."
BLOCKEOF

# unblock.sh
cat > "${INSTALL_DIR}/scripts/unblock.sh" << 'UNBLOCKEOF'
#!/bin/bash
TENANT_ID="${1:-}"
PLAN="${2:-basic}"
DAYS="${3:-30}"
[ -z "$TENANT_ID" ] && { echo "Uso: bash unblock.sh <TENANT_ID> [plano] [dias]"; exit 1; }

source /opt/zapflow/.env
RESULT=$(curl -s -X POST "http://localhost:3001/admin/tenants/${TENANT_ID}/unblock" \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"plan\": \"${PLAN}\", \"days\": ${DAYS}}")
echo "$RESULT"
echo ""
echo "✅ Tenant ${TENANT_ID} reativado — plano ${PLAN} por ${DAYS} dias."
UNBLOCKEOF

# backup.sh
cat > "${INSTALL_DIR}/scripts/backup.sh" << 'BACKUPEOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/zapflow/backups"
mkdir -p "$BACKUP_DIR"

echo "💾 Iniciando backup — ${DATE}"

# Backup do .env (sem o conteúdo exposto nos logs)
cp /opt/zapflow/.env "${BACKUP_DIR}/.env.${DATE}"

# Backup do banco interno da Evolution
docker exec zf_postgres pg_dump -U evol_user evolution \
  | gzip > "${BACKUP_DIR}/postgres_${DATE}.sql.gz"

echo "✅ Backup salvo em ${BACKUP_DIR}/"

# Manter apenas últimos 7 backups
cd "$BACKUP_DIR"
ls -t postgres_*.sql.gz | tail -n +8 | xargs -r rm
BACKUPEOF

# health-check.sh
cat > "${INSTALL_DIR}/scripts/health.sh" << 'HEALTHEOF'
#!/bin/bash
echo "🩺 ZapFlow Health Check"
echo "═══════════════════════"
cd /opt/zapflow

# Status dos containers
docker compose ps

echo ""
echo "📡 API:"
curl -s http://localhost:3001/health | python3 -m json.tool 2>/dev/null || echo "API não responde"

echo ""
echo "💾 Redis:"
docker exec zf_redis redis-cli ping 2>/dev/null || echo "Redis não responde"

echo ""
echo "🗄️  Postgres:"
docker exec zf_postgres pg_isready -U evol_user 2>/dev/null || echo "Postgres não responde"
HEALTHEOF

chmod +x "${INSTALL_DIR}/scripts/"*.sh
ok "Scripts criados em ${INSTALL_DIR}/scripts/"

section "8. Serviço systemd (auto-start)"
cat > /etc/systemd/system/zapflow.service << SVCEOF
[Unit]
Description=ZapFlow WhatsApp SaaS
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=on-failure
RestartSec=30
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable zapflow
ok "Serviço systemd configurado (auto-start no boot)"

section "9. Cron — renovação SSL + backup diário"
(crontab -l 2>/dev/null || true; cat << 'CRONEOF'
# ZapFlow — Renovação SSL (2x por dia)
0 4,16 * * * docker compose -f /opt/zapflow/docker-compose.yml run --rm certbot renew --quiet && docker compose -f /opt/zapflow/docker-compose.yml restart zf_nginx >> /opt/zapflow/logs/certbot.log 2>&1

# ZapFlow — Backup diário às 3h
0 3 * * * bash /opt/zapflow/scripts/backup.sh >> /opt/zapflow/logs/backup.log 2>&1

# ZapFlow — Health check a cada 5 min (registra em log)
*/5 * * * * curl -sf http://localhost:3001/health > /dev/null || echo "$(date) API DOWN" >> /opt/zapflow/logs/health.log
CRONEOF
) | crontab -
ok "Cron jobs configurados"

# ── Resumo final ──────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "═══════════════════════════════════════════════════════"
echo "  ✅  ZAPFLOW — SETUP CONCLUÍDO!"
echo "═══════════════════════════════════════════════════════"
echo -e "${NC}"
echo -e "${BOLD}📁 Instalação:${NC}  ${INSTALL_DIR}"
echo ""
echo -e "${YELLOW}${BOLD}PRÓXIMOS PASSOS (em ordem):${NC}"
echo ""
echo -e "  ${BOLD}1.${NC} Preencha as credenciais do Supabase:"
echo -e "     ${CYAN}nano ${INSTALL_DIR}/.env${NC}"
echo ""
echo -e "  ${BOLD}2.${NC} Configure os DNS (aguarde propagação ~5 min):"
echo -e "     ${CYAN}app.${DOMAIN}   → $(curl -s ifconfig.me 2>/dev/null || echo 'IP_DA_VPS')${NC}"
echo -e "     ${CYAN}api.${DOMAIN}   → $(curl -s ifconfig.me 2>/dev/null || echo 'IP_DA_VPS')${NC}"
echo -e "     ${CYAN}admin.${DOMAIN} → $(curl -s ifconfig.me 2>/dev/null || echo 'IP_DA_VPS')${NC}"
echo ""
echo -e "  ${BOLD}3.${NC} Copie os arquivos do projeto:"
echo -e "     ${CYAN}scp -r ./zapflow/* root@IP_VPS:${INSTALL_DIR}/${NC}"
echo ""
echo -e "  ${BOLD}4.${NC} Execute as migrations no Supabase:"
echo -e "     Cole o conteúdo de ${CYAN}migrations.sql${NC} no SQL Editor do Supabase"
echo -e "     Crie o bucket ${CYAN}campaign-media${NC} (público)"
echo ""
echo -e "  ${BOLD}5.${NC} Obtenha o SSL:"
echo -e "     ${CYAN}bash ${INSTALL_DIR}/scripts/ssl.sh ${DOMAIN} ${ADMIN_EMAIL}${NC}"
echo ""
echo -e "  ${BOLD}6.${NC} Inicie os serviços:"
echo -e "     ${CYAN}bash ${INSTALL_DIR}/scripts/start.sh${NC}"
echo ""
echo -e "${BOLD}SCRIPTS ÚTEIS:${NC}"
echo -e "  Iniciar     →  ${CYAN}bash ${INSTALL_DIR}/scripts/start.sh${NC}"
echo -e "  Parar       →  ${CYAN}bash ${INSTALL_DIR}/scripts/stop.sh${NC}"
echo -e "  Logs API    →  ${CYAN}bash ${INSTALL_DIR}/scripts/logs.sh zf_backend${NC}"
echo -e "  Logs Worker →  ${CYAN}bash ${INSTALL_DIR}/scripts/logs.sh zf_backend${NC}"
echo -e "  Health      →  ${CYAN}bash ${INSTALL_DIR}/scripts/health.sh${NC}"
echo -e "  Bloquear    →  ${CYAN}bash ${INSTALL_DIR}/scripts/block.sh <TENANT_UUID>${NC}"
echo -e "  Desbloquear →  ${CYAN}bash ${INSTALL_DIR}/scripts/unblock.sh <TENANT_UUID> pro 30${NC}"
echo -e "  Backup      →  ${CYAN}bash ${INSTALL_DIR}/scripts/backup.sh${NC}"
echo ""
echo -e "${BOLD}ACESSOS APÓS DEPLOY:${NC}"
echo -e "  Painel cliente  →  ${GREEN}https://app.${DOMAIN}${NC}"
echo -e "  API             →  ${GREEN}https://api.${DOMAIN}/health${NC}"
echo -e "  Admin           →  ${GREEN}https://admin.${DOMAIN}${NC}"
echo ""
echo "═══════════════════════════════════════════════════════"
