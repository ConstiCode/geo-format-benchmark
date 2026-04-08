FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY tsconfig.json vitest.config.ts ./
COPY src/ src/

# Build
RUN npm run build

# Production
FROM node:22-alpine
WORKDIR /app
COPY --from=base /app/dist dist/
COPY --from=base /app/node_modules node_modules/
COPY --from=base /app/package.json .

EXPOSE 3000
CMD ["node", "dist/index.js"]
