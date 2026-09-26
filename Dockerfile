# One image for the whole site (API + built frontend). Works on Fly.io,
# Railway, a VPS, or anywhere that runs containers.
#   docker build -t insurtechai .
#   docker run -p 4000:4000 -v insurtechai-data:/data \
#     -e AUTH_SECRET=... -e APP_ORIGIN=http://localhost:4000 insurtechai

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY shared shared
COPY backend backend
COPY frontend frontend
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_URL=file:/data/insurtechai.db
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/drizzle backend/drizzle
COPY --from=build /app/frontend/dist frontend/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node backend/dist/db/migrate.js && node backend/dist/seed/seed.js --if-empty && node backend/dist/server.js"]
