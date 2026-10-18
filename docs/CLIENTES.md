# Configuración manual por gestor

Sirve para **todos** los clientes, pero los valores dependen del dominio. La tabla exacta por
dominio está en la portada (`index.html`, sección 01) y en `domains.js`. Referencia del dominio
principal:

| Campo | Valor |
|---|---|
| Correo | `tu-nombre@taskeplusholding.com` |
| Usuario | el correo completo (`tu-nombre@taskeplusholding.com`) |
| Contraseña | la del buzón |
| IMAP | `chocobo.mxrouting.net` · puerto **993** · SSL/TLS |
| SMTP | `chocobo.mxrouting.net` · puerto **465** · SSL/TLS |
| Autenticación SMTP | obligatoria, misma contraseña |

Para cualquier otro dominio del grupo:

```bash
node scripts/inspect-domain.mjs otrodominio.com
```

Eso te da sus servidores, puertos y una entrada lista para `domains.js`.

Si un cliente no acepta el 465, el 587 con STARTTLS también funciona en MXroute.

## Automático (no hay que hacer nada más que escribir el email)

| Cliente | Mecanismo | Estado |
|---|---|---|
| Thunderbird (escritorio) | Autoconfig `mail/config-v1.1.xml` | ✅ funciona ya |
| Thunderbird Android / K-9 Mail | Autoconfig | ✅ funciona ya |
| FairEmail | Autoconfig | ✅ funciona ya |
| Apple Mail (iOS/macOS) | perfil `.mobileconfig` desde la web | ✅ funciona ya |
| Outlook 2013+ / Microsoft 365 | Autodiscover POX (POST) | ⏳ requiere endpoint (ver `docs/DNS.md`) |
| Outlook for Mac | Autodiscover / SRV `_autodiscover._tcp` | ⏳ requiere endpoint + SRV |
| Windows Mail / Mail (W10-11) | Autodiscover POX | ⏳ requiere endpoint |
| eM Client, Mailbird, BlueMail | Autodiscover POX | ⏳ requiere endpoint |

## Manual paso a paso

### Outlook (Windows / Mac) sin Autodiscover
1. *Archivo → Agregar cuenta → Configuración manual*.
2. Tipo de cuenta **IMAP**.
3. Entrante `chocobo.mxrouting.net` 993 SSL · Saliente `chocobo.mxrouting.net` 465 SSL.
4. Usuario = correo completo; contraseña la del buzón.
5. Si pide «Requiere inicio de sesión (SPA)»: **desmarcado**.

### Apple Mail (iPhone / iPad) manual, si no se usa el perfil
1. *Ajustes → Mail → Cuentas → Agregar cuenta → Otra → Agregar cuenta de correo*.
2. Nombre, email y contraseña → *Siguiente*.
3. Entrante: `chocobo.mxrouting.net`, usuario = email, contraseña.
4. Saliente: `chocobo.mxrouting.net`, usuario = email, contraseña, SSL activado.

### Apple Mail (Mac) manual
*Mail → Cuentas → Agregar otra cuenta → Cuenta de Mail*, mismo esquema que arriba.

### Thunderbird manual
*Configuración manual de la cuenta*: IMAP 993 SSL/TLS · SMTP 465 SSL/TLS · autenticación
«Contraseña normal» · usuario = correo completo.

### Gmail para Android / iOS
Gmail no lee archivos de autoconfiguración, siempre es manual:
1. *Añadir cuenta → Otro → Configuración manual (IMAP)*.
2. Servidor entrante `chocobo.mxrouting.net` puerto 993, SSL/TLS, usuario = email.
3. Servidor saliente `chocobo.mxrouting.net` puerto 465, SSL/TLS, usuario = email.

### Samsung Mail
*Agregar cuenta → Otro → Configuración manual*; mismos valores (993 / 465, SSL/TLS).

### Evolution (Linux)
*Recepción: IMAP+ SSL, `chocobo.mxrouting.net:993`* ·
*Envío: SMTP, `chocobo.mxrouting.net:465`, SSL, autenticación con contraseña*.

## Diagnóstico rápido

```bash
# ¿el servidor responde?
openssl s_client -connect chocobo.mxrouting.net:993 -servername chocobo.mxrouting.net </dev/null | head -2
openssl s_client -connect chocobo.mxrouting.net:465 -servername chocobo.mxrouting.net </dev/null | head -3

# ¿el certificado es válido?
openssl s_client -connect chocobo.mxrouting.net:993 -servername chocobo.mxrouting.net </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -dates
```

Errores típicos:

| Síntoma | Causa probable |
|---|---|
| «Autenticación fallida» | Usuario escrito sin `@taskeplusholding.com` |
| Timeout en el envío | Puerto 25 bloqueado por el proveedor de internet → usar 465/587 |
| Aviso de certificado | Cliente conectando por IP o por un host antiguo |
| Outlook insiste en buscar el servidor | No existe `autodiscover.taskeplusholding.com` (ver `docs/DNS.md`) |
