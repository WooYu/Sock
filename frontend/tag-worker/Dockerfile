FROM node:22-bookworm-slim
WORKDIR /app
COPY scripts/note-tag-extraction.mjs scripts/
COPY scripts/note-tag-suggestions.mjs scripts/
COPY src/features/knowledge/note-tag-taxonomy.json src/features/knowledge/note-tag-catalog.json src/features/knowledge/
COPY src/server/note-study-seed.json src/server/
COPY tag-worker/server.mjs tag-worker/
ENV NODE_ENV=production PORT=3010 CODEX_HOME=/tmp/codex
USER node
EXPOSE 3010
CMD ["node", "tag-worker/server.mjs"]
