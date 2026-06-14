# Eclipse Scout RT meeting-server (LiveKit tokens + contacts + persistent chat, H2).
# Build context is the repository root (consistent with the other service images).

# --- Build stage -----------------------------------------------------------
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
COPY services/meeting-server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /data
EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]
