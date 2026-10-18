/**
 * Endpoint de autoconfiguración de correo (multi-dominio).
 * ---------------------------------------------------------------------------
 * ARCHIVO GENERADO por scripts/build.mjs a partir de domains.js.
 * No editar a mano: los cambios se pierden en la próxima ejecución.
 *
 * Responde, según el Host de la petición, a los dos estándares:
 *
 *   1) Autoconfig Mozilla   GET  /mail/config-v1.1.xml
 *      (Thunderbird, K-9 / Thunderbird Android, FairEmail, Evolution…)
 *
 *   2) Autodiscover POX     POST /autodiscover/autodiscover.xml
 *      (Outlook 2007+, Outlook for Mac, Windows Mail, eM Client, Mailbird,
 *       Apple Mail en modo Autodiscover). Outlook usa POST y manda el email
 *       en el cuerpo XML; por eso este endpoint NO puede ser estático:
 *       GitHub Pages contesta 405 a POST.
 *
 * Despliegue: Netlify (netlify.toml + esta carpeta). Un solo sitio puede
 * tener N dominios personalizados, cada uno con su certificado TLS; el Host
 * decide qué configuración se sirve.
 */

const DOMAINS = [
  {
    "domain": "taskeplusholding.com",
    "displayName": "Task Eplus Holding",
    "displayShortName": "Task Eplus",
    "aliases": [],
    "imap": {
      "host": "chocobo.mxrouting.net",
      "port": 993,
      "socket": "SSL"
    },
    "smtp": {
      "host": "chocobo.mxrouting.net",
      "port": 465,
      "socket": "SSL"
    }
  },
  {
    "domain": "taskeplusholdingllc.com",
    "displayName": "Task Eplus Holding LLC",
    "displayShortName": "Task Eplus LLC",
    "aliases": [],
    "imap": {
      "host": "chocobo.mxrouting.net",
      "port": 993,
      "socket": "SSL"
    },
    "smtp": {
      "host": "chocobo.mxrouting.net",
      "port": 465,
      "socket": "SSL"
    }
  },
  {
    "domain": "epluservices.com",
    "displayName": "Eplus Services",
    "displayShortName": "Eplus",
    "aliases": [],
    "imap": {
      "host": "chocobo.mxrouting.net",
      "port": 993,
      "socket": "SSL"
    },
    "smtp": {
      "host": "chocobo.mxrouting.net",
      "port": 465,
      "socket": "SSL"
    }
  },
  {
    "domain": "vencox.com",
    "displayName": "Vencox",
    "displayShortName": "Vencox",
    "aliases": [],
    "imap": {
      "host": "chocobo.mxrouting.net",
      "port": 993,
      "socket": "SSL"
    },
    "smtp": {
      "host": "chocobo.mxrouting.net",
      "port": 465,
      "socket": "SSL"
    }
  }
];

const XML_HEADERS = {
  "content-type": "text/xml; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
};

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

const escapeXml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
  );

const byName = new Map();
for (const cfg of DOMAINS) {
  byName.set(normalize(cfg.domain), cfg);
  for (const alias of cfg.aliases || []) byName.set(normalize(alias), cfg);
}

/** Host -> configuración del dominio (o null si el dominio no está publicado). */
export function resolveDomain(host) {
  const value = normalize(host).split(":")[0];
  for (const prefix of ["autoconfig.", "autodiscover.", "mail."]) {
    if (value.startsWith(prefix)) {
      const cfg = byName.get(value.slice(prefix.length));
      if (cfg) return cfg;
    }
  }
  return byName.get(value) || null;
}

export function extractEmail(raw = "") {
  const match = /<(?:EMailAddress|EmailAddress|emailaddress)[^>]*>([^<]+)</i.exec(raw);
  return match ? match[1].trim() : "";
}

/**
 * Usuario de autenticación para un dominio.
 *
 * Por defecto es la dirección completa. Si el dominio es un alias de otro en
 * MXroute (no tiene buzones propios), se configura `loginTemplate`, p. ej.:
 *   loginTemplate: "%EMAILLOCALPART%@taskeplusholding.com"
 *
 * Marcadores: %EMAILADDRESS%, %EMAILLOCALPART%, %EMAILDOMAIN%.
 */
export function applyLogin(cfg, email) {
  if (!email) return "";
  const template = cfg.loginTemplate || "%EMAILADDRESS%";
  const at = email.lastIndexOf("@");
  const local = at > 0 ? email.slice(0, at) : email;
  const domain = at > 0 ? email.slice(at + 1) : "";
  return template
    .replace(/%EMAILADDRESS%/gi, email)
    .replace(/%EMAILLOCALPART%/gi, local)
    .replace(/%EMAILDOMAIN%/gi, domain);
}

const loginTag = (cfg, email) => {
  const login = applyLogin(cfg, email);
  return login ? `\n        <LoginName>${escapeXml(login)}</LoginName>` : "";
};

/** Respuesta POX: la que entienden Outlook, Apple Mail y demás. */
export function buildAutodiscover(cfg, email = "") {
  const login = loginTag(cfg, email);
  return `<?xml version="1.0" encoding="utf-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">
  <Response xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a">
    <User>
      <DisplayName>${escapeXml(cfg.displayName)}</DisplayName>
    </User>
    <Account>
      <AccountType>email</AccountType>
      <Action>settings</Action>
      <Protocol>
        <Type>IMAP</Type>
        <Server>${escapeXml(cfg.imap.host)}</Server>
        <Port>${cfg.imap.port}</Port>${login}
        <SSL>${cfg.imap.socket === "SSL" ? "on" : "off"}</SSL>
        <Encryption>${escapeXml(cfg.imap.socket)}</Encryption>
        <SPA>off</SPA>
        <AuthRequired>on</AuthRequired>
        <TTL>1</TTL>
      </Protocol>
      <Protocol>
        <Type>SMTP</Type>
        <Server>${escapeXml(cfg.smtp.host)}</Server>
        <Port>${cfg.smtp.port}</Port>${login}
        <SSL>${cfg.smtp.socket === "SSL" ? "on" : "off"}</SSL>
        <Encryption>${escapeXml(cfg.smtp.socket)}</Encryption>
        <SPA>off</SPA>
        <AuthRequired>on</AuthRequired>
        <UsePOPAuth>off</UsePOPAuth>
        <SMTPLast>off</SMTPLast>
        <TTL>1</TTL>
      </Protocol>
    </Account>
  </Response>
</Autodiscover>`;
}

/** Respuesta autoconfig de Mozilla. */
export function buildAutoconfig(cfg) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="${escapeXml(cfg.domain)}">
    <domain>${escapeXml(cfg.domain)}</domain>
    <displayName>${escapeXml(cfg.displayName)}</displayName>
    <displayShortName>${escapeXml(cfg.displayShortName || cfg.displayName)}</displayShortName>
    <incomingServer type="imap">
      <hostname>${escapeXml(cfg.imap.host)}</hostname>
      <port>${cfg.imap.port}</port>
      <socketType>${escapeXml(cfg.imap.socket)}</socketType>
      <authentication>password-cleartext</authentication>
      <username>${escapeXml(cfg.loginTemplate || "%EMAILADDRESS%")}</username>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>${escapeXml(cfg.smtp.host)}</hostname>
      <port>${cfg.smtp.port}</port>
      <socketType>${escapeXml(cfg.smtp.socket)}</socketType>
      <authentication>password-cleartext</authentication>
      <username>${escapeXml(cfg.loginTemplate || "%EMAILADDRESS%")}</username>
    </outgoingServer>
    <documentation url="https://autoconfig.${escapeXml(cfg.domain)}/">
      <descr lang="es">Configuración automática del correo de ${escapeXml(cfg.displayName)}</descr>
      <descr lang="en">${escapeXml(cfg.displayName)} automatic mail setup</descr>
    </documentation>
  </emailProvider>
</clientConfig>`;
}

async function handler(request) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      },
    });
  }

  const cfg = resolveDomain(url.hostname);
  if (!cfg) {
    const known = DOMAINS.map((d) => d.domain).join(", ");
    return new Response(
      `Dominio no publicado: ${url.hostname}\nDominios configurados: ${known}\n`,
      { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  if (url.pathname.endsWith("config-v1.1.xml")) {
    return new Response(buildAutoconfig(cfg), { headers: XML_HEADERS });
  }

  let email = url.searchParams.get("emailaddress") || url.searchParams.get("email") || "";
  if (!email && request.method !== "GET") {
    try {
      email = extractEmail(await request.text());
    } catch {
      email = "";
    }
  }

  return new Response(buildAutodiscover(cfg, email), { headers: XML_HEADERS });
}

export default handler;
