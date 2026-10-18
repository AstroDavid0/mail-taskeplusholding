# Registros DNS — taskeplusholding.com

DNS en **Namecheap** (`dns1/dns2.registrar-servers.com`). Estado verificado:

| Registro | Estado |
|---|---|
| `MX` 10 `chocobo.mxrouting.net` / 20 `chocobo-relay.mxrouting.net` | ✅ correcto, no tocar |
| `SPF` `v=spf1 include:mxroute.com -all` | ✅ correcto, no tocar |
| DKIM selector `x` | ✅ presente, no tocar |
| `CNAME autoconfig` → `astrodavid0.github.io` | ✅ funciona (Thunderbird, K-9, FairEmail) |
| `CNAME autodiscover` | ❌ no existe → Outlook va a mano |
| `TXT _dmarc` | ❌ no existe |

## 1. Autodiscover (lo único que falta para que Outlook funcione solo)

> GitHub Pages **no puede** servir esto: contesta **405 a POST**, y Outlook usa POST.
> Verificado. Necesita un endpoint con funciones; la ruta más simple es Netlify
> (gratis, certificado TLS automático, sin mover el DNS).

| Tipo  | Host           | Valor                  |
|-------|----------------|------------------------|
| CNAME | `autodiscover` | `<sitio>.netlify.app.` |

Pasos:

1. Netlify → *Add new site → Import an existing project* → este repo
   (ya trae `netlify.toml` y `netlify/edge-functions/autodiscover.mjs`; build vacío, publish `.`).
   ⚠️ Tiene que ser *Import from Git*: con "Netlify Drop" no se despliega la edge function.
2. *Domain management → Add a domain* → `autodiscover.taskeplusholding.com`.
3. Crear el `CNAME` de la tabla. Netlify emite el certificado en minutos.
4. Verificar:

```bash
curl -s -X POST https://autodiscover.taskeplusholding.com/autodiscover/autodiscover.xml \
  -H 'Content-Type: text/xml' \
  -d '<Autodiscover><Request><EMailAddress>ana@taskeplusholding.com</EMailAddress></Request></Autodiscover>'
```

Debe devolver el XML con `<LoginName>ana@taskeplusholding.com</LoginName>`.

Si no se publica, no pasa nada grave: Outlook/Windows Mail se configuran a mano con los datos de la
portada (`index.html`, sección 01). Thunderbird, K-9, FairEmail y Apple no dependen de esto.

## 2. Recomendados

### DMARC (falta) — lo más importante para un correo de empresa

| Host     | Tipo | Valor |
|----------|------|-------|
| `_dmarc` | TXT  | `v=DMARC1; p=none; rua=mailto:dmarc@taskeplusholding.com; adkim=r; aspf=r; pct=100` |

Empezar en `p=none` (solo informa). Tras unas semanas de informes, subir a `p=quarantine` y luego a
`p=reject`. El buzón `dmarc@` debe existir o ser un alias que reciba.

### Pistas de descubrimiento opcionales

| Host (Namecheap: Service / Protocol) | Prioridad | Peso | Puerto | Target |
|---|---|---|---|---|
| `_imaps` / `_tcp`        | 0 | 0 | 993 | `chocobo.mxrouting.net.` |
| `_submissions` / `_tcp`  | 0 | 0 | 465 | `chocobo.mxrouting.net.` |
| `_autodiscover` / `_tcp` | 0 | 0 | 443 | `autodiscover.taskeplusholding.com.` |

| Host | Tipo | Valor |
|------|------|-------|
| `@`  | TXT  | `mailconf=https://autoconfig.taskeplusholding.com/mail/config-v1.1.xml` |

## 3. Verificación

```bash
cd ~/mail-taskeplusholding
node scripts/verify-domains.mjs                 # estado completo de un vistazo
node scripts/build.mjs --check                  # archivos sincronizados con domains.js

dig +short CNAME autoconfig.taskeplusholding.com
dig +short CNAME autodiscover.taskeplusholding.com
dig +short TXT _dmarc.taskeplusholding.com
```

Con `autodiscover` publicado y el certificado emitido, `verify-domains.mjs` debe mostrar
`1/1 dominios funcionando por completo`.

## 4. Notas

- El respaldo `https://taskeplusholding.com/.well-known/autoconfig/mail/config-v1.1.xml` está en el
  repo, pero el apex no tiene registro A (dominio solo de correo), así que esa ruta no existe. Da
  igual: Thunderbird consulta primero `autoconfig.<dominio>`.
- Si algún día este dominio resultara **alias** de otro en MXroute (recibe correo pero no tiene
  buzones propios), el usuario de autenticación es el del dominio principal. Se arregla en
  `domains.js` con `loginTemplate: "%EMAILLOCALPART%@otrodominio.com"` y un `node scripts/build.mjs`.
- Para otro dominio (plan futuro): repo nuevo con su propia GitHub Page, cambiar la entrada de
  `domains.js` y el archivo `CNAME`. El resto es idéntico.
