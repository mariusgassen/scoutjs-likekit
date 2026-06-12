#!/bin/sh
# Regenerate the runtime config from $LIVEKIT_URL each time the container starts,
# so the same image can target different LiveKit servers without rebuilding.
set -e
: "${LIVEKIT_URL:=ws://localhost:7880}"
cat > /usr/share/nginx/html/config.js <<EOF
window.APP_CONFIG = {
  livekitUrl: "${LIVEKIT_URL}"
};
EOF
echo "config.js written with livekitUrl=${LIVEKIT_URL}"
