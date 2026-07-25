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

EXPOSE 3000

CMD ["npm", "run", "dev"]
