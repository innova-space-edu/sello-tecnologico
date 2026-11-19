FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV INNOVA_STORAGE_DELL_ENABLED=false
COPY --chown=node:node services/innova-storage-dell/server.mjs /app/services/innova-storage-dell/server.mjs
COPY --chown=node:node src/lib/innova-storage/r2-sign.mjs /app/src/lib/innova-storage/r2-sign.mjs
COPY --chown=node:node src/lib/innova-storage/read-guard.mjs /app/src/lib/innova-storage/read-guard.mjs
USER node
EXPOSE 8080
CMD ["node","/app/services/innova-storage-dell/server.mjs"]
