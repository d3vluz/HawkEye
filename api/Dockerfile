FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push && node dist/main"]
