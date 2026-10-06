# Remote Pilot Ready: Project Vision

Status: Draft v0.11 (2026-10-06)
Owner: Rick, Wisecrum Associates LLC
Domains: remotepilotready.com, remotepilotready.space (Cloudflare Registrar)

## Purpose

A free, public website that prepares people to pass the FAA Part 107 Remote Pilot knowledge test. Users create an account, take full-length timed practice exams, and track their progress toward a defined readiness standard.

Rick is also the first user. He will study for and take the Part 107 exam using this site.

## Ownership and model

- Published under Wisecrum Associates LLC.
- Free to use. A "Support this site" link accepts voluntary contributions.
- Use "support" wording, never "donate" or "donation." Wisecrum is an LLC, so contributions are not tax-deductible, and the wording should not imply a charity. (Confirm tax treatment with Wisecrum's accountant.)
- The site states clearly that it is not affiliated with or endorsed by the FAA.

## MVP scope

1. Account creation and sign-in.
2. Full-length timed practice exams that mirror the real test format.
3. Post-exam review (details below).
4. Readiness tracker against the readiness standard.
5. "Report this question" button on every question.
6. "Beta" label site-wide until the exit condition under Content rules is met.

## Readiness standard

Only completed 2-hour exams count toward readiness. A 2-hour exam is completed when the user submits it or its time runs out, even with unanswered questions; a quit exam never counts. Every scored attempt of any length is stored with its details, and each review compares with the user's previous attempt of the same length (D-036, D-040).

A user is "ready" when all of the following hold:

- Their three most recent full-length practice exams are each 85% or higher.
- In each of those three exams, no ACS area scored below 70%.

Both thresholds (85% overall, 70% per area) and the streak length (3) are configuration values, not hardcoded.

## Devices

The site is a responsive website, not an app-store app. Every page works on monitors, tablets, and phones in portrait and landscape.

## Practice exam rules

- Format matches the real exam, per FAA-S-ACS-10B, Appendix 1 (page A-1): 60 multiple-choice questions, a single correct response per question, each question independent of the others, up to two hours to complete, and 70% or better to pass.
- Questions are drawn to match the real exam's topic distribution, using the ACS percentage ranges. Every question must be tagged to its ACS area.

| ACS Area of Operation | Share of exam | Questions out of 60 |
| --- | --- | --- |
| I. Regulations | 15-25% | 9-15 |
| II. Airspace & Requirements | 15-25% | 9-15 |
| III. Weather | 11-16% | 7-9 |
| IV. Loading & Performance | 7-11% | 5-6 |
| V. Operations | 35-45% | 21-27 |

For each practice exam, the count for each area is drawn at random within its range, with the total fixed at 60 (D-032).

Exam lengths (D-033). The user chooses a 15-minute, 30-minute, 1-hour, or 2-hour exam. The 2-hour exam is the full real-exam format above. Shorter exams scale the question count linearly from it (two minutes per question) and scale each area's range the same way:

| Length | Questions | I | II | III | IV | V |
| --- | --- | --- | --- | --- | --- | --- |
| 2 hours | 60 | 9-15 | 9-15 | 7-9 | 5-6 | 21-27 |
| 1 hour | 30 | 5-7 | 5-7 | 4 | 3 | 11-13 |
| 30 minutes | 15 | 2-4 | 2-4 | 1-3 | 1-2 | 5-7 |
| 15 minutes | 8 | 1-2 | 1-2 | 1-2 | 1 | 2-4 |

At 30 and 15 minutes, exactly scaled ranges allow only one fixed mix (30 minutes) or none (15 minutes), so those rows round the ranges outward, with at least one question from every area (D-039).

The clock and leaving an exam (D-034, D-035):
- The clock never pauses. It keeps running if the user closes the tab, locks the phone, or loses signal, as on the real exam. If time runs out while the user is away, the attempt is scored with the answers saved so far.
- The user can quit an exam at any time and chooses one of two outcomes: score the questions answered so far and go to the review, or discard the exam entirely, with no score and no review.
- No answers or feedback during the exam. All results are shown in the post-exam review.
- Questions that reference a Testing Supplement figure display that figure, as the real exam does.
- The countdown timer is visible at all times during the exam. If the page scrolls, the timer stays fixed in view. If questions are shown one per page or in a modal, every view shows the timer.
- Each attempt records the order in which answer options were shown for every question.

## Post-exam review

Shown at the end of each practice exam:

- Overall score.
- Percentage correct per ACS area.
- Missed questions, grouped by ACS area, each showing the user's answer and the correct answer.
- For repeat attempts: per-area comparison against the previous attempt (up, down, unchanged).
- Total elapsed time for the exam.
- Each reviewed question shows its figure, chart, or other media, the same as during the exam.
- Answer options appear in the same order the user saw them during the exam, never reshuffled.

Pending decisions (see `BACKLOG.md`): whether to show each missed question's explanation and source citation (B-005), and whether to show time spent per question (B-012).

## Content rules

- The question bank is original. Sources are FAA publications only: 14 CFR Parts 107, 89 (Remote ID), and 48 (registration), AC 107-2A, the Remote Pilot ACS, the Remote Pilot Study Guide (FAA-G-8082-22), the Pilot's Handbook of Aeronautical Knowledge, the AIM, the FAA Testing Supplement (FAA-CT-8080-2H), and FAA-published sample questions.
- No questions copied or adapted from commercial prep providers.
- The question bank lives as files in the repo, one file per question, in the format defined in `docs/QUESTION_FORMAT.md`. Testing Supplement figures and legends are shared images in `figures/`, referenced from each question (D-044). The database is loaded from these files.
- Public launch requires at least 300 reviewer-approved questions. A smaller bank is acceptable while Rick uses the site for his own study.
- When the site tells users to consult an FAA document, it links to the official FAA source. The site never hosts FAA reference documents for download. Figures extracted from the Testing Supplement for use in questions are the exception.
- Every question stores: its ACS knowledge-element code (the area comes from the code), its sources (document, edition, location, and the exact passage as printed), any figures or legends it uses, three options with one keyed answer, a short explanation, and a review block. Area I questions cite at least one 14 CFR source (D-047).
- Drafting: Claude writes questions from the source text.
- Review: a separate reviewer agent, without access to the drafting rationale, verifies that the cited passage supports the keyed answer and that no distractor is also defensible. Questions that fail or are ambiguous are held back, not published. Approved questions are never edited; a fix means retiring the question and writing a new one (D-051).
- Live feedback: "Report this question" submissions go into a review queue.
- Beta exit condition: Rick passes the Part 107 exam, then reviews all flagged and reported questions.
- Maintenance: when the FAA revises any reference document, questions citing the old edition are re-checked. The validator flags them by comparing each source's edition with `data/references.json` (D-053).

## Technical decisions

| Area | Decision | Reason |
| --- | --- | --- |
| Front end | React Router v7 (framework mode), TypeScript | Server-rendered public pages for search; native Cloudflare Workers support; works with Neon Auth's React components |
| Hosting | Cloudflare (Workers with static assets) | Free tier permits commercial use; Vercel Hobby does not, and its treatment of donation links is unclear |
| Domains | Cloudflare Registrar | At-cost renewals; DNS, hosting, and registration in one account |
| Database | Neon Postgres, Free plan | Scales to zero and wakes automatically on the next query; no manual reactivation as with Supabase Free |
| Auth | Neon Auth (managed Better Auth) | Included in Neon Free up to 60,000 MAU; avoids building auth |
| Testing Supplement figures | Figures and legends rasterized from the PDF at ~300 dpi, one image each, stored in `figures/` with an index | Lets questions display the actual figure and legend |
| Question bank tools | TypeScript scripts run by Node 22.18+ (`npm run qbank:*`): validator, hash, ACS extraction, reference checksum check | Usable before the app exists (D-058) |
| Exam answers | Radio buttons; no free-text answers | D-060 |

Testing Supplement: FAA-CT-8080-2H (2018, effective June 11, 2018, 113 pages), stored at `references/sport_rec_private_akts.pdf`. As of 2026-10-01, the FAA's testing supplements page lists it as the current edition for Remote Pilot (UAG). Its front matter carries no copyright notice, and as a work of the U.S. government it is not subject to copyright (17 U.S.C. 105), so its figures can be published. Recheck the FAA page for a newer edition before launch.

## Repository layout and source of truth

- `docs/`: project documents (see Project documents below).
- `images/`: branding (logo, favicons). Originals are kept as delivered.
- `questions/`: the question bank, one file per question (`docs/QUESTION_FORMAT.md`).
- `figures/`: Testing Supplement figures and legends extracted for questions, with `index.json`.
- `data/`: `references.json` (the reference document index) and `acs-10b-knowledge.json` (the 176 ACS knowledge codes).
- `scripts/qbank/`: the question bank validator and tools.
- `references/`: FAA source documents used to write and check questions. Read-only inputs, never edited, and never committed to git (`references/*.pdf` is in `.gitignore`). Files keep the names the FAA gives them.

The single index of reference documents is `data/references.json` (D-056): for each document, its key, kind, title, document number, edition, official URL, local file name, and SHA-256 checksum of the copy questions were written against. `npm run qbank:refs:check` compares the local files to those checksums. It currently lists nine documents: 14 CFR Parts 107, 89, and 48; FAA-S-ACS-10B; FAA-CT-8080-2H; FAA-G-8082-22; FAA-H-8083-25C; the AIM; and AC 107-2A.

The eCFR is the FAA's continuously updated text of the regulations. Each CFR PDF is a dated snapshot of it; when the eCFR changes, download a new snapshot and recheck affected questions.

The Study Guide predates the 2021 Part 107 amendments (operations over people, night operations, recurrent training) and the Remote ID rule. Where it conflicts with the current 14 CFR Part 107, the regulation governs, and questions must not be keyed to outdated Study Guide text.

## Accounts and privacy

- Privacy policy published before launch.
- Users can delete their account and all progress data.
- Store only what readiness tracking needs: account identity, exam attempts, answers, and scores.

## Writing rules for public-facing text

Applies to site copy, UI text, emails, and the privacy policy. Does not apply to code.

- No AI-tell language or clichés (delve, leverage, unlock, robust, seamless, and similar), no forced exclamation points, no em-dash overuse.
- No "it's not X, it's Y" constructions in any form.
- No bold for emphasis in body text.
- Anything generally recognized as AI-generated filler is out.
- If a flagged element seems genuinely needed, flag it for Rick to decide.

## Version 2 (not in MVP)

- Topic drills (e.g., 20 airspace questions).
- Weak-area mode that pulls from a user's missed questions and low-scoring areas.

## Project documents

All project documents live in `docs/`. Each has one job, so nothing is tracked in two places.

| File | Purpose |
| --- | --- |
| `PROJECT_VISION.md` | What the product is and the rules it follows. Changes only when a decision changes the product. |
| `DECISION_LOG.md` | Every decision, dated, with its reason. |
| `BACKLOG.md` | All work items, open questions, and verification tasks, with status. |
| `PROGRESS.md` | Current state of the project and a dated log of each session. |
| `LESSONS_LEARNED.md` | Project-specific lessons: what went wrong or surprised us, and what to do differently. |
| `SESSION_STARTER.md` | Rewritten at the end of every session. The next session reads it first. |
| `QUESTION_FORMAT.md` | The question file format, enforced by the validator. |
| `plans/` | Approved plans handed to the builder, kept as the record of what was approved (D-059). |
