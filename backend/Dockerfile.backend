FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ── Dependências ─────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
# Instalamos todas as dependências para evitar o erro de 'module not found'
RUN npm install

# ── Imagem final ─────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

# Copia as dependências instaladas e o código fonte
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

# Configuração de usuário e pastas (tudo feito como root antes da troca)
RUN addgroup -g 1001 -S zapflow && \
    adduser -u 1001 -S zapflow -G zapflow && \
    mkdir -p /app/uploads && \
    chown -R zapflow:zapflow /app

# Agora sim, mudamos para o usuário seguro
USER zapflow

EXPOSE 3001

# O dumb-init já cuida dos sinais no ENTRYPOINT, o CMD inicia o servidor
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
