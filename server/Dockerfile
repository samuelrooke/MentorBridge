# Production image for the MentorBridge API.
# Build from the repo root so the workspace lockfile is used:
#   docker build -f server/Dockerfile -t mentorbridge-api .
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Workspace manifests and the lockfile first, so dependency installs are cached.
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
COPY landing/package.json landing/
RUN npm ci --omit=dev --workspace server --include-workspace-root=false

COPY server/src server/src
COPY server/scripts server/scripts

USER node
EXPOSE 4000
CMD ["node", "server/src/index.js"]
