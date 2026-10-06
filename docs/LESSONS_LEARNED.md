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
