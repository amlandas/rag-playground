# syntax=docker/dockerfile:1

FROM node:18-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_API_VENV_SETUP=true

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_API_BASE_URL="https://rag-playground-api-908840126213.us-west1.run.app"
ARG NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="false"
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}

WORKDIR /app/apps/web
RUN pnpm build

FROM node:18-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN groupadd -r nextjs && useradd -r -g nextjs nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
