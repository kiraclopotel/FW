# FeelingWise Architecture

## Document Hierarchy

1. **Foundation Document** (docx) — The vision, the ethics, the world we're building
2. **Technical Architecture + Addendum** (docx) — High-level system overview
3. **MASTER_BUILD_GUIDE.md** — Single source of truth for implementation. WINS in any conflict
4. **docs/RESEARCH_FOUNDATION.md** — Scientific grounding for all detection decisions

## Quick Reference

### Three-Layer Detection Pipeline
1. **Layer 1: Pattern Scan** — Regex, <5ms, wide net, confidence capped at 0.70
2. **Layer 2: Local AI** — WebLLM verification, 50-200ms, quality gate
3. **Layer 3: Cloud AI** — Optional, for hard cases only, 200-800ms

### Cardinal Rule: When in doubt, PASS.

### Key Directories
- `src/core/` — Detection and neutralization engine (platform-agnostic)
- `src/content/` — Browser extension content scripts (platform-specific)
- `src/ai/` — Local (WebLLM) and cloud AI integration
- `src/forensics/` — Evidence logging and export
- `src/modes/` — Child/Teen/Adult behavior configuration
- `src/ui/` — All user interface surfaces

### Local AI: WebLLM
No Ollama. No installation. WebLLM runs in-browser via WebGPU.
Model auto-downloads on first use, caches permanently.
