FROM node:24.13.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
RUN apt-get update && apt-get install -y --no-install-recommends openssl procps && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm run prisma:generate
EXPOSE 3001
CMD ["npm", "run", "dev"]
