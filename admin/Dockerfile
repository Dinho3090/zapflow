FROM node:18-alpine
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./
RUN npm install

# Copia o restante do código
COPY . .

# Build da aplicação Next.js
RUN npm run build

# Expõe a porta que você definiu no package.json
EXPOSE 3002

# Inicia o servidor em modo produção
CMD ["npm", "start"]