# Backlog

All work items, open questions, and verification tasks. Items move through: Not started, In progress, Blocked, Done. Done items stay in the list with the date they finished.

Owner is Rick or Claude. Handoff names the Claude Code agent (planner, builder, or tester) once an item has been talked through and is ready to hand off.

## Setup and decisions

| ID | Item | Owner | Status | Handoff | Notes |
| --- | --- | --- | --- | --- | --- |
| B-001 | Decide where the single copy of project documents lives and how Claude app sessions reach it | Rick | Done 2026-10-06 | | `docs/` in the project folder is the only copy; app sessions reach it through the desktop link; no copies in the claude.ai Project. Revisit if GitHub sync is wanted after B-008 |
| B-002 | Add 14 CFR Part 107 and the Remote Pilot ACS to `references/`, and add rows to the vision doc's document table | Rick | Done 2026-10-02 | | |
| B-003 | Verify current Remote Pilot ACS version and exam format (question count, time limit, passing score) | Claude | Done 2026-10-02 | | FAA-S-ACS-10B is current; 60 questions, up to 2 hours, 70% to pass (D-030) |
| B-004 | Find the authoritative source for exam topic weighting by ACS area | Claude | Done 2026-10-02 | | ACS-10B Appendix 1, page A-1 (D-030) |
| B-005 | Decide whether the post-exam review shows each missed question's explanation and source citation | Rick | Not started | | Data exists anyway for content review |
| B-006 | Choose the front-end framework | Rick | Done 2026-10-02 | | React Router v7 (D-027) |
| B-007 | Register remotepilotready.com and remotepilotready.space in Cloudflare Registrar; turn on DNSSEC and auto-renew | Rick | Done 2026-10-06 | | Both registered; DNSSEC and auto-renew confirmed on |
| B-008 | Initialize git in `C:\Projects\RemotePilotReady` and create a private GitHub repository | Rick | Done 2026-10-06 | | Private repo github.com/rwaters73/RemotePilotReady, branch main |
| B-009 | Create the Neon project and enable Neon Auth | Rick | Not started | | |
| B-010 | Branding cleanup: lock exact brand hex values, add `favicon.ico` and a 180x180 Apple touch icon, web-friendly image file names | Claude | Not started | | Deferred (D-015). Logo navy roughly #011936, blue roughly #0066F5 |
| B-011 | Exam time only: decide whether answer options appear in a different order when the same question comes up in a later exam attempt | Rick | Not started | | Does not affect the review, which always matches the exam order (D-021) |
| B-012 | Decide whether to track and show time spent per question in the review | Rick | Not started | | Recommend recording it from the start even if not shown, so this becomes a display-only decision |
| B-013 | Adapt the planner, builder, and tester agents to this project and add q-writer and q-reviewer | Claude | Done 2026-10-06 | | All five agents and the orchestrator skill are in `.claude/`; Brainzy files removed |
| B-014 | Draft `CLAUDE.md` at the repo root pointing Claude Code to `docs/`, the writing rules, and the end-of-session routine | Claude | Done 2026-10-02 | | Commands section to be filled in after the app is scaffolded |
| B-015 | Decide how each practice exam picks its question count per ACS area within the ACS ranges | Rick | Done 2026-10-02 | | Random within ranges, totaling 60 (D-032) |
| B-016 | Decide what happens to the exam clock when the user leaves mid-exam (closes the tab, locks the phone, loses signal) | Rick | Done 2026-10-02 | | Clock keeps running (D-034); quit option added (D-035) |
| B-017 | Add Rick's communication preferences and universal lessons learned files to the repo and list them in `CLAUDE.md`'s reading order | Rick | In progress | | Both in `CLAUDE.md` (D-038). Claude Code has now run in the project; Rick to confirm the external-import prompt was approved. Claude app access is B-021 |
| B-018 | Approve the question counts and area ranges for the 15- and 30-minute exams | Rick | Done 2026-10-06 | | D-039 |
| B-019 | Decide which attempts count toward readiness and the attempt-over-attempt comparison | Rick | Done 2026-10-02 | | D-036, D-040 |
| B-020 | Update `docs/Communication_Preferences.md` for this project; it was copied from AI Trader 2 | Claude | Done 2026-10-02 | | Title, background, target user, end-of-session routine, context-window rule, and session numbering updated |
| B-021 | Decide how Claude app sessions read the universal lessons file without a second copy | Rick | Not started | | The claude.ai Project copy is a second copy and will drift (Session 2 read it from there). Proposed: move the file to its own folder such as `C:\Users\rickw\Shared-AI\`, update the `@` import in `CLAUDE.md`, grant that folder to app sessions, delete the Project copy |
| B-022 | Apply the agent edits from B-102: q_writer.md and q_reviewer.md per plan section 3.9 as amended (figures list, Area I any CFR source, held/hash lifecycle, reviewed_by rules, option-text rule); add Bash to q-reviewer's tools; add the `.claude/settings.json` allow rules for `npm run qbank:hash` and `npm run qbank:validate`; fix the stale "media alongside (D-023)" lines in planner.md, builder.md, tester.md | Rick | Not started | | Claude drafts the exact text next session; Rick applies it, since app sessions can't write `.claude/`. Needed before q-writer and q-reviewer start. D-044, D-047, D-049 to D-055 |
| B-023 | Laptop setup: `git pull`, check `node --version` is 22.18 or later, `npm ci`, `npm run qbank:test` | Rick | Not started | | Only the desktop has run the question bank tools |
| B-024 | Decide: if the database holds a hash for a question ID and the file for that ID is missing, the load fails | Rick | Not started | | Claude recommends yes: files are never deleted (D-043), so a missing file means something went wrong. Needed for the loader (B-116) |
| B-025 | `docs/QUESTION_FORMAT.md` wording: label the remaining process rules (git pull before batches, who sets each status, never copy the example into `questions/`, never edit by hand) as q-reviewer, loader, or process rules, so line 3's claim is accurate | Claude | Not started | | Found by the builder in B-102's last round |
| B-026 | Edition rechecks: the AIM's next basic edition takes effect December 24, 2026 (per the AIM's own schedule); recheck AIM-keyed questions then. Recheck PHAK (25C) and Testing Supplement (8080-2H) editions before launch | Claude | Not started | | The `source-edition` warning (D-053) lists affected questions once `data/references.json` is updated |

## MVP build

| ID | Item | Owner | Status | Handoff | Notes |
| --- | --- | --- | --- | --- | --- |
| B-101 | Rasterize Testing Supplement figures and legends at about 300 dpi, one image each, and fill `figures/index.json` | Claude | Not started | | Figures 1-82 and Legends 1-19. Keys and index format per `docs/QUESTION_FORMAT.md` (D-044). Extract from the original PDF, not a compressed copy. Output files are committed (D-028) |
| B-102 | Question bank schema: ACS area and task code, source document and edition, source passage or figure, explanation, review status | Claude | Done 2026-10-06 | builder, tester | `docs/QUESTION_FORMAT.md`, `data/`, `figures/index.json`, validator in `scripts/qbank/` (62 tests). Plan in `docs/plans/B-102-plan-v1.txt`. D-041 to D-058 |
| B-103 | Question drafting workflow from FAA sources | Claude | Not started | | q-writer agent exists; needs B-022 edits. Start with a small batch for Rick's own study |
| B-104 | Independent reviewer agent: checks keyed answer against cited passage and that no distractor is defensible | Claude | In progress | | q-reviewer agent exists (B-013); needs B-022 edits to match the format |
| B-105 | Account creation, sign-in, and account deletion with all progress data | Claude | Not started | | |
| B-106 | Timed practice exam in four lengths with weighted draw, figure display, always-visible countdown timer, quit option, and stored option order per attempt | Claude | Not started | | D-019, D-021, D-030, D-032 to D-035, D-060. The deadline is set on the server at exam start; each answer is saved as it is given; a reloaded or reopened exam resumes with the correct remaining time. Answers by radio button with the whole option row as the tap target; the answer can be changed until submit |
| B-107 | Post-exam review: overall score, per-area scores, missed questions by area, attempt-over-attempt comparison, total elapsed time, question media, options in exam order | Claude | Not started | | Needs B-005, B-012. D-020, D-021, D-022 |
| B-108 | Readiness tracker with configurable thresholds | Claude | Not started | | D-003, D-036, D-040 |
| B-109 | "Report this question" button and review queue | Claude | Not started | | |
| B-110 | Site-wide beta label | Claude | Not started | | D-005 |
| B-111 | "Support this site" link | Claude | Not started | | D-002 |
| B-112 | FAA non-affiliation statement | Claude | Not started | | |
| B-114 | References index: each FAA document with its official source URL, edition, and a checksum of the copy used; used for site links (D-026) and to detect when the FAA replaces a file | Claude | Done 2026-10-06 | builder | `data/references.json`, nine documents; `npm run qbank:refs:check` compares local files to their checksums (D-056) |
| B-113 | Privacy policy, published before launch | Claude | Not started | | Follows the public-text writing rules |
| B-115 | Scaffold the React Router v7 app on Cloudflare Workers, connected to Neon and Neon Auth, with the commands section of `CLAUDE.md` filled in | Claude | Not started | | Needs B-009 (B-008 done). Merge into the existing root `package.json`; don't overwrite it. Confirm the React Router and Workers tooling accept TypeScript 7 (installed by B-102) |
| B-116 | Question loader: load question files into Neon per the loader contract in `docs/QUESTION_FORMAT.md` section 8 | Claude | Not started | | Needs B-115, B-024. Must import the hash from `scripts/qbank/lib/hash.ts`, never re-implement it. D-050 to D-052 |

## Version 2

| ID | Item | Status |
| --- | --- | --- |
| B-201 | Topic drills (for example, 20 airspace questions) | Not started |
| B-202 | Weak-area mode from a user's missed questions and low-scoring areas | Not started |
