# Mode Switch Manual Testing Checklist

Manual test cases for verifying mode switching (child/teen/adult) across TikTok and Twitter.

For each test case:
- **Starting state** — which mode and platform
- **Action** — what to do
- **Expected result** — what should happen in the DOM
- **How to verify** — what to check in DevTools

---

## Quick Reference

### Data Attributes

| Attribute | Values | Meaning |
|---|---|---|
| `data-fw-action-rail` | `hidden` / `neutralized` / `adult-pass` | TikTok action rail state |
| `data-fw-action-row` | `hidden` / `neutralized` / `adult-pass` | Twitter action row state |
| `data-fw-comment-section` | `hidden` / `teen-discovered` / `adult-pass` | TikTok comment section state |

### Injected Style Tag IDs

| ID | Controls |
|---|---|
| `fw-tiktok-action-rail-css` | TikTok like/comment/share button strip |
| `fw-tiktok-comment-section-css` | TikTok comment section visibility |
| `fw-twitter-engagement-css` | Twitter reply/retweet/like/bookmark row |

### Key Platform Selectors

**TikTok action rail anchors:**
`[data-e2e="like-icon"]`, `[data-e2e="comment-icon"]`, `[data-e2e="share-icon"]`

**TikTok count elements:**
`[data-e2e="like-count"]`, `[data-e2e="comment-count"]`, `[data-e2e="share-count"]`, `[data-e2e="undefined-count"]`

**TikTok comment section:**
`[data-e2e^="comment-level-"]`, `[data-e2e="comment-input"]`, `[data-e2e="comment-post"]`

**Twitter action row buttons:**
`button[data-testid="reply"]`, `button[data-testid="retweet"]`, `button[data-testid="like"]`, `button[data-testid="bookmark"]`

**Twitter action row container:**
`[role="group"]` (containing 2+ of the above buttons)

**Twitter analytics:**
`a[href*="/analytics"]`

---

## Test 1: TikTok Child Mode — Action Rail Completely Gone

**Starting state:** Child mode, TikTok feed loaded, scrolled to a video.

**Action:** Observe the right side of the video where like/comment/share buttons normally appear.

**Expected result:**
- The entire action rail (like, comment, share, bookmark buttons) is not visible.
- The container element still exists in the DOM but has `display: none !important` and `visibility: hidden !important`.

**How to verify:**
1. Open DevTools → Elements panel.
2. Search for `[data-fw-action-rail]`. Every match should have value `"hidden"`.
3. Click on a matched element → Styles panel should show:
   - `display: none !important`
   - `visibility: hidden !important`
4. Search the `<head>` for `<style id="fw-tiktok-action-rail-css">` — it should exist.
5. The count elements (`[data-e2e="like-count"]`, `[data-e2e="comment-count"]`, `[data-e2e="share-count"]`) should also be invisible since the parent is hidden.
6. Console should have no errors.

---

## Test 2: TikTok Child Mode — Comment Section Hidden (or Educational)

**Starting state:** Child mode, TikTok video page with comments area.

**Action:** Look where the comment section normally appears below or beside the video.

**Expected result:**
- If `childCommentMode` is `'hidden'` (default is `'educational'`): the comment section is not visible at all.
- If `childCommentMode` is `'educational'`: the native comments are replaced with AI-generated educational comments.
- The comment input box and post button are hidden regardless of `childCommentMode` (controlled by `childBlockPosting`).

**How to verify:**
1. Search for `[data-fw-comment-section]` in Elements panel — value should be `"hidden"`.
2. Search the `<head>` for `<style id="fw-tiktok-comment-section-css">` — it should exist.
3. Search for `[data-e2e="comment-input"]` — should have `display: none !important`.
4. Search for `[data-e2e="comment-post"]` — should have `display: none !important`.
5. Search for `[data-fw-post-blocked="true"]` — should exist on the posting elements.
6. If educational mode: look for FW-injected educational content replacing native comments.

---

## Test 3: Switch TikTok Child → Teen — Action Rail Reappears with Hidden Counts

**Starting state:** Child mode on TikTok with action rail hidden (Test 1 verified).

**Action:** Open the extension popup and switch mode from Child to Teen. (Enter parent PIN if prompted.) Do NOT reload the page.

**Expected result:**
- The action rail buttons (like, comment, share) reappear and are clickable.
- The count numbers next to each button are invisible — the space is still occupied but the text is not shown.
- The `resetEngagementDOM()` function fires first, clearing all old markers and styles, then teen-mode controls are applied.

**How to verify:**
1. Immediately after switching, search for `[data-fw-action-rail]`:
   - Old `"hidden"` values should be gone.
   - New value should be `"neutralized"` on each action rail.
2. Inspect a count element (e.g., `[data-e2e="like-count"]`):
   - Should have `visibility: hidden !important` (not `display: none`).
   - The element still occupies layout space (no layout shift).
3. Verify the old `<style id="fw-tiktok-action-rail-css">` was removed and a new one injected.
4. Click the like button — it should still function (the button itself is visible and interactive).
5. No stale `data-fw-action-rail="hidden"` attributes should remain anywhere.

---

## Test 4: Switch TikTok Teen → Adult — Action Rail Fully Visible with Counts

**Starting state:** Teen mode on TikTok with action rail neutralized (Test 3 verified).

**Action:** Switch mode from Teen to Adult via the extension popup.

**Expected result:**
- Action rail buttons are fully visible.
- All count numbers (likes, comments, shares) are fully visible.
- Markers change to `adult-pass`.

**How to verify:**
1. Search for `[data-fw-action-rail]` — value should be `"adult-pass"`.
2. Inspect count elements (`[data-e2e="like-count"]`, etc.):
   - `visibility` should be `visible` (or unset/inherited — no `hidden`).
   - Actual numbers should be rendered and readable.
3. No `fw-tiktok-action-rail-css` style tag should be injecting hide/neutralize rules.
4. Buttons should be fully interactive with visible counts.

---

## Test 5: Switch TikTok Adult → Child — Action Rail Disappears Again

**Starting state:** Adult mode on TikTok with everything visible (Test 4 verified).

**Action:** Switch mode from Adult to Child via the extension popup. Enter parent PIN if prompted.

**Expected result:**
- The action rail disappears completely (same as Test 1).
- All `adult-pass` markers are cleared and replaced with `hidden`.
- Comment section also hides.

**How to verify:**
1. Search for `[data-fw-action-rail]`:
   - No `"adult-pass"` values should remain.
   - All should now be `"hidden"`.
2. Inline styles on the action rail container: `display: none !important`.
3. `<style id="fw-tiktok-action-rail-css">` should be present in `<head>`.
4. `[data-fw-comment-section="hidden"]` should reappear.
5. Scroll to a new video — new action rails should also be hidden immediately (MutationObserver catches new DOM).

---

## Test 6: Twitter Child Mode — Action Rows Under Tweets Gone

**Starting state:** Child mode, Twitter/X feed loaded.

**Action:** Scroll through the timeline and observe the area below each tweet where reply/retweet/like/bookmark buttons normally appear.

**Expected result:**
- The action row under every tweet is not visible.
- The row element still exists in the DOM but has `display: none !important`, `height: 0 !important`, `overflow: hidden !important`.

**How to verify:**
1. Search for `[data-fw-action-row]` — all matches should have value `"hidden"`.
2. Click on a matched element → Styles panel should show:
   - `display: none !important`
   - `height: 0 !important`
   - `overflow: hidden !important`
3. Search `<head>` for `<style id="fw-twitter-engagement-css">` — should exist.
4. Verify by searching for `[role="group"]` elements that contain `button[data-testid="reply"]` — these are the action row containers, and they should all be marked.
5. The tweet text, images, and user info above should still render normally — no layout collapse.

---

## Test 7: Twitter Child → Teen — Action Rows Reappear, Counts Hidden

**Starting state:** Child mode on Twitter with action rows hidden (Test 6 verified).

**Action:** Switch mode from Child to Teen via the extension popup.

**Expected result:**
- Reply, retweet, like, bookmark buttons reappear and are clickable.
- The numeric count spans inside each button are invisible.
- Analytics links (`a[href*="/analytics"]`) are hidden.

**How to verify:**
1. Search for `[data-fw-action-row]` — value should change to `"neutralized"`.
2. Inspect a button, e.g., `button[data-testid="like"]`:
   - The button itself is visible.
   - Find the `<span>` inside it that holds the count number — it should have `visibility: hidden !important`.
3. Search for `a[href*="/analytics"]` — should have `display: none` or `visibility: hidden`.
4. No `data-fw-action-row="hidden"` attributes should remain.
5. Click the like button — it should work (the button is interactive, just the number is hidden).

---

## Test 8: Twitter Teen → Adult — Everything Visible

**Starting state:** Teen mode on Twitter with counts hidden (Test 7 verified).

**Action:** Switch mode from Teen to Adult via the extension popup.

**Expected result:**
- All action row buttons fully visible.
- All count spans visible with actual numbers.
- Analytics links visible.
- Markers change to `adult-pass`.

**How to verify:**
1. Search for `[data-fw-action-row]` — value should be `"adult-pass"`.
2. Inspect count spans inside buttons — `visibility` should be `visible` or unset.
3. `a[href*="/analytics"]` — `display` should be normal (not `none`).
4. No hide/neutralize CSS rules from `fw-twitter-engagement-css`.
5. Scroll to load more tweets — new action rows should also show `"adult-pass"`.

---

## Test 9: Twitter Feed → Detail Navigation — Action Row Controls Persist

**Starting state:** Any non-adult mode on Twitter (child or teen) with action row controls active.

**Action:**
1. On the feed, note the action row state (hidden or neutralized).
2. Click on a tweet to navigate to the detail/thread view.
3. Observe the action row on the detail page.
4. Click back to return to the feed.

**Expected result:**
- On the detail page, the action row has the same control state as the feed (hidden in child, neutralized in teen).
- Navigating back to the feed, all action rows are still correctly controlled.
- No flash of uncontrolled content during navigation.
- `resetEngagementDOM()` may fire on navigation; new markers are applied promptly by MutationObserver + 2-second polling fallback.

**How to verify:**
1. Before clicking into detail: note `data-fw-action-row` values on feed tweets.
2. On detail page: search for `[data-fw-action-row]` — should match expected mode value.
3. After navigating back: search again — all action rows should be marked correctly.
4. Watch the Console tab during navigation — no errors from the engagement controller.
5. Optional: in Performance tab, verify MutationObserver callbacks fire within ~100ms of new DOM appearing.

---

## Test 10: Settings Change Within Mode — Toggle `childBlockActions` Off in Child Mode

**Starting state:** Child mode on TikTok (or Twitter), action rail/row hidden.

**Action:** Open extension settings and toggle `childBlockActions` OFF. Do NOT change the mode — stay in child mode.

**Expected result:**
- The action rail (TikTok) or action rows (Twitter) immediately reappear without a page reload.
- The `chrome.storage.onChanged` listener detects the setting change and triggers `resetEngagementDOM()` followed by re-evaluation.
- Since `childBlockActions` is now OFF, `shouldControlEngagement()` returns false for action hiding, so no hide markers are applied.

**How to verify:**
1. After toggling OFF, search for `[data-fw-action-rail]` or `[data-fw-action-row]`:
   - The `"hidden"` markers should be removed.
   - Elements should have no FW data attributes (or possibly no marker at all).
2. Inspect the previously-hidden element:
   - `display` should no longer be `none`.
   - `visibility` should no longer be `hidden`.
   - Inline style overrides should be cleared.
3. Check `<head>` — the corresponding `<style>` tag (`fw-tiktok-action-rail-css` or `fw-twitter-engagement-css`) should be removed.
4. Toggle `childBlockActions` back ON — action rail/row should hide again immediately.
5. Test the per-platform sub-toggle: disable only `childBlockActionsPlatforms.tiktok` while master is ON — only TikTok should be affected; Twitter should remain hidden.

---

## Test 11: Settings Change — Toggle `teenHideMetrics` Off in Teen Mode

**Starting state:** Teen mode on TikTok (or Twitter), counts hidden (`visibility: hidden`).

**Action:** Open extension settings and toggle `teenHideMetrics` OFF. Stay in teen mode.

**Expected result:**
- All count numbers immediately become visible.
- Action rail/row buttons remain visible (they were already visible in teen mode).
- The marker may change from `"neutralized"` to `"adult-pass"` (or be removed), since there's nothing left to neutralize.

**How to verify:**
1. **TikTok:** Inspect `[data-e2e="like-count"]`, `[data-e2e="comment-count"]`, `[data-e2e="share-count"]`:
   - `visibility` should change from `hidden` to `visible` (or the property should be removed).
   - Actual numbers should render.
2. **Twitter:** Inspect count `<span>` elements inside `button[data-testid="like"]`, etc.:
   - `visibility` should be `visible` or unset.
   - `a[href*="/analytics"]` should become visible.
3. The change should happen without page reload — watch the DOM update live in Elements panel.
4. Toggle `teenHideMetrics` back ON — counts should hide again immediately.
5. No console errors during the toggle cycle.

---

## General DevTools Tips

- **Find all FW markers:** In the Elements panel search box, type `data-fw-` to find all FW-controlled elements.
- **Watch storage changes:** In the Console, run `chrome.storage.onChanged.addListener((c, a) => console.log('storage change:', a, c))` to see real-time setting updates.
- **Check injected styles:** In Elements, expand `<head>` and look for `<style>` tags with `id` starting with `fw-`.
- **Monitor DOM mutations:** Use a `MutationObserver` on `document.body` to see when FW modifies elements during mode switches.
- **Force re-evaluation:** If controls seem stuck, scroll to trigger new content — the MutationObserver and 2-second polling fallback should pick it up.
