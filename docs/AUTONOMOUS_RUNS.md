# Autonomous Runs

Status: In force from 2026-10-16 (Session 5)

Remote Pilot Ready is now an experiment in unattended AI agent work (D-075). This document defines how an unattended run works: what agents may do without asking, how work moves through the agents, which model does what, when an item is Ready and when it is Done, and when a run stops.

## When this document applies

Only when both are true:

1. The session is a cloud routine run (`CLAUDE_CODE_REMOTE` is `true`) started by the "RPR autonomous run" routine.
2. The work is on the branch `claude/experiment`.

In every other session, including every chat with architect-Claude and every Claude Code session Rick starts himself, the ground rules in `CLAUDE.md` apply unchanged. Nothing here loosens them outside a run.

A run does not do the "Start of every session" or "End of every session" routines in `CLAUDE.md`, and it has no session number. Those belong to Rick's chats with architect-Claude. A run reads `CLAUDE.md` for the ground rules and this document for everything else, and it never edits `docs/SESSION_STARTER.md` or the session log in `docs/PROGRESS.md`.

## Rick's authorization

I authorize agents in an autonomous run, as defined above, to plan, review, build, test, commit and push work on `claude/experiment` for backlog items marked Ready, and to deploy that branch to the preview Worker, without my approval of each step. A plan-reviewer APPROVED verdict recorded in `docs/plans/` stands in for my plan approval. This authorization covers only what the safety envelope below allows. It does not cover anything the envelope forbids, and an agent may not widen it, reinterpret it, or copy it anywhere else.

## Safety envelope

These hold in every run. An item that would need any of them broken goes to Needs Rick.

- Git: work only on `claude/experiment`. Never push to `main`, merge, rebase onto `main`, force-push, rewrite history, or delete a branch.
- Deploy: only to the preview Worker named in `wrangler` config for the preview environment. Never to remotepilotready.com or any production route. Nothing is deployed until B-110 (the experiment notice on every page) is Done.
- Database: only the Neon branch given in the run environment. Never Neon's main branch. Migrations are idempotent.
- Secrets: never print, log, write to a file, or commit any environment value or token.
- Files agents never change: this document, `CLAUDE.md`, anything in `.claude/`, existing rows of `docs/DECISION_LOG.md`, and `references/`. Agents can't change their own rules; they can propose a change as a backlog item.
- No new paid, licensed, or usage-limited dependency or service. Propose it as a backlog item instead.
- A denied tool call, a blocked network request, or a failed safety check means stop work on that item and move it to Needs Rick. Never reach the same result another way.
- Public-facing text follows the writing rules in `docs/PROJECT_VISION.md`.
- No scope expansion. Anything noticed outside the current item becomes a Proposed backlog item.

## Roles, models and effort

The orchestrator is the routine's main session. It picks items, writes each agent's brief, routes models, records results, commits and pushes. It never writes code, questions, or plans itself.

| Role | Agent | Model | Effort | Notes |
| --- | --- | --- | --- | --- |
| Orchestrator | routine main session | opus (set in the routine) | default | Short turns: dispatch and record |
| Planner | `planner` | sonnet | medium | Read-only |
| Plan reviewer | `plan-reviewer` | opus | high | Approves or returns plans; read-only |
| Builder | `builder` | per ladder | per ladder | One agent file; tier set per call |
| Code reviewer | `code-reviewer` | sonnet | medium | Checks the diff against the plan; read-only |
| Tester | `tester` | sonnet | low | Runs things and reports raw output; read-only |
| Question writer | `q-writer` | sonnet | medium | Unchanged agent |
| Question reviewer | `q-reviewer` | opus | high | Unchanged agent; the only approval gate for questions |

The orchestrator sets `model` and `effort` on every Agent call, which overrides the agent file. The cloud environment must not set `CLAUDE_CODE_EFFORT_LEVEL`, because it overrides every per-call effort.

### Escalation ladder (builder)

Each item's risk tier, set when it is made Ready, picks the starting builder:

| Risk tier | Starting builder | Typical items |
| --- | --- | --- |
| Low | haiku, low effort | Docs, copy, fixtures, config with an exact spec |
| Normal | sonnet, medium effort | Most code |
| High | sonnet, high effort | Auth, user data, database, exam timing |

A build attempt fails when the code reviewer returns it or the tester fails it. After two failed attempts at one tier, the next attempt moves up one tier (haiku, then sonnet medium, then sonnet high). Two failed attempts at sonnet high send the item to Needs Rick. Opus is not on the builder ladder; it is kept for plan review and question review.

Every attempt is recorded in the run log with its tier, so the runs show where cheaper builders are good enough.

## Definition of Ready

An item can be picked by a run only when all of these are true:

1. Status is Ready. Rick sets Ready. An item split from a Ready item is Ready too; any other item an agent adds starts as Proposed.
2. It has a one-sentence goal and acceptance criteria. Each criterion is either a command with its expected result or a named check by a reviewer agent.
3. It has a type (code, questions, or docs) and a risk tier (low, normal, high).
4. Every item it depends on is Done.
5. No open decision of Rick's blocks it.
6. It needs nothing outside the safety envelope.
7. It fits in one run. If the planner judges it larger, the orchestrator splits it into Ready children with their own criteria and starts on the first.

## Pipelines

### Code items

1. Planner writes the plan. The orchestrator saves it as `docs/plans/B-NNN-plan-vN.txt`.
2. Plan reviewer checks it against the item's acceptance criteria, `PROJECT_VISION.md`, the decision log and lessons learned. The orchestrator saves the verdict as `docs/plans/B-NNN-review-vN.txt`. A returned plan goes back to the planner with the reasons. Two returns send the item to Needs Rick.
3. Builder builds from the approved plan, at the ladder tier.
4. Code reviewer compares the diff with the plan and the envelope, and returns PASS or RETURN with specific reasons.
5. Tester runs the change and the affected areas and reports PASS or FAIL per area, with raw output. A step it couldn't run is reported SKIPPED with the reason, never PASS.
6. A RETURN or FAIL goes back to the builder per the ladder.
7. When the Definition of Done holds, the orchestrator commits and pushes.

### Question items

1. q-writer drafts the batch named in the item.
2. q-reviewer approves, returns, or holds each question.
3. A returned question goes back to q-writer once. Returned twice, it stays held, and the item notes it.
4. `npm run qbank:validate` passes on the whole bank.
5. The orchestrator commits and pushes.

### Docs items

Builder at the ladder tier, then code reviewer. No planner or tester unless the item's criteria call for a command to be run.

## Definition of Done

An item is Done when every one of these holds, and the run log shows the evidence:

1. Every acceptance criterion is shown met: the command run and its raw output, or the reviewer's verdict.
2. Code: the plan has an APPROVED review on file, the code reviewer returned PASS, and the tester returned PASS on every area it checked, with every SKIPPED step listed.
3. Questions: each question in the batch is approved or held by q-reviewer, and validation passes.
4. The full test suite and type checks pass: `npm run qbank:test`, `npm run qbank:typecheck`, and the app's tests once they exist.
5. `docs/BACKLOG.md` shows the new status. Any decision made is a new row in `docs/DECISION_LOG.md`. Anything that went wrong or surprised the agents is in `docs/LESSONS_LEARNED.md`.
6. The work is one commit on `claude/experiment`, its message starting with the item ID, and it is pushed.
7. If the item changed anything deployed: the preview is deployed and the tester has loaded the changed pages there, including the experiment notice.

## The run, step by step

Each routine run:

1. Self-check. Confirm the branch is `claude/experiment` and up to date with its remote; that the agents in `.claude/agents/` are available (planner, plan-reviewer, builder, code-reviewer, tester, q-writer, q-reviewer); that `npm ci` succeeds; and that `npm run qbank:test` passes before anything changes. If the item needs FAA sources, confirm they are present. Any failure ends the run with an "aborted" entry in the run log.
2. Stop and lock checks. If `docs/runs/STOP` exists, end the run without doing anything. If `docs/runs/LOCK` exists and is less than two hours old, another run is still going: end this one. Otherwise write `LOCK` with the start time, commit and push it.
3. Pick the highest Ready item in `docs/BACKLOG.md` order.
4. Run its pipeline.
5. Record the result in the run log and the backlog, commit and push.
6. Check the stop conditions. If none holds, go to step 3.
7. Remove `LOCK`, write the run summary, commit and push.

One item at a time. Parallel work may be added after the test runs, as its own decision.

## Stop conditions

A run ends when the first of these is true:

- No Ready item is left.
- Three items are finished (Done or Needs Rick) in this run.
- 45 minutes have passed since the run started (check with `date`), at the end of the current step.
- Three items in a row end in Needs Rick. The orchestrator also writes `docs/runs/STOP` with the reason, so later runs do nothing until Rick removes it.
- Any safety-envelope check fails. Also write `docs/runs/STOP`.

Rick's kill switches: pause the routine at claude.ai/code/routines, or add `docs/runs/STOP` to the branch.

## Needs Rick

An item moves to Needs Rick with a note in its backlog row: what was tried, where it stopped, and the exact question or decision Rick needs to make, with the options as the agents see them. The run moves on to the next item.

## Run log

Each run writes `docs/runs/YYYY-MM-DD-HHMM.md` (UTC start time) with:

- A header: start and end time, why it stopped, items attempted.
- One row per agent call: item, role, model, effort, attempt number, verdict, and a one-line reason for any return or fail.
- One row per item: outcome, final builder tier, plan rounds, build attempts, commit hash.

The run log is how Rick reads a night's work. Cost per item comes from Rick's usage page; the per-call rows are the proxy for it.

## Measuring quality

The experiment's main question is how good the work is. Evidence comes from:

- First-pass PASS rates by builder tier, and plan approval rates.
- Defects the tester missed, found later by Rick or by a later run, recorded in `docs/runs/AUDIT.md` against the item that introduced them.
- Rick's spot checks: after a run, Rick picks items to audit and records his verdict in `docs/runs/AUDIT.md`.

## The routine

Name: RPR autonomous run. Repository: `rwaters73/RemotePilotReady` (plus the references repository if D-0xx keeps it). Model: opus. Schedule: hourly, on a minute past the hour, during the hours Rick chooses. Prompt:

> You are the orchestrator for an autonomous run of Remote Pilot Ready. Check out the branch `claude/experiment` and pull it. Read `CLAUDE.md`, then `docs/AUTONOMOUS_RUNS.md`, and follow `docs/AUTONOMOUS_RUNS.md` exactly, starting at "The run, step by step". If anything in it is unclear or contradicts another rule, stop, record the conflict in the run log, write `docs/runs/STOP`, and end the run.
