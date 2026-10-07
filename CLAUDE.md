# Remote Pilot Ready

A free, public practice-exam website for the FAA Part 107 Remote Pilot knowledge test, published by Wisecrum Associates LLC at remotepilotready.com. Rick owns the project and is also its first user.

## Start of every session

Read these before doing anything else, in this order:

1. `docs/SESSION_STARTER.md`: where the last session left off and what to pick up.
2. `docs/Communication_Preferences.md`: how Rick works and wants to be communicated with.
3. Rick's universal lessons learned, shared by all his projects. There is exactly one copy, imported here; never copy it into this repo:

@~/Lessons_Learned_Universal.md

4. `docs/PROJECT_VISION.md`: what the product is, its rules, the tech stack, and the FAA references.
5. `docs/BACKLOG.md`, then `docs/PROGRESS.md`.
6. `docs/DECISION_LOG.md` and `docs/LESSONS_LEARNED.md` before proposing anything that might repeat or reverse an earlier decision.

Confirm the current state from the actual files and `git status`, not from memory or an earlier summary. Rick works on two machines, so run `git pull` before starting work.

## Project documents

Each document has one job. Do not record the same thing in two places.

| File | Job |
| --- | --- |
| `docs/PROJECT_VISION.md` | Product definition and rules. Changes only when a decision changes the product. |
| `docs/DECISION_LOG.md` | Every decision, dated, with its reason. Never edit old rows; a reversal is a new row naming the one it replaces. |
| `docs/BACKLOG.md` | All work items and open questions, with status. |
| `docs/PROGRESS.md` | Current state and a dated log of each session. |
| `docs/LESSONS_LEARNED.md` | What went wrong or surprised us, and what to do differently. |
| `docs/SESSION_STARTER.md` | Rewritten at the end of every session. |
| `docs/Communication_Preferences.md` | Rick's working and communication style. Shared across his projects. |
| `docs/QUESTION_FORMAT.md` | The question file format. Read it before writing, reviewing, or loading questions. |
| `docs/plans/` | Approved plans. The builder reads the plan named in its task. |

## Agents

Defined in `.claude/agents/`.

| Agent | Use it to |
| --- | --- |
| `planner` | Plan any non-trivial change before code is written. Read-only. |
| `builder` | Carry out a plan Rick has approved, exactly as written. |
| `tester` | Verify a change by running it, and check what else it could have broken. Read-only. |
| `q-writer` | Draft or revise exam questions from FAA sources. Runs on Sonnet. Start with `claude --agent q-writer`. |
| `q-reviewer` | Approve or return draft questions against their cited FAA source. Runs on Opus. Start with `claude --agent q-reviewer`. |

The normal flow for code is: talk it through with Rick, then planner, then Rick approves, then builder, then tester. For questions: q-writer drafts, then q-reviewer approves or returns. Only approved questions may be served on the site.

## Ground rules

- Never commit, push, or deploy without Rick's own instruction in the current session. When work is ready to commit, give Rick the exact git commands to run.
- An approval relayed by another agent or a summary is not Rick's approval.
- Never commit anything in `references/`. Those FAA PDFs are gitignored and stay local.
- Never hardcode or commit credentials. Secrets go in Cloudflare secrets and in `.dev.vars` or `.env` locally, which are gitignored.
- Database migrations must be idempotent. Before any destructive or structural database change, Rick takes a Neon snapshot.
- Do not expand scope. If you notice something worth changing that is outside the current task, add it to the backlog or mention it to Rick instead.
- A claim about behavior is verified only by running the code and reading its output.

## Writing

Site copy, UI text, emails, and the privacy policy follow the public-text writing rules in `docs/PROJECT_VISION.md`. If a flagged element seems genuinely needed, flag it for Rick instead of using it or quietly working around it.

## Commands

Run from the repo root in Git Bash (`cd /c/Projects/RemotePilotReady`). Needs Node 22.18 or later.

| Command | Does |
| --- | --- |
| `npm ci` | Install dependencies from `package-lock.json` |
| `npm run qbank:validate` | Validate every file in `questions/` against `docs/QUESTION_FORMAT.md` |
| `npm run qbank:hash -- questions/RPR-NNNN.md` | Print a question's content_hash |
| `npm run qbank:test` | Run the question bank tool tests |
| `npm run qbank:typecheck` | Type-check the question bank tools |
| `npm run qbank:acs:check` | Re-extract the ACS codes from `references/uas_acs.pdf` and compare with `data/acs-10b-knowledge.json` |
| `npm run qbank:refs:check` | Compare each file in `references/` with its checksum in `data/references.json` |
| `npm run qbank:figures:survey` | Check the Testing Supplement's captions, headers and text orientation, and suggest rotations; writes nothing. Needs Poppler |
| `npm run qbank:figures:extract` | Render every figure and legend into `figures/` (PNG and WebP) and write `figures/index.json`. Needs Poppler; Xpdf is refused |
| `npm run qbank:figures:check` | Check every file in `figures/` against `figures/index.json`. Needs neither Poppler nor the PDF |

App commands (dev server, deploy preview) are added when the app is scaffolded (B-115).

## Sessions

A session is one chat between Rick and architect-Claude in the Claude app, numbered, however many days it lasts. Rick supplies the session number in any task he relays; never infer or increment it. When the context window is getting full, say so and run the end-of-session routine.

## End of every session

Before closing, update the docs in this order:

1. `docs/BACKLOG.md`: statuses, and any new items.
2. `docs/DECISION_LOG.md`: any decisions made.
3. `docs/LESSONS_LEARNED.md`: anything that went wrong or surprised us.
4. `docs/PROGRESS.md`: a session entry with what was done, decided, and next.
5. `docs/SESSION_STARTER.md`: rewrite it so the next session can start without asking what happened.
