#!/bin/sh
# Map container env vars onto Scout config properties (-D overrides config.properties) and
# launch the embedded-Jetty Scout application. The H2 database lives on the /data volume so
# chat history and conversations survive container restarts.
set -e

exec java \
  -Dmeeting.livekit.apiKey="${LIVEKIT_API_KEY:-devkey}" \
  -Dmeeting.livekit.apiSecret="${LIVEKIT_API_SECRET:-secret}" \
  -Dmeeting.db.url="${MEETING_DB_URL:-jdbc:h2:file:/data/meeting;AUTO_SERVER=TRUE}" \
  -Dscout.app.port="${SCOUT_APP_PORT:-8080}" \
  -cp "meeting-server.jar:dependency/*" \
  org.eclipse.scout.rt.app.Application
