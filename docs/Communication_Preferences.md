# Remote Pilot Ready — Communication Preferences
*Rick's profile and working style — read this every session*

---

## Who Rick Is

- Experienced software developer, out of practice — comfortable with concepts and architecture, rusty on implementation
- One of the first 1,000 Python users; helped establish early Python coding standards
- Agile and Scrum expert — thinks in sprints, backlogs, and incremental delivery naturally
- Has developed in 15+ languages — strong instincts, wide pattern recognition
- More comfortable with JavaScript and TypeScript than in earlier projects
- Coordinating work across Claude Code subagents is still relatively new territory
- Bottom line: Rick's general software background runs deep — no need to go slow on language fundamentals or architecture. Where this project's specific libraries and services are concerned (React Router, Cloudflare Workers, Neon, Neon Auth), explain carefully and verify against real docs or live behavior rather than assuming familiarity.

---

## How Rick Thinks

- Technical depth is welcome — don't simplify the concepts, just explain the new technologies carefully
- Reason through decisions, don't just hand them over
- Push back directly when a direction is wrong
- Rick thinks out loud and types fast — read intent, not just literal words
- When Rick is tired or moving quickly, slow down and make sure captures are accurate before moving on
- Price-sensitive, thinks like a user not just a founder — keep that perspective in the room

---

## Rick as the Target User

- Studying for the FAA Part 107 Remote Pilot knowledge test
- Will be the site's first user, preparing for his own exam with it

---

## Communication Style

- No filler, no AI-speak, no throat-clearing
- Conversational tone for discussion, structure only when it genuinely helps
- Claude writes project docs directly in `docs/`. At "end of session": update `docs/BACKLOG.md`, `docs/DECISION_LOG.md`, `docs/LESSONS_LEARNED.md`, and `docs/PROGRESS.md` in place, then rewrite `docs/SESSION_STARTER.md` in full. Re-read every file after writing it to confirm the change landed.
- When either Claude or Rick thinks the context window is getting full, say so right away and start the end-of-session routine, rather than pushing on until context runs out.
- Before treating a subagent's "this is already done" or "no changes needed" claim as fact, get the actual raw `git diff`/`git status`/`git log` output (piped through `cat`, not through a pager) rather than the subagent's prose summary of it.
- Before Claude states that a documentation problem, mismatch, drift, or duplication exists in a project file, Claude must have directly viewed that file's actual current content in the session — not inferred it from memory, a prior session's summary, or a pasted diff without clear added/removed markers. If unverified, say so explicitly as an open question, not a finding.
- When Claude sees the need for a subagent to do something, go ahead and write the subagent prompt without asking if Rick wants it
- One thing at a time: while a Claude Code agent is running a task Rick relayed, the Claude app session does no other work in parallel. Wait for Rick to bring back the result.
- Rick uses Git Bash on Windows. Give paths in Git Bash form (`/c/Projects/RemotePilotReady`) and commands with no placeholders to fill in.
- Instructions, Memory, and Project Files are always-on background context, not new input. Never narrate discovering, noting, or reacting to them as if they were just provided in the current message

---

**Session numbering.** "Session N" means one chat between Rick and 
architect-Claude — never a Claude Code invocation, a subagent call, or a 
calendar day. The number is fixed for the entire chat and is always supplied 
explicitly in the task Rick relays. No subagent may infer, guess, or 
increment this number itself, including from the last number seen in 
`docs/PROGRESS.md`. If a delegated task doesn't include one, stop and ask rather 
than assume. A session can last part of a day or more than a week; 
the number marks the chat, not the calendar.
