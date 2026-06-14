# Custom LiveKit image that BAKES IN the production config instead of bind-mounting it.
#
# Coolify's docker-compose buildpack does not reliably resolve relative bind-mount
# source paths (e.g. ./infra/livekit/livekit.yaml). When the source can't be resolved,
# Docker creates an empty directory at the target — which surfaces at runtime as the
# crash loop: "read /etc/livekit/livekit.yaml: is a directory". Baking the file into
# the image removes the host path entirely, so there is nothing to misresolve.
#
# Build context is the repo root (so the COPY path below resolves).
FROM livekit/livekit-server:latest
COPY infra/livekit/livekit.yaml /etc/livekit/livekit.yaml
# The base image's ENTRYPOINT is `livekit-server`; these are its default args.
CMD ["--config", "/etc/livekit/livekit.yaml"]
