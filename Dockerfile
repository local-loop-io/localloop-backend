FROM oven/bun:1.3.8

WORKDIR /app

RUN useradd -m -u 10001 app

COPY package.json bun.lock ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN bun install --production
RUN bun run prisma:generate

COPY src ./src
COPY .env.example ./

RUN chown -R app:app /app
USER app

EXPOSE 8088

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD bun -e "fetch('http://127.0.0.1:8088/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
