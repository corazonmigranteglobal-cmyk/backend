FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .


RUN mkdir -p /app/logs && chown -R node:node /app
USER node

EXPOSE 3003

# Por defecto: API
CMD ["node", "index.js"]
