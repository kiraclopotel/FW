import { describe, it, expect, vi } from 'vitest';
import type { ScoredComment } from '../../src/analysis/comment-scorer';

// Mock callAI before importing the module under test
vi.mock('../../src/ai/client', () => ({
  callAI: vi.fn(),
}));

// Mock detect to return no triggers by default
vi.mock('../../src/core/detector', () => ({
  detect: vi.fn(() => [
    { technique: 'fear-appeal', present: false, confidence: 0, severity: 0, evidence: [] },
  ]),
}));

import { generateChildComments, rewriteTeenComments } from '../../src/analysis/comment-rewriter';
import { callAI } from '../../src/ai/client';
import { detect } from '../../src/core/detector';

const mockedCallAI = vi.mocked(callAI);
const mockedDetect = vi.mocked(detect);

function makeScoredComment(text: string, overrides: Partial<ScoredComment['scores']> = {}): ScoredComment {
  return {
    raw: {
      text,
      likes: 5,
      replies: 0,
      isPinned: false,
      isCreatorReply: false,
      isHighlighted: false,
      authorHandle: '@user',
      timestamp: '2024-01-01T00:00:00Z',
    },
    scores: {
      relevance: 0.5,
      popularity: 0.3,
      creatorSignal: 0,
      consensus: 0.2,
      noise: 0.1,
      sarcasm: 0.1,
      ...overrides,
    },
    composite: 0.5,
    flags: [],
  };
}

describe('comment-rewriter', () => {
  describe('generateChildComments — valid JSON', () => {
    it('parses valid AI response and returns educational comments', async () => {
      const aiResponse = JSON.stringify([
        { text: 'Did you know octopuses have three hearts?', topic: 'biology' },
        { text: 'What makes the sky blue? Light scattering!', topic: 'physics' },
      ]);
      mockedCallAI.mockResolvedValueOnce(aiResponse);
      mockedDetect.mockReturnValue([
        { technique: 'fear-appeal', present: false, confidence: 0, severity: 0, evidence: [] },
      ]);

      const result = await generateChildComments(
        'Cool Science Facts', 'A video about science', ['biology', 'physics'], 'English', 2,
      );

      expect(result.mode).toBe('child');
      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].rewritten).toBe('Did you know octopuses have three hearts?');
      expect(result.comments[0].educationalTopic).toBe('biology');
      expect(result.comments[0].original).toBe('');
      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.videoContext).toBe('Cool Science Facts');
    });
  });

  describe('generateChildComments — malformed output', () => {
    it('returns empty array when AI returns garbage', async () => {
      mockedCallAI.mockResolvedValueOnce('This is not JSON at all!!!');

      const result = await generateChildComments(
        'Test Video', '', ['science'], 'English', 3,
      );

      expect(result.mode).toBe('child');
      expect(result.comments).toHaveLength(0);
    });
  });

  describe('rewriteTeenComments — malformed output', () => {
    it('returns originals unmodified when AI returns garbage', async () => {
      mockedCallAI.mockResolvedValueOnce('totally broken response {{{');

      const scored = [
        makeScoredComment('lol this is so dumb'),
        makeScoredComment('everyone knows this already'),
      ];

      const result = await rewriteTeenComments(scored, 'Test Video', 'English');

      expect(result.mode).toBe('teen');
      expect(result.comments).toHaveLength(2);
      // Fallback: rewritten === original
      expect(result.comments[0].rewritten).toBe('lol this is so dumb');
      expect(result.comments[1].rewritten).toBe('everyone knows this already');
    });
  });
});
