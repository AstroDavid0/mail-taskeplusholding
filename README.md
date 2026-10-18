# mail-taskeplusholding

Configuración pública de correo para **varios dominios** (MXroute), publicada como sitio estático
para que los gestores reconozcan el dominio y traigan solos los datos de conexión.

Dominio principal (el único que GitHub Pages puede servir): **https://autoconfig.taskeplusholding.com/**
· El resto de dominios los sirve el mismo sitio desplegado en **Netlify** (un sitio, N dominios, TLS automático).

Servidor de correo real: **MXroute** (p. ej. `chocobo.mxrouting.net`: IMAP 993 SSL, SMTP 465 SSL,
usuario = la dirección de correo completa).

## Dominios publicados

| Dominio | Nombre visible | Servidor |
|---|---|---|
| taskeplusholding.com *(principal)* | Task Eplus Holding | chocobo.mxrouting.net · IMAP 993 · SMTP 465 |
| taskeplusholdingllc.com | Task Eplus Holding LLC | chocobo.mxrouting.net · IMAP 993 · SMTP 465 |
| epluservices.com | Eplus Services | chocobo.mxrouting.net · IMAP 993 · SMTP 465 |
| vencox.com | Vencox | chocobo.mxrouting.net · IMAP 993 · SMTP 465 |

Los cuatro están verificados: MX en MXroute, certificado TLS válido, IMAP 993 y SMTP 465 abiertos,
DKIM (selector `x`) y SPF presentes. **Ninguno tiene DMARC** todavía — ver `docs/DNS.md`.

## Fuente de verdad

`domains.js`. Se edita **solo eso** y luego:

```bash
node scripts/build.mjs          # regenera los archivos derivados
node scripts/build.mjs --check  # falla si hay algo desincronizado
```

Los derivados (marcados como *GENERADO* dentro del archivo) son:

`mail/config-v1.1.xml` · `.well-known/autoconfig/mail/config-v1.1.xml` · `autodiscover/autodiscover.xml` · `netlify/edge-functions/autodiscover.mjs`

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `domains.js` | **Fuente única de verdad**: dominio, nombre visible, alias y servidores. |
| `scripts/build.mjs` | Genera todo lo derivado desde `domains.js`. |
| `scripts/inspect-domain.mjs` | Diagnostica un dominio nuevo (MX, TLS, IMAP/SMTP) y escupe la entrada lista. |
| `mail/config-v1.1.xml` | **Autoconfig** (formato Mozilla) del dominio principal. |
| `.well-known/autoconfig/mail/config-v1.1.xml` | Copia de respaldo del mismo XML. |
| `autodiscover/autodiscover.xml` | **Autodiscover POX** estático del dominio principal. |
| `netlify/edge-functions/autodiscover.mjs` | Endpoint dinámico **multi-dominio**: resuelve por `Host`, responde POST y rellena `<LoginName>`. |
| `netlify.toml` | Rutas del endpoint en Netlify. |
| `serverless/cloudflare-worker.mjs` | Envoltorio equivalente para Cloudflare Workers. |
| `assets/profile.js` | Generador del perfil `.mobileconfig` de Apple, por dominio. |
| `index.html` | Página pública: ajustes por dominio, generador de perfil Apple, estado por cliente. |
| `docs/DNS.md` | Registros DNS exactos por dominio. |
| `docs/CLIENTES.md` | Configuración manual por gestor. |
| `.nojekyll` | Evita que GitHub Pages procese el sitio con Jekyll (protege `.well-known/`). |

## Los tres mecanismos

1. **Autoconfig (Mozilla)** — `GET https://autoconfig.<dominio>/mail/config-v1.1.xml`.
   Estático; lo entienden Thunderbird, K-9 / Thunderbird Android, FairEmail, Evolution.
2. **Autodiscover (Microsoft)** — `POST https://autodiscover.<dominio>/autodiscover/autodiscover.xml`.
   Lo usan Outlook, Windows Mail, eM Client, Mailbird y Apple Mail en modo Autodiscover.
   **Necesita la edge function**: GitHub Pages contesta `405` a POST.
3. **Perfil Apple** — `.mobileconfig` generado en el navegador desde `index.html`.
   Es la vía fiable en iOS/macOS: instalado, la cuenta queda lista sin escribir nada.

## Cómo agregar un dominio

```bash
# 1. Diagnosticar el dominio (MX + TLS + IMAP/SMTP) y obtener la entrada
node scripts/inspect-domain.mjs nuevo-dominio.com

# 2. Pegar la entrada en el array DOMAINS de domains.js

# 3. Regenerar y verificar
node scripts/build.mjs
node scripts/build.mjs --check
```

Luego, en DNS (por cada dominio):

| Tipo | Host | Valor |
|---|---|---|
| CNAME | `autoconfig` | `<sitio>.netlify.app` |
| CNAME | `autodiscover` | `<sitio>.netlify.app` |

Y en Netlify, agregar `autoconfig.<dominio>` y `autodiscover.<dominio>` como dominios del sitio
(emite un certificado por nombre, automáticamente). Opcionales pero recomendados: `SRV`
(`_imaps._tcp`, `_submissions._tcp`, `_autodiscover._tcp`), `TXT mailconf` y `DMARC`.
Detalle en `docs/DNS.md`.

## Límite importante

**Un sitio de GitHub Pages = un solo dominio.** Verificado: apuntar `autoconfig.otro.com` al
mismo Pages falla el TLS (`no alternative certificate subject name`) y, aun ignorándolo, responde
`404`. Por eso el dominio principal vive en Pages (sin dependencias) y la cobertura multi-dominio
plus Autodiscover va por Netlify. Si algún día se quiere todo en un solo lugar, mover todo a
Netlify es simplemente cambiar los CNAME.

## Estado actual

- ✅ Autoconfig del dominio principal: publicado y verificado (200, `application/xml`, TLS válido).
- ✅ Perfil Apple: generable desde la web, sin backend.
- ✅ Código multi-dominio: probado con dos dominios simultáneos (Host distinto → servidor distinto).
- ⏳ Despliegue Netlify + CNAME por dominio: pendiente (5 minutos por sitio + 2 registros por dominio).

## Verificación rápida

```bash
curl -sI  https://autoconfig.taskeplusholding.com/mail/config-v1.1.xml          # 200
curl -s   https://autoconfig.taskeplusholding.com/mail/config-v1.1.xml | head   # XML
curl -s -X POST https://autodiscover.taskeplusholding.com/autodiscover/autodiscover.xml \
  -d '<Autodiscover><Request><EMailAddress>ana@taskeplusholding.com</EMailAddress></Request></Autodiscover>'
```

## Notas

- El XML usa `password-cleartext` porque la conexión es SSL/TLS; el estándar prohíbe esa
  autenticación sin cifrado, y aquí nunca viaja en claro.
- No hay contraseñas en el repositorio: solo servidores, puertos y el formato del usuario.
- `aliases` sirve para dominios que son solo de reenvío o variantes: reciben la misma
  configuración que su dominio base.
- Si un dominio **no tiene buzones propios** (es alias de otro en MXroute), su usuario de
  autenticación es el del dominio principal. Se resuelve con un campo, sin tocar código:

  ```js
  loginTemplate: "%EMAILLOCALPART%@taskeplusholding.com"
  ```

  Marcadores disponibles: `%EMAILADDRESS%`, `%EMAILLOCALPART%`, `%EMAILDOMAIN%`.
  La función de `scripts/inspect-domain.mjs` no puede detectarlo (requiere credenciales):
  compruébalo intentando iniciar sesión con un buzón de ese dominio.
