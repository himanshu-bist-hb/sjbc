FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY public ./public
ENV NODE_ENV=production PORT=3000 TRUST_PROXY=true
EXPOSE 3000
CMD ["node", "server/index.js"]
