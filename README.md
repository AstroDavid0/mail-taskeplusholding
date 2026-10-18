# mail-taskeplusholding

Configuración pública de correo de **taskeplusholding.com** (MXroute), publicada como sitio estático
en **https://autoconfig.taskeplusholding.com/** para que los gestores de correo reconozcan el dominio
y traigan solos los datos de conexión.

Servidor de correo real: `chocobo.mxrouting.net` · IMAP 993 SSL · SMTP 465 SSL ·
usuario = la dirección de correo completa.

## Fuente de verdad

`domains.js` (hoy con un solo dominio). Se edita **solo eso** y luego:

```bash
node scripts/build.mjs          # regenera los archivos derivados
node scripts/build.mjs --check  # falla si hay algo desincronizado
```

Derivados (llevan un aviso *GENERADO* dentro): `mail/config-v1.1.xml`,
`.well-known/autoconfig/mail/config-v1.1.xml`, `autodiscover/autodiscover.xml`,
`netlify/edge-functions/autodiscover.mjs`.

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `domains.js` | **Fuente única de verdad**: dominio, nombre visible y servidores. |
| `scripts/build.mjs` | Genera todo lo derivado desde `domains.js`. |
| `scripts/verify-domains.mjs` | Comprueba en producción: DNS, TLS, autoconfig GET y autodiscover POST. |
| `scripts/inspect-domain.mjs` | Diagnostica un dominio nuevo (MX, TLS, IMAP/SMTP) y da la entrada lista. |
| `mail/config-v1.1.xml` | **Autoconfig** (formato Mozilla). |
| `.well-known/autoconfig/mail/config-v1.1.xml` | Copia de respaldo del mismo XML. |
| `autodiscover/autodiscover.xml` | **Autodiscover POX** estático (clientes que consultan con GET). |
| `netlify/edge-functions/autodiscover.mjs` | Endpoint dinámico que responde **POST** y rellena `<LoginName>`. |
| `netlify.toml` | Rutas del endpoint en Netlify. |
| `serverless/cloudflare-worker.mjs` | Envoltorio equivalente para Cloudflare Workers. |
| `assets/profile.js` | Generador del perfil `.mobileconfig` de Apple. |
| `index.html` | Portada: ajustes, generador de perfil Apple y estado por cliente. |
| `docs/DNS.md` | Registros DNS exactos y verificación. |
| `docs/CLIENTES.md` | Configuración manual por gestor. |
| `.nojekyll` | Evita que GitHub Pages procese el sitio con Jekyll (protege `.well-known/`). |

## Los tres mecanismos

1. **Autoconfig (Mozilla)** — `GET https://autoconfig.taskeplusholding.com/mail/config-v1.1.xml`.
   Estático, ya publicado. Lo entienden Thunderbird, K-9 / Thunderbird Android, FairEmail, Evolution.
2. **Autodiscover (Microsoft)** — `POST https://autodiscover.taskeplusholding.com/autodiscover/autodiscover.xml`.
   Lo usan Outlook, Windows Mail, eM Client, Mailbird y Apple Mail en modo Autodiscover.
   **Necesita la edge function**: GitHub Pages contesta `405` a POST.
3. **Perfil Apple** — `.mobileconfig` generado en el navegador desde `index.html`, sin backend.

## Estado

- ✅ Autoconfig: publicado y verificado (200, `application/xml`, TLS válido).
- ✅ Portada con ajustes y generador de perfil Apple: publicada y probada en navegador real.
- ✅ Perfil Apple: funciona hoy, sin DNS ni servidor extra.
- ⏳ Autodiscover (Outlook): archivos listos; falta el sitio Netlify y el `CNAME autodiscover`.
  Mientras tanto, Outlook se configura a mano (30 segundos, ver `docs/CLIENTES.md`).

## Verificación

```bash
node scripts/verify-domains.mjs     # DNS + TLS + autoconfig + autodiscover de una vez
node scripts/build.mjs --check
curl -sI  https://autoconfig.taskeplusholding.com/mail/config-v1.1.xml   # 200
```

## Para publicar otro dominio (plan futuro)

La estructura está pensada para clonar: **un repo y una GitHub Page por dominio**.

1. `node scripts/inspect-domain.mjs otrodominio.com` → te da la entrada lista.
2. Clonar este repo, reemplazar la entrada de `domains.js` y correr `node scripts/build.mjs`.
3. Cambiar el archivo `CNAME` a `autoconfig.otrodominio.com` y publicar la Page.
4. DNS: `CNAME autoconfig` → `<usuario>.github.io`.

Si además se quiere **Outlook** en ese dominio hace falta el endpoint POST: un sitio Netlify por
dominio, o —más simple— **un solo sitio Netlify con varios dominios** añadidos en *Domain management*.
GitHub Pages nunca podrá hacer esa parte.

## Notas

- El XML usa `password-cleartext` porque la conexión es SSL/TLS; el estándar prohíbe esa
  autenticación sin cifrado, y aquí nunca viaja en claro.
- No hay contraseñas en el repositorio: solo servidores, puertos y el formato del usuario.
- Si el dominio resultara **alias** de otro en MXroute, se resuelve con `loginTemplate` en
  `domains.js` (ver `docs/DNS.md`).
