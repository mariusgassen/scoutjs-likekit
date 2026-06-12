# Build context must be the repository root (workspaces resolution).
# Build stage
FROM node:24-alpine AS build
WORKDIR /repo
COPY . .
RUN npm install
RUN npm run build --workspace=token-server

# Runtime stage
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=build /repo/services/token-server/dist ./dist
COPY --from=build /repo/services/token-server/package.json ./
COPY --from=build /repo/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/server.js"]
