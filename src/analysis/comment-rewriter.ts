// FeelingWise - Comment Rewriter (Layer 2)
// Uses AI to generate educational comments (child mode) or decode
// manipulative comments with explanations (teen mode).

import { callAI } from '../ai/client';
import { detect } from '../core/detector';
import type { ScoredComment } from './comment-scorer';

// --- Types ---

export interface RewrittenComment {
  original: string;
  rewritten: string;
  technique?: string;
  lesson?: string;
  educationalTopic?: string;
  sarcasmDecoded?: boolean;
}

export interface CommentRewriteResult {
  comments: RewrittenComment[];
  mode: 'child' | 'teen';
  videoContext: string;
  generationTimeMs: number;
}

// --- JSON parsing (3-tier) ---

function parseJSONResponse<T>(raw: string): T[] | null {
  // Attempt 1: direct parse
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* continue */ }

  // Attempt 2: strip markdown fences
  try {
    const stripped = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '');
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* continue */ }

  // Attempt 3: regex extract
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* continue */ }

  return null;
}

// --- Child mode ---

export async function generateChildComments(
  videoTitle: string,
  videoDescription: string,
  topics: string[],
  language: string,
  count: number,
): Promise<CommentRewriteResult> {
  const systemPrompt =
    `You are an educational content generator for children ages 8-12.\n` +
    `Generate short, interesting, age-appropriate facts and thought-provoking questions.\n` +
    `Each item: 1-3 sentences. Write in ${language}.\n` +
    `Never include: violence, sexual content, scary content, negativity, manipulation.\n` +
    `Always include: curiosity, wonder, encouragement to think.\n` +
    `Return ONLY a JSON array: [{"text": "...", "topic": "..."}]\n` +
    `No markdown. No backticks. No preamble. Just the JSON array.`;

  const descriptionLine = videoDescription
    ? `Description: "${videoDescription.slice(0, 200)}"\n`
    : '';

  const userPrompt =
    `Video topic: "${videoTitle}"\n` +
    descriptionLine +
    `Generate ${count} items. Mix these topics: ${topics.join(', ')}.\n` +
    `Some should relate to the video topic. Others: standalone interesting facts or questions.`;

  const start = Date.now();
  let raw: string;
  try {
    raw = await callAI(systemPrompt, userPrompt);
  } catch {
    return { comments: [], mode: 'child', videoContext: videoTitle, generationTimeMs: Date.now() - start };
  }
  const generationTimeMs = Date.now() - start;

  if (!raw) {
    return { comments: [], mode: 'child', videoContext: videoTitle, generationTimeMs };
  }

  const parsed = parseJSONResponse<{ text?: string; topic?: string }>(raw);
  if (!parsed) {
    return { comments: [], mode: 'child', videoContext: videoTitle, generationTimeMs };
  }

  // Safety filter: run each generated comment through Layer 1 regex classifier
  let dropped = 0;
  const comments: RewrittenComment[] = [];

  for (const item of parsed) {
    const text = item.text ?? '';
    if (!text) continue;

    const results = detect(text);
    const triggered = results.some(r => r.present);
    if (triggered) {
      dropped++;
      continue;
    }

    comments.push({
      original: '',
      rewritten: text,
      educationalTopic: item.topic,
    });
  }

  // If too many were flagged, discard all (something went wrong)
  if (dropped > 3) {
    return { comments: [], mode: 'child', videoContext: videoTitle, generationTimeMs };
  }

  return { comments, mode: 'child', videoContext: videoTitle, generationTimeMs };
}

// --- Teen mode ---

export async function rewriteTeenComments(
  scoredComments: ScoredComment[],
  videoTitle: string,
  language: string,
): Promise<CommentRewriteResult> {
  const commentList = scoredComments
    .map((sc, i) => {
      let line = `${i + 1}. "${sc.raw.text}"`;
      if (sc.scores.sarcasm > 0.3) line += ' [LIKELY SARCASTIC]';
      if (sc.scores.noise > 0.5) line += ' [LOW QUALITY]';
      return line;
    })
    .join('\n');

  const count = scoredComments.length;

  const systemPrompt =
    `You are a communication translator for teenagers ages 13-17.\n` +
    `Rewrite social media comments in clear, intellectual ${language}. For each:\n` +
    `1. Rewrite in plain, respectful language. Remove slang, emoji meanings, aggression.\n` +
    `2. If marked SARCASTIC or you detect sarcasm: decode the REAL meaning literally. Do not preserve the sarcasm.\n` +
    `3. Identify the technique: sarcasm, bandwagon, shame-attack, fear-appeal, toxic-positivity, peer-pressure, mockery, genuine-opinion, informative, neutral.\n` +
    `4. Write one sentence explaining the technique to a teenager.\n` +
    `Return ONLY a JSON array: [{"index": 1, "rewritten": "...", "technique": "...", "lesson": "...", "wasSarcasm": true/false}]\n` +
    `No markdown. No backticks. No preamble.`;

  const userPrompt =
    `Video: "${videoTitle}"\n` +
    `Comments:\n${commentList}\n` +
    `Rewrite all ${count} comments. Return valid JSON only.`;

  const start = Date.now();
  let raw: string;
  try {
    raw = await callAI(systemPrompt, userPrompt);
  } catch {
    return buildTeenFallback(scoredComments, videoTitle, Date.now() - start);
  }
  const generationTimeMs = Date.now() - start;

  if (!raw) {
    return buildTeenFallback(scoredComments, videoTitle, generationTimeMs);
  }

  const parsed = parseJSONResponse<{
    index?: number;
    rewritten?: string;
    technique?: string;
    lesson?: string;
    wasSarcasm?: boolean;
  }>(raw);

  if (!parsed) {
    return buildTeenFallback(scoredComments, videoTitle, generationTimeMs);
  }

  // Map parsed results back to originals by index
  const comments: RewrittenComment[] = scoredComments.map((sc, i) => {
    // Try to find by 1-based index, then fall back to array position
    const aiItem =
      parsed.find(p => p.index === i + 1) ??
      (i < parsed.length ? parsed[i] : undefined);

    if (aiItem?.rewritten) {
      return {
        original: sc.raw.text,
        rewritten: aiItem.rewritten,
        technique: aiItem.technique,
        lesson: aiItem.lesson,
        sarcasmDecoded: aiItem.wasSarcasm ?? false,
      };
    }

    // AI didn't cover this comment — return original unmodified
    return { original: sc.raw.text, rewritten: sc.raw.text };
  });

  return { comments, mode: 'teen', videoContext: videoTitle, generationTimeMs };
}

function buildTeenFallback(
  scoredComments: ScoredComment[],
  videoTitle: string,
  generationTimeMs: number,
): CommentRewriteResult {
  return {
    comments: scoredComments.map(sc => ({
      original: sc.raw.text,
      rewritten: sc.raw.text,
    })),
    mode: 'teen',
    videoContext: videoTitle,
    generationTimeMs,
  };
}
