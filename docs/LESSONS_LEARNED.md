# Lessons Learned

Lessons specific to this project. Lessons that apply across all projects belong in the universal lessons file instead.

Each entry: date, what happened, and what to do differently.

## 2026-10-01

- Adding a local folder to a claude.ai Project did not make it visible to a chat that was already open. Use "Add folder" from the "+" menu in the chat itself, then confirm the folder appears before relying on it.
- A file written to the local folder through the desktop link reported success but did not contain the latest edits. After every write to the local folder, re-read the file and compare it with what was intended.
- FAA download names do not match document numbers (FAA-G-8082-22 downloads as `remote_pilot_study_guide.pdf`). Identify reference files by the document number and edition printed inside them, never by file name.
- The Remote Pilot Study Guide (2016) predates the 2021 Part 107 amendments and the Remote ID rule. Check every Study Guide fact against the current regulation before keying a question to it.
- The Testing Supplement PDF is 176 MB, above GitHub's 100 MB file limit. Decide how large reference files are handled before the first commit.

## 2026-10-02

- The failed-write problem happened again: one of four files in a batch got a new timestamp but kept its old content. A single retry fixed it. Compare content after every write, since the timestamp alone is not proof.
- Cause found: the desktop link appears to cache a file by the path it is sent from. Re-sending an edited file from the same path delivered the old version, while sending it from a new path worked. Write each update from a fresh path, then compare content on the device.
- Claude app sessions cannot write into the project's `.claude` folder through the desktop link; it is blocked for safety. Write agent and skill files to a staging folder and have Rick move them.
- Claude Code loads skills as folders (`.claude/skills/<name>/SKILL.md`), not as packaged `.skill` zip files. Agent names allow letters, numbers, and hyphens, and `claude --agent` uses the name inside the file, not the file name.

## 2026-10-06

- Scaling the ACS percentage ranges down to short exams produced ranges with no whole-number count in them. Check that a scaled rule still has valid integer answers before adopting it.
- Docs copied from another project (the agents, `Communication_Preferences.md`) carried that project's specifics with them. Review any copied file for leftovers before agents rely on it.
- Git Bash treats backslashes as escapes: `cd C:\Projects\RemotePilotReady` became `C:ProjectsRemotePilotReady` and failed. Give Rick Git Bash paths as `/c/Projects/RemotePilotReady`.
- A `<placeholder>` in a shell command is read as a redirect, so it fails with a confusing error. Give literal commands, or say exactly what to replace and show a filled-in example.
- `pdftotext -layout` pairs ACS codes with the wrong descriptions; `-raw` pairs them correctly. One code (UA.I.B.K24) follows a form feed at a page break, so a line-anchored match misses it. Count the extracted codes against an independent extraction before trusting them.
- Check which documents the ACS actually cites for each task before choosing source documents. Part 107 alone left Remote ID (Task I.F, Part 89 only) with no regulation to key to.
- Searching for "AC 107-2" mostly finds the 2016 original. The current revision is AC 107-2A, posted on faa.gov; no mail request needed.
- An amendment list written in one pass contained a rule ("Rick clearing held sends it to draft") that contradicted another ("approved content is never edited"). The builder caught it. Before handing off amendments, check each new rule against the others.
- Each Claude Code agent starts fresh and does not see the previous agent's output. Save the approved plan to a file in the repo (`docs/plans/`) and point the next agent to it.
- The tester could not render PDF pages on Windows (no pdftoppm). A Claude app session can render pages in its own workspace and check them visually; use that for "compare against the printed page" steps.

## 2026-10-07

- Claude Code 2.1.283 and later start interactive sessions in auto mode, where a classifier approves routine commands. A permission allow rule tested in auto mode proves nothing, because nothing prompts. Test allow rules with `claude --permission-mode manual`, and include a command that should prompt as the control.
- An agent that refuses a command because its instructions say so has not tested the permission rules. The instruction limit and the Claude Code enforcement are separate layers; test each on its own.
- Architect-Claude gave the planner a header position measured from the word "Appendix" alone. The full header group ("Appendix" plus its digit) is wider, and the plan's windows would have failed every page. Measure the whole thing a rule will assert on, across every page, before handing numbers to a planner.
- Running a plan's rules against the real PDF in the app workspace before the builder starts caught eight problems across plans v2 and v3: wrong header and page-number windows, header strips that cut real figure content (Figures 19 and 65), caption-check false alarms on short words, two items whose reading direction can't be read from text, a direction margin of 0.4%, and an unescaped regex dot. Each check took minutes; each would have cost a builder round.
- sharp 0.35.5 writes a one-channel raw buffer as an RGB PNG unless `.toColourspace('b-w')` is set, and decoding with b-w turns a three-channel file into one channel. A check that only decodes can't tell a correct gray PNG from a wrong one; read the stored channel count from the file's metadata too.
- In Node, `process.exit()` inside a `try` skips its `finally`, so cleanup in the `finally` never runs. Return an exit code from the main function instead.
- A Claude Code transcript exported into the repo root gets picked up by `git add -A`. Save exports outside the repo, in `/c/Projects/session-exports/`.
- The planner can't write files, so its plan reaches the repo only when architect-Claude saves it. Save each version under its own name (`B-101-plan-v1.txt`, `-v2`, `-v3`), note corrections as an erratum at the top rather than editing the planner's text, and compare the copy on the device after each write.

## 2026-10-09

- Architect-Claude found a defect in committed code and wrote a builder task for Rick to run, skipping the planner, on the reasoning that the approved plan already required the behaviour. It also said it had "sent it straight to the builder", which made it sound as if something had run. The flow is talk it through with Rick, then planner, then Rick approves, then builder, then tester, for every code change. A belief that a step is redundant is a question for Rick, not a reason to skip it. Describe exactly what was done: "I wrote a task for you to run", not "I sent it".
- When the version check failed, architect-Claude ran the survey and an extraction with a scratch workaround before asking Rick. Nothing reached the desktop and the results were useful, but the decision to run them was Rick's. Ask before running anything that works around a failure, even in the workspace.
- `findPoppler()` assumed the tools exit non-zero on `-v`. Poppler 24.02.0 exits 0 and writes `-v` to stderr, and `execFileSync` returns only stdout on a zero exit, so real Poppler was refused. Tester stage A ran where only Xpdf (exit 99) exists, so the zero-exit path never ran. Tests on a machine without the real dependency can't cover the paths that dependency takes; run new tooling against the real tool before trusting its tests.
- In the architect workspace, a long run started in the background from a command that later timed out was killed with it. Start long runs fully detached (`setsid nohup …`) and poll for completion.

## 2026-10-15

- Image files written to the desktop through the desktop link arrive with a signed Anthropic C2PA Content Credentials manifest added: a `caBX` chunk in PNGs (5,770 bytes more) and a `C2PA` chunk in WebPs (5,768 bytes more). The image data is unchanged, but the SHA-256 is not, so `qbank:figures:check` fails. JSON and text files arrived unchanged. Compare size and hash after every binary transfer, and make binary deliverables on the desktop instead (D-074).
- Git Bash puts its own `/mingw64/bin` ahead of the Windows PATH, so Git's Xpdf `pdftotext` is found before an installed Poppler even when the Windows PATH lists Poppler. Point `POPPLER_BIN` at Poppler's `Library/bin` for the figure scripts.
- A command built on a guessed install path (`/c/poppler-24.02.0/…`) failed because Poppler was installed under `C:\Program Files\poppler\…`. When a command depends on where Rick installed something, ask for the path first.
- Transcript exports now go in `exports/` in the repo, which git ignores (D-073). This replaces the 2026-10-07 advice to save them outside the repo.
- The B-101 version guard did its job: it refused to overwrite figures made with Poppler 24.02.0 when Poppler 26.09.0 was on the PATH.

## 2026-10-16

- Poppler 24.02.0 for Windows (oschwartz10612 release 24.02.0-0) and Ubuntu's Poppler 24.02.0, each with sharp 0.35.5 and libvips 8.18.7, produced byte-identical figures, index and words fixture for this PDF. Matching the index hash is enough to carry an eye check across machines; keep the exact Poppler version when re-running.
