/**
 * Variantes de CV por vacante.
 *
 * Reglas de seguridad de contenido (importantes):
 *  - El modelo NUNCA inventa experiencia. Solo puede (a) reescribir titular y
 *    resumen usando hechos ya presentes en el CV, y (b) REORDENAR u OCULTAR
 *    elementos existentes referenciándolos por su id estable.
 *  - Todo lo que devuelve el modelo se valida contra la forma del CV guardado
 *    antes de almacenarse. Un id inventado se descarta.
 *  - Se usan ids y no posiciones para que editar el CV base (añadir un empleo,
 *    reordenar logros) no descoloque las variantes ya publicadas.
 */


const MAX_HEADLINE = 120;
const MAX_SUMMARY = 900;
const MAX_SUGGESTION = 90;
const MAX_FOCUS = 700;
const MAX_LABEL = 80;
const MAX_JD_CHARS = 6000;
const MAX_VARIANTS = 60;

/* ------------------------------------------------------------------ *
 * Validación / saneamiento
 * ------------------------------------------------------------------ */

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Filtra una lista de ids dejando solo los que existen, sin repetidos y en el
 * orden pedido. Un id que ya no está en el CV (logro borrado) desaparece solo.
 */
function sanitizeIdOrder(raw, validIds) {
  if (!Array.isArray(raw)) return null;
  const valid = new Set(validIds);
  const seen = new Set();
  const out = [];
  for (const v of raw) {
    const id = str(v, 40);
    if (!valid.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length ? out : null;
}

function sanitizeLangBlock(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const headline = str(raw.headline, MAX_HEADLINE);
  const summary = str(raw.summary, MAX_SUMMARY);
  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions.map((s) => str(s, MAX_SUGGESTION)).filter(Boolean).slice(0, 5)
    : [];
  if (!headline && !summary && !suggestions.length) return null;
  return { headline, summary, suggestions };
}

/**
 * Convierte la salida cruda del modelo (o del formulario) en una variante
 * segura de almacenar. Devuelve null si no queda nada aprovechable.
 */
export function sanitizeVariant(raw, shape) {
  if (!raw || typeof raw !== 'object' || !shape) return null;

  const variant = {
    label: str(raw.label, MAX_LABEL),
    company: str(raw.company, MAX_LABEL),
    role: str(raw.role, MAX_LABEL),
    focus: str(raw.focus, MAX_FOCUS),
    es: sanitizeLangBlock(raw.es),
    en: sanitizeLangBlock(raw.en),
  };

  // Orden de logros por empleo: { "empleo-actual": ["logro-1", "logro-2"], ... }
  const bulletOrder = {};
  if (raw.bulletOrder && typeof raw.bulletOrder === 'object') {
    for (const job of shape.jobs) {
      const order = sanitizeIdOrder(raw.bulletOrder[job.id], job.bulletIds);
      if (order) bulletOrder[job.id] = order;
    }
  }
  if (Object.keys(bulletOrder).length) variant.bulletOrder = bulletOrder;

  const skillOrder = sanitizeIdOrder(raw.skillOrder, shape.skillIds);
  if (skillOrder) variant.skillOrder = skillOrder;

  // Los badges solo pueden salir del catálogo del CV: nada de tecnologías que
  // el candidato no tiene.
  if (Array.isArray(raw.badges)) {
    const badges = [];
    for (const b of raw.badges) {
      const name = str(b, 30);
      const hit = shape.badges.find((x) => x.toLowerCase() === name.toLowerCase());
      if (hit && !badges.includes(hit)) badges.push(hit);
    }
    if (badges.length) variant.badges = badges.slice(0, 14);
  }

  if (!variant.es && !variant.en && !variant.bulletOrder && !variant.skillOrder && !variant.badges) {
    return null;
  }
  return variant;
}

/* ------------------------------------------------------------------ *
 * Prompt de generación
 * ------------------------------------------------------------------ */

export function buildGenerationPrompt(cvContext, jobDescription) {
  return `You tailor an existing résumé to a specific job posting. You output ONLY a JSON object, nothing else.

=== ABSOLUTE RULES ===
1. NEVER invent experience, employers, dates, metrics, technologies, degrees or certifications. Every factual claim must already appear in the résumé below.
2. You may NOT add achievements. To emphasise one, reorder it — refer to items by the id="..." shown next to each.
3. The headline and summary must be rewritten to speak to this posting, but using ONLY facts from the résumé. Do not claim seniority, domains or tools that are not there.
4. If the posting asks for something the candidate lacks, simply do not mention it. Never imply he has it.
5. Output valid JSON only. No markdown fences, no commentary before or after.

=== RÉSUMÉ (source of truth, each item tagged with a stable id) ===
${cvContext}

=== JOB POSTING ===
${jobDescription}

=== OUTPUT SHAPE ===
{
  "label": "short internal name for this variant, max 60 chars, e.g. 'Engineering Manager @ Acme'",
  "company": "hiring company name if stated, else empty string",
  "role": "role title as written in the posting, else empty string",
  "es": {
    "headline": "Spanish headline under the name, max 110 chars, no invented titles",
    "summary": "Spanish professional summary, 45-90 words, third person avoided — write in first person like the original",
    "suggestions": ["4 short Spanish questions a recruiter for THIS role would ask, max 60 chars each"]
  },
  "en": {
    "headline": "English headline, max 110 chars",
    "summary": "English professional summary, 45-90 words",
    "suggestions": ["4 short English questions, max 60 chars each"]
  },
  "bulletOrder": {
    "<job id>": ["bullet ids of that job, most relevant first; OMIT an id to hide that bullet"],
    "<another job id>": ["..."]
  },
  "skillOrder": ["skill group ids, most relevant first"],
  "badges": ["6 to 10 technology names, chosen ONLY from the allowed badge list above, ordered by relevance to the posting"],
  "focus": "2-3 sentences, in English, describing what this posting values most. This is injected into the chat assistant's context so it can connect the candidate's real experience to this role."
}`;
}

/**
 * Repara un JSON cortado a medias (el modelo agotó max_tokens).
 *
 * Retrocede hasta el último valor completo, descarta una clave sin valor si
 * quedó colgando, y cierra las llaves y corchetes que sigan abiertos. Vale la
 * pena porque los campos que importan (titular, resumen) salen al principio:
 * un borrador incompleto pero revisable es mejor que un error.
 */
function repairTruncatedJson(s) {
  // Un solo recorrido registrando cada posición donde termina algo que PODRÍA
  // ser un valor, junto con los cierres pendientes en ese punto.
  const candidates = [];
  const stack = [];
  let inStr = false;
  let escaped = false;

  const mark = (i) => candidates.push({ idx: i, closers: [...stack].reverse().join('') });

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') { inStr = false; mark(i); }
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') { stack.pop(); mark(i); }
    else if (/[0-9eslutrafn]/.test(c)) mark(i);   // números y true/false/null
  }

  // Se prueban de atrás hacia delante: el primero que parsee es el corte más
  // completo posible. Una cadena que resultó ser una CLAVE colgante no parsea,
  // así que el candidato anterior la descarta sola.
  const limit = Math.max(0, candidates.length - 400);
  for (let k = candidates.length - 1; k >= limit; k--) {
    const { idx, closers } = candidates[k];
    const out = s.slice(0, idx + 1).replace(/[,:\s]+$/, '') + closers;
    try {
      const parsed = JSON.parse(out);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return out;
    } catch { /* probamos el corte anterior */ }
  }
  return null;
}

/** Extrae el primer objeto JSON de la respuesta del modelo. */
export function parseModelJson(text) {
  if (typeof text !== 'string') return null;
  let s = text.trim();

  // Quita cercas de markdown si el modelo las añadió pese a las instrucciones.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  const start = s.indexOf('{');
  if (start === -1) return null;
  s = s.slice(start);

  // Recorre equilibrando llaves, ignorando las que estén dentro de strings.
  let depth = 0, inStr = false, escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(s.slice(0, i + 1)); } catch { break; }
    }
  }

  // No cerró: probablemente truncado. Intentamos rescatarlo.
  const repaired = repairTruncatedJson(s);
  if (!repaired) return null;
  try { return JSON.parse(repaired); } catch { return null; }
}

/* ------------------------------------------------------------------ *
 * Almacenamiento (KV)
 * ------------------------------------------------------------------ */

const INDEX_KEY = '__index__';

/** Id corto, legible y no adivinable. */
export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}

export async function readVariant(kv, id) {
  if (!kv || !/^[a-z0-9-]{3,40}$/.test(id)) return null;
  return kv.get(`v:${id}`, 'json');
}

export async function listVariants(kv) {
  if (!kv) return [];
  return (await kv.get(INDEX_KEY, 'json')) || [];
}

export async function saveVariant(kv, id, variant) {
  const record = { ...variant, id, updatedAt: new Date().toISOString() };
  await kv.put(`v:${id}`, JSON.stringify(record));

  const index = await listVariants(kv);
  const entry = {
    id,
    label: record.label || record.role || id,
    company: record.company || '',
    updatedAt: record.updatedAt,
  };
  const next = [entry, ...index.filter((e) => e.id !== id)].slice(0, MAX_VARIANTS);
  await kv.put(INDEX_KEY, JSON.stringify(next));
  return record;
}

export async function deleteVariant(kv, id) {
  await kv.delete(`v:${id}`);
  const index = await listVariants(kv);
  await kv.put(INDEX_KEY, JSON.stringify(index.filter((e) => e.id !== id)));
}

export { MAX_JD_CHARS };
