FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node server.js package.json ./
COPY --chown=node:node public ./public
USER node
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
