# Progress

## Current state

Phase: question bank tools in place; Testing Supplement figures being extracted. No questions and no app code yet.

- Vision at v0.12. Decisions D-001 to D-070 logged.
- q-writer and q-reviewer match the question format (B-022). q-reviewer can run `npm run qbank:hash` and `npm run qbank:validate` without a prompt; other commands prompt in manual mode.
- B-101 commit 1 is in (06b6e22): figure survey, extraction and check scripts, the two-file figure index, validator changes, tests (179: 161 pass, 18 expected failures in the untracked `figures-real.test.ts`). `figures/` still holds only an empty index.
- Not yet done: B-101 extraction and commit 2, Neon and Neon Auth (B-009), app scaffold (B-115), loader (B-116).

## Session log

Newest first. A session is one chat between Rick and architect-Claude, however many days it spans. Each entry: what was done, what was decided, what is next.

### Session 3 (2026-10-06 to 2026-10-07), Claude app: agent edits and figure extraction tools

- B-022: drafted the q-writer, q-reviewer, planner, builder and tester edits and `.claude/settings.json`; Rick applied them (f142503). Found that Claude Code now starts in auto mode, then verified the allow rules in manual mode with a control command.
- B-101: surveyed the Testing Supplement (79 figures, 19 legends, one per page; 13 printed sideways with upright captions). Planner produced v1 to v3. Before each hand-off, architect-Claude ran the plan's rules on the real PDF and found the problems that drove v2 and v3 (see LESSONS_LEARNED). Plans saved in `docs/plans/`; v3 carries an erratum for the caption regex.
- Builder built v3; tester stage A found two defects (grayscale PNGs written as RGB, temp folder not cleaned up on early exit); builder fixed both; a re-check found the PNG check could not catch the first defect, which was fixed and verified. Commit 1: 06b6e22.
- Decisions D-061 to D-070. New backlog items B-027 to B-030.
- Next: see `SESSION_STARTER.md`.

### Session 2 (2026-10-06), Claude app: git setup and question bank format

- Put the project in git and pushed it to a private GitHub repo; confirmed both domains have DNSSEC and auto-renew on.
- Added five reference documents after checking which documents the ACS cites: AIM, PHAK 25C, 14 CFR Parts 89 and 48, AC 107-2A. Read each edition from inside the file and recorded checksums.
- B-102: talked through the question format, then ran planner, builder (three rounds), and tester. Built the spec, the references and ACS data files, and a validator with a failing fixture for every check. Verified independently in the Claude app: the spec example's hash, its CFR quote, the references data, the ACS codes, and the ACS descriptions against the rendered PDF pages.
- Decisions D-041 to D-060, including radio-button answers for exams (D-060).
- Next: see `SESSION_STARTER.md`.

### Session 1 (2026-10-01 to 2026-10-06), Claude app: planning and setup

- Interviewed the project idea; chose the name Remote Pilot Ready and the stack (React Router v7 on Cloudflare Workers, Neon, Neon Auth).
- Set up `docs/` with the vision, decision log, backlog, progress, lessons learned, and session starter; deleted the duplicate vision doc from the Project's files.
- Added all four FAA references and recorded their editions, official links, and checksums. Confirmed FAA-S-ACS-10B is current and took the exam format and topic weighting from it.
- Defined exam behavior: always-visible timer, review in exam order with media, four exam lengths with scaled question counts, a clock that never pauses, quit with score-or-discard, and what counts toward readiness.
- Wrote the planner, builder, tester, q-writer, and q-reviewer agents, `CLAUDE.md`, and `.gitignore`. Updated `Communication_Preferences.md` for this project. Rick installed the agents and the orchestrator skill.
- Decisions D-001 to D-040.
- Next: see `SESSION_STARTER.md`.
