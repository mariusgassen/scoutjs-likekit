# Eclipse Scout RT scoutkit-server. Serves BOTH the Scout JS web app (at /) and the REST API
# (at /api/*) from one container — no separate nginx. Build context is the repository root.

# --- Web build stage: build the Scout JS app into a static site ------------
FROM node:25-alpine AS web
WORKDIR /repo
COPY . .
RUN npm install
RUN npm run build:lib && npm run build:web
# produces apps/web/target/site

# --- Java build stage ------------------------------------------------------
FROM maven:3-eclipse-temurin-26 AS build
WORKDIR /build
COPY services/scoutkit-server/pom.xml .
# Warm the local repo so source-only changes don't re-download dependencies.
RUN mvn -B -q dependency:go-offline || true
COPY services/scoutkit-server/src ./src
RUN mvn -B -q -DskipTests package

# --- Runtime stage ---------------------------------------------------------
FROM eclipse-temurin:25-jre
WORKDIR /app
# The module jar plus its dependencies on the classpath. We deliberately do NOT build a
# shaded uber-jar: that would collapse the per-jar Jandex indexes Scout uses for bean discovery.
COPY --from=build /build/target/scoutkit-server.jar ./scoutkit-server.jar
COPY --from=build /build/target/dependency ./dependency
# The built web app served at / (StaticResourceServlet, meeting.web.root=/app/web).
COPY --from=web /repo/apps/web/target/site ./web
COPY services/scoutkit-server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]
