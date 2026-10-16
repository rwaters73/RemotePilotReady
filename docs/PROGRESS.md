# Progress

## Current state

Phase: paused (D-081). Remote Pilot Ready is now an experiment in unattended AI agent runs (D-075). The run setup is designed but has never run. Rick is trying a separate project first, which takes remotepilotready.space.

- Vision at v0.12 (doesn't yet reflect the experiment; B-036). Decisions D-001 to D-081 logged.
- The repository is public. `main` is frozen by the `freeze-main` ruleset (D-079). All work is on `claude/experiment`.
- `docs/AUTONOMOUS_RUNS.md` is in force (D-076). New agents: plan-reviewer and code-reviewer. Planner, builder and tester have run-mode sections.
- B-101 is done: 79 figures and 19 legends in `figures/` (49ad786). Test suite: 188 tests, all passing on the desktop at the end of Session 4.
- Not yet done: the run setup items B-033 to B-040, Neon and Neon Auth (B-009), app scaffold (B-115), loader (B-116). No questions yet.

## Session log

Newest first. A session is one chat between Rick and architect-Claude, however many days it spans. Each entry: what was done, what was decided, what is next.

### Session 5 (2026-10-15 to 2026-10-16), Claude app: autonomous-run setup, then paused

- Rick turned the abandoned project into an experiment in unattended agent work (D-075). Talked through what had to change, then checked the current Claude Code docs. Corrected an earlier claim from architect-Claude: subagents can nest up to three levels.
- Wrote `docs/AUTONOMOUS_RUNS.md`: when it applies, Rick's authorization, the safety envelope, model routing and the escalation ladder, Definition of Ready and Done, the pipelines, the run steps with lock and STOP files, stop conditions, the run log and the routine prompt (D-076 to D-078, D-080). Wrote the plan-reviewer and code-reviewer agents, added run-mode sections to planner, builder and tester (closing B-027), and updated `CLAUDE.md`.
- Rick made the repo public and added the `freeze-main` ruleset; a test push to `main` was rejected (D-079). The new work went to `claude/experiment` (8b874b2).
- The cleanup command for the test commit (`git reset --hard`) discarded four uncommitted files. Architect-Claude restored `CLAUDE.md` and the envelope edit through the desktop link (re-sent from a fresh path after a stale write); Rick restored the three agent files, and their hashes match. Whether they are committed is B-033.
- Rick paused the project to try a separate project on remotepilotready.space first (D-081).
- Decisions D-075 to D-081. New backlog items B-033 to B-040.
- Next: see `SESSION_STARTER.md`.

### Session 4 (2026-10-09 to 2026-10-16), Claude app: B-101 finished

- The survey failed on real Poppler: the version check read only stdout, and Poppler writes `-v` to stderr with exit 0. Architect-Claude found and confirmed the cause, then skipped the planner and wrote a builder task; Rick caught it and the fix went through planner, approval, builder and tester (plan `docs/plans/B-101-poppler-fix-plan-v1.txt`, commit 301858f). The tester's mutation check showed the new defect test fails on the old code.
- Architect-Claude ran the extraction in the Linux workspace and checked all 98 images by eye: the 13 turned items side by side with their pages, the tops of fig-19 and fig-65 against 300 dpi page renders, and PNG against WebP at full size for the 41 sectional chart, Chart Supplement and legend items. Two runs were byte-identical; PNG total 171.3 MiB, under the 300 MB gate.
- Images written to the desktop through the desktop link arrived with an added C2PA manifest, so they didn't match the index. Rick installed Poppler 24.02.0 for Windows and ran the extraction himself; his index matched the checked run byte for byte (D-074). Tester stage B passed; commit 2 is 49ad786.
- Rick committed the `.gitignore` change for `exports/` (6d38b3f).
- Decisions D-071 to D-074. New backlog items B-031 (`extract-acs.ts` has the same version-check gap) and B-032 (`figures:check` totals).
- Next: see `SESSION_STARTER.md`.

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
