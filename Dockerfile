# 1. ETAPA DE CONSTRUCCIÓN
FROM node:22-alpine AS build

WORKDIR /app

# Copiamos archivos de dependencias y los instalamos
COPY package*.json ./
RUN npm install

# Copiamos el resto del código y construimos la app
COPY . .
RUN npm run build -- --configuration=production


# 2. ETAPA DE SERVICIO (NGINX)
FROM nginx:alpine

# Copiamos los archivos generados desde la etapa 'build'
COPY --from=build /app/dist/travely-web/browser /usr/share/nginx/html

# CONFIGURACIÓN PARA EVITAR ERROR 404 EN RUTAS DE ANGULAR
# Esto redirige todas las peticiones al index.html
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
