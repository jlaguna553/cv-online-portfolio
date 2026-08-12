/**
 * CV base: lectura, validación y derivación del contexto que ve el modelo.
 *
 * Antes el CV estaba escrito a mano en tres sitios (el objeto CV del frontend,
 * el SYSTEM_PROMPT y el CV_CONTEXT). Ahora hay una sola copia, en KV, y todo lo
 * demás se deriva de ella.
 */
import { DEFAULT_CV } from './cv-default.js';

const CV_KEY = 'cv:base';

const MAX = {
  short: 160,      // titulares, puestos, fechas, etiquetas
  bullet: 600,
  summary: 1400,
  item: 60,        // items de skills y badges
  id: 40,
};

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Bloque {es, en} obligatorio en ambos idiomas. */
function bi(raw, max, fallback = { es: '', en: '' }) {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  return { es: str(raw.es, max) || fallback.es, en: str(raw.en, max) || fallback.en };
}

/** Id estable: minúsculas, dígitos y guiones. Se genera uno si falta o es inválido. */
function safeId(raw, prefix, used) {
  let id = str(raw, MAX.id).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!id) id = prefix + '-' + Math.random().toString(36).slice(2, 8);
  while (used.has(id)) id = id + '-' + Math.random().toString(36).slice(2, 5);
  used.add(id);
  return id;
}

const list = (raw, max, cap) =>
  (Array.isArray(raw) ? raw : []).map((v) => str(v, max)).filter(Boolean).slice(0, cap);

/**
 * Sanea un CV recibido del panel. Nunca lanza: lo que no encaja se descarta y
 * se rellena con el valor por defecto, para que un guardado a medias no deje
 * el sitio en blanco.
 */
export function sanitizeCV(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const jobIds = new Set();
  const skillIds = new Set();

  const experience = (Array.isArray(raw.experience) ? raw.experience : [])
    .slice(0, 20)
    .map((job) => {
      const bulletIds = new Set();
      return {
        id: safeId(job?.id, 'job', jobIds),
        org: str(job?.org, MAX.short),
        title: bi(job?.title, MAX.short),
        place: bi(job?.place, MAX.short),
        dates: bi(job?.dates, MAX.short),
        bullets: (Array.isArray(job?.bullets) ? job.bullets : [])
          .slice(0, 15)
          .map((b) => ({
            id: safeId(b?.id, 'b', bulletIds),
            es: str(b?.es, MAX.bullet),
            en: str(b?.en, MAX.bullet),
          }))
          .filter((b) => b.es || b.en),
      };
    })
    .filter((j) => j.org || j.title.es || j.title.en);

  const skills = (Array.isArray(raw.skills) ? raw.skills : [])
    .slice(0, 12)
    .map((g) => ({
      id: safeId(g?.id, 'skill', skillIds),
      label: bi(g?.label, MAX.short),
      items: list(g?.items, MAX.item, 30),
    }))
    .filter((g) => (g.label.es || g.label.en) && g.items.length);

  const metrics = (Array.isArray(raw.metrics) ? raw.metrics : [])
    .slice(0, 6)
    .map((m, i) => ({
      id: str(m?.id, MAX.id) || 'm' + i,
      value: str(m?.value, 20),
      es: str(m?.es, 60),
      en: str(m?.en, 60),
    }))
    .filter((m) => m.value);

  const cv = {
    version: 1,
    name: str(raw.name, MAX.short) || DEFAULT_CV.name,
    email: str(raw.email, MAX.short),
    phone: str(raw.phone, MAX.short),
    linkedin: str(raw.linkedin, 300),
    linkedinLabel: str(raw.linkedinLabel, 200),
    location: bi(raw.location, MAX.short, DEFAULT_CV.location),
    headline: bi(raw.headline, MAX.short, DEFAULT_CV.headline),
    summary: bi(raw.summary, MAX.summary, DEFAULT_CV.summary),
    experience: experience.length ? experience : DEFAULT_CV.experience,
    skills: skills.length ? skills : DEFAULT_CV.skills,
    education: {
      degree: bi(raw.education?.degree, MAX.short, DEFAULT_CV.education.degree),
      school: str(raw.education?.school, MAX.short),
    },
    certs: list(raw.certs, MAX.short, 15),
    languages: {
      es: list(raw.languages?.es, MAX.short, 10),
      en: list(raw.languages?.en, MAX.short, 10),
    },
    badges: list(raw.badges, MAX.item, 20),
    metrics: metrics.length ? metrics : DEFAULT_CV.metrics,
    updatedAt: new Date().toISOString(),
  };

  return cv;
}

/* ------------------------------------------------------------------ *
 * Persistencia
 * ------------------------------------------------------------------ */

export async function readCV(kv) {
  if (!kv) return DEFAULT_CV;
  const stored = await kv.get(CV_KEY, 'json');
  return stored || DEFAULT_CV;
}

export async function writeCV(kv, cv) {
  await kv.put(CV_KEY, JSON.stringify(cv));
  return cv;
}

/* ------------------------------------------------------------------ *
 * Derivados para el modelo
 * ------------------------------------------------------------------ */

/** Catálogo de ids válidos: lo usa la validación de variantes. */
export function cvShape(cv) {
  return {
    jobs: cv.experience.map((j) => ({ id: j.id, bulletIds: j.bullets.map((b) => b.id) })),
    skillIds: cv.skills.map((s) => s.id),
    badges: [...new Set([...cv.badges, ...cv.skills.flatMap((s) => s.items)])],
  };
}

/** CV en texto plano bilingüe para el system prompt del chat. */
export function cvToPromptText(cv) {
  const jobs = cv.experience
    .map((j) => {
      const es = `${j.title.es} — ${j.org} (${j.dates.es}, ${j.place.es})\n` +
        j.bullets.map((b) => `   - ${b.es}`).join('\n');
      const en = `${j.title.en} — ${j.org} (${j.dates.en}, ${j.place.en})\n` +
        j.bullets.map((b) => `   - ${b.en}`).join('\n');
      return { es, en };
    });

  const skills = {
    es: cv.skills.map((s) => `   - ${s.label.es}: ${s.items.join(', ')}`).join('\n'),
    en: cv.skills.map((s) => `   - ${s.label.en}: ${s.items.join(', ')}`).join('\n'),
  };

  return `[ES]
Nombre: ${cv.name}
Titular: ${cv.headline.es}
Ubicación: ${cv.location.es}
Email: ${cv.email} | Teléfono: ${cv.phone}
LinkedIn: ${cv.linkedin}

Perfil: ${cv.summary.es}

Experiencia:
${jobs.map((j, i) => `${i + 1}. ${j.es}`).join('\n')}

Aptitudes:
${skills.es}

Educación: ${cv.education.degree.es} — ${cv.education.school}
Certificaciones: ${cv.certs.join(', ')}
Idiomas: ${cv.languages.es.join(', ')}

[EN]
Name: ${cv.name}
Title: ${cv.headline.en}
Location: ${cv.location.en}
Email: ${cv.email} | Phone: ${cv.phone}
LinkedIn: ${cv.linkedin}

Profile: ${cv.summary.en}

Experience:
${jobs.map((j, i) => `${i + 1}. ${j.en}`).join('\n')}

Skills:
${skills.en}

Education: ${cv.education.degree.en} — ${cv.education.school}
Certifications: ${cv.certs.join(', ')}
Languages: ${cv.languages.en.join(', ')}`;
}

/** CV con ids explícitos, para que el modelo pueda reordenar al generar variantes. */
export function cvToIndexedContext(cv) {
  const jobs = cv.experience.map((j) =>
    `JOB id="${j.id}" — ${j.title.en}, ${j.org} (${j.dates.en}). Bullets:\n` +
    j.bullets.map((b) => `  id="${b.id}": ${b.en}`).join('\n'),
  ).join('\n\n');

  const skills = cv.skills.map((s) => `  id="${s.id}" — ${s.label.en}: ${s.items.join(', ')}`).join('\n');
  const shape = cvShape(cv);

  return `Candidate: ${cv.name} — ${cv.headline.en}. ${cv.location.en}.

${cv.summary.en}

${jobs}

SKILL GROUPS:
${skills}

EDUCATION: ${cv.education.degree.en} — ${cv.education.school}
CERTIFICATIONS: ${cv.certs.join(', ')}
LANGUAGES: ${cv.languages.en.join(', ')}

ALLOWED BADGE LIST (use only these exact strings): ${shape.badges.join(', ')}`;
}
