# Build context must be the repository root (npm workspaces resolution).
# ---- build stage ----
FROM node:24-alpine AS build
WORKDIR /repo
COPY . .
RUN npm install
# Build the reusable library first, then the Scout demo app + static site.
RUN npm run build:lib && npm run build:demo

# ---- serve stage ----
FROM nginx:1.27-alpine
COPY apps/demo/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/demo/target/site /usr/share/nginx/html
# Regenerate config.js from $LIVEKIT_URL on container start.
COPY apps/demo/docker-entrypoint.sh /docker-entrypoint.d/40-livekit-config.sh
RUN chmod +x /docker-entrypoint.d/40-livekit-config.sh
EXPOSE 80
