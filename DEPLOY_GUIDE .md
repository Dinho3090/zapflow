# 🚀 ZapFlow — Guia de Deploy Completo

## 📋 Pré-requisitos

### Você vai precisar de:

1. **VPS Ubuntu 22.04 LTS**
   - RAM: mínimo 4GB (recomendado 8GB para 50+ clientes)
   - Disco: 40GB SSD
   - Provedores testados: DigitalOcean, Vultr, Hetzner, AWS Lightsail

2. **Domínio próprio**
   - Registrado em qualquer registrar (GoDaddy, Namecheap, Registro.br, etc)
   - Acesso ao painel DNS

3. **Conta Supabase** (gratuita)
   - Criar em: https://supabase.com
   - Projeto novo

---

## 🎯 Ordem de Execução (importante seguir!)

### **FASE 1: Supabase** (15 min)
### **FASE 2: DNS** (5 min + aguardar propagação)
### **FASE 3: VPS** (30 min)
### **FASE 4: SSL** (5 min)
### **FASE 5: Testes** (10 min)

---

## 📦 FASE 1: Configurar Supabase

### 1.1 Criar projeto

1. Acesse https://supabase.com/dashboard
2. Clique em **"New project"**
3. Preencha:
   - **Name**: `zapflow-prod`
   - **Database Password**: gere uma senha forte (salve!)
   - **Region**: escolha o mais próximo dos seus clientes (Brazil = São Paulo)
4. Aguarde ~2 min para provisionar

### 1.2 Executar migrations

1. No painel do Supabase, vá em **SQL Editor** (ícone `</>`  na sidebar)
2. Clique em **"+ New query"**
3. Copie **TODO** o conteúdo do arquivo `migrations.sql`
4. Cole no editor
5. Clique em **"Run"** (canto inferior direito)
6. Aguarde ~10s — deve aparecer "Success. No rows returned"

✅ Se apareceu erro, copie a mensagem e me envie. Não prossiga!

### 1.3 Criar bucket de mídia

1. No painel do Supabase, vá em **Storage** (ícone 🗃️ na sidebar)
2. Clique em **"New bucket"**
3. Preencha:
   - **Name**: `campaign-media`
   - **Public bucket**: ✅ **ATIVE** (importante!)
4. Clique em **"Create bucket"**

### 1.4 Copiar credenciais

1. No painel do Supabase, vá em **Settings** → **API** (ícone ⚙️ → API)
2. Copie e salve em um bloco de notas:

```
URL: https://xxxxx.supabase.co
anon key: eyJhbG...
service_role key: eyJhbG...   ← esse é SECRETO!
```

⚠️ **NUNCA** exponha a `service_role key` publicamente!

---

## 🌐 FASE 2: Configurar DNS

### 2.1 Apontar subdomínios

No painel DNS do seu provedor de domínio, crie **3 registros A**:

```
Tipo  Nome     Valor           TTL
────────────────────────────────────
A     app      IP_DA_VPS       300
A     api      IP_DA_VPS       300
A     admin    IP_DA_VPS       300
```

**Exemplo real** (domínio: `meusite.com`, IP da VPS: `203.0.113.50`):

```
A     app      203.0.113.50    300
A     api      203.0.113.50    300
A     admin    203.0.113.50    300
```

### 2.2 Aguardar propagação

Execute no terminal (seu PC):

```bash
# Linux/Mac
nslookup app.seudominio.com

# Windows
nslookup app.seudominio.com
```

Deve retornar o IP da VPS. Se não retornar:
- Aguarde 5-10 minutos
- Teste novamente
- Se após 30 min não funcionar, verifique se salvou as configurações DNS

⏱️ **Aguarde a propagação antes de prosseguir!**

---

## 🖥️ FASE 3: Deploy na VPS

### 3.1 Conectar via SSH

```bash
ssh root@IP_DA_VPS
```

Se pedir senha, digite a senha root fornecida pela hospedagem.

### 3.2 Executar script de setup

Cole e execute:

```bash
curl -fsSL https://raw.githubusercontent.com/SEU_USUARIO/zapflow/main/setup.sh -o setup.sh
bash setup.sh
```

**OU** se você ainda não subiu pro GitHub, faça manualmente:

```bash
# Copie o arquivo setup.sh para a VPS
scp setup.sh root@IP_DA_VPS:/root/

# Execute
ssh root@IP_DA_VPS
bash setup.sh
```

O script vai perguntar:
```
Domínio (ex: seudominio.com): █
```
Digite **SEM** `app.` ou `www.` — só `seudominio.com`

```
Email para SSL (Let's Encrypt): █
```
Digite seu email real.

⏱️ Script leva ~5 minutos. Vai instalar Docker, configurar firewall, criar pastas, etc.

### 3.3 Preencher `.env`

Após o script terminar:

```bash
nano /opt/zapflow/.env
```

**Preencha** as 3 linhas do Supabase que você copiou na Fase 1.4:

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_KEY=eyJhbG...   ← cole aqui
```

Salve: `Ctrl+O` → `Enter` → `Ctrl+X`

**IMPORTANTE:** Anote a `ADMIN_KEY` que apareceu no final do script! Você vai precisar.

### 3.4 Enviar código do projeto

**Na sua máquina local** (não na VPS):

```bash
# Compacte o projeto
cd /caminho/onde/estão/os/arquivos
tar -czf zapflow.tar.gz backend/ frontend/ admin/ nginx/ docker-compose.yml

# Envie para a VPS
scp zapflow.tar.gz root@IP_DA_VPS:/opt/zapflow/

# Descompacte na VPS
ssh root@IP_DA_VPS
cd /opt/zapflow
tar -xzf zapflow.tar.gz
rm zapflow.tar.gz
```

---

## 🔐 FASE 4: Obter SSL

Na VPS, execute:

```bash
cd /opt/zapflow
bash scripts/ssl.sh seudominio.com seu@email.com
```

Substitua `seudominio.com` e `seu@email.com` pelos seus dados reais.

O script vai:
1. Obter certificado SSL para `app.`, `api.` e `admin.seudominio.com`
2. Configurar o Nginx com HTTPS
3. Reiniciar os serviços

⏱️ Leva ~30 segundos.

Se der erro:
- Verifique se o DNS está propagado (teste com `nslookup`)
- Verifique se a porta 80 está aberta: `ufw status`

---

## 🎬 FASE 5: Iniciar Serviços

```bash
cd /opt/zapflow
bash scripts/start.sh
```

Aguarde ~1 minuto para todos os containers subirem.

Verifique status:

```bash
bash scripts/health.sh
```

Deve mostrar todos os serviços como `Up` e `healthy`.

---

## ✅ Checklist de Validação

### 1. Backend funcionando

```bash
curl http://localhost:3001/health
```

Deve retornar JSON com `"status": "ok"`.

### 2. Frontend acessível

Abra no navegador:
```
https://app.seudominio.com
```

Deve aparecer a tela de login.

### 3. Admin acessível

```
https://admin.seudominio.com
```

Deve aparecer o painel admin (use a `ADMIN_KEY` no header depois).

### 4. SSL funcionando

```bash
curl -I https://app.seudominio.com
```

Deve retornar `HTTP/2 200` (não 301 ou erro de certificado).

### 5. Evolution API respondendo

```bash
curl http://localhost:8080/instance/fetchInstances
```

Deve retornar JSON (pode ser array vazio `[]` se não tiver instâncias ainda).

---

## 🎉 Primeiro Acesso

### Criar sua conta

1. Acesse `https://app.seudominio.com`
2. Clique em **"Criar conta"** (se não tiver esse link, crie diretamente no Supabase)
3. **Via Supabase:**
   - Vá em **Authentication** → **Users** → **"Add user"**
   - Email: `seu@email.com`
   - Password: senha forte
   - **"Create user"**
4. Volte ao painel, vá em **SQL Editor**, execute:

```sql
-- Cria o tenant para o usuário
INSERT INTO tenants (
  auth_user_id, name, email, plan, status,
  messages_limit_month, contacts_limit, campaigns_limit,
  subscription_expires_at
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'seu@email.com'),
  'Minha Empresa',
  'seu@email.com',
  'pro',
  'active',
  10000,
  10000,
  10,
  (NOW() + INTERVAL '30 days')
);
```

5. Faça login em `https://app.seudominio.com`

### Conectar WhatsApp

1. No painel, vá em **WhatsApp** (sidebar)
2. Clique em **"Conectar via QR Code"**
3. Abra WhatsApp no celular → **Dispositivos vinculados** → **Vincular**
4. Escaneie o QR Code
5. Aguarde status mudar para **"Conectado"** (verde)

### Importar contatos

1. Vá em **Contatos**
2. Clique em **"📥 Importar"**
3. Arraste um arquivo CSV (formato: `nome;telefone`)
4. Aguarde importação

### Criar primeira campanha

1. Vá em **Campanhas**
2. Clique em **"+ Nova Campanha"**
3. Preencha:
   - Nome: `Teste Inicial`
   - Mensagem: `Olá {nome}! Esta é uma mensagem de teste.`
   - Delay: `10` a `30` segundos (padrão)
   - Agendamento: **"Envio imediato"**
4. Clique em **"🚀 Criar Campanha"**
5. A campanha vai iniciar automaticamente
6. Acompanhe o progresso no **Dashboard**

---

## 🔧 Comandos Úteis

### Logs em tempo real

```bash
# Ver logs da API
bash /opt/zapflow/scripts/logs.sh zf_backend

# Ver logs do worker (disparos)
bash /opt/zapflow/scripts/logs.sh zf_backend

# Ver logs da Evolution API
docker logs -f zf_evolution
```

### Reiniciar serviço específico

```bash
bash /opt/zapflow/scripts/restart.sh zf_backend
```

### Parar tudo

```bash
bash /opt/zapflow/scripts/stop.sh
```

### Iniciar tudo

```bash
bash /opt/zapflow/scripts/start.sh
```

### Backup manual

```bash
bash /opt/zapflow/scripts/backup.sh
```

(Backup automático roda todo dia às 3h via cron)

### Suspender um cliente

```bash
bash /opt/zapflow/scripts/block.sh <TENANT_UUID> "Inadimplência"
```

### Reativar cliente

```bash
bash /opt/zapflow/scripts/unblock.sh <TENANT_UUID> pro 30
```

---

## 🐛 Troubleshooting

### "502 Bad Gateway" no navegador

**Causa:** Backend não está rodando.

**Solução:**
```bash
bash /opt/zapflow/scripts/health.sh
# Se aparecer "exited" em algum serviço:
bash /opt/zapflow/scripts/restart.sh zf_backend
```

### "WhatsApp desconectado" mesmo após escanear QR

**Causa:** Evolution API reiniciou ou perdeu conexão.

**Solução:**
```bash
docker logs -f zf_evolution
# Procure por erros
# Se necessário, reconecte pelo painel
```

### Campanha não inicia

**Causas possíveis:**
1. WhatsApp desconectado → reconecte
2. Tenant suspenso → verifique no admin
3. Worker travado → reinicie:

```bash
bash /opt/zapflow/scripts/restart.sh zf_backend
bash /opt/zapflow/scripts/logs.sh zf_backend
```

### SSL expirou

Renovação automática via cron, mas se falhar:

```bash
cd /opt/zapflow
docker compose run --rm certbot renew
docker compose restart zf_nginx
```

### Disco cheio

Remova logs antigos:

```bash
docker system prune -a --volumes
rm -rf /opt/zapflow/logs/*.log
```

### Container travado em "Restarting"

```bash
docker ps -a  # veja qual está travado
docker logs <nome_do_container>  # veja o erro
docker rm -f <nome_do_container>
bash /opt/zapflow/scripts/start.sh
```

---

## 📊 Monitoramento

### Health check automático

O cron já está configurado para verificar a cada 5 minutos.

Logs em: `/opt/zapflow/logs/health.log`

### Ver uso de recursos

```bash
docker stats
```

Mostra CPU, RAM e rede de cada container em tempo real.

### Alertas (opcional)

Configure o UptimeRobot (gratuito) para monitorar:
- `https://api.seudominio.com/health`
- Se cair, envia email/SMS

---

## 🔒 Segurança

### Acesso SSH com chave (recomendado)

```bash
# Na sua máquina:
ssh-keygen -t ed25519 -C "seu@email.com"
ssh-copy-id root@IP_DA_VPS

# Na VPS:
nano /etc/ssh/sshd_config
# Altere: PasswordAuthentication no
systemctl restart sshd
```

### Firewall — restringir admin

Se quiser que apenas seu IP acesse o admin:

```bash
nano /opt/zapflow/nginx/nginx.conf
```

Procure por `# allow SEU_IP_AQUI;` e descomente:

```nginx
# No bloco do admin.seudominio.com:
allow  203.0.113.100;  # ← seu IP fixo
deny   all;
```

Reinicie:
```bash
docker compose restart zf_nginx
```

---

## 📈 Escalabilidade

### Quando crescer para 100+ clientes

1. **Upgrade da VPS:**
   - RAM: 16GB
   - CPU: 4 cores
   - Disco: 80GB SSD

2. **Redis dedicado:**
   - Migre o Redis para instância separada (AWS ElastiCache, DigitalOcean Managed Redis)
   - Atualize `REDIS_URL` no `.env`

3. **CDN para mídia:**
   - Cloudflare na frente do Supabase Storage
   - Reduz latência

4. **Load balancer:**
   - Se passar de 500 clientes, rode múltiplas instâncias do backend
   - Use Nginx como load balancer

---

## 🎓 Próximos Passos

1. **Configurar gateway de pagamento** (Stripe, Mercado Pago)
2. **Implementar webhook de pagamento** → ativa/bloqueia tenants automaticamente
3. **Adicionar analytics** (Plausible, PostHog)
4. **Criar landing page** para captação
5. **Configurar email transacional** (SendGrid, Resend) para notificações

---

## 📞 Suporte

Se travar em algum passo:

1. Copie os logs:
   ```bash
   bash /opt/zapflow/scripts/logs.sh zf_backend > logs.txt
   bash /opt/zapflow/scripts/health.sh >> logs.txt
   ```

2. Me envie:
   - O erro exato
   - O arquivo `logs.txt`
   - Em qual fase você está

---

**Boa sorte! 🚀**
