/**
 * ALTERNATIVA: Cloudflare Pages Functions.
 *
 * Solo se usa si despliegas con Cloudflare Pages en lugar de Workers.
 * Reutiliza exactamente la misma lógica y System Prompt de src/worker.js.
 * Si despliegas como Worker (recomendado), este archivo se ignora.
 */
import worker from '../../src/worker.js';

export const onRequest = (context) =>
  worker.fetch(context.request, context.env, context);
