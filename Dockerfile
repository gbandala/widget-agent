FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars se hornean en el bundle — deben venir como build args
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_DEMO_WIDGET_TOKEN

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_DEMO_WIDGET_TOKEN=$NEXT_PUBLIC_DEMO_WIDGET_TOKEN

# Disable telemetry prompt (avoids pause + noise in CI logs)
ENV NEXT_TELEMETRY_DISABLED=1
# Cap Node heap to 1.5 GB — prevents OOM kills on shared VPS RAM
ENV NODE_OPTIONS="--max-old-space-size=1536"

# npm run build = tsx scripts/build-widget.ts && next build
RUN node_modules/.bin/tsx scripts/build-widget.ts && node_modules/.bin/next build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodeuser
USER nodeuser

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
