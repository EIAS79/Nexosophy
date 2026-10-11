# Nexosophy cinematic homepage — design QA

Review date: 2026-10-09. Scope: the marketing homepage and local interactive product illustrations.

## Reference comparison

The supplied orbital, transformation, recursive workspace, workflow, persona and collaboration references were compared beside rendered browser screenshots. Evidence lives in `design-evidence/`; comparison boards preserve the review history, not a claim of identical pixels.

| Surface | Implemented | Intentional difference |
| --- | --- | --- |
| Orbital hero | Supplied lake/terrace photograph, visible seated woman, blue globe, six DOM glass windows, serif/cyan heading | Calmer, darker treatment; system serif; simplified orbit geometry |
| Transformation | Fragmented tools, central identity, connected interactive dashboard | More breathing room and less perspective distortion |
| Architecture | Central manuscript, graph, ten capability panels and shared foundation | Simplified platform rings; responsive grouping preserves readable controls |
| Workflow | All nine stages in order, distinct previews, connected rail, previous/next and keyboard navigation | Straight rail instead of densely undulating path; scrollable at narrower widths |
| Personas | Six photographic cards with distinct previews and meaningful detail dialogs | Supporting photographs are recreated; some scenery is reused |
| Collaboration | Roles/permissions preview, revisions, comments, activity and manuscript | No unverified infrastructure map, uptime, encryption or certification claims |

## Browser review

Production build inspected in the cloud browser. Exact-size iframe viewports: 1440×900, 1920×1080, 834×1112 and 390×844. Scrollbars reduce available content width. No horizontal page overflow was observed. Desktop comparison boards and focused mobile evidence are included. Native browser capture supplements the iframe screenshots; full-page capture intermittently timed out.

Confirmed local interactions: product tabs; task checks; graph selection; search filtering; workflow progression; mobile menu; motion pause; guided-tour next/close; student detail dialog; role selection; comment resolve/reopen. Product previews do not change real account permissions or invoke live AI. Browser logs showed no application/hydration errors; extension metadata errors were unrelated to the application.

## Fixes during review

- Protected hero text and the woman's silhouette from floating panels; removed panel collisions.
- Softened the mobile scenic edge and retained readable stacked/swipeable previews.
- Replaced generic persona previews with role-specific study, research, teaching, laboratory, fact-check and analysis content.
- Increased mobile interaction targets and disabled mobile panel backdrop blur.
- Replaced percentage vertical grid gap on tablet/mobile with 40px: the final CTA no longer overlaps collaboration controls. Resolve/reopen was verified again on mobile (`mobile-comments.jpg`).
- Corrected white-on-white dashboard manuscript heading and metadata. Final post-fix evidence: `overview-contrast-final.jpg`; earlier transformation comparison boards show the issue before this correction.

## Validation

- `corepack pnpm --filter @nexosophy/web build`: passed.
- `corepack pnpm typecheck`: passed, 13 tasks.
- `corepack pnpm test`: passed, 19 tasks; some packages have no tests and Turbo reports missing output-file warnings.
- `node_modules/.bin/biome lint . --diagnostic-level=error`: passed, no errors. CSS specificity warnings remain at warning severity.
- Changed source formatting, module-boundary check and `git diff --check`: passed.

## Performance and limits

Eight optimized WebP assets total approximately 836KB. Below-fold imagery is lazy-loaded. Motion uses CSS/SVG, respects reduced motion, supports manual pause and pauses decorative animation offscreen. Scrolling stays native; there is no scroll hijacking or large animation dependency. No physical-device performance benchmark or complete WCAG audit was performed, so this is not a guaranteed frame-rate or accessibility certification.

This is an adaptation of the art direction, not a pixel-perfect reconstruction. The overview is an interactive guided preview, not a recorded video. No claim is made that illustrated planned capabilities are already implemented services. Larger sections intentionally exceed a single viewport to retain readable content. No known blocking layout or interaction issue remained in the reviewed views.

Final result: passed

## Follow-up: contained workflow carousel

The requested process line now sits in a single glass callout with a pale cyan left border. Cards advance horizontally every 4.5 seconds and reverse at the end. Autoplay pauses on hover/focus, stops on touch/manual navigation, and does no scrolling offscreen, in a hidden tab, with global motion paused, or with reduced motion enabled. Play/pause, swipe and arrow controls remain available at wide desktop sizes. Hover/focus lifts only the preview by 5px. Browser checks confirmed automatic scroll progression (668 → 1336px), pause state and manual advancement. Web typecheck and error-level lint passed; production build checked again. This replaces the earlier all-nine-at-once wide-desktop layout.
