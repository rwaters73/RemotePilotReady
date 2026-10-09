# Session Starter

Last updated: 2026-10-07, end of Session 3. The next chat is Session 4.

## Reading order

1. This file.
2. `docs/Communication_Preferences.md` and the universal lessons file (`C:\Users\rickw\Lessons_Learned_Universal.md`, imported by `CLAUDE.md`). App sessions can't reach that folder yet and have been reading the claude.ai Project copy instead (B-021).
3. `docs/PROJECT_VISION.md`.
4. `docs/BACKLOG.md`, then `docs/PROGRESS.md`.
5. `docs/plans/B-101-plan-v3.txt`, including the erratum and architect notes at the top, before any figure work. Sections 3, 9 and 10 cover the steps below.
6. `docs/DECISION_LOG.md` and `docs/LESSONS_LEARNED.md` as needed.

## Where things stand

- Repo: private GitHub `rwaters73/RemotePilotReady`, branch `main`, last commit 06b6e22 (B-101 commit 1). On the desktop, `scripts/qbank/test/figures-real.test.ts` is untracked on purpose; it goes in with commit 2.
- Question bank format, validator and tools are built. q-writer and q-reviewer are ready (B-022). No questions yet.
- B-101: the extraction tools are committed. `figures/` holds only an empty index, and `data/figure-rotations.json` has an empty list. Test suite: 179 tests, 161 pass; the 18 failures are all in `figures-real.test.ts` and are expected until the images exist.
- Decisions run D-001 to D-070.

## Pick up here: B-101, in this order (plan v3, section 9)

1. Architect-Claude, in the Linux workspace: stage the commit-1 tree and the PDF; confirm Node 22.22.0, `npm ci`, sharp 0.35.5 / libvips 8.18.7, Poppler 24.02.0, and the PDF's SHA-256.
2. Run `npm run qbank:figures:survey` (with `--save-words` to produce `scripts/qbank/test/fixtures/figure-words.json`). Expect 98 items, fig-55 as the only contents difference, 11 sideways items with direction from their words, and fig-3 and fig-82 sideways with direction set by eye. Fill `data/figure-rotations.json`, checking every undetermined item by eye.
3. Run `npm run qbank:figures:extract`. Check all 98 images by eye, with full-zoom PNG/WebP comparisons of the sectional charts, the Chart Supplement figures and the legends (plan 9). Confirm fig-19's top edge and fig-65's top border are kept. Run it a second time into another folder and confirm both index.json files are identical. Apply the 300 MB PNG gate.
4. Transfer through the desktop link: images first, then `figure-rotations.json` and `figure-words.json`, then `figures/index.json` last. Report the SHA-256 of both JSON files; Rick compares them and runs `npm run qbank:figures:check`.
5. Tester stage B (plan 8B), then commit 2 with the commands in plan section 10.

Viewing 98 images uses a lot of a chat's context. If the context gets tight partway through, say so and close the session after a clean checkpoint.

## Other open items

- Rick's decisions: B-030 (run q-writer and q-reviewer in manual permission mode), B-005, B-011, B-012, B-024 (Claude recommends yes), B-021.
- Claude drafts for Rick to apply in `.claude/`: B-027 (stale repo-layout line), B-029 (agents open the WebP).
- Before the first chart question: B-028 (zoom command for q-reviewer).
- Rick's setup items: B-009 (Neon and Neon Auth), B-023 (laptop: `git pull`, `npm ci`, `npm run qbank:test`), B-017.
- Questions without figures (B-103/B-104) can start any time; figure questions wait for B-101 commit 2.

## Watch out for

- Rick uses Git Bash: paths as `/c/Projects/RemotePilotReady`, and no `<placeholders>` in commands.
- Claude Code starts in auto mode. To test permission rules, or to have them enforced, start with `--permission-mode manual`.
- Save Claude Code transcript exports outside the repo (`/c/Projects/session-exports/`); `git add -A` picks them up otherwise.
- Writes through the desktop link can keep old content. Write each update from a fresh path and compare the file on the device after every write. App sessions can't write into `.claude/`.
- The planner can't write files: architect-Claude saves each plan version to `docs/plans/` and verifies the copy.
- Measure the whole object a rule will check, on every page, before giving numbers to a planner (LESSONS_LEARNED 2026-10-07).
- The AIM's next basic edition takes effect December 24, 2026 (B-026).
- Possible universal lessons for Rick's file: measure the complete thing a rule asserts on before handing it off; a runtime check written for a specific defect must be shown to fail on that defect itself, not only in a unit test; check each new rule in an amendment list against the others.

## End-of-session routine

Update `BACKLOG.md`, `DECISION_LOG.md`, `LESSONS_LEARNED.md`, and `PROGRESS.md`, then rewrite this file. Re-read every file after writing it.
