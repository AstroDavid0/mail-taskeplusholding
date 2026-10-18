#!/usr/bin/env node
/**
 * Generador de archivos derivados.
 * ---------------------------------------------------------------------------
 * Entrada:  domains.js  (única fuente de verdad)
 * Salida:   mail/config-v1.1.xml
 *           .well-known/autoconfig/mail/config-v1.1.xml
 *           autodiscover/autodiscover.xml
 *           netlify/edge-functions/autodiscover.mjs
 *
 * Uso:
 *   node scripts/build.mjs            # escribe los archivos
 *   node scripts/build.mjs --check    # no escribe; falla (exit 1) si hay diferencias
 *
 * Los XML estáticos existen para GitHub Pages, que solo puede servir UN dominio
 * (el primero de domains.js). Todo lo demás lo sirve la edge function, que
 * resuelve el dominio por el Host de la petición.
 */

import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DOMAINS, PRIMARY_DOMAIN } from "../domains.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const TEMPLATE = path.join(ROOT, "scripts/templates/edge-autodiscover.mjs.tmpl");
const EDGE_OUT = path.join(ROOT, "netlify/edge-functions/autodiscover.mjs");

const GENERATED_NOTE = (source) =>
  `  <!-- Archivo GENERADO por scripts/build.mjs desde domains.js. No editar a mano. -->`;

/** Carga el handler generado para reutilizar sus generadores de XML. */
async function loadGenerated(edgeSource) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mail-config-"));
  const file = path.join(dir, "edge.mjs");
  await writeFile(file, edgeSource, "utf8");
  try {
    return await import(pathToFileURL(file).href);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Pone un comentario justo después de la declaración XML (que debe ir primera). */
function withNote(xml, note) {
  const [first, ...rest] = xml.split("\n");
  return [first, note, ...rest.slice(0)].join("\n");
}

async function main() {
  if (!PRIMARY_DOMAIN) {
    console.error("domains.js no tiene dominios definidos.");
    process.exit(1);
  }

  const template = await readFile(TEMPLATE, "utf8");
  if (!template.includes("/* @DOMAINS@ */ []")) {
    console.error("La plantilla no tiene el marcador /* @DOMAINS@ */ []");
    process.exit(1);
  }

  const edgeSource = template.replace("/* @DOMAINS@ */ []", JSON.stringify(DOMAINS, null, 2));
  const mod = await loadGenerated(edgeSource);

  const primary = DOMAINS[0];
  const autoconfigXml = withNote(
    mod.buildAutoconfig(primary),
    GENERATED_NOTE(),
  );
  const autodiscoverXml = withNote(
    mod.buildAutodiscover(primary, ""),
    `  <!-- Archivo GENERADO por scripts/build.mjs desde domains.js. No editar a mano.
       Estático: sirve a clientes que consultan con GET. Outlook usa POST y
       necesita la edge function (GitHub Pages responde 405 a POST). -->`,
  );

  const outputs = new Map([
    ["mail/config-v1.1.xml", autoconfigXml + "\n"],
    [".well-known/autoconfig/mail/config-v1.1.xml", autoconfigXml + "\n"],
    ["autodiscover/autodiscover.xml", autodiscoverXml + "\n"],
    ["netlify/edge-functions/autodiscover.mjs", edgeSource],
  ]);

  let drift = 0;

  for (const [relative, content] of outputs) {
    const target = path.join(ROOT, relative);
    let current = null;
    try {
      current = await readFile(target, "utf8");
    } catch {
      current = null;
    }

    if (CHECK) {
      if (current !== content) {
        drift += 1;
        console.error(`desactualizado: ${relative}`);
      }
      continue;
    }

    if (current === content) {
      console.log(`sin cambios:  ${relative}`);
      continue;
    }

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    console.log(`escrito:      ${relative}`);
  }

  if (CHECK) {
    if (drift > 0) {
      console.error(`\n${drift} archivo(s) desactualizado(s). Corre: node scripts/build.mjs`);
      process.exit(1);
    }
    console.log("Todo sincronizado con domains.js");
    return;
  }

  console.log("\nDominios publicados:");
  for (const cfg of DOMAINS) {
    const alias = (cfg.aliases || []).length ? ` (alias: ${cfg.aliases.join(", ")})` : "";
    console.log(
      `  ${cfg.domain}${alias} -> IMAP ${cfg.imap.host}:${cfg.imap.port} | SMTP ${cfg.smtp.host}:${cfg.smtp.port}`,
    );
  }
  console.log(`\nGitHub Pages sirve solo: https://autoconfig.${PRIMARY_DOMAIN}/`);
  console.log("Autodiscover (POST) necesita la edge function en Netlify.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
