# Dockerfile for Node.js backend
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install --frozen-lockfile || npm install
RUN npm run build || :
EXPOSE 8080
CMD ["npm", "start"]
