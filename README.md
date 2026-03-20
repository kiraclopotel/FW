# FeelingWise

**AI-Powered Content Neutralizer**

Neutralize, don't censor. Build immunity, not dependence. Restore agency to the internet.

## What It Does

FeelingWise sits between social media platforms and the user. It detects manipulation techniques in content using a three-layer pipeline (regex scan → local AI verification → optional cloud), then rewrites manipulative content to preserve the information while removing the psychological assault.

Same claim. Same viewpoint. Zero manipulation.

## Three Modes

- **Child (8-11):** Invisible protection. Calmer internet without knowing why.
- **Teen (12-17):** Guided learning. Neutralized content + technique analysis. Progressive autonomy.
- **Adult (18+):** Reasoning mirror. Original content with analysis on demand.

## Setup

```bash
git clone <repository-url>
cd feelingwise
npm install
cp .env.example .env.local   # Add cloud API keys if using cloud AI
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
