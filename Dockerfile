FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline
COPY . .
RUN npm run build -- --configuration=production

FROM node:22-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=build /app/dist/travely-web/browser ./
EXPOSE 4200
CMD ["serve", "-s", ".", "-l", "4200"]
