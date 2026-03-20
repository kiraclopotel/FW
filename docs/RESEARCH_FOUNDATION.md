# FEELINGWISE RESEARCH FOUNDATION
## Grounding Detection in Science, Not Intuition

**Status:** This document defines the *why* behind every detection decision. It must be read before implementing any classifier. The Master Build Guide tells you *what code to write*. This document tells you *why that code makes those decisions*.

**Core Sources:**
- Cambridge Social Decision-Making Lab (van der Linden, Roozenbeek et al.)
- Inoculation meta-analysis: Simchon et al., 2025, N=37,025
- Transfer gap study: Wang et al., PNAS Nexus 2025
- Google/Jigsaw prebunking collaboration
- SemEval persuasion technique detection tasks (2023, 2024)
- Frontiers survey: "Decoding persuasion" (Bassi et al., 2024)

---

## 1. THE FUNDAMENTAL DISTINCTION: PERSUASION vs. MANIPULATION

This is the single most important concept in FeelingWise. Get this wrong and everything downstream fails.

### What is Persuasion?

Persuasion is the attempt to change someone's mind using evidence, argument, or appeal. It is a normal, necessary part of human communication. A doctor persuading a patient to take medication. A parent persuading a child to eat vegetables. An editorial arguing for a policy position. These are all persuasion. FeelingWise does NOT flag persuasion.

### What is Manipulation?

Manipulation is the attempt to change someone's behavior by exploiting psychological vulnerabilities rather than engaging their rational faculties. The distinction is not in the *goal* (both want to change minds) but in the *method*:

| Dimension | Persuasion | Manipulation |
|-----------|-----------|--------------|
| Engages | Rational evaluation | Emotional bypass |
| Respects | Audience autonomy | Exploits audience vulnerability |
| Relies on | Evidence and argument | Psychological pressure |
| Transparent about | Its own intent | Hides its intent |
| Outcome if detected | Still potentially valid | Loses all force |

**The Litmus Test:** If you strip the emotional packaging from a piece of content and present only the factual claim, does the content still have persuasive force? If yes, it was persuasion. If no — if the content's entire impact depended on the emotional packaging — it was manipulation.

This is exactly what FeelingWise's neutralization does. It applies this litmus test automatically: rewrite the content as a neutral factual claim, and see what survives.

### Why This Distinction Matters for False Positives

A false positive in FeelingWise is not "we flagged a post that was fine." It is "we told someone their legitimate expression was manipulative." That is a trust-destroying event. The research confirms this concern:

The Cambridge meta-analysis found that proper inoculation "improves discrimination without increasing response bias" — meaning people get better at spotting manipulation WITHOUT becoming cynical about everything. FeelingWise must mirror this property. If our tool makes users suspicious of legitimate content, we are causing the same harm we claim to prevent, just in the opposite direction.

The PNAS Nexus 2025 paper found that inoculation's "difficulty arises in applying what they have learned in contexts where cases of emotional manipulation are less obvious." This means the easy cases (obvious rage-bait, blatant shame attacks) are not where we fail. We fail on the ambiguous cases — the content that *might* be manipulation or *might* be genuine strong emotion. Our detection system must handle ambiguity gracefully, erring toward non-intervention rather than over-flagging.

**Rule: When in doubt, do not flag. A missed manipulation is a missed opportunity for education. A false positive is an active harm.**

---

## 2. THE TECHNIQUE TAXONOMY

### 2.1 Reconciling Our 10 Techniques with the Research

The Cambridge/Jigsaw collaboration identified 5 core manipulation techniques validated across 30,000+ participants. FeelingWise uses 10. Here is the mapping, justification, and research basis for each:

#### TIER 1: Research-Validated Techniques (Direct Cambridge/Jigsaw Matches)

**1. FEAR APPEAL (= Jigsaw's "Fearmongering")**
- Research basis: One of the original 5 Jigsaw inoculation targets
- Psychological mechanism: Activates the amygdala's threat response, bypassing prefrontal cortex evaluation. Under fear, humans default to heuristic processing (Kahneman System 1) rather than analytical processing (System 2)
- Key distinction from legitimate concern: Fear appeals use *disproportionate* alarm relative to actual risk. "Climate change is a serious problem" = concern. "Your children will DIE if you don't act NOW" = fear appeal. The amplification beyond evidence is the signal
- Detection challenge: News reporting about genuinely scary events (pandemics, disasters, violence) uses strong language that overlaps with fear appeal patterns. Context is everything

**2. SCAPEGOATING (Direct Jigsaw Match)**
- Research basis: One of the original 5 Jigsaw inoculation targets
- Psychological mechanism: Exploits the brain's preference for simple causal narratives (monocausal explanation bias). Complex problems with systemic causes are cognitively expensive to analyze. Attributing them to a single group is cognitively cheap
- Key distinction from legitimate criticism: Scapegoating attributes COMPLEX SYSTEMIC problems to IDENTIFIABLE GROUPS. Criticizing a specific person's specific action is not scapegoating. Blaming "all immigrants" for economic problems is
- Detection challenge: Political discourse regularly involves group-level claims. "This administration's policies caused X" is criticism. "Those people are destroying our country" is scapegoating. The line is group-level blame for systemic complexity

**3. AD HOMINEM (Maps to our "Shame Attack")**
- Research basis: One of the original 5 Jigsaw inoculation targets
- Psychological mechanism: Attacks the person rather than the argument. In our taxonomy, we call this "shame-attack" because in social media the attack specifically targets identity and self-worth, not just credibility
- Why we renamed it: "Ad hominem" is a logical fallacy term that teens won't connect with. "Shame attack" describes the experiential effect — which is what the user feels and what the tool needs to help them understand
- Key distinction: Criticizing someone's specific behavior ("that argument is poorly supported") is not ad hominem. Attacking their identity or worth ("you're disgusting if you think that") is
- Detection challenge: Heated but genuine disagreement can contain personal elements. "I think you're wrong and here's why" vs. "You're an idiot if you believe this" — the former engages the argument, the latter bypasses it

#### TIER 2: Research-Supported Techniques (Not in Jigsaw 5, But Literature-Validated)

**4. FALSE URGENCY**
- Research basis: Cialdini's "scarcity principle" (Influence, 1984); extensively documented in marketing psychology; SemEval propaganda detection tasks include this
- Psychological mechanism: Creates artificial time pressure that prevents reflective processing. Under time pressure, humans rely more heavily on heuristics and emotional responses
- Key distinction: Real deadlines ("filing deadline is April 15") are not false urgency. Manufactured deadlines ("ONLY 2 HOURS LEFT to save your family") are
- Detection challenge: E-commerce legitimately uses scarcity ("sale ends Sunday"). This is a lower-severity case — honest but still using psychological pressure. FeelingWise should detect it at lower severity, not block it

**5. BANDWAGON PRESSURE**
- Research basis: Asch conformity experiments; social proof theory (Cialdini); documented in SemEval propaganda taxonomy
- Psychological mechanism: Humans are social animals who use group consensus as an information shortcut. Fabricated consensus exploits this by making dissent feel abnormal and isolating
- Key distinction: Citing actual data ("73% of respondents prefer remote work") is social proof but not manipulation — it's evidence. "EVERYONE agrees" without evidence is bandwagon
- Detection challenge: Colloquial hyperbole ("everyone loves this restaurant") is bandwagon-structured but not manipulative in intent. Severity should be low for casual usage, high for political/identity-charged contexts

**6. ANGER/OUTRAGE TRIGGER**
- Research basis: McLoughlin et al., 2024 (misinformation exploits emotions, especially outrage); Vosoughi et al., 2018 (false news spreads faster partly due to emotional novelty); documented in SemEval tasks
- Psychological mechanism: Anger narrows attentional focus and increases reliance on heuristic processing. An angry person is measurably less capable of analytical evaluation. Content designed to trigger anger is therefore designed to reduce the reader's critical capacity
- Key distinction from legitimate anger: A person expressing THEIR OWN anger ("I'm furious about this injustice") is not deploying an anger trigger. Content DESIGNED TO MAKE THE READER angry is ("These TRAITORS are DESTROYING everything"). The direction of the emotion is the signal: inward expression vs. outward provocation
- Detection challenge: This is the hardest technique to distinguish from genuine passionate advocacy. Political content is often legitimately anger-inducing. The question is whether the anger serves the argument or replaces it

**7. FOMO (Fear of Missing Out)**
- Research basis: Przybylski et al., 2013 (original FOMO research); extensively documented in marketing and social media psychology
- Psychological mechanism: Exploits loss aversion — the pain of missing out is psychologically stronger than the pleasure of gaining. Combined with artificial scarcity, creates compulsive engagement
- Key distinction: An event genuinely has limited tickets. That's real scarcity. "This SECRET METHOD that only a FEW people know about" is manufactured exclusivity
- Detection challenge: Influencer culture makes FOMO-structured content ubiquitous. Much of it is low-severity commercial content, not psychological assault. Severity calibration matters — not every "don't miss this" is harmful

#### TIER 3: FeelingWise-Specific Techniques (Less Formal Research, High Practical Relevance)

**8. TOXIC POSITIVITY**
- Research basis: Quintero & Long, 2019; emerging research on emotion invalidation in digital spaces
- Psychological mechanism: Dismisses legitimate negative emotions, preventing the reader from processing genuine distress. Creates guilt for feeling bad ("other people have it worse"). Particularly harmful to children and teens who are developing emotional vocabulary
- Key distinction: Genuine encouragement ("I believe you can get through this") is not toxic positivity. Dismissal of legitimate distress ("just think positive!") is
- Detection challenge: Wellness and self-help content walks this line constantly. Cultural context matters — some cultures value stoic positivity more than others. Lower severity threshold, more reliance on AI contextual analysis

**9. MISLEADING FORMATTING**
- Research basis: Visual rhetoric research; attentional capture studies; documented in SemEval as a component of propaganda detection
- Psychological mechanism: ALL CAPS, emoji saturation, and visual hierarchy manipulation exploit bottom-up attentional capture — they grab attention regardless of content quality, creating false salience
- Key distinction: Emphasis for clarity ("the deadline is MARCH 15") is functional formatting. ALL CAPS emotional words designed to amplify psychological impact ("You're DISGUSTING and PATHETIC") is manipulative formatting
- Detection challenge: This is the most straightforward technique to detect (structural analysis, not semantic) but has the most legitimate uses. Severity must be context-dependent — caps in a shame attack vs. caps in a celebration

**10. COMBINED ATTACKS**
- Research basis: Propaganda analysis literature consistently finds that real-world manipulation layers multiple techniques for compound effect
- Psychological mechanism: Each technique exploits a different psychological vulnerability. Combined, they overwhelm the reader's capacity to resist any single one. A post using shame + urgency + bandwagon creates a triple-bind
- Key distinction: This is a meta-technique — it's detected when 3+ other techniques co-occur in a single post, scored non-linearly higher than any individual technique
- Detection challenge: Long posts naturally touch more themes and may trigger multiple classifiers without being manipulative. The combined classifier must verify that the techniques are *reinforcing* each other, not merely co-occurring

### 2.2 Techniques We Explicitly Do NOT Detect

FeelingWise does not flag:

- **Satire and irony.** These use manipulation-adjacent structures for comedic or critical effect. A satirical post saying "EVERYONE should DEFINITELY trust the government, they've NEVER lied" is using caps and bandwagon language, but the intent is the opposite. Detection of irony is an unsolved NLP problem. We err on the side of not flagging
- **Legitimate persuasion with strong language.** An editorial arguing passionately for a position using evidence and argument is not manipulation even if it's emotional
- **Cultural expression patterns.** Some communities, demographics, and cultures use caps, emoji, and intensifiers as standard communication. This is not manipulation
- **Personal emotional expression.** "I'm terrified about this" is a person sharing feelings, not deploying a fear appeal
- **Disagreement.** Thinking someone is wrong, even saying so bluntly, is not manipulation unless it employs specific technique structures

---

## 3. THE HYBRID DETECTION METHODOLOGY

### 3.1 Why Regex Alone Fails

Our v2 regex patterns scored 95% recall / 0% false positives on a curated test set of 16 posts. This is misleading for three reasons:

1. **Real-world content is vastly more diverse.** 16 posts cannot represent the billions of real posts. Real posts include slang, code-switching, sarcasm, irony, misspellings, emoji-only communication, and cultural idioms our patterns have never seen
2. **The test set was written by us to match our patterns.** Of course they match. Real manipulation uses techniques we haven't enumerated. Real benign content uses patterns we haven't excepted
3. **Context makes the same words manipulative or benign.** "Wake up people" from a conspiracy theorist is an anger trigger. "Wake up people, it's a beautiful morning" is a cheerful greeting. Regex cannot tell the difference

### 3.2 The Three-Layer Architecture

Based on the Frontiers survey recommendation for hybrid approaches, FeelingWise uses three layers:

**LAYER 1: Pattern Scan (Rule-Based, <5ms)**
- Purpose: Fast first filter. Runs on every post
- Method: Regex patterns from MASTER_BUILD_GUIDE.md Section 4
- Output: List of potentially-triggered techniques with preliminary confidence scores
- Behavior: Posts with ZERO pattern triggers pass through with no further processing. This is ~60-80% of content and must be fast
- False positive tolerance: HIGH. This layer over-triggers on purpose. It casts a wide net. Layer 2 narrows

**LAYER 2: Semantic Analysis (Local AI, 50-200ms)**
- Purpose: Context-aware verification. Runs only on posts that triggered Layer 1
- Method: The local WebLLM model receives the post text + the techniques Layer 1 flagged, and evaluates whether the flagged patterns are genuinely manipulative in context
- Prompt: Uses DETECTION_ASSIST prompt from Master Build Guide Section 2.2
- Output: Verified AnalysisResult with adjusted confidence and severity scores
- Behavior: Can DOWNGRADE Layer 1 flags (reduce confidence, reduce severity, mark as non-manipulative). Can also UPGRADE (increase severity if the AI detects additional techniques the regex missed)
- False positive tolerance: LOW. This is the quality gate. If the AI isn't confident, the post passes through

**LAYER 3: Cloud Verification (Cloud AI, 200-800ms, Optional)**
- Purpose: Expert opinion on hard cases. Runs only when Layer 2 confidence is below threshold AND cloud is enabled
- Method: Larger cloud model receives full analysis and makes final determination
- Output: Final AnalysisResult
- Behavior: Can override Layer 2 in either direction. This is the "second opinion" layer
- False positive tolerance: VERY LOW. Cloud should only confirm, not introduce new flags

### 3.3 The Confidence Cascade

```
Post arrives
  │
  ├─ Layer 1: Pattern Scan
  │   No patterns triggered → PASS (no further processing)
  │   Patterns triggered → Continue to Layer 2
  │
  ├─ Layer 2: Local AI Semantic Analysis  
  │   Confidence > 0.85 → ACT (neutralize if above mode threshold)
  │   Confidence 0.60-0.85 → ACT with reduced severity (-1)
  │   Confidence < 0.60 AND cloud enabled → Continue to Layer 3
  │   Confidence < 0.60 AND cloud disabled → PASS (not confident enough to intervene)
  │
  └─ Layer 3: Cloud Verification
      Confirms manipulation → ACT
      Denies manipulation → PASS
      Uncertain → PASS (never act on uncertainty)
```

**The critical principle: EVERY ambiguous case defaults to PASS.** Under-detection is regrettable. Over-detection is harmful.

---

## 4. ADDRESSING THE TRANSFER GAP

The PNAS Nexus 2025 study found that inoculation struggles to transfer from controlled settings to real social media feeds. This is the problem FeelingWise was built to solve, but we must solve it correctly.

### 4.1 Why FeelingWise's Approach Addresses the Gap

Traditional inoculation: Learn about manipulation techniques in one context (video, game, classroom) → Try to apply that knowledge later in a different context (live social media feed) → Transfer fails because the contexts are too different.

FeelingWise's approach: See manipulated content → Simultaneously see the neutralized version AND the technique analysis → The learning happens AT THE POINT OF EXPOSURE, not separately. There is no transfer gap because there is no transfer — the learning and the application happen in the same moment, on the same content.

This is the core innovation. It must be preserved in implementation. The teen mode analysis panel must appear alongside the neutralized content, not in a separate section. The learning zone games must use REAL posts the teen has encountered (anonymized), not synthetic examples.

### 4.2 The Over-Cynicism Risk

The Cambridge meta-analysis found that proper inoculation doesn't increase general skepticism. But the PNAS study's finding about "limited effectiveness" warns us that people struggle to apply inoculation spontaneously. There's a risk gradient:

- Too little detection → Tool seems useless → User abandons it → No protection
- Right detection → Tool catches real manipulation → User learns patterns → Eventually doesn't need tool → SUCCESS
- Too much detection → Tool flags everything → User becomes cynical about all content → Distrust of legitimate information → HARM

FeelingWise must sit in the middle zone. The calibration mechanism is the severity threshold:

- Child mode: Lower threshold (intervene more) because the cost of missing manipulation on a child is higher than occasional over-flagging that the child doesn't see anyway (it's invisible)
- Teen mode: Medium threshold, and the teen can see and challenge the tool's decisions (building critical thinking)
- Adult mode: Higher threshold (intervene less) because adults should be trusted to handle moderate manipulation and only need help with severe cases

### 4.3 Measuring Success

FeelingWise must track its own accuracy over time. The forensic layer already logs every decision. We add:

- **User disagreement tracking:** When a user marks a neutralization as "wrong" (teen mode: "this wasn't manipulative"; adult mode: "I disagree with this flag"), that's a signal. High disagreement rate = threshold too low
- **Technique distribution monitoring:** If 80% of flagged posts are "misleading-format" (caps detection), the system might be over-weighting a low-harm technique
- **Platform comparison sanity check:** If one platform shows 10x more flags than another for similar content, the platform adapter may have issues, not the content

---

## 5. NEUTRALIZATION: THE HARDEST PROBLEM

Detection tells us WHAT is manipulative. Neutralization tells us what to DO about it. The neutralization must:

1. **Preserve the factual claim.** If someone says "immigrants are DESTROYING this country," the factual claim is "this person believes immigration harms the country." The neutralization must preserve that claim
2. **Attribute to the source.** The neutralized version must make explicit that this is one person's/account's view, not objective truth. "This account argues that immigration policy needs reform"
3. **Remove the manipulation technique.** The emotional amplification, the caps, the dehumanization, the urgency — these are stripped
4. **Not editorialize.** The neutralized version does NOT add "this is a common scapegoating technique" or "studies show immigration is beneficial." That would make FeelingWise a propaganda tool for a different position. We neutralize, period
5. **Be shorter than or equal to the original.** A neutralized version that's twice as long disrupts the feed layout and draws attention to itself (violating child mode's invisibility requirement)

### 5.1 Neutralization Quality Criteria

A good neutralization passes all five checks:
- [ ] Same topic as original? (YES required)
- [ ] Factual claim preserved? (YES required)
- [ ] Attributed to source? (YES required)
- [ ] Manipulation techniques removed? (YES required)
- [ ] Length ≤ original? (YES required)

A neutralization that fails ANY check should be discarded, and the original should pass through unchanged. **A bad neutralization is worse than no neutralization.** If the AI produces a rewrite that changes the topic, adds editorial commentary, or distorts the original claim, the tool becomes exactly the kind of content manipulation it claims to fight.

### 5.2 The Neutralization Evaluation Problem

We cannot test neutralization quality with automated metrics alone. "Did the rewrite remove the shame attack?" requires human judgment. Before deployment, neutralization quality must be evaluated by:

1. **Human review of at least 200 neutralized posts** across all technique categories
2. **Checks for political bias:** Are left-leaning and right-leaning posts neutralized with equal quality?
3. **Checks for cultural bias:** Are posts from different cultural communication styles handled appropriately?
4. **Checks for meaning preservation:** Does a reader of the neutralized version understand the original poster's actual position?

This evaluation cannot be skipped or automated. It is the quality gate before any public release.

---

## 6. DEVELOPMENTAL PSYCHOLOGY: AGE-APPROPRIATE DETECTION

### 6.1 Why Age Matters for Detection

A child's prefrontal cortex — responsible for analytical evaluation, impulse control, and critical thinking — is not fully developed until the mid-twenties. This means:

- **Ages 8-11:** Very limited capacity to distinguish persuasion from manipulation. The child processes content emotionally first and analytically rarely. Detection threshold should be LOW (catch more, including moderate manipulation that an adult could handle)
- **Ages 12-14:** Developing capacity for abstract reasoning but still highly susceptible to social pressure (bandwagon, FOMO) and identity threats (shame attacks). These techniques should be weighted higher for this age group
- **Ages 15-17:** Increasing analytical capacity but still vulnerable to emotional bypass, especially under stress, fatigue, or social pressure. Progressive autonomy is appropriate
- **Ages 18+:** Full analytical capacity available but often not deployed during casual scrolling (Kahneman System 1 dominance). Adults benefit from on-demand analysis, not automatic intervention

### 6.2 Age-Adjusted Severity

The same technique should produce different severity scores for different age groups:

| Technique | Child (8-11) | Teen (12-14) | Teen (15-17) | Adult (18+) |
|-----------|-------------|-------------|-------------|------------|
| Shame Attack | +3 | +2 | +1 | 0 |
| Fear Appeal | +2 | +1 | +1 | 0 |
| FOMO | +1 | +3 | +2 | 0 |
| Bandwagon | +1 | +2 | +1 | 0 |
| Scapegoating | +1 | +1 | +1 | 0 |
| False Urgency | +1 | +1 | 0 | 0 |
| Anger Trigger | +2 | +1 | +1 | 0 |

These modifiers ADD to the base severity score. A shame attack that scores 5 for an adult scores 8 for a child. This ensures children are protected from content that an adult could brush off.

---

## 7. OPEN QUESTIONS REQUIRING FURTHER RESEARCH

These are gaps we have identified but not yet resolved. Each one must be addressed before the corresponding feature is implemented.

### 7.1 Irony and Sarcasm Detection
Current NLP cannot reliably detect irony. A sarcastic post using manipulation patterns will be falsely flagged. Possible mitigations: lower confidence for posts with irony markers ("/s", certain emoji patterns, quote-tweet format), or accept this as a known limitation and document it.

### 7.2 Multi-Language Support
The regex patterns are English-only. Manipulation exists in every language. The AI layer can handle multiple languages, but the fast Layer 1 filter cannot. For non-English content, Layer 1 must be bypassed and all analysis done by the AI layer (slower but language-agnostic).

### 7.3 Image and Video Manipulation
FeelingWise currently processes text only. But manipulation increasingly occurs in images (visual rhetoric, shock imagery), video (emotional music, editing techniques), and audio (tone of voice, cadence). This is a future expansion, not a v1 requirement.

### 7.4 Neurodivergent Communication Patterns
People with autism, ADHD, and other neurodivergent conditions may use communication patterns (intense language, caps for emphasis, direct phrasing) that resemble manipulation techniques but are genuine self-expression. The system should not pathologize neurodivergent communication.

### 7.5 Adversarial Attacks
If FeelingWise becomes widely used, manipulators will adapt their language to evade detection. Misspellings ("d1sgusting"), unicode substitution, image-based text, and novel framing will emerge. The regex layer will miss these; the AI layer should catch most; but an ongoing update cycle is necessary.

---

## 8. RECOMMENDATIONS FOR IMPLEMENTATION

Based on this research review:

1. **Implement the three-layer hybrid architecture.** Do not ship with regex-only detection. Layer 2 (AI verification) is not optional — it is the quality gate that prevents false positives
2. **Err toward PASS on ambiguous cases.** The cost of a false positive (eroding trust in the tool) exceeds the cost of a false negative (missed teaching moment)
3. **Test neutralization quality with human evaluators** before any public release. Automated metrics are insufficient for this task
4. **Include age-adjusted severity modifiers.** The same content poses different risks to different age groups
5. **Track and report the tool's own accuracy** via user disagreement rates. If users consistently disagree with flags, the thresholds need adjustment
6. **Document known limitations honestly.** Irony detection failure, English-only patterns, image-based manipulation blindness — these should be stated, not hidden
7. **Ground the technique taxonomy in the Cambridge/Jigsaw research** but extend it for FeelingWise's specific use case (social media feed, not news articles)
8. **Preserve the simultaneous-exposure design** in teen mode — this is FeelingWise's answer to the transfer gap problem, and it must not be compromised in implementation

---

*This document should be updated as new research emerges. Detection science is evolving. FeelingWise's algorithms must evolve with it.*

*Last updated: March 2026*
