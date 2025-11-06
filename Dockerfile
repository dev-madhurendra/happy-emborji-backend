# Multi-stage Dockerfile using Bun
# Builder: install deps and compile TypeScript
FROM oven/bun:latest AS builder
WORKDIR /app

# copy package manifest and lockfile first for better caching
COPY package.json bun.lock /app/
COPY tsconfig.json /app/

# copy source
COPY src ./src

# install dev + prod deps so tsc (in devDependencies) is available
RUN bun install 

# build TypeScript to /app/dist using the project build script

EXPOSE 8021 

# Use Bun to execute the compiled JS directly
CMD ["bun", "run","src/app.ts"]
