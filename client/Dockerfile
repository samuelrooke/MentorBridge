# Builds the client with Vite and serves the static files with nginx.
# Build from the repo root:  docker build -f client/Dockerfile -t mentorbridge-client .
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY landing/package.json landing/
RUN npm ci --workspaces --include-workspace-root=false

COPY client client

# Vite bakes these into the bundle at build time.
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
# Supabase URL and publishable key: pass them as build args, or keep them in client/.env.
# Empty args are dropped so they don't override client/.env.
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
RUN [ -n "$VITE_SUPABASE_URL" ] || unset VITE_SUPABASE_URL; \
    [ -n "$VITE_SUPABASE_ANON_KEY" ] || unset VITE_SUPABASE_ANON_KEY; \
    npm run build -w client

FROM nginx:1.27-alpine
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
