# FEELINGWISE — MASTER BUILD GUIDE v2
## The Single Source of Truth for Implementation

**Prerequisite:** Read `docs/RESEARCH_FOUNDATION.md` first. It explains *why* every decision here was made.

**Document hierarchy (in case of conflict, higher number wins):**
1. Foundation Document — the vision
2. Technical Architecture + Addendum — the overview
3. **This document — the implementation spec. THIS WINS.**
4. RESEARCH_FOUNDATION.md — the scientific grounding (informs this doc, does not override code specs)

---

## TABLE OF CONTENTS

1. Architecture: Zero-Install Browser AI
2. Three-Layer Detection Pipeline
3. Exact Prompts (Verbatim)
4. Layer 1: Pattern Scan
5. Layer 2: Local AI Verification
6. Layer 3: Cloud Verification
7. Severity Scoring with Age Adjustment
8. Neutralization Specification
9. AI Router Logic
10. WebLLM Integration
11. Cloud Providers
12. Forensic System
13. Mode System + Progressive Autonomy
14. Platform Adapters
15. File Population Order
16. Consistency Rules
17. Agent Instructions

---

## 1. ARCHITECTURE: ZERO-INSTALL BROWSER AI

The user installs a Chrome extension. That is the entire setup.

WebLLM (https://github.com/mlc-ai/web-llm) runs LLM inference inside the browser via WebGPU. On first use, the model downloads (~1-2GB), caches in browser Cache API, runs locally forever. No Ollama. No command line. No configuration.

### Model Auto-Selection

| Available VRAM | Model | Download | Speed |
|---------------|-------|----------|-------|
| >=6GB | Phi-3.5-mini-instruct-q4f16_1 | ~2.1GB | Fast |
| >=4GB | Qwen2.5-1.5B-Instruct-q4f16_1 | ~1.0GB | Very fast |
| >=2GB | SmolLM2-360M-Instruct-q4f16_1 | ~0.3GB | Fastest |
| No WebGPU | WASM CPU fallback | ~1.0GB | Slow but works |

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "FeelingWise",
  "version": "0.1.0",
  "description": "AI-powered content neutralizer. Neutralize, don't censor.",
  "permissions": ["activeTab", "storage", "sidePanel", "alarms"],
  "host_permissions": ["*://*.twitter.com/*", "*://*.x.com/*", "*://*.instagram.com/*", "*://*.tiktok.com/*", "*://*.facebook.com/*", "*://*.youtube.com/*"],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "background": { "service_worker": "src/background/service-worker.ts", "type": "module" },
  "content_scripts": [{"matches": ["*://*.twitter.com/*", "*://*.x.com/*", "*://*.instagram.com/*", "*://*.tiktok.com/*", "*://*.facebook.com/*", "*://*.youtube.com/*"], "js": ["src/content/index.ts"], "run_at": "document_idle"}],
  "side_panel": { "default_path": "src/ui/sidepanel/index.html" }
}
```

### NPM Dependencies

`@mlc-ai/web-llm`, `react`, `react-dom`, `tailwindcss`
Dev: `typescript`, `vite`, `@crxjs/vite-plugin`, `vitest`, `@playwright/test`, `@types/react`, `@types/react-dom`, `@types/chrome`

---

## 2. THREE-LAYER DETECTION PIPELINE

**The most important section. Every detection decision flows through this cascade.**

```
Post text extracted from DOM
  |
  v
LAYER 1: Pattern Scan (regex, <5ms)
  |
  +-- ZERO patterns triggered --> PASS. No further processing. (~60-80% of posts)
  |
  +-- Patterns triggered --> preliminary TechniqueResult[]
       |
       v
LAYER 2: Local AI Semantic Analysis (WebLLM, 50-200ms)
  |  Receives: post text + Layer 1 flags
  |  Returns: verified AnalysisResult with adjusted confidence/severity
  |
  +-- confidence > 0.85 --> ACT (neutralize if above mode threshold)
  +-- confidence 0.60-0.85 --> ACT with severity reduced by 1
  +-- confidence < 0.60 AND cloud enabled --> continue to Layer 3
  +-- confidence < 0.60 AND cloud disabled --> PASS
       |
       v
LAYER 3: Cloud Verification (API, 200-800ms, optional)
  |
  +-- Confirms --> ACT
  +-- Denies --> PASS
  +-- Uncertain --> PASS
```

### THE CARDINAL RULE

**When in doubt, PASS. Every ambiguous case defaults to non-intervention.**

A false positive erodes user trust. A false negative is a missed teaching moment. The costs are asymmetric. Under-detection is regrettable. Over-detection is harmful.

---

## 3. EXACT PROMPTS (VERBATIM)

These live in `src/ai/prompts.ts`. Use exactly as written. Do not modify per-provider.

### 3.1 NEUTRALIZATION PROMPT

System: "You are a content neutralizer. Rewrite text to preserve the informational claim while removing all manipulation techniques.

RULES:
1. Preserve the factual claim or opinion being expressed.
2. Attribute to source: 'This account believes...' or 'This poster argues...'
3. Use emotionally neutral language. No fear, shame, urgency, or outrage.
4. Output SHORTER than or equal to input length.
5. Do NOT add commentary, warnings, or meta-text.
6. Do NOT change the topic or add information not in the original.
7. Preserve legitimate factual claims exactly.
8. Write in the same language as the input.

OUTPUT: Return ONLY the rewritten text. No explanations. No labels. No markdown."

User template: "ORIGINAL:\n{text}\n\nDETECTED: {techniques}\n\nNEUTRALIZED:"

### 3.2 LAYER 2 VERIFICATION PROMPT

System: "You verify whether flagged content is genuinely manipulative or a false positive.

MANIPULATION = exploiting psychological vulnerabilities to bypass rational evaluation.
NOT MANIPULATION = persuasion, genuine emotion, cultural expression, satire, irony, news reporting, personal opinion.

CRITICAL CONTEXT RULES:
- A person expressing THEIR OWN emotion ('I'm terrified') is NOT a fear appeal
- Strong political opinion with arguments is NOT an anger trigger
- ALL CAPS in celebration ('CONGRATULATIONS') is NOT misleading format
- Legitimate news about scary events is NOT fearmongering
- Casual hyperbole ('everyone loves this') is NOT bandwagon pressure
- Sarcasm and irony using manipulation-adjacent language are NOT manipulation
- Cultural communication patterns (some communities use intense language normally) are NOT manipulation

For each flagged technique, respond:
CONFIRMED - genuinely manipulative, with severity 1-10
DENIED - false positive, explain briefly
UNCERTAIN - cannot determine

OUTPUT: JSON only, no markdown.
{
  'techniques': [{'name': 'string', 'verdict': 'CONFIRMED|DENIED|UNCERTAIN', 'severity': 1-10, 'reason': 'brief'}],
  'overallManipulative': boolean,
  'overallConfidence': 0.0-1.0
}"

User template: "POST: {text}\n\nFLAGGED: {flags}\n\nVERIFY:"

### 3.3 LAYER 3 DETECTION PROMPT (Cloud Only)

System: "You are an expert manipulation analyst. Analyze text for 10 psychological manipulation techniques: fear-appeal, anger-trigger, shame-attack, false-urgency, bandwagon, scapegoating, fomo, toxic-positivity, misleading-format, combined. Context is everything. When uncertain, lean toward NOT MANIPULATIVE. OUTPUT: JSON only."

---

## 4. LAYER 1: PATTERN SCAN

Each classifier exports: classify(ClassifierInput) -> ClassifierOutput
ClassifierInput: { text: string, author?: string, platform?: string }
ClassifierOutput: { technique: TechniqueName, present: boolean, confidence: number, severity: number, evidence: string[] }

**Layer 1 confidence CAPPED at 0.70.** Regex cannot understand context.

### Classifier Template

STRONG patterns: +3 to score each
MODERATE patterns: +1 to score each
EXCEPTION patterns: if matched, dampen score by 60%
present = severity >= 3
confidence = min(0.4 + severity * 0.04, 0.70)

### Validated Patterns Per Technique

(See RESEARCH_FOUNDATION.md Section 2 for why each technique is included)

**fear-appeal.ts STRONG:**
- /if you don'?t .{0,30} (it'?ll be too late|you'?ll regret|your .{0,20} will suffer)/i
- /\b(catastroph|doomsday|apocalyp|end of the world|total collapse|extinction)\b/i
- /\b(terrif|horrif|nightmare|devastating|deadly|lethal|fatal)\b.*\b(you|your|children|family)\b/i
- /we (only )?have (less than )?\d+ (years?|months?|days?|hours?) (left|before|until)/i
- /\bdon'?t want you to know\b/i
- /\b(they|doctors?|experts?) (are )?(hiding|don'?t want|won'?t tell)\b/i
MODERATE: /\b(danger|threat|crisis|emergency|alarming)\b/i, /\b(warn|alert|beware)\b/i
EXCEPTIONS: /\b(according to|reported by|officials say|data shows|study finds)\b/i, /\b(i'?m (scared|afraid|worried))\b/i

**shame-attack.ts STRONG:**
- /you'?re (disgusting|pathetic|worthless|trash|a joke|embarrassing|terrible|horrible|awful) if/i
- /you'?re .{0,10}(disgusting|pathetic|worthless|terrible|horrible) (person|human)/i
- /\b(real|true|good) (men|women|parents|people) (would|don'?t|always)/i
- /no (real |true )?(man|woman|parent|person) would/i
- /what'?s wrong with you/i
- /you should be (ashamed|embarrassed)/i
- /you'?re just (uneducated|ignorant|stupid|dumb|blind|clueless)/i
- /\bNO EXCUSES\b/
MODERATE: /\b(loser|failure|weak|coward|snowflake)\b/i, /imagine (being|thinking|believing)/i
EXCEPTIONS: /\b(self-reflection|accountability)\b/i, /\b(i feel ashamed|i'?m embarrassed)\b/i

**anger-trigger.ts STRONG:**
- /\b(traitors?|scum|vermin|parasites?|cockroach|subhuman|filth)\b/i
- /(they'?re|are) (destroy|ruin|steal|taking|corrupt)(ing)? (everything|our|your)/i
- /\bwake up (sheeple|people|america|world)\b/i
- /they (don'?t care|laugh at you|hate you|want you to suffer)/i
- /\b(DYING|KILLING|MURDERED|DESTROYED)\b/
- /you'?re (scrolling past|ignoring|doing nothing) while/i
MODERATE: /\b(outrag|infuriat|enrag|disgrac|unforgivable)\b/i
EXCEPTIONS: /\b(i'?m (angry|frustrated|upset|mad))\b/i, /\b(editorial|opinion|commentary)\b/i

**false-urgency.ts STRONG:**
- /\b(LAST CHANCE|NOW OR NEVER|LIMITED TIME|ACT NOW|HURRY)\b/
- /only \d+ (left|remaining|spots|seats|available)/i
- /\b(expires?|ending) (today|tonight|midnight|in \d+)/i
- /don'?t (wait|hesitate|think|delay)/i
- /\bshare this NOW\b/i
- /(in|for) the next \d+ (minutes?|hours?|days?)/i
- /\bclock is ticking\b/i
- /\bbefore it'?s too late\b/i
MODERATE: /\b(urgent|immediately|right now)\b/i
EXCEPTIONS: /\b(deadline|due date|submission|filing|registration closes)\b/i

**bandwagon.ts STRONG:**
- /\beveryone (knows|agrees|understands|can see|else)\b/i
- /\ball (reasonable|smart|educated|good) people\b/i
- /\bnobody (disagrees|denies|questions)\b/i
- /if you (still )?(disagree|think|believe).{0,20}you'?re (the only|just|alone)/i
- /\beveryone (else )?(cares?|is doing|supports?|sees?)\b/i
MODERATE: /\b(millions|thousands|everyone) (is|are) (saying|doing|switching)\b/i
EXCEPTIONS: /\b(survey|poll|study|research|data) (shows|indicates|found)\b/i, /\b\d+% (of|say|agree)\b/i

**scapegoating.ts STRONG:**
- /\b(they|those people|these people) (are|is) (the reason|why|responsible for|to blame|destroying|ruining)\b/i
- /\b(all|every) (immigrants|liberals|conservatives|boomers|millennials|men|women) (are|do|want)\b/i
- /\bblame (the|those|these)\b/i
- /\bit'?s (all )?(their|his|her) fault\b/i
- /\b(traitors?|enemies) in (government|congress|parliament|power)\b/i
EXCEPTIONS: /\b(policy|legislation|decision|action) (led to|caused|resulted)\b/i

**fomo.ts STRONG:**
- /\byou'?re missing out\b/i
- /\b(exclusive|members only|invite only|limited access)\b/i
- /\bdon'?t (miss|let this pass|regret)\b/i
- /\bmiss out (forever|on this)\b/i
- /\bonly available (for|until|today)\b/i
- /\bsecret (method|trick|hack|way|formula)\b/i
EXCEPTIONS: /\b(event|concert|show|game) (tickets|registration)\b/i

**toxic-positivity.ts STRONG:**
- /\bjust (think positive|be happy|smile|stay positive|look on the bright side)\b/i
- /\b(good vibes only|no negativity|stop complaining|be grateful)\b/i
- /\beverything happens for a reason\b/i
- /\b(other people have it worse|at least you)\b/i
EXCEPTIONS: /\b(cognitive (behavioral|reframing)|therapy|counseling)\b/i, /\b(I try to|it helps me to|personally I)\b/i

**misleading-format.ts** — Structural analysis: count ALL-CAPS words (excluding acronyms), emoji density, exclamation density. Score >= 3 = present. Caps ratio threshold: 0.12. See v1 Build Guide for exact algorithm.

---

## 7. SEVERITY SCORING WITH AGE ADJUSTMENT

### Base Aggregation
- 1 technique: that technique's severity
- 2 techniques: highest + (second * 0.3), capped at 10
- 3+: highest + sum(remaining * 0.2), capped at 10

### Age Modifiers (ADDED to base score after aggregation)

| Technique | Child 8-11 | Teen 12-14 | Teen 15-17 | Adult |
|-----------|-----------|-----------|-----------|-------|
| shame-attack | +3 | +2 | +1 | 0 |
| fear-appeal | +2 | +1 | +1 | 0 |
| anger-trigger | +2 | +1 | +1 | 0 |
| fomo | +1 | +3 | +2 | 0 |
| bandwagon | +1 | +2 | +1 | 0 |
| scapegoating | +1 | +1 | +1 | 0 |
| false-urgency | +1 | +1 | 0 | 0 |
| combined | +2 | +1 | +1 | 0 |

Uses highest applicable modifier across detected techniques.

---

## 8. NEUTRALIZATION

Uses prompt from Section 3.1. Every output validated:

1. Length <= original * 1.2 (rewrite not longer than 120% of original)
2. Non-empty (>= 5 chars)
3. Does not contain meta-commentary words (manipulat, propaganda, technique, fallacy, rhetoric)

If validation fails: original passes through unchanged. A bad neutralization is worse than no neutralization.

---

## 9-14. (Router, WebLLM, Cloud, Forensics, Modes, Adapters)

These sections are unchanged from v1 Build Guide. Key specs:

- **Router:** cloud-disabled -> local; confidence > 0.85 -> local; confidence < 0.60 -> cloud; 3+ techniques -> cloud; default -> local
- **WebLLM:** ServiceWorkerMLCEngine in background, auto model selection, CreateServiceWorkerMLCEngine factory
- **Cloud:** All providers implement send(system, user) -> Promise<string>. Gemini, Anthropic, OpenAI, DeepSeek
- **Forensics:** SHA-256 via Web Crypto, IndexedDB append-only, JSON/CSV export
- **Modes:** Child threshold=1 invisible; Teen L1-L4 progressive; Adult on-demand. Autonomy requires 50 quizzes, 80% accuracy, 30 days
- **Adapters:** PlatformAdapter interface with detectPlatform(), getPostSelector(), extractPost(), replaceContent(). Twitter reference implementation.

---

## 15. FILE POPULATION ORDER (10 PHASES)

| Phase | Files | Test |
|-------|-------|------|
| 1: Types + Config | ~12 | `npm install && tsc --noEmit` = 0 errors |
| 2: Content + Twitter | ~5 | Extension loads, console logs tweet text |
| 3: Layer 1 Detection | ~13 | Tweets show pattern scan results in console |
| 4: Layer 2 + Neutralization | ~8 | Posts detected -> AI verified -> neutralized -> replaced in DOM |
| 5: Mode System | ~5 | Mode changes behavior (child invisible, teen badge) |
| 6: Forensics | ~5 | IndexedDB contains ForensicRecords with hashes |
| 7: Cloud (Layer 3) | ~6 | Low-confidence posts route to cloud |
| 8: Popup + Side Panel | ~10 | Popup shows stats, side panel shows analysis |
| 9: Dashboard + Learning | ~14 | Charts from forensic data, quiz works |
| 10: Other Platforms + Tests | ~15 | Works across platforms, tests pass |

---

## 16. CONSISTENCY RULES

1. All imports use path aliases (@types/, @core/, @ai/, etc.)
2. All async functions return typed Promises, never Promise<any>
3. All message passing uses ExtensionMessage type
4. All timestamps: new Date().toISOString()
5. All IDs: crypto.randomUUID()
6. Severity: integers 1-10. present: false instead of 0
7. Confidence: floats 0.0-1.0, two decimal max
8. DOM text: always .trim()
9. originalHash = SHA-256 of original text BEFORE processing
10. Prompts from Section 3 used VERBATIM
11. All classifiers export classify(ClassifierInput): ClassifierOutput
12. Child mode: ZERO visual indication
13. Every async operation: try/catch. Failures = original passes through
14. No external network except cloud AI APIs when enabled
15. src/core/ never imports from src/content/ or src/ui/
16. **Layer 1 confidence CAPPED at 0.70**
17. **All ambiguous cases default to PASS**
18. **Neutralization must pass validation or original is shown**

---

## 17. AGENT INSTRUCTIONS

1. Read docs/RESEARCH_FOUNDATION.md and this document before writing any code
2. Follow Phase order. Do not skip
3. After each phase, verify test criterion passes
4. Use exact prompts from Section 3
5. Use exact algorithms from this document
6. Follow all 18 consistency rules
7. When unsure about UI, refer to Foundation Document
8. If a file needs info not in this doc, flag as TODO. Never hallucinate
9. Project builds as Chrome Extension (Manifest V3)
10. **If detection is uncertain, the answer is PASS. Always.**

---

*End of Master Build Guide v2*
