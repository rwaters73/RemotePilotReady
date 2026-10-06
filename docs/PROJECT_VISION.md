# Remote Pilot Ready: Project Vision

Status: Draft v0.10 (2026-10-06)
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

- The question bank is original. Sources are FAA publications only: 14 CFR Part 107, the Remote Pilot ACS, the Remote Pilot Study Guide (FAA-G-8082-22), the Pilot's Handbook of Aeronautical Knowledge, the AIM, the FAA Testing Supplement (FAA-CT-8080-2H), and FAA-published sample questions.
- No questions copied or adapted from commercial prep providers.
- The question bank lives as files in the repo, one file per question, with its media alongside. The database is loaded from these files.
- Public launch requires at least 300 reviewer-approved questions. A smaller bank is acceptable while Rick uses the site for his own study.
- When the site tells users to consult an FAA document, it links to the official FAA source. The site never hosts FAA reference documents for download. Figures extracted from the Testing Supplement for use in questions are the exception.
- Every question stores: ACS area and task code, source document and edition, the exact source passage or figure supporting the answer, and a short explanation.
- Drafting: Claude writes questions from the source text.
- Review: a separate reviewer agent, without access to the drafting rationale, verifies that the cited passage supports the keyed answer and that no distractor is also defensible. Questions that fail or are ambiguous are held back, not published.
- Live feedback: "Report this question" submissions go into a review queue.
- Beta exit condition: Rick passes the Part 107 exam, then reviews all flagged and reported questions.
- Maintenance: when the FAA revises the ACS or the Testing Supplement, questions tagged to the old edition are re-checked.

## Technical decisions

| Area | Decision | Reason |
| --- | --- | --- |
| Front end | React Router v7 (framework mode), TypeScript | Server-rendered public pages for search; native Cloudflare Workers support; works with Neon Auth's React components |
| Hosting | Cloudflare (Workers with static assets) | Free tier permits commercial use; Vercel Hobby does not, and its treatment of donation links is unclear |
| Domains | Cloudflare Registrar | At-cost renewals; DNS, hosting, and registration in one account |
| Database | Neon Postgres, Free plan | Scales to zero and wakes automatically on the next query; no manual reactivation as with Supabase Free |
| Auth | Neon Auth (managed Better Auth) | Included in Neon Free up to 60,000 MAU; avoids building auth |
| Testing Supplement figures | Rasterized from the PDF at ~300 dpi, one image per figure, stored as site assets | Lets questions display the actual figure |

Testing Supplement: FAA-CT-8080-2H (2018, effective June 11, 2018, 113 pages), stored at `references/sport_rec_private_akts.pdf`. As of 2026-10-01, the FAA's testing supplements page lists it as the current edition for Remote Pilot (UAG). Its front matter carries no copyright notice, and as a work of the U.S. government it is not subject to copyright (17 U.S.C. 105), so its figures can be published. Recheck the FAA page for a newer edition before launch.

## Repository layout and source of truth

- `docs/`: project documents (see Project documents below).
- `images/`: branding (logo, favicons). Originals are kept as delivered.
- `references/`: FAA source documents used to write and check questions. Read-only inputs, never edited, and never committed to git (`references/*.pdf` is in `.gitignore`). Each document's official source URL is recorded so the file can be downloaded again. Files keep the names the FAA gives them; the table below maps each document to its file.

| Document | Edition | File | Official source |
| --- | --- | --- | --- |
| 14 CFR Part 107, Small Unmanned Aircraft Systems | eCFR, current as of Sept. 30, 2026 | `references/14 CFR Part 107 -  9-30-2026.pdf` | https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-107 (text of the regulation, not a PDF) |
| Remote Pilot sUAS Airman Certification Standards (FAA-S-ACS-10B) | April 2021, effective April 6, 2021 | `references/uas_acs.pdf` | https://www.faa.gov/training_testing/testing/acs/uas_acs.pdf |
| Airman Knowledge Testing Supplement (FAA-CT-8080-2H) | 2018, effective June 11, 2018 | `references/sport_rec_private_akts.pdf` | https://www.faa.gov/sites/faa.gov/files/training_testing/testing/supplements/sport_rec_private_akts.pdf |
| Remote Pilot sUAS Study Guide (FAA-G-8082-22) | August 2016 | `references/remote_pilot_study_guide.pdf` | https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/remote_pilot_study_guide.pdf |

SHA-256 checksums of the local copies, used to tell when a downloaded file differs from the one questions were written against:

| File | SHA-256 |
| --- | --- |
| `14 CFR Part 107 -  9-30-2026.pdf` | `b1b93795f43c39b8ae47283d347b1d709bfb70ccb719b6a65529da6f9174fc5e` |
| `uas_acs.pdf` | `9ee24463b40f023a3140d0c8a4d14ab295ede7a869fbacb7b7cd5ceb4caef431` |
| `sport_rec_private_akts.pdf` | `738a0cd5c429e20888e94fd490d90ba09223ac4d350d06fe228788d4b502f4fd` |
| `remote_pilot_study_guide.pdf` | `55d0e7772ecd16dc201f21b0286f9d7777f67e894a97a9b074fa27464903e05f` |

The eCFR is the FAA's continuously updated text of the regulation. The Part 107 PDF is a dated snapshot of it; when the eCFR changes, download a new snapshot and recheck affected questions.

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
