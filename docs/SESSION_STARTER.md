# Session Starter

Last updated: 2026-10-16, end of Session 5. The next chat is Session 6. Rick gives the number in his "Starting Session #" prompt.

## The project is paused

Remote Pilot Ready is now an experiment in unattended AI agent runs (D-075). Session 5 set the runs up but never ran one. Rick paused the project to try a separate project first, which takes remotepilotready.space (D-081). If that experiment fails, he comes back here to run this one. Don't start work here unless Rick says he's resuming.

## Reading order when resuming

1. This file.
2. `docs/Communication_Preferences.md` and the universal lessons file (read the copy in the claude.ai Project's files; B-021).
3. `docs/AUTONOMOUS_RUNS.md`: how runs work. In force (D-076).
4. `docs/BACKLOG.md`, starting with the "Autonomous-run setup" section, then `docs/PROGRESS.md`.
5. `docs/DECISION_LOG.md` D-075 to D-081 and the 2026-10-16 lessons in `docs/LESSONS_LEARNED.md`.
6. `docs/PROJECT_VISION.md`. It is still v0.12 and doesn't reflect the experiment yet (B-036).

## Where things stand

- Repo: public GitHub `rwaters73/RemotePilotReady`. `main` is frozen at 8526977 by the ruleset `freeze-main`, which has no bypass (D-079). All work is on `claude/experiment`; Rick's desktop is on that branch.
- `claude/experiment` commit 8b874b2 holds `docs/AUTONOMOUS_RUNS.md` and the plan-reviewer and code-reviewer agents. At session end, the restored `CLAUDE.md`, the envelope edit (GitHub rule, line 27) and the restored planner, builder and tester files were on disk but not confirmed committed (B-033).
- Decisions run D-001 to D-081.

## Pick up here when resuming

Work the setup items in order: B-033 (confirm the commit), B-034 (references repo), B-035 (universal lessons in the cloud), B-036 (vision changes), B-037 (backlog refill to the Definition of Ready, B-110 first, including the experiment notice wording), B-038 (preview deploy and Neon branch, only when an item needs them), B-039 (environment and routine), then B-040 (the test run). Only after the test run passes does the routine go on a schedule.

## Watch out for

- Before giving Rick any command that rewrites the working tree (`git reset --hard` and the like), check for uncommitted changes. A `reset --hard` in Session 5 discarded four files.
- Check Claude Code capability claims against the current docs (code.claude.com/docs) before stating them.
- Writes through the desktop link can keep old content. Write each update from a fresh path and compare the device copy. App sessions can't write into `.claude/`; Rick saves those files.
- The routine pushes as Rick. The ruleset is the only hard guard on `main`; everything else in the envelope is enforced by instructions.
- Never set `CLAUDE_CODE_EFFORT_LEVEL` on the cloud environment; it overrides every per-agent effort.
- Rick uses Git Bash: paths as `/c/Projects/RemotePilotReady`, and no `<placeholders>` in commands.
- Claude Code transcript exports go in `exports/`, which git ignores (D-073).
- Possible universal lessons for Rick's file: check for uncommitted changes before any working-tree reset; a branch rule the owner can bypass doesn't stop automation that acts as the owner; raise a process step you think is redundant instead of skipping it; check binary transfers by hash.

## End-of-session routine

Update `BACKLOG.md`, `DECISION_LOG.md`, `LESSONS_LEARNED.md`, and `PROGRESS.md`, then rewrite this file. Re-read every file after writing it.
