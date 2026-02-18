-- =============================================
-- ZAPFLOW — Schema Completo v2
-- Execute no SQL Editor do Supabase
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ─────────────────────────────────────────────────
CREATE TYPE tenant_status AS ENUM ('trial','active','suspended','cancelled');
CREATE TYPE tenant_plan   AS ENUM ('trial','basic','pro','enterprise');
CREATE TYPE wa_status     AS ENUM ('connected','disconnected','connecting','banned');
CREATE TYPE camp_status   AS ENUM ('draft','scheduled','running','paused','done','failed','cancelled');
CREATE TYPE msg_status    AS ENUM ('queued','sending','sent','delivered','read','failed');
CREATE TYPE media_type    AS ENUM ('none','image','video','document','audio');
CREATE TYPE recur_type    AS ENUM ('none','daily','weekly','custom');
CREATE TYPE auto_trigger  AS ENUM ('keyword','menu','always');
CREATE TYPE node_type     AS ENUM ('message','menu','wait','condition');

-- ── TENANTS ───────────────────────────────────────────────
CREATE TABLE tenants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id            UUID UNIQUE,            -- Supabase auth.users.id
  name                    TEXT NOT NULL,
  email                   TEXT UNIQUE NOT NULL,
  phone                   TEXT,
  plan                    tenant_plan   DEFAULT 'trial',
  status                  tenant_status DEFAULT 'trial',

  -- Limites do plano
  messages_limit_month    INT DEFAULT 500,
  contacts_limit          INT DEFAULT 200,
  campaigns_limit         INT DEFAULT 2,
  min_delay_seconds       INT DEFAULT 10,

  -- Uso do mês
  messages_sent_month     INT DEFAULT 0,
  billing_cycle_start     DATE DEFAULT CURRENT_DATE,

  -- WhatsApp
  wa_instance_id          TEXT UNIQUE,
  wa_status               wa_status DEFAULT 'disconnected',
  wa_phone_number         TEXT,
  wa_profile_name         TEXT,
  wa_connected_at         TIMESTAMPTZ,
  wa_disconnected_at      TIMESTAMPTZ,

  -- Assinatura / bloqueio
  subscription_expires_at TIMESTAMPTZ,
  blocked_at              TIMESTAMPTZ,
  block_reason            TEXT,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONTACTS ──────────────────────────────────────────────
CREATE TABLE contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT,
  phone       TEXT NOT NULL,
  email       TEXT,
  tags        TEXT[]  DEFAULT '{}',
  variables   JSONB   DEFAULT '{}',      -- {nome, empresa, ...} para interpolação
  active      BOOLEAN DEFAULT true,
  opted_out   BOOLEAN DEFAULT false,
  opted_out_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);

-- ── CAMPAIGNS ─────────────────────────────────────────────
CREATE TABLE campaigns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name                 TEXT NOT NULL,
  description          TEXT,

  -- Conteúdo
  message_text         TEXT,
  media_type           media_type DEFAULT 'none',
  media_url            TEXT,
  media_caption        TEXT,

  -- Comportamento humano
  delay_min_seconds    INT  DEFAULT 10,
  delay_max_seconds    INT  DEFAULT 30,
  typing_simulation    BOOL DEFAULT true,
  send_start_hour      INT  DEFAULT 8,
  send_end_hour        INT  DEFAULT 20,
  send_on_weekends     BOOL DEFAULT false,

  -- Segmentação
  target_tags          TEXT[] DEFAULT '{}',
  target_all           BOOL   DEFAULT true,

  -- Status
  status               camp_status DEFAULT 'draft',
  scheduled_at         TIMESTAMPTZ,

  -- Recorrência
  recurrence_type      recur_type DEFAULT 'none',
  recurrence_days      INT[]   DEFAULT '{}',  -- 0=Dom..6=Sáb
  recurrence_times     TEXT[]  DEFAULT '{}',  -- ['09:00','18:00']
  recurrence_end_date  DATE,

  -- Progresso
  contacts_total       INT DEFAULT 0,
  contacts_sent        INT DEFAULT 0,
  contacts_failed      INT DEFAULT 0,
  contacts_pending     INT DEFAULT 0,

  -- Controle
  queue_job_id         TEXT,
  started_at           TIMESTAMPTZ,
  finished_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── CAMPAIGN_CONTACTS (fila de envio) ─────────────────────
CREATE TABLE campaign_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id)  ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  contact_id    UUID NOT NULL REFERENCES contacts(id)   ON DELETE CASCADE,
  final_message TEXT,
  status        msg_status DEFAULT 'queued',
  error_message TEXT,
  attempts      INT  DEFAULT 0,
  wa_message_id TEXT,
  queued_at     TIMESTAMPTZ DEFAULT NOW(),
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  failed_at     TIMESTAMPTZ,
  UNIQUE(campaign_id, contact_id)
);

-- ── MESSAGE_LOGS ──────────────────────────────────────────
CREATE TABLE message_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  campaign_id   UUID REFERENCES campaigns(id)           ON DELETE SET NULL,
  contact_id    UUID REFERENCES contacts(id)            ON DELETE SET NULL,
  phone         TEXT NOT NULL,
  status        msg_status,
  wa_message_id TEXT,
  error_message TEXT,
  sent_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── MEDIA_LIBRARY ─────────────────────────────────────────
CREATE TABLE media_library (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        media_type NOT NULL,
  url         TEXT NOT NULL,
  mime_type   TEXT,
  size_bytes  BIGINT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUTOMATIONS (Chatbot) ─────────────────────────────────
CREATE TABLE automations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  trigger_type      auto_trigger DEFAULT 'keyword',
  trigger_keywords  TEXT[]  DEFAULT '{}',   -- ['oi','olá','menu']
  active            BOOLEAN DEFAULT true,
  priority          INT     DEFAULT 0,      -- maior = mais prioritário
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUTOMATION_NODES (nós do fluxo) ──────────────────────
CREATE TABLE automation_nodes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id  UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES tenants(id)     ON DELETE CASCADE,
  order_index    INT  NOT NULL DEFAULT 0,
  type           node_type DEFAULT 'message',
  content        TEXT,                      -- texto da mensagem ou menu
  media_type     media_type DEFAULT 'none',
  media_url      TEXT,
  media_caption  TEXT,
  -- Para tipo 'menu': JSON array de opções
  -- [{ key: "1", label: "Suporte", next_node_order: 2 }]
  options        JSONB,
  wait_seconds   INT DEFAULT 0,             -- para tipo 'wait'
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── BOT_SESSIONS (estado da conversa por usuário) ─────────
CREATE TABLE bot_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone               TEXT NOT NULL,
  automation_id       UUID REFERENCES automations(id) ON DELETE SET NULL,
  current_node_index  INT DEFAULT 0,
  context             JSONB DEFAULT '{}',   -- variáveis da conversa
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);

-- ── SUBSCRIPTIONS ─────────────────────────────────────────
CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan          tenant_plan NOT NULL,
  amount_cents  INT  NOT NULL,
  currency      TEXT DEFAULT 'BRL',
  status        TEXT NOT NULL,
  gateway       TEXT,
  gateway_id    TEXT,
  paid_at       TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── ÍNDICES ───────────────────────────────────────────────
CREATE INDEX idx_contacts_tenant      ON contacts(tenant_id);
CREATE INDEX idx_contacts_tags        ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_phone       ON contacts(phone);

CREATE INDEX idx_campaigns_tenant     ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status     ON campaigns(status);
CREATE INDEX idx_campaigns_scheduled  ON campaigns(scheduled_at) WHERE scheduled_at IS NOT NULL;

CREATE INDEX idx_cc_campaign          ON campaign_contacts(campaign_id);
CREATE INDEX idx_cc_status            ON campaign_contacts(status);
CREATE INDEX idx_cc_tenant            ON campaign_contacts(tenant_id);

CREATE INDEX idx_logs_tenant          ON message_logs(tenant_id);
CREATE INDEX idx_logs_campaign        ON message_logs(campaign_id);
CREATE INDEX idx_logs_sent_at         ON message_logs(sent_at DESC);

CREATE INDEX idx_automations_tenant   ON automations(tenant_id);
CREATE INDEX idx_automation_nodes_auto ON automation_nodes(automation_id);
CREATE INDEX idx_bot_sessions_tenant  ON bot_sessions(tenant_id, phone);

CREATE INDEX idx_tenants_status       ON tenants(status);
CREATE INDEX idx_tenants_wa           ON tenants(wa_instance_id);

-- ── TRIGGERS updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_upd    BEFORE UPDATE ON tenants         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_campaigns_upd  BEFORE UPDATE ON campaigns        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contacts_upd   BEFORE UPDATE ON contacts         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_automations_upd BEFORE UPDATE ON automations     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sessions_upd   BEFORE UPDATE ON bot_sessions     FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── FUNCTION: bloquear tenant ─────────────────────────────
CREATE OR REPLACE FUNCTION check_tenant_blocked(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE v tenants%ROWTYPE;
BEGIN
  SELECT * INTO v FROM tenants WHERE id = p_tenant_id;
  IF NOT FOUND                             THEN RETURN json_build_object('blocked', true,  'reason', 'Tenant não encontrado'); END IF;
  IF v.status = 'suspended'               THEN RETURN json_build_object('blocked', true,  'reason', v.block_reason); END IF;
  IF v.status = 'cancelled'               THEN RETURN json_build_object('blocked', true,  'reason', 'Assinatura cancelada'); END IF;
  IF v.subscription_expires_at < NOW()    THEN RETURN json_build_object('blocked', true,  'reason', 'Assinatura expirada'); END IF;
  IF v.messages_sent_month >= v.messages_limit_month
                                          THEN RETURN json_build_object('blocked', true,  'reason', 'Limite mensal atingido'); END IF;
  RETURN json_build_object('blocked', false, 'reason', null);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── FUNCTION: incrementar contador de mensagens ───────────
CREATE OR REPLACE FUNCTION increment_messages_sent(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE tenants SET messages_sent_month = messages_sent_month + 1 WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS ───────────────────────────────────────────────────
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_library     ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_nodes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants           ENABLE ROW LEVEL SECURITY;

-- Cada tenant acessa apenas seus próprios dados
CREATE POLICY "iso_tenants"    ON tenants          FOR ALL USING (auth_user_id = auth.uid());
CREATE POLICY "iso_contacts"   ON contacts         FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
CREATE POLICY "iso_campaigns"  ON campaigns        FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
CREATE POLICY "iso_cc"         ON campaign_contacts FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
CREATE POLICY "iso_logs"       ON message_logs     FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
CREATE POLICY "iso_media"      ON media_library    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
CREATE POLICY "iso_autos"      ON automations      FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
CREATE POLICY "iso_nodes"      ON automation_nodes FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
CREATE POLICY "iso_sessions"   ON bot_sessions     FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
CREATE POLICY "iso_subs"       ON subscriptions    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

-- ── VIEW admin ────────────────────────────────────────────
CREATE VIEW admin_overview AS
SELECT
  t.id, t.name, t.email, t.plan, t.status,
  t.wa_status, t.wa_phone_number,
  t.messages_sent_month, t.messages_limit_month,
  ROUND(t.messages_sent_month::NUMERIC / NULLIF(t.messages_limit_month,0) * 100, 1) AS usage_pct,
  t.subscription_expires_at, t.blocked_at, t.block_reason,
  COUNT(DISTINCT co.id)                                               AS total_contacts,
  COUNT(DISTINCT ca.id) FILTER (WHERE ca.status = 'running')         AS active_campaigns,
  COUNT(DISTINCT au.id) FILTER (WHERE au.active = true)              AS active_automations,
  t.created_at
FROM tenants t
LEFT JOIN contacts   co ON co.tenant_id = t.id
LEFT JOIN campaigns  ca ON ca.tenant_id = t.id
LEFT JOIN automations au ON au.tenant_id = t.id
GROUP BY t.id ORDER BY t.created_at DESC;

-- ── BUCKET no Supabase Storage ────────────────────────────
-- Crie manualmente no painel: Storage > New Bucket
-- Nome: "campaign-media", Public: true
-- ─────────────────────────────────────────────────────────
