# Session Starter

Last updated: 2026-10-16, end of Session 4. The next chat is Session 5.

## Reading order

1. This file.
2. `docs/Communication_Preferences.md` and the universal lessons file (`C:\Users\rickw\Lessons_Learned_Universal.md`, imported by `CLAUDE.md`). App sessions can't reach that folder and read the copy Rick adds to the claude.ai Project's files (B-021).
3. `docs/PROJECT_VISION.md`.
4. `docs/BACKLOG.md`, then `docs/PROGRESS.md`.
5. `docs/QUESTION_FORMAT.md` before any question work.
6. `docs/DECISION_LOG.md` and `docs/LESSONS_LEARNED.md` as needed. Read the 2026-10-09 lessons before handing any code work to an agent.

## Where things stand

- Repo: private GitHub `rwaters73/RemotePilotReady`, branch `main`, last commit 49ad786 (B-101 commit 2). Rick's two-line "Starting Session #" edit in `CLAUDE.md` is uncommitted and has a typo ("neumber").
- B-101 is done. `figures/` holds 79 figures and 19 legends as PNG and WebP with `figures/index.json` (SHA-256 c514126d…). Test suite: 188 tests, all passing on the desktop.
- The question bank format, validator and tools are built. q-writer and q-reviewer are ready (B-022). No questions yet.
- Decisions run D-001 to D-074.

## Pick up here

Question drafting (B-103) is the next real work. Before the first q-writer run:

1. Rick decides B-030: run q-writer and q-reviewer in manual permission mode. Claude recommends manual mode for q-reviewer at least.
2. Claude drafts B-029 (q-writer and q-reviewer open the WebP, D-068) and B-027 (stale repo-layout line in planner.md, builder.md and tester.md). Rick applies them in `.claude/`, which app sessions can't write.
3. Talk through the first q-writer batch with Rick: which ACS area, how many questions, and whether to start with questions that need no figure.
4. Chart questions (sectional charts, Chart Supplement) also wait for B-028, a zoom command for q-reviewer. That needs a planner pass.

## Other open items

- Rick's decisions: B-005, B-011, B-012, B-024 (Claude recommends yes), B-021, B-030.
- Rick's setup items: B-009 (Neon and Neon Auth), B-023 (laptop: `git pull`, `npm ci`, `npm run qbank:test`; the pull is about 213 MB), B-017.
- Small tooling items for later plans: B-031 (`extract-acs.ts` version check), B-032 (`figures:check` totals), B-025, B-026.

## Watch out for

- Every code change goes: talk it through with Rick, planner, Rick approves, builder, tester. If a step looks redundant, raise it with Rick; never skip it. Describe exactly what was done ("I wrote a task for you to run", not "I sent it").
- Ask Rick before running any workaround, even in the workspace.
- Image and other binary files written to the desktop through the desktop link get an Anthropic C2PA manifest added, so their hashes change. Make binary deliverables on the desktop; check every transfer by hash. Text and JSON arrive unchanged.
- Poppler on the desktop: Git Bash finds Git's Xpdf `pdftotext` first, so set `POPPLER_BIN="C:/Program Files/poppler/poppler-24.02.0/Library/bin"` for the figure scripts. Poppler 26.09.0 is also installed; the figures were made with 24.02.0.
- When a command depends on where Rick installed something, ask for the path first.
- Rick uses Git Bash: paths as `/c/Projects/RemotePilotReady`, and no `<placeholders>` in commands.
- Claude Code starts in auto mode. To test permission rules, or to have them enforced, start with `--permission-mode manual`.
- Claude Code transcript exports go in `exports/`, which git ignores (D-073).
- Writes through the desktop link can keep old content. Write each update from a fresh path and compare the file on the device after every write. App sessions can't write into `.claude/`.
- The planner can't write files: architect-Claude saves each plan to `docs/plans/` and verifies the copy.
- The AIM's next basic edition takes effect December 24, 2026 (B-026).
- Possible universal lessons for Rick's file: raise a process step you think is redundant instead of skipping it; tests run where the real dependency is missing can't cover that dependency's paths; check binary transfers by hash, since a tool in between can change the bytes.

## End-of-session routine

Update `BACKLOG.md`, `DECISION_LOG.md`, `LESSONS_LEARNED.md`, and `PROGRESS.md`, then rewrite this file. Re-read every file after writing it.
