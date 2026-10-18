#!/usr/bin/env node
/**
 * Inspector de dominios de correo.
 * ---------------------------------------------------------------------------
 * Para cada dominio:
 *   1. lee el registro MX
 *   2. prueba IMAP 993 y SMTP 465/587 con TLS real
 *   3. valida que el certificado cubra el hostname
 *   4. imprime una entrada lista para pegar en domains.js
 *
 * Uso:
 *   node scripts/inspect-domain.mjs dominio1.com dominio2.com ...
 *
 * Solo diagnostica: no modifica nada.
 */

import { resolveMx } from "node:dns/promises";
import tls from "node:tls";
import net from "node:net";

const TIMEOUT = 9000;

function probeTls(host, port) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate() || {};
      const authorized = socket.authorized;
      let banner = "";
      socket.on("data", (chunk) => {
        banner += chunk.toString("utf8");
        if (banner.length > 80) socket.destroy();
      });
      socket.on("close", () =>
        done({
          ok: authorized,
          cn: cert.subject?.CN || "",
          san: (cert.subjectaltname || "").replace(/DNS:/g, ""),
          banner: banner.split(/\r?\n/)[0].slice(0, 90),
        }),
      );
      setTimeout(() => socket.destroy(), 1800);
    });

    socket.on("error", (error) => done({ ok: false, error: error.message }));
    socket.setTimeout(TIMEOUT, () => socket.destroy());
  });
}

function probeTcp(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(TIMEOUT, () => socket.destroy());
    socket.on("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

const pinta = (estado) => (estado ? "✅" : "❌");

async function inspect(domain) {
  console.log(`\n=== ${domain} ===`);

  let mx = [];
  try {
    mx = await resolveMx(domain);
  } catch (error) {
    console.log(`  ${pinta(false)} MX: ${error.code || error.message}`);
  }

  if (mx.length) {
    mx.sort((a, b) => a.priority - b.priority);
    for (const record of mx) console.log(`  MX ${record.priority} ${record.exchange}`);
  } else {
    console.log(`  ${pinta(false)} sin registros MX (¿dominio sin correo?)`);
  }

  const host = mx.length ? mx[0].exchange.replace(/\.$/, "") : "";
  if (!host) return null;

  const [imap993, smtp465, smtp587] = await Promise.all([
    probeTls(host, 993),
    probeTls(host, 465),
    probeTcp(host, 587),
  ]);

  const describe = (nombre, result) => {
    if (result.true === true) return console.log(`  ${pinta(true)} ${nombre}: puerto abierto (sin TLS verificado)`);
    if (result.error) return console.log(`  ${pinta(false)} ${nombre}: ${result.error}`);
    console.log(
      `  ${pinta(result.ok)} ${nombre}: cert CN=${result.cn || "-"} | ${result.banner || "sin banner"}`,
    );
  };

  describe("IMAP 993", imap993);
  describe("SMTP 465", smtp465);
  console.log(`  ${pinta(smtp587 === true)} SMTP 587 (STARTTLS) ${smtp587 ? "abierto" : "cerrado"}`);

  const certOk = imap993.cn && imap993.cn.toLowerCase().includes(host.split(".")[0].toLowerCase());
  if (!certOk) {
    console.log(`  ⚠️  el certificado no parece cubrir ${host}; usar el host del certificado como servidor`);
  }

  const entrada = {
    domain,
    displayName: domain,
    displayShortName: domain.split(".")[0],
    aliases: [],
    imap: { host: certOk ? host : imap993.cn || host, port: 993, socket: "SSL" },
    smtp: { host: certOk ? host : imap993.cn || host, port: smtp465.banner ? 465 : 587, socket: smtp465.banner ? "SSL" : "STARTTLS" },
  };

  console.log("  → entrada para domains.js:");
  console.log(
    JSON.stringify(entrada, null, 2)
      .split("\n")
      .map((line) => "     " + line)
      .join("\n"),
  );

  return entrada;
}

const dominios = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
if (!dominios.length) {
  console.error("Uso: node scripts/inspect-domain.mjs dominio1.com [dominio2.com ...]");
  process.exit(1);
}

for (const dominio of dominios) {
  await inspect(dominio.trim().toLowerCase());
}
