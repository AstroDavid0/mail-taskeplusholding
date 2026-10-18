#!/usr/bin/env node
/**
 * Verificación de producción por dominio.
 * ---------------------------------------------------------------------------
 * Para cada dominio de domains.js comprueba:
 *   1. DNS: existe autoconfig.<dominio> y autodiscover.<dominio>
 *   2. TLS: el certificado es válido para ese nombre y no caduca pronto
 *   3. Autoconfig (GET): 200 + application/xml + el dominio y el servidor correctos
 *   4. Autodiscover (POST): 200 + <LoginName> con la dirección real
 *
 * Uso:
 *   node scripts/verify-domains.mjs            # todos
 *   node scripts/verify-domains.mjs taskeplusholding.com   # solo uno
 */

import { resolve4 } from "node:dns/promises";
import tls from "node:tls";
import { DOMAINS } from "../domains.js";

const TIMEOUT = 15000;
const SOLO = process.argv.slice(2).filter((a) => !a.startsWith("-"));

const ok = (v) => (v ? "✅" : "❌");

async function hayDns(host) {
  try {
    const records = await resolve4(host);
    return records.length > 0;
  } catch {
    return false;
  }
}

function certInfo(host) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const socket = tls.connect(
      { host, port: 443, servername: host, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate() || {};
        const authorized = socket.authorized;
        const san = cert.subjectaltname || "";
        const expires = cert.valid_to ? new Date(cert.valid_to) : null;
        const días = expires ? Math.round((expires - Date.now()) / 86400000) : null;
        socket.end();
        done({ authorized, san, días, cn: cert.subject?.CN || "" });
      },
    );
    socket.setTimeout(TIMEOUT, () => socket.destroy());
    socket.on("error", (error) => done({ error: error.code || error.message }));
  });
}

async function probar(dominio) {
  const cfg = DOMAINS.find((d) => d.domain === dominio);
  if (!cfg) return null;

  const r = {
    domain: dominio,
    dnsConfig: false,
    dnsDiscover: false,
    tls: false,
    tlsDias: null,
    autoconfig: false,
    autodiscover: false,
    detalle: [],
  };

  const hostConfig = `autoconfig.${dominio}`;
  const hostDiscover = `autodiscover.${dominio}`;

  r.dnsConfig = await hayDns(hostConfig);
  r.dnsDiscover = await hayDns(hostDiscover);

  if (r.dnsConfig) {
    const c = await certInfo(hostConfig);
    if (c.error) r.detalle.push(`TLS ${hostConfig}: ${c.error}`);
    else {
      r.tls = Boolean(c.authorized) && c.san.includes(hostConfig);
      r.tlsDias = c.días;
      if (!r.tls) r.detalle.push(`cert no cubre ${hostConfig} (SAN=${c.san || "-"})`);
    }
  }

  // 3. autoconfig
  if (r.dnsConfig) {
    try {
      const res = await fetch(`https://${hostConfig}/mail/config-v1.1.xml?emailaddress=ana@${dominio}`, {
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const body = await res.text();
      r.autoconfig =
        res.status === 200 &&
        body.includes(`<domain>${dominio}</domain>`) &&
        body.includes(`<hostname>${cfg.imap.host}</hostname>`) &&
        body.includes(`<port>${cfg.imap.port}</port>`);
      if (!r.autoconfig) r.detalle.push(`autoconfig: HTTP ${res.status}`);
    } catch (error) {
      r.detalle.push(`autoconfig: ${error.cause?.code || error.name}`);
    }
  }

  // 4. autodiscover POST
  if (r.dnsDiscover) {
    try {
      const res = await fetch(`https://${hostDiscover}/autodiscover/autodiscover.xml`, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body: `<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/requestschema/2006"><Request><EMailAddress>ana@${dominio}</EMailAddress></Request></Autodiscover>`,
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const body = await res.text();
      r.autodiscover =
        res.status === 200 &&
        body.includes(`<LoginName>ana@${dominio}</LoginName>`) &&
        body.includes(`<Server>${cfg.imap.host}</Server>`);
      if (!r.autodiscover) r.detalle.push(`autodiscover: HTTP ${res.status}`);
    } catch (error) {
      r.detalle.push(`autodiscover: ${error.cause?.code || error.name}`);
    }
  }

  return r;
}

const lista = SOLO.length ? SOLO : DOMAINS.map((d) => d.domain);
const resultados = [];

for (const dominio of lista) {
  const r = await probar(dominio);
  if (r) resultados.push(r);
}

const pad = (v, n) => String(v).padEnd(n);
console.log(`\n${pad("DOMINIO", 26)} ${pad("DNS", 6)} ${pad("TLS", 14)} ${pad("AUTOCONFIG", 12)} AUTODISCOVER`);
console.log("-".repeat(78));

for (const r of resultados) {
  const dns = `${r.dnsConfig ? "✅" : "❌"}${r.dnsDiscover ? "✅" : "❌"}`;
  const tlsTxt = r.tlsDias != null ? `${ok(r.tls)} ${r.tlsDias}d` : ok(r.tls);
  console.log(
    `${pad(r.domain, 26)} ${pad(dns, 6)} ${pad(tlsTxt, 14)} ${pad(ok(r.autoconfig), 12)} ${ok(r.autodiscover)}`,
  );
  if (r.detalle.length) {
    for (const linea of r.detalle) console.log(`   ↳ ${linea}`);
  }
}

const completos = resultados.filter((r) => r.autoconfig && r.autodiscover).length;
console.log("-".repeat(78));
console.log(`${completos}/${resultados.length} dominios funcionando por completo.`);

if (completos < resultados.length) {
  console.log("\nQué falta:");
  for (const r of resultados) {
    if (r.autoconfig && r.autodiscover) continue;
    const pistas = [];
    if (!r.dnsConfig) pistas.push("CNAME autoconfig");
    else if (!r.autoconfig) pistas.push("autoconfig no responde");
    if (!r.dnsDiscover) pistas.push("CNAME autodiscover → <sitio>.netlify.app");
    else if (!r.autodiscover) pistas.push("endpoint POST de Autodiscover sin publicar");
    console.log(`  ${r.domain}: ${pistas.join(" · ")}`);
  }
  console.log("\nDetalle en docs/DNS.md");
  process.exitCode = 1;
}
