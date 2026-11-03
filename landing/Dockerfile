# Builds the landing with Vite and serves the static files with nginx.
# Build from the repo root:  docker build -f landing/Dockerfile -t mentorbridge-landing .
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY landing/package.json landing/
RUN npm ci --workspaces --include-workspace-root=false

COPY landing landing

# Vite bakes these into the bundle at build time.
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w landing

FROM nginx:1.27-alpine
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/landing/dist /usr/share/nginx/html
EXPOSE 80
