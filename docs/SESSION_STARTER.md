# Session Starter

Last updated: 2026-10-06, end of Session 2. The next chat is Session 3.

## Reading order

1. This file.
2. `docs/Communication_Preferences.md` and the universal lessons file (`C:\Users\rickw\Lessons_Learned_Universal.md`, imported by `CLAUDE.md`).
3. `docs/PROJECT_VISION.md`.
4. `docs/BACKLOG.md`, then `docs/PROGRESS.md`.
5. `docs/QUESTION_FORMAT.md` before any question work.
6. `docs/DECISION_LOG.md` and `docs/LESSONS_LEARNED.md` as needed.

## Where things stand

The repo is on GitHub (private, `rwaters73/RemotePilotReady`, branch `main`). Both domains are registered with DNSSEC and auto-renew on. The question bank format (B-102) is built, tested, and committed: `docs/QUESTION_FORMAT.md`, `data/references.json` (nine FAA documents), `data/acs-10b-knowledge.json` (176 ACS codes), an empty `figures/index.json`, and the validator in `scripts/qbank/` (62 tests passing). There are no questions yet and no app code. Decisions run D-001 to D-060.

## Pick up here

In this order:

1. B-022: Claude drafts the exact edits for `.claude/agents/q_writer.md` and `q_reviewer.md` (plan section 3.9 in `docs/plans/B-102-plan-v1.txt`, as amended by D-044, D-047, D-049 to D-055), the stale "media alongside (D-023)" lines in `planner.md`, `builder.md`, and `tester.md`, adding Bash to q-reviewer's tools, and the `.claude/settings.json` allow rules. Rick applies them, because app sessions can't write into `.claude/`. The allow rules the builder proposed:

   ```json
   {
     "permissions": {
       "allow": [
         "Bash(npm run qbank:hash)",
         "Bash(npm run qbank:hash:*)",
         "Bash(npm run qbank:validate)",
         "Bash(npm run qbank:validate:*)"
       ]
     }
   }
   ```

   These apply to every agent in the project, not only q-reviewer. Test them in Claude Code before relying on them.
2. B-101: extract the Testing Supplement figures (1-82) and legends (1-19) into `figures/` and fill `figures/index.json`. Talk it through, then planner.
3. B-103 and B-104: a first small batch of questions with q-writer, reviewed by q-reviewer, for Rick's own study. Needs B-022, and B-101 for any figure question.

Rick's setup items:

- B-009: create the Neon project and turn on Neon Auth. Blocks B-115.
- B-023: on the laptop, `git pull`, check `node --version` is 22.18 or later, `npm ci`, `npm run qbank:test`.
- B-017: confirm the external-import prompt for the universal lessons file was approved in Claude Code.
- B-021: decide how Claude app sessions read the universal lessons file. Session 2 read the second copy in the claude.ai Project, which is exactly the drift risk.

Open decisions for Rick: B-005 (explanations and citations in the review), B-011 (shuffle answer order between attempts), B-012 (per-question time), B-024 (a missing file for an ID the database knows fails the load; Claude recommends yes).

## Watch out for

- Rick uses Git Bash: paths as `/c/Projects/RemotePilotReady`, and no `<placeholders>` in commands.
- Claude Code agents start fresh. Save approved plans to `docs/plans/` and point the builder at the file.
- No parallel work in the Claude app while a Claude Code agent is running.
- Writes to the project folder through the desktop link can silently keep old content. Write each update from a fresh path and compare the file on the device after every write. Writes into `.claude/` are blocked from app sessions.
- The AIM's next basic edition takes effect December 24, 2026 (B-026).
- TypeScript 7 is installed; B-115 must confirm the React Router and Workers tooling accept it.
- Possible universal lessons for Rick's file: check each new rule in an amendment list against the others before handing it off; save an agent's output to a file before the next fresh agent needs it.

## End-of-session routine

Update `BACKLOG.md`, `DECISION_LOG.md`, `LESSONS_LEARNED.md`, and `PROGRESS.md`, then rewrite this file. Re-read every file after writing it.
