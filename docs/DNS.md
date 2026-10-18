# Registros DNS — 4 dominios en MXroute

Verificado el 2026-10-18 con `node scripts/inspect-domain.mjs`:

| Dominio | MX | IMAP/SMTP | Certificado | DKIM | SPF | DMARC |
|---|---|---|---|---|---|---|
| taskeplusholding.com | chocobo.mxrouting.net | 993 / 465 ✅ | ✅ | ✅ `x` | ✅ | ❌ falta |
| taskeplusholdingllc.com | chocobo.mxrouting.net | 993 / 465 ✅ | ✅ | ✅ `x` | ✅ | ❌ falta |
| epluservices.com | chocobo.mxrouting.net | 993 / 465 ✅ | ✅ | ✅ `x` | ✅ | ❌ falta |
| vencox.com | chocobo.mxrouting.net | 993 / 465 ✅ | ✅ | ✅ `x` | ✅ | ❌ falta |

Los cuatro usan el **mismo servidor** (`chocobo.mxrouting.net`, certificado válido, puerto 587 también
abierto). Ninguno tiene hostname propio tipo `mail.dominio.com`, así que no hay nada que inventar:
el servidor del certificado es el servidor de conexión.

DNS de los cuatro: **Namecheap** (`dns1/dns2.registrar-servers.com`). No toques `MX`, `SPF` ni DKIM.

## 1. Estado actual de los registros de autoconfiguración

| Dominio | `CNAME autoconfig` | `CNAME autodiscover` |
|---|---|---|
| taskeplusholding.com | ✅ `astrodavid0.github.io` (funciona) | ❌ no existe |
| taskeplusholdingllc.com | ❌ no existe | ❌ no existe |
| epluservices.com | ❌ no existe | ❌ no existe |
| vencox.com | ❌ no existe | ❌ no existe |

## 2. Lo que hay que crear (Namecheap → Advanced DNS)

> ⚠️ GitHub Pages **no** sirve aquí: contesta **405 a POST** (lo que usa Outlook) y admite **un solo**
> dominio personalizado por sitio (probado: otro host → fallo de TLS y 404). Todo lo nuevo va a
> **Netlify**, que sí acepta POST y permite N dominios con certificado propio en un único sitio.

| Registro | Host | Tipo | Valor | TTL |
|---|---|---|---|---|
| taskeplusholding.com | `autodiscover` | CNAME | `<sitio>.netlify.app.` | Automatic |
| taskeplusholdingllc.com | `autoconfig` | CNAME | `<sitio>.netlify.app.` | Automatic |
| taskeplusholdingllc.com | `autodiscover` | CNAME | `<sitio>.netlify.app.` | Automatic |
| epluservices.com | `autoconfig` | CNAME | `<sitio>.netlify.app.` | Automatic |
| epluservices.com | `autodiscover` | CNAME | `<sitio>.netlify.app.` | Automatic |
| vencox.com | `autoconfig` | CNAME | `<sitio>.netlify.app.` | Automatic |
| vencox.com | `autodiscover` | CNAME | `<sitio>.netlify.app.` | Automatic |

`<sitio>` es el nombre que te dé Netlify (p. ej. `taskeplus-mail.netlify.app`). Son **7 registros**.

`autoconfig.taskeplusholding.com` se queda como está en GitHub Pages: funciona, no cuesta nada y da
redundancia si Netlify fallara.

### Passos en Netlify

1. *Add new site → Import an existing project* → este repo (build vacío, **publish `.`**).
   Ya trae `netlify.toml` y `netlify/edge-functions/autodiscover.mjs`.
2. *Domain management → Add a domain*, uno por uno estos 7 nombres:
   - `autodiscover.taskeplusholding.com`
   - `autoconfig.taskeplusholdingllc.com`, `autodiscover.taskeplusholdingllc.com`
   - `autoconfig.epluservices.com`, `autodiscover.epluservices.com`
   - `autoconfig.vencox.com`, `autodiscover.vencox.com`
3. Crea los CNAME de la tabla. Netlify emite un certificado Let's Encrypt por nombre en minutos.
4. Verifica (debe devolver el XML con el `LoginName` correcto):

```bash
for d in taskeplusholding.com taskeplusholdingllc.com epluservices.com vencox.com; do
  echo "== $d"
  curl -s -o /dev/null -w "  autoconfig   %{http_code}\n" "https://autoconfig.$d/mail/config-v1.1.xml"
  curl -s -X POST "https://autodiscover.$d/autodiscover/autodiscover.xml" \
    -H 'Content-Type: text/xml' \
    -d "<Autodiscover><Request><EMailAddress>ana@$d</EMailAddress></Request></Autodiscover>" \
    | grep -o "<LoginName>[^<]*</LoginName>"
done
```

## 3. Recomendados por dominio (5 minutos cada uno)

### DMARC — falta en los cuatro

Empezar en `p=none` (solo informa) y endurecer cuando lleguen los informes:

| Dominio | Host | Tipo | Valor |
|---|---|---|---|
| taskeplusholding.com | `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@taskeplusholding.com; adkim=r; aspf=r; pct=100` |
| taskeplusholdingllc.com | `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@taskeplusholdingllc.com; adkim=r; aspf=r; pct=100` |
| epluservices.com | `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@epluservices.com; adkim=r; aspf=r; pct=100` |
| vencox.com | `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@vencox.com; adkim=r; aspf=r; pct=100` |

(El buzón `dmarc@` debe existir o ser un alias que reciba; si no, pon tu dirección real.)

### SRV y TXT de descubrimiento

Por cada dominio, sustituyendo `<d>`:

| Host (Namecheap: Service / Protocol) | Prioridad | Peso | Puerto | Target |
|---|---|---|---|---|
| `_imaps` / `_tcp` | 0 | 0 | 993 | `chocobo.mxrouting.net.` |
| `_submissions` / `_tcp` | 0 | 0 | 465 | `chocobo.mxrouting.net.` |
| `_autodiscover` / `_tcp` | 0 | 0 | 443 | `autodiscover.<d>.` |

| Host | Tipo | Valor |
|---|---|---|
| `@` | TXT | `mailconf=https://autoconfig.<d>/mail/config-v1.1.xml` |

En Namecheap, los SRV van con "Type: SRV Record" y el Host escrito completo (`_imaps._tcp`).

## 4. Notas

- Cada nombre nuevo necesita **su propio certificado**. Si creas el CNAME antes de añadir el dominio
  en Netlify, verás error de TLS hasta que se emita (minutos).
- `taskeplusholdingllc.com` y `epluservices.com` tienen el apex en una página de parking de Namecheap
  (`192.64.119.x`) y `vencox.com` en AWS. No afecta al correo ni a esto, pero si algún día quieres
  también el respaldo `/.well-known/autoconfig/...` en el apex, hay que publicar el sitio ahí.
- Límites de Let's Encrypt: por dominio registrado y semana. 7 nombres no es problema.
- El respaldo `https://<dominio>/.well-known/autoconfig/mail/config-v1.1.xml` ya está en el repo para
  el día que algún apex se publique; Thunderbird consulta primero `autoconfig.<dominio>`.
- **Si alguno de los dominios es alias de otro en MXroute** (recibe correo pero no tiene buzones
  propios), el usuario de autenticación es el del dominio principal. Se corrige en `domains.js` con
  `loginTemplate: "%EMAILLOCALPART%@taskeplusholding.com"`; el resto no cambia. Se comprueba
  intentando iniciar sesión con un buzón de ese dominio.
