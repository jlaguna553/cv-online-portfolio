# CV Online — CV interactivo con IA

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Cloudflare](https://img.shields.io/badge/Cloudflare%20Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![Workers AI](https://img.shields.io/badge/Workers%20AI-2C7A7B?style=for-the-badge&logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)

> **Un CV que responde preguntas: chatbot IA integrado, bilingüe y con variantes por vacante — todo en el free tier de Cloudflare.**

CV bilingüe (ES/EN) con un chatbot que responde preguntas de reclutadores usando
**Cloudflare Workers AI**. Sin servidor propio, sin base de datos y sin suscripciones de pago.

| Pieza | Tecnología | Costo |
|---|---|---|
| Frontend | HTML + Tailwind CSS (CDN) + JS puro | Gratis |
| Backend | Cloudflare Worker (`src/worker.js`) | Free plan: 100 000 req/día |
| LLM | Workers AI · `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Free tier: 10 000 neuronas/día |
| Hosting estático | Static Assets del mismo Worker | Gratis e ilimitado |
| CI/CD | GitHub → Workers Builds | Gratis |

> **Nota sobre el modelo:** `@cf/meta/llama-3.3-7b-instruct` no existe en el catálogo de
> Cloudflare (Llama 3.3 solo se publicó en 70B). El Worker usa
> `@cf/meta/llama-3.3-70b-instruct-fp8-fast` y cae automáticamente a
> `@cf/meta/llama-3.1-8b-instruct` si el primero falla o está saturado.
> Ambos están incluidos en el Free Tier.

---

## Estructura

```
cv-online/
├── public/
│   ├── index.html          # SPA completa: i18n, tabs, chat, PDF, variantes
│   ├── admin.html          # Panel privado: editor del CV y variantes
│   └── avatar.jpg
├── src/
│   ├── worker.js           # API de chat, CV, variantes y administración
│   ├── cv-default.js       # CV semilla (solo se usa si KV está vacío)
│   ├── cv.js               # Validación del CV y derivación del prompt
│   └── variants.js         # Prompt de generación, validación y KV
├── functions/api/chat.js   # Solo si despliegas con Cloudflare Pages (alternativa)
├── wrangler.toml           # Bindings: AI, KV, ASSETS, rate limit
├── package.json
└── README.md
```

---

## Funcionalidades

- **Selector ES/EN** que cambia interfaz, contenido del CV, preguntas sugeridas y el idioma del bot (se recuerda en `localStorage`).
- **Chat en streaming** con indicador "Escribiendo…", render de Markdown saneado con DOMPurify e historial de los últimos 8 turnos.
- **Detección automática de idioma**: el bot responde en el idioma en que le escriban, sin importar el selector.
- **Exportar CV en PDF** (`html2pdf.js`) con documento A4 dedicado en el idioma activo; si el CDN está bloqueado, cae al diálogo `@media print` del navegador.
- **Modo claro / oscuro** con detección de preferencia del sistema.
- **Rate limiting** de 15 mensajes/minuto por IP, con binding nativo de Cloudflare.
- **Protección del prompt**: mensajes saneados, longitud máxima e instrucciones anti prompt-injection.

---

## CVs por vacante

Cada aplicación puede tener su propio CV en `tudominio.com/v/<id>`, adaptado al puesto y
con link privado que mandas solo a esa empresa.

### Cómo funciona

0. En `/admin` → **CV base** editas tu CV: añadir empleos y logros, reordenarlos,
   cambiar skills, contacto y métricas, todo en ES e EN. Se guarda en KV y entra en vivo
   al instante, sin desplegar.
1. En **Variantes por vacante** pegas la descripción del puesto y pulsas **Generar borrador**
   (o **Crear a mano** si prefieres escribirla tú, que para vacantes muy específicas suele
   salir mejor que el modelo).
2. Workers AI produce un JSON con titular, resumen, orden de logros, skills, badges y un
   *focus* para el chatbot.
3. **Lo revisas y editas** en el panel. Nada se guarda hasta que pulsas Publicar.
4. Al publicar, se almacena en KV y obtienes la URL `/v/<id>` para enviar.
5. Desde el listado puedes **editar** una variante publicada: elige con casillas qué logros
   se muestran y en qué orden, reordena los grupos de skills y marca los badges.

Las páginas `/v/<id>` llevan `noindex, nofollow` y no están listadas en ningún sitio
público: solo se llega con el link. La raíz `/` sigue siendo el CV genérico.

### La IA no puede inventar experiencia

Es la restricción central del diseño, y está impuesta en dos capas:

- **En el prompt** ([src/variants.js](src/variants.js)): el modelo solo puede reescribir
  titular y resumen a partir de hechos que ya están en el CV. Para dar énfasis a un logro
  debe *reordenarlo*, refiriéndose a él por su id; no puede redactar logros nuevos.
- **En el servidor**: todo lo que devuelve el modelo pasa por `sanitizeVariant()`, que lo
  contrasta con los ids reales del CV guardado. Un id inexistente se descarta y los badges
  se filtran contra el catálogo del propio CV. Probado: al enviar los ids `INVENTADO`,
  `empleo-que-no-existe` y `NO-EXISTE`, más el badge `HTML5-FALSO`, todos se eliminaron
  antes de guardarse.

Aun así, **revisa siempre el resumen antes de publicar**: es lo único que el modelo redacta
desde cero, y es donde podría exagerar un matiz.

### Preparación (una sola vez)

```bash
# 1. Crear el almacén de variantes
npx wrangler kv namespace create VARIANTS
# Copia el id que imprime y pégalo en wrangler.toml, reemplazando PENDIENTE_...

# 2. Definir la contraseña del panel
npx wrangler secret put ADMIN_TOKEN
# Pega una cadena larga y aleatoria. Nunca queda en el repo.

# 3. Para desarrollo local, crea .dev.vars (ya está en .gitignore)
echo 'ADMIN_TOKEN=lo-que-quieras-en-local' > .dev.vars
```

Sin `ADMIN_TOKEN` configurado, `/api/admin/*` responde 401 a todo: el panel queda cerrado
por defecto, no abierto.

---

## Guía de despliegue

### Paso 0 — Requisitos

- Cuenta gratuita en [dash.cloudflare.com](https://dash.cloudflare.com) (sin tarjeta).
- Cuenta de GitHub.
- Node.js 18+ instalado.

### Paso 1 — Probar en local

```bash
cd cv-online
npm install
npx wrangler login       # abre el navegador para autorizar
npm run dev              # http://localhost:8787
```

`wrangler dev` sirve `public/` y ejecuta el Worker. **Workers AI siempre se ejecuta en la nube
de Cloudflare**, incluso durante el desarrollo local, así que la cuenta debe estar lista antes:

1. `wrangler login` — sin sesión el servidor ni siquiera arranca
   (`You must be logged in to use wrangler dev in remote mode`).
2. **Registrar el subdominio `workers.dev` de la cuenta**, una sola vez, en
   `https://dash.cloudflare.com/<account-id>/workers/onboarding`. Si falta, verás
   `You need to register a workers.dev subdomain before running the dev command in remote mode`.
   Elige un nombre (p. ej. `cv-online`) y tu Worker quedará en `cv-online.<tu-subdominio>.workers.dev` (el subdominio lo da tu cuenta, p. ej. `tu-usuario`).
   Es gratis y no pide tarjeta.

Si solo quieres revisar el diseño, el cambio de idioma o el PDF sin tocar la IA:

```bash
npx wrangler dev --local     # arranca sin cuenta; /api/chat responde 503 y la UI lo maneja
```

(También puedes presionar `l` dentro de la consola de Wrangler para alternar a modo local.)

Verifica el backend con:

```bash
curl http://localhost:8787/api/health
# {"ok":true,"model":"@cf/meta/llama-3.3-70b-instruct-fp8-fast", ...}
```

### Paso 2 — Desplegar (opción A: línea de comandos, la más rápida)

```bash
npm run deploy
```

Wrangler crea el Worker, activa el binding de Workers AI, sube `public/` y te da una URL
tipo `https://cv-online.<tu-subdominio>.workers.dev`. **No hay que crear el binding de AI a
mano** — `wrangler.toml` ya lo declara y el deploy lo provisiona.

### Paso 3 — Desplegar desde GitHub (opción B: CI/CD automático)

1. Sube el proyecto a GitHub:

   ```bash
   git init
   git add .
   git commit -m "CV interactivo con Cloudflare Workers AI"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/cv-online.git
   git push -u origin main
   ```

2. En el dashboard de Cloudflare: **Compute (Workers) → Create → Import a repository**.
3. Autoriza Cloudflare en GitHub y elige el repo `cv-online`.
4. Configuración de build:
   - **Build command**: *(vacío)*
   - **Deploy command**: `npx wrangler deploy`
   - **Root directory**: `/`
5. **Create and deploy**. Desde ese momento, cada `git push` a `main` redespliega solo.

> **¿Prefieres Cloudflare Pages?** Funciona igual de bien y también es gratis:
> **Workers & Pages → Create → Pages → Connect to Git**, con *Build output directory* = `public`
> y *Build command* vacío. El archivo `functions/api/chat.js` ya está listo y reutiliza el
> mismo código; solo falta añadir el binding de AI en **Settings → Bindings → Add → Workers AI**
> con nombre de variable **`AI`** (en Pages ese binding sí se agrega desde el dashboard).
> El rate limiting no está disponible en Pages Functions, así que ese bloque se omite solo.

### Paso 4 — Dominio propio (opcional)

**Con subdominio `.workers.dev` (gratis, sin dominio):** ya lo tienes tras el paso 2.
Cámbiale el nombre editando `name = "cv-online"` en `wrangler.toml`.

**Con tu propio dominio** (por ejemplo `cv.tudominio.dev`):

1. Añade el dominio a Cloudflare: **Add a site** y apunta los nameservers desde tu registrador.
2. Ve a tu Worker → **Settings → Domains & Routes → Add → Custom domain**.
3. Escribe `cv.tudominio.com` y guarda. Cloudflare crea el registro DNS y el certificado
   TLS automáticamente (1–2 minutos).

Alternativa por configuración: añade a `wrangler.toml`

```toml
routes = [
  { pattern = "cv.tudominio.com", custom_domain = true }
]
```

---

## Personalización

| Qué quieres cambiar | Dónde |
|---|---|
| **Tu CV** (experiencia, skills, contacto…) | **`/admin` → pestaña "CV base"** |
| Textos de la interfaz y preguntas sugeridas | objeto `UI` en `public/index.html` |
| Badges de tecnologías | constante `BADGES` en `public/index.html` |
| Colores de marca | `tailwind.config` en el `<head>` |
| Comportamiento y datos del bot | `SYSTEM_PROMPT` en `src/worker.js` |
| Modelo, tokens, temperatura | constantes al inicio de `src/worker.js` |
| Foto de perfil | coloca `public/avatar.jpg`; si no existe se muestran las iniciales |
| Reglas de generación de variantes | `buildGenerationPrompt()` en `src/variants.js` |
| Qué puede tocar una variante | `sanitizeVariant()` en `src/variants.js` |
| CV semilla (antes del primer guardado) | `src/cv-default.js` |

### Por qué ids y no posiciones

Cada empleo, logro y grupo de skills lleva un `id` estable, y las variantes los
referencian por ese id. Así, añadir un empleo nuevo al principio o reordenar logros **no
descoloca las variantes ya publicadas**: cada una sigue destacando exactamente lo que
eligió. Si borras un logro que una variante destacaba, esa variante simplemente deja de
mostrarlo, y al guardar el CV el panel te avisa de cuáles quedaron afectadas.

El CV vivía antes en tres sitios (frontend, system prompt y contexto de generación).
Ahora hay una sola copia en KV y todo lo demás se deriva de ella.

> El CV aparece en dos lugares: el objeto `CV` (lo que se ve y se imprime) y el
> `SYSTEM_PROMPT` (lo que sabe el bot). Al actualizar tu experiencia, edita ambos.

---

## Costos y límites del Free Tier

- **Workers**: 100 000 peticiones/día, 10 ms de CPU por invocación.
- **Workers AI**: 10 000 neuronas/día. Una respuesta típica del chat consume decenas de
  neuronas, así que da para cientos de conversaciones diarias. Al agotarse, el Worker
  devuelve 503 y la UI muestra un mensaje pidiendo contacto por email.
- **Static Assets**: gratis e ilimitado.
- No se requiere tarjeta de crédito ni hay cobro automático al pasar los límites: el
  servicio simplemente se limita hasta el siguiente ciclo.

Monitorea el consumo en **Dashboard → AI → Workers AI** y los logs con `npm run tail`.

<!-- Agrega capturas en docs/screenshots/ -->

---

