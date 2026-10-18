/**
 * FUENTE ÚNICA DE VERDAD de los dominios de correo.
 * ---------------------------------------------------------------------------
 * Editar SOLO este archivo y luego correr `node scripts/build.mjs` para
 * regenerar los archivos derivados:
 *
 *   mail/config-v1.1.xml
 *   .well-known/autoconfig/mail/config-v1.1.xml
 *   autodiscover/autodiscover.xml
 *   netlify/edge-functions/autodiscover.mjs
 *
 * Los archivos generados llevan un aviso de "no editar a mano".
 *
 * Campos por dominio
 * ------------------
 *   domain             dominio del correo (el que va después de la @)
 *   displayName        nombre visible en el cliente de correo
 *   displayShortName   nombre corto (Thunderbird)
 *   aliases            dominios extra que deben recibir esta misma config
 *                      (útil para variantes o dominios solo de reenvío)
 *   loginTemplate      OPCIONAL. Usuario de autenticación cuando no es la
 *                      dirección completa. Por defecto "%EMAILADDRESS%".
 *                      Si el dominio es alias de otro en MXroute (recebe correo
 *                      pero no tiene buzones propios), usar p. ej.
 *                      "%EMAILLOCALPART%@taskeplusholding.com"
 *   imap / smtp        host, puerto y socket ("SSL" | "STARTTLS")
 *
 * Ojo: `host` debe ser un nombre con certificado TLS válido. En MXroute vale
 * el host del servidor (p. ej. chocobo.mxrouting.net); un hostname propio tipo
 * mail.sudominio.com sirve solo si también tiene certificado.
 *
 * En MXroute, por defecto, el usuario del buzón es la dirección completa.
 */

export const DOMAINS = [
  {
    domain: "taskeplusholding.com",
    displayName: "Task Eplus Holding",
    displayShortName: "Task Eplus",
    aliases: [],
    imap: { host: "chocobo.mxrouting.net", port: 993, socket: "SSL" },
    smtp: { host: "chocobo.mxrouting.net", port: 465, socket: "SSL" },
  },
];

/* ------------------------------------------------------------------ */
/* Utilidades compartidas (edge function, generador y navegador)       */
/* ------------------------------------------------------------------ */

export const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

/** El primer dominio de la lista es el que se publica en GitHub Pages. */
export const PRIMARY_DOMAIN = DOMAINS[0]?.domain ?? "";

export const siteUrl = (domain = PRIMARY_DOMAIN) => `https://autoconfig.${domain}/`;

/** Busca por dominio exacto o por alias. Devuelve el objeto de configuración. */
export function findDomain(name) {
  const target = normalize(name);
  if (!target) return null;
  for (const cfg of DOMAINS) {
    if (normalize(cfg.domain) === target) return cfg;
    if ((cfg.aliases || []).some((alias) => normalize(alias) === target)) return cfg;
  }
  return null;
}

/** Busca por dirección de correo (usa lo que va después de la @). */
export function findDomainByEmail(email) {
  const value = String(email ?? "").trim();
  const at = value.lastIndexOf("@");
  if (at < 1) return null;
  return findDomain(value.slice(at + 1));
}

/**
 * Usuario de autenticación para una dirección, según `loginTemplate` del dominio.
 * Marcadores: %EMAILADDRESS%, %EMAILLOCALPART%, %EMAILDOMAIN%.
 */
export function applyLogin(cfg, email) {
  if (!cfg) return "";
  const value = String(email ?? "").trim();
  if (!value) return "";
  const template = cfg.loginTemplate || "%EMAILADDRESS%";
  const at = value.lastIndexOf("@");
  const local = at > 0 ? value.slice(0, at) : value;
  const domain = at > 0 ? value.slice(at + 1) : "";
  return template
    .replace(/%EMAILADDRESS%/gi, value)
    .replace(/%EMAILLOCALPART%/gi, local)
    .replace(/%EMAILDOMAIN%/gi, domain);
}

/**
 * Resuelve el dominio a partir del Host de la petición:
 *   autoconfig.dominio.com  -> dominio.com
 *   autodiscover.dominio.com -> dominio.com
 *   mail.dominio.com        -> dominio.com
 *   dominio.com             -> dominio.com
 */
export function domainFromHost(host) {
  const value = normalize(host).split(":")[0];
  for (const prefix of ["autoconfig.", "autodiscover.", "mail."]) {
    if (value.startsWith(prefix)) {
      const cfg = findDomain(value.slice(prefix.length));
      if (cfg) return cfg;
    }
  }
  return findDomain(value);
}
