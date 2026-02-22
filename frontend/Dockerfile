# ─────────────────────────────────────────────────────────
# ZapFlow Frontend — Dockerfile
# Next.js 14 · Build otimizado de produção
# ─────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ── Instala dependências ──────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci

# ── Build ────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis necessárias no build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ── Imagem final ─────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup -g 1001 -S zapflow && \
    adduser  -u 1001 -S zapflow -G zapflow

COPY --from=builder --chown=zapflow:zapflow /app/.next/standalone ./
COPY --from=builder --chown=zapflow:zapflow /app/.next/static ./.next/static
#COPY --from=builder --chown=zapflow:zapflow /app/public ./public

USER zapflow
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
