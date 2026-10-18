/**
 * Generador de perfiles de configuración de Apple (.mobileconfig)
 * ---------------------------------------------------------------------------
 * Apple Mail (iPhone, iPad, Mac) es el caso donde el descubrimiento automático
 * NO es fiable: además de intentar Autodiscover, Apple espera un perfil firmado
 * o instalado a mano. Un .mobileconfig deja la cuenta configurada al 100% sin
 * que el usuario escriba servidores, puertos ni SSL.
 *
 * Multi-dominio: el servidor se resuelve a partir del dominio del email usando
 * domains.js. Si el dominio no está publicado, `buildProfile` devuelve null.
 *
 * El perfil se genera en el propio navegador: el email se queda en el
 * dispositivo y no viaja a ningún servidor.
 */

import { findDomainByEmail, applyLogin } from "../domains.js";

const escapeXml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
  );

const uuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().toUpperCase();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
};

export const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(email).trim());

/** Dominio publicado para esa dirección de correo (o null). */
export const domainForEmail = (email) => findDomainByEmail(email);

/** Devuelve el XML del perfil listo para instalar, o null si el dominio no está publicado. */
export function buildProfile(email) {
  const address = String(email).trim();
  const cfg = findDomainByEmail(address);
  if (!cfg) return null;

  const username = applyLogin(cfg, address) || address;
  const mailUuid = uuid();

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.mail.managed</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>com.${escapeXml(cfg.domain)}.mail.account.${mailUuid}</string>
      <key>PayloadUUID</key>
      <string>${mailUuid}</string>
      <key>PayloadDisplayName</key>
      <string>${escapeXml(cfg.displayName)}</string>
      <key>PayloadDescription</key>
      <string>Cuenta IMAP/SMTP de ${escapeXml(cfg.displayName)}</string>
      <key>PayloadOrganization</key>
      <string>${escapeXml(cfg.displayName)}</string>
      <key>EmailAccountName</key>
      <string>${escapeXml(cfg.displayName)}</string>
      <key>EmailAccountDescription</key>
      <string>${escapeXml(address)}</string>
      <key>EmailAccountType</key>
      <string>EmailTypeIMAP</string>
      <key>EmailAddress</key>
      <string>${escapeXml(address)}</string>
      <key>IncomingMailServerAuthentication</key>
      <string>EmailAuthPassword</string>
      <key>IncomingMailServerHostName</key>
      <string>${escapeXml(cfg.imap.host)}</string>
      <key>IncomingMailServerPortNumber</key>
      <integer>${cfg.imap.port}</integer>
      <key>IncomingMailServerUseSSL</key>
      <${cfg.imap.socket === "SSL" ? "true" : "false"}/>
      <key>IncomingMailServerUsername</key>
      <string>${escapeXml(username)}</string>
      <key>OutgoingMailServerAuthentication</key>
      <string>EmailAuthPassword</string>
      <key>OutgoingMailServerHostName</key>
      <string>${escapeXml(cfg.smtp.host)}</string>
      <key>OutgoingMailServerPortNumber</key>
      <integer>${cfg.smtp.port}</integer>
      <key>OutgoingMailServerUseSSL</key>
      <${cfg.smtp.socket === "SSL" ? "true" : "false"}/>
      <key>OutgoingMailServerUsername</key>
      <string>${escapeXml(username)}</string>
      <key>OutgoingPasswordSameAsIncomingPassword</key>
      <true/>
      <key>SMIMEEnabled</key>
      <false/>
      <key>disableMailRecentsSyncing</key>
      <false/>
    </dict>
  </array>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadIdentifier</key>
  <string>com.${escapeXml(cfg.domain)}.mail.${uuid()}</string>
  <key>PayloadUUID</key>
  <string>${uuid()}</string>
  <key>PayloadDisplayName</key>
  <string>Correo ${escapeXml(cfg.displayName)}</string>
  <key>PayloadDescription</key>
  <string>Configura automáticamente la cuenta de correo @${escapeXml(cfg.domain)} (IMAP + SMTP)</string>
  <key>PayloadOrganization</key>
  <string>${escapeXml(cfg.displayName)}</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>HasRemovalPasscode</key>
  <false/>
</dict>
</plist>
`;
}

/** Nombre de archivo sugerido, sin caracteres problemáticos. */
export function profileFileName(email) {
  const value = String(email).trim();
  const cfg = findDomainByEmail(value);
  const domain = cfg ? cfg.domain : value.split("@")[1] || "correo";
  const local = value.split("@")[0].replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  return `${domain}-${local || "correo"}.mobileconfig`;
}
