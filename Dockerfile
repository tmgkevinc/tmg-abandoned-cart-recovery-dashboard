FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

COPY package.json server.js ./
COPY public ./public

EXPOSE 8080
CMD ["node", "server.js"]
