# Progress

## Current state

Phase: question bank format built and committed. No app code yet.

- Vision at v0.11. Decisions D-001 to D-060 logged.
- Repo on GitHub (private, rwaters73/RemotePilotReady); domains registered with DNSSEC and auto-renew.
- Question bank format: `docs/QUESTION_FORMAT.md`, `data/references.json` (nine FAA documents), `data/acs-10b-knowledge.json` (176 ACS codes), `figures/index.json` (empty until B-101), validator and tools in `scripts/qbank/` (62 tests passing).
- No questions yet. q-writer and q-reviewer need the B-022 edits before they start.
- Not yet done: Neon and Neon Auth (B-009), figure extraction (B-101), app scaffold (B-115), loader (B-116).

## Session log

Newest first. A session is one chat between Rick and architect-Claude, however many days it spans. Each entry: what was done, what was decided, what is next.

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
