#!/bin/sh
# Map container env vars onto Scout config properties (-D overrides config.properties) and
# launch the embedded-Jetty Scout application, which serves the web app (/) and the API (/api).
# Persistence is a real PostgreSQL database (MEETING_DB_*); Flyway migrates the schema on startup.
set -e

# Regenerate the browser runtime config (index.html loads /config.js) from $LIVEKIT_URL,
# so the same image can target different LiveKit servers without rebuilding.
: "${LIVEKIT_URL:=ws://localhost:7880}"
cat > /app/web/config.js <<EOF
window.APP_CONFIG = {
  livekitUrl: "${LIVEKIT_URL}"
};
EOF
echo "config.js written with livekitUrl=${LIVEKIT_URL}"

exec java \
  -Dmeeting.livekit.apiKey="${LIVEKIT_API_KEY:-devkey}" \
  -Dmeeting.livekit.apiSecret="${LIVEKIT_API_SECRET:-secret}" \
  -Dmeeting.db.url="${MEETING_DB_URL:-jdbc:postgresql://postgres:5432/scoutkit}" \
  -Dmeeting.db.user="${MEETING_DB_USER:-scoutkit}" \
  -Dmeeting.db.password="${MEETING_DB_PASSWORD:-scoutkit}" \
  -Dmeeting.web.root="${MEETING_WEB_ROOT:-/app/web}" \
  -Dscout.app.port="${SCOUT_APP_PORT:-8080}" \
  -cp "scoutkit-server.jar:dependency/*" \
  org.eclipse.scout.rt.app.Application
