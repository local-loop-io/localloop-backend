FROM oven/bun:1.3.5

WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN bun install --production
RUN bun run prisma:generate

COPY src ./src
COPY .env.example ./

EXPOSE 8088

CMD ["bun", "run", "src/index.ts"]
