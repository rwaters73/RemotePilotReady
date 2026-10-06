# Progress

## Current state

Phase: planning and setup complete on the docs side. No code yet.

- Vision drafted (`PROJECT_VISION.md`, v0.10): product rules, exam format and lengths, readiness, tech stack, and all four FAA references with official links and checksums.
- Decisions D-001 to D-040 logged.
- Five Claude Code agents and the orchestrator skill installed in `.claude/`.
- `CLAUDE.md` and `.gitignore` at the repo root.
- Not yet done: git and GitHub (B-008), domains (B-007), Neon and Neon Auth (B-009), app scaffold (B-115).

## Session log

Newest first. A session is one chat between Rick and architect-Claude, however many days it spans. Each entry: what was done, what was decided, what is next.

### Session 1 (2026-10-01 to 2026-10-06), Claude app: planning and setup

- Interviewed the project idea; chose the name Remote Pilot Ready and the stack (React Router v7 on Cloudflare Workers, Neon, Neon Auth).
- Set up `docs/` with the vision, decision log, backlog, progress, lessons learned, and session starter; deleted the duplicate vision doc from the Project's files.
- Added all four FAA references and recorded their editions, official links, and checksums. Confirmed FAA-S-ACS-10B is current and took the exam format and topic weighting from it.
- Defined exam behavior: always-visible timer, review in exam order with media, four exam lengths with scaled question counts, a clock that never pauses, quit with score-or-discard, and what counts toward readiness.
- Wrote the planner, builder, tester, q-writer, and q-reviewer agents, `CLAUDE.md`, and `.gitignore`. Updated `Communication_Preferences.md` for this project. Rick installed the agents and the orchestrator skill.
- Decisions D-001 to D-040.
- Next: see `SESSION_STARTER.md`.
