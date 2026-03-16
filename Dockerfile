FROM node:24.13-alpine AS base
RUN npm install -g pnpm @nestjs/cli

# prisma-migrate target
FROM base AS prisma-migrate
WORKDIR /usr/src/app
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY prisma.config.ts ./
COPY ./prisma ./prisma
RUN pnpm install
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# production stage
FROM base AS production
ARG NODE_ENV=production
ARG DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy?schema=public"
ENV NODE_ENV=${NODE_ENV}
ENV DATABASE_URL=${DATABASE_URL}
WORKDIR /usr/src/app
COPY . .
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY prisma.config.ts ./
COPY ./prisma ./
RUN pnpm install
RUN pnpm exec prisma generate
RUN pnpm run build
ENV APP_MAIN_FILE=dist/src/main
CMD node ${APP_MAIN_FILE}
