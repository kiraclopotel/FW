# FeelingWise

**AI-Powered Parental Content Shield for Social Media**

Neutralize, don't censor. Build immunity, not dependence. Restore agency to the internet.

## What It Does

FeelingWise is a Chrome extension that sits between social media platforms and the user. It detects manipulation techniques in content — sarcasm, bandwagon pressure, shame attacks, fear appeals, toxic positivity, peer pressure, mockery — using a three-layer detection pipeline, then neutralizes content age-appropriately.

Same claim. Same viewpoint. Zero manipulation.

## Supported Platforms

| Platform | Text Scanning | Comment Rewriting | Engagement Control |
|----------|:---:|:---:|:---:|
| TikTok | Yes | Yes | Yes |
| Twitter/X | Yes | — | Yes |
| YouTube | Yes | Yes | — |
| Instagram | Yes | Yes | — |
| Facebook | Yes | Yes | — |
| Reddit | Yes | — | — |
| 4chan | Yes | — | — |

## Three Modes

### Child (8-12)
Invisible protection. The child sees a calmer, safer internet without knowing why.
- Engagement metrics hidden (like counts, share counts)
- Action buttons removed (like, comment, share)
- Comment posting blocked
- Comments replaced with age-appropriate educational facts and questions
- Profanity filtered (replaced with asterisks)
- Manipulative text neutralized silently

### Teen (13-17)
Guided learning. Neutralized content with technique explanations. Progressive autonomy.
- Engagement metric counts hidden
- Manipulative comments rewritten in clear, natural language
- Sarcasm decoded with explanations
- Manipulation techniques identified and explained (with toggle to view originals)
- Lesson cards teach critical thinking

### Adult (18+)
Reasoning mirror. Original content with optional analysis.
- Optional metric hiding
- Optional profanity filtering (`adultCleanLanguage`)
- Analysis on demand

## Parent Controls

Granular per-platform settings give parents full control:

- **Per-platform action blocking** — enable/disable action hiding independently for TikTok, Twitter, Instagram, Facebook
- **Metric hiding** — hide engagement counts in child, teen, or adult mode
- **Comment modes** — choose between hidden comments or educational replacements (child mode)
- **Posting blocks** — prevent comment posting in child mode
- **Daily usage caps** — limit API calls per day
- **Educational topics** — configure which topics appear in child educational comments (science, nature, history, math, languages, philosophy)

## Architecture

```
Content Script → Platform Adapter → ContentInterceptor → Processing Queue
                                                              ↓
                   Layer 1: Regex Detection (< 5ms) ←─── Detection Pipeline
                   Layer 2: Local AI Verification          ↓
                   Layer 3: Cloud AI (optional)        Neutralizer → DOM Injection
                                                              ↓
                                              Engagement Controller (metrics, actions)
                                              Video Pipeline (comment rewriting, overlays)
```

**Multi-provider AI support:** DeepSeek, Anthropic (Claude), OpenAI, Google Gemini, or managed credits.

## Setup

```bash
git clone <repository-url>
cd FW
npm install
npm run dev
```

Load in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`

## Documentation

| Document | Purpose |
|----------|---------|
| `MASTER_BUILD_GUIDE.md` | **Single source of truth** for implementation |
| `docs/RESEARCH_FOUNDATION.md` | Scientific grounding for detection decisions |
| `docs/ARCHITECTURE.md` | Quick reference for system structure |
| `docs/CONTRIBUTING.md` | How to contribute |

## Cardinal Rule

**When in doubt, PASS.** Under-detection is regrettable. Over-detection is harmful.

## License

TBD
