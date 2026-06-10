// Pon aquí la URL pública de Cloudflare de tu contenedor backend
// Ejemplo: https://api.tu-app.com  (sin barra final)
const BACKEND = 'https://TU_BACKEND.CLOUDFLARE.COM';

export const environment = {
  production: true,
  apiUrl: `${BACKEND}/api/v1`,
  wsUrl:  `${BACKEND.replace('https://', 'wss://').replace('http://', 'ws://')}/ws`,
};
