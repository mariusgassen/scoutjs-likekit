# Eclipse Scout RT meeting-server. Serves BOTH the Scout JS web app (at /) and the REST API
# (at /api/*) from one container — no separate nginx. Build context is the repository root.

# --- Web build stage: build the Scout JS app into a static site ------------
FROM node:24-alpine AS web
WORKDIR /repo
COPY . .
RUN npm install
RUN npm run build:lib && npm run build:demo
# produces apps/demo/target/site

# --- Java build stage ------------------------------------------------------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY services/meeting-server/pom.xml .
# Warm the local repo so source-only changes don't re-download dependencies.
RUN mvn -B -q dependency:go-offline || true
COPY services/meeting-server/src ./src
RUN mvn -B -q -DskipTests package

# --- Runtime stage ---------------------------------------------------------
FROM eclipse-temurin:21-jre
WORKDIR /app
# The module jar plus its dependencies on the classpath. We deliberately do NOT build a
# shaded uber-jar: that would collapse the per-jar Jandex indexes Scout uses for bean discovery.
COPY --from=build /build/target/meeting-server.jar ./meeting-server.jar
COPY --from=build /build/target/dependency ./dependency
# The built web app served at / (StaticResourceServlet, meeting.web.root=/app/web).
COPY --from=web /repo/apps/demo/target/site ./web
COPY services/meeting-server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /data
EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]
