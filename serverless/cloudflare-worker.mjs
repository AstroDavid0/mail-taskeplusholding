/**
 * Envoltorio para Cloudflare Workers.
 * ---------------------------------------------------------------------------
 * La lógica vive en ../netlify/edge-functions/autodiscover.mjs (un solo lugar,
 * sin duplicar). Cloudflare exige que el default export sea un objeto con
 * fetch, así que este archivo solo envuelve.
 *
 * Despliegue (wrangler):
 *   wrangler deploy serverless/cloudflare-worker.mjs \
 *     --name taskeplusholding-autodiscover \
 *     --compatibility-date 2024-01-01
 *
 * Ojo con el hostname: Workers necesita que el dominio esté en tu zona de
 * Cloudflare para emitir el certificado de autodiscover.taskeplusholding.com.
 * Como el DNS está en Namecheap, la ruta sin migrar nada es la de Netlify
 * (ver netlify.toml y docs/DNS.md). Cloudflare es buena alternativa si algún
 * día mueves la zona completa a Cloudflare.
 */
import handler from "../netlify/edge-functions/autodiscover.mjs";

export default {
  fetch(request, env, ctx) {
    return handler(request, env, ctx);
  },
};
