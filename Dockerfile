# Dependencies
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci


# Build
FROM node:22-alpine AS builder

WORKDIR /app

ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chatkit"
ENV DATABASE_URL=${DATABASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build


# Production
FROM node:22-alpine AS runner

WORKDIR /app

ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chatkit"
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=${DATABASE_URL}

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]