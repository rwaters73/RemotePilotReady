# Session Starter

Last updated: 2026-10-06, end of Session 1. The next chat is Session 2.

## Reading order

1. This file.
2. `docs/Communication_Preferences.md` and the universal lessons file (`C:\Users\rickw\Lessons_Learned_Universal.md`, imported by `CLAUDE.md`).
3. `docs/PROJECT_VISION.md`.
4. `docs/BACKLOG.md`, then `docs/PROGRESS.md`.
5. `docs/DECISION_LOG.md` and `docs/LESSONS_LEARNED.md` as needed.

## Where things stand

Planning is done and every Session 1 decision is in `docs/DECISION_LOG.md` (D-001 to D-040). The project folder `C:\Projects\RemotePilotReady` holds `docs/`, `images/`, `references/` (gitignored PDFs), `.claude/` (five agents and the orchestrator skill), `CLAUDE.md`, and `.gitignore`. Nothing is in git yet, and there is no code.

## Pick up here

Rick's setup items, in this order:

1. B-008: put the project in git and on GitHub. In a terminal:

   ```
   cd C:\Projects\RemotePilotReady
   git init -b main
   git status
   ```

   Check that no file from `references/` appears in the `git status` list. Then:

   ```
   git add .
   git commit -m "Session 1: project docs, agents, CLAUDE.md, .gitignore"
   ```

   Create an empty private repository on github.com (no README, no .gitignore), then:

   ```
   git remote add origin https://github.com/<your-account>/<repo-name>.git
   git push -u origin main
   ```

2. Start Claude Code in the project once and approve the external import prompt for the universal lessons file.
3. B-009: create the Neon project and turn on Neon Auth.
4. B-007: register the two domains in Cloudflare Registrar, with DNSSEC and auto-renew on.
5. B-021: decide how Claude app sessions read the universal lessons file. The copy in the claude.ai Project's files is a second copy and will drift.

First build work, which needs no infrastructure:

1. B-102: question file format. Talk it through, then hand it to the planner. q-writer and q-reviewer can't start until it exists.
2. B-101: extract the Testing Supplement figures.
3. B-115: scaffold the app, once B-008 and B-009 are done.

Open decisions for Rick: B-005 (explanations and citations in the review), B-011 (shuffle answer order between attempts), B-012 (per-question time).

## Watch out for

- In Claude app sessions, files written to the project folder through the desktop link can silently keep old content. Write each update from a fresh path and compare the file on the device after every write. Writes into `.claude/` are blocked from app sessions.
- The 2016 Study Guide predates the 2021 rule changes and Remote ID; the current 14 CFR Part 107 governs.
- Possible universal lesson for Rick to consider adding to his file: files copied between projects carry over project-specific content, so review them before use.

## End-of-session routine

Update `BACKLOG.md`, `DECISION_LOG.md`, `LESSONS_LEARNED.md`, and `PROGRESS.md`, then rewrite this file. Re-read every file after writing it.
