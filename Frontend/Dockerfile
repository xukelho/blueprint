# syntax=docker/dockerfile:1
# Development image for the Blueprint Vite frontend. Dependencies and
# Playwright browsers are installed in the image, never on the host machine.
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development \
    CHOKIDAR_USEPOLLING=true

# Playwright installs Chromium and its system libraries during the image build.
COPY package.json package-lock.json* ./
RUN npm install && npm cache clean --force

COPY . .

EXPOSE 5385

# The development node_modules directory is a persistent Compose volume. Keep it
# synchronized with the bind-mounted lockfile whenever the container starts so a
# dependency change does not leave Vite running against a stale volume.
CMD ["sh", "-c", "npm install --no-audit --no-fund && npm run dev"]
