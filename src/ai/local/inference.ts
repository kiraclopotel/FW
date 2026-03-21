// FeelingWise - Local inference wrapper
// Accepts prompt, returns generated text. Handles tokenization and config.

import { getEngine, isReady } from './model-manager';

export async function runInference(system: string, user: string): Promise<string> {
  try {
    if (!isReady()) return '';

    const engine = getEngine();
    if (!engine) return '';

    const reply = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });

    return reply.choices[0]?.message?.content ?? '';
  } catch (err) {
    console.error('[FeelingWise] Inference failed:', err);
    return '';
  }
}
