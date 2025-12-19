FROM oven/bun:1.3.5

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production

COPY src ./src
COPY .env.example ./

EXPOSE 8088

CMD ["bun", "run", "src/index.ts"]
