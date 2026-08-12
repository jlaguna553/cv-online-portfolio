/**
 * CV base por defecto.
 *
 * Es la semilla: al arrancar sin nada en KV, esto es lo que se sirve. En cuanto
 * guardas desde /admin, manda la copia de KV y este archivo deja de usarse.
 *
 * Cada empleo, logro y grupo de skills lleva un `id` ESTABLE. Las variantes
 * referencian esos ids, no posiciones, para que añadir o reordenar experiencia
 * no descoloque las variantes ya publicadas. Nunca reutilices un id para otra
 * cosa: bórralo y crea uno nuevo.
 *
 * El contenido de este archivo es un EJEMPLO: edita el tuyo desde /admin, que
 * es donde se guarda en KV y entra en vivo sin desplegar.
 */
export const DEFAULT_CV = {
  version: 1,

  name: 'Tu Nombre',
  email: 'tu@correo.com',
  phone: '+00 000 000 0000',
  linkedin: 'https://www.linkedin.com/in/tu-perfil',
  linkedinLabel: 'linkedin.com/in/tu-perfil',

  location: {
    es: 'Tu ciudad, País',
    en: 'Your city, Country',
  },

  headline: {
    es: 'Tu titular profesional',
    en: 'Your professional headline',
  },

  summary: {
    es: 'Escribe aquí un resumen profesional de un párrafo: qué haces, en qué sector y qué resultados destacas. El chatbot lo usa como base para responder a los reclutadores.',
    en: 'Write a one-paragraph professional summary here: what you do, your industry, and the results you stand out for. The chatbot uses it to answer recruiters.',
  },

  experience: [
    {
      id: 'empleo-actual',
      org: 'Tu Empresa',
      title: { es: 'Tu Puesto', en: 'Your Role' },
      place: { es: 'Tu ciudad, País (Remoto)', en: 'Your city, Country (Remote)' },
      dates: { es: 'ene 2020 – Presente', en: 'Jan 2020 – Present' },
      bullets: [
        {
          id: 'logro-1',
          es: 'Describe tu logro principal con impacto medible.',
          en: 'Describe your main achievement with measurable impact.',
        },
        {
          id: 'logro-2',
          es: 'Añade un segundo logro relevante con datos.',
          en: 'Add a second relevant achievement with numbers.',
        },
      ],
    },
    {
      id: 'empleo-anterior',
      org: 'Tu Empresa Anterior',
      title: { es: 'Tu Puesto Anterior', en: 'Your Previous Role' },
      place: { es: 'Tu ciudad, País', en: 'Your city, Country' },
      dates: { es: '2016 – 2020', en: '2016 – 2020' },
      bullets: [
        {
          id: 'logro-3',
          es: 'Describe responsabilidades y logros de ese puesto.',
          en: 'Describe responsibilities and achievements in that role.',
        },
      ],
    },
  ],

  skills: [
    {
      id: 'skills-main',
      label: { es: 'Lenguajes y Frameworks', en: 'Languages & Frameworks' },
      items: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
    },
    {
      id: 'skills-data',
      label: { es: 'Datos', en: 'Data' },
      items: ['PostgreSQL', 'Redis'],
    },
    {
      id: 'skills-infra',
      label: { es: 'Infraestructura y Prácticas', en: 'Infra & Practices' },
      items: ['Docker', 'CI/CD', 'Code review'],
    },
  ],

  education: {
    degree: {
      es: 'Tu título universitario',
      en: 'Your university degree',
    },
    school: 'Tu universidad',
  },

  certs: ['Tu certificación principal'],

  languages: {
    es: ['Español — nativo', 'Inglés — intermedio'],
    en: ['Spanish — native', 'English — intermediate'],
  },

  badges: ['JavaScript', 'TypeScript', 'React', 'Node.js',
           'PostgreSQL', 'Redis', 'Docker', 'CI/CD'],

  metrics: [
    { id: 'metric-years', value: '10', es: 'años de experiencia', en: 'years of experience' },
    { id: 'metric-team', value: '8', es: 'personas en tu equipo', en: 'people on your team' },
    { id: 'metric-projects', value: '25+', es: 'proyectos entregados', en: 'projects delivered' },
    { id: 'metric-perf', value: '−50%', es: 'mejora de rendimiento', en: 'performance improvement' },
  ],
};

/** Etiquetas de sección, no editables desde el panel. */
export const SECTIONS = {
  es: { sum: 'PERFIL PROFESIONAL', exp: 'EXPERIENCIA', skills: 'APTITUDES',
        edu: 'EDUCACIÓN', certs: 'CERTIFICACIONES', lang: 'IDIOMAS' },
  en: { sum: 'PROFESSIONAL SUMMARY', exp: 'EXPERIENCE', skills: 'SKILLS',
        edu: 'EDUCATION', certs: 'CERTIFICATIONS', lang: 'LANGUAGES' },
};
