# Question File Format

This is the format for every question in the Remote Pilot Ready question bank. q-writer writes files in this format, q-reviewer reviews them against it, and the validator (`npm run qbank:validate`) enforces every rule here that is not marked as a q-reviewer or loader rule. If this document and the validator disagree, that is a bug: report it to Rick.

## 1. Where things live

| Path | Contents |
| --- | --- |
| `questions/RPR-NNNN.md` | One file per question. Flat folder, no subfolders. |
| `figures/` | Testing Supplement figures and legends as images (`fig-N.png`, `legend-N.png`), shared by all questions. |
| `figures/index.json` | Index of the images in `figures/`. |
| `data/references.json` | The FAA source documents: key, kind, title, document number, edition, official URL, local file name, SHA-256. |
| `data/acs-10b-knowledge.json` | The 176 knowledge elements of FAA-S-ACS-10B, extracted from the PDF. Never edit by hand. |

`figures/index.json` looks like this:

```json
{
  "source_doc": "akts-2h",
  "items": [
    { "key": "fig-26", "type": "figure", "number": 26, "file": "fig-26.png" },
    { "key": "legend-1", "type": "legend", "number": 1, "file": "legend-1.png" }
  ]
}
```

`key` is `fig-N` for a figure and `legend-N` for a legend, where N is the number printed in the Testing Supplement. B-101 fills in the items.

## 2. IDs

- An ID is `RPR-` plus four digits, starting at `RPR-0001`, and it matches the file name: `RPR-0042` lives in `questions/RPR-0042.md`. `RPR-0000` is not a valid ID.
- A new ID is the highest existing ID plus 1. IDs carry no meaning and are never reused.
- Question files are never deleted or renumbered. An abandoned question is retired instead (section 6). Deleting the highest file would let the plus-1 rule reuse its ID, so the validator reports any gap in the sequence.
- Rick runs `git pull` before every q-writer batch, so the two machines can't hand out the same ID. q-writer runs one batch at a time.

## 3. File layout

A question file has three parts, in this order:

1. YAML front matter: line 1 is `---`, then the front matter, then a line `---`. Each delimiter line is `---`, optionally followed by trailing spaces or tabs, and nothing else.
2. The stem: plain paragraphs.
3. A line that is exactly `## Explanation`, then the explanation.

Front matter rules:

- The keys appear in this order and no others: `id`, `acs_code`, `figures`, `options`, `answer`, `sources`, `review`. There is no `area` key; the area comes from the ACS code.
- `review` is the last key, written in block style (one field per line, indented under `review:`), never as `{ ... }`. The `review:` line has nothing after the colon.
- No YAML comments (`#`) and no HTML comments (`<!-- -->`) anywhere in the file. In the front matter, any `<!--` is rejected, even inside a quoted string. Drafting notes do not go in question files.
- Double-quote every option, edition, location, and passage string. Unquoted values can change type (an unquoted `400` is a number, not text).

Files are UTF-8 without a byte order mark, with LF line endings (`.gitattributes` enforces LF in git).

## 4. Field reference

| Key | Type | Rules |
| --- | --- | --- |
| `id` | string | `RPR-NNNN`, equal to the file name. |
| `acs_code` | string | A knowledge element code from `data/acs-10b-knowledge.json`, for example `UA.I.B.K10` or the lettered sub-element `UA.I.B.K14a`. The area is the Roman numeral in the code (`I` in `UA.I.B.K10`). |
| `figures` | list of strings | `[]` when the question uses no figure. Otherwise each entry is `fig-N` or `legend-N`, must be in `figures/index.json`, must have its image file in `figures/`, and appears only once. |
| `options` | mapping | Exactly the keys `A`, `B`, `C`, in that order. Each value is a non-empty double-quoted string. The three must differ, ignoring case and whitespace. |
| `answer` | string | `A`, `B`, or `C`. Exactly one correct answer. |
| `sources` | list | At least one entry. Each entry has exactly `doc`, `edition`, `location`, `passage`, all non-empty strings. `edition`, `location`, and `passage` are double-quoted. |
| `review` | mapping | Exactly `status`, `reviewed_by`, `reviewed_at`, `content_hash`, `notes`. See section 6. |

Source entries:

- `doc` is a key in `data/references.json`: `cfr-107`, `cfr-89`, `cfr-48`, `acs-10b`, `akts-2h`, `study-guide-22`, `phak-25c`, `aim`, `ac-107-2a`.
- `edition` is copied exactly from that document's `edition` in `data/references.json`.
- `location` says where in the document the passage is, for example `"§ 107.51(a)"`, a chapter and page, or `"Figure 26"`.
- `passage` is the exact supporting text, as printed. Line-break hyphenation and runs of whitespace are normalized; characters such as `§` are kept as printed. For a chart question, it quotes the printed text on the figure, or the legend entry that defines the symbol. This exact-passage rule is checked by q-reviewer, not the validator. Passage is required on every source, including `akts-2h`; the validator checks that it is present and double-quoted.

Area I rule: a question whose ACS code is in Area I (Regulations) must have at least one source whose document has `"kind": "cfr"` in `data/references.json` (currently 14 CFR parts 107, 89, and 48).

Options and option order: options are shown in a shuffled order during an exam, and each attempt stores the order shown (D-021). So an option must stand on its own. The validator rejects an option that contains any of these exact phrases, in any capitalization:

- "all of the above"
- "none of the above"
- "both of the above"
- "neither of the above"
- "all of these"
- "none of these"
- "both X and Y" and "neither X nor Y", where X and Y are each `A`, `B`, or `C` (for example "both A and B" or "neither A nor C")

Any other reference to another option is checked by q-reviewer, not the validator.

## 5. Body rules

- The stem is not empty. The explanation is not empty.
- `## Explanation` appears exactly once. No other headings, and no lines made only of `-` or `=` characters.
- No HTML, no HTML comments, and no images (`![...]`). Figures are attached through the `figures` key, never in the body.
- The stem and explanation are public text and follow the writing rules in `docs/PROJECT_VISION.md`. These writing rules are checked by q-reviewer, not the validator.

## 6. Review block and status lifecycle

```yaml
review:
  status: draft
  reviewed_by: null
  reviewed_at: null
  content_hash: null
  notes: null
```

| Field | Values |
| --- | --- |
| `status` | `draft`, `approved`, `returned`, `held`, or `retired`. |
| `reviewed_by` | `q-reviewer`, `rick`, or `null`. Only `q-reviewer` when `status` is `approved`. |
| `reviewed_at` | A quoted date, `"YYYY-MM-DD"`, or `null`. |
| `content_hash` | 64 lowercase hex characters (section 7), or `null`. |
| `notes` | Text, or `null`. When present, it is not empty. |

Who sets each status:

| Status | Set by | Meaning |
| --- | --- | --- |
| `draft` | q-writer, for a new question or a revised returned one. Rick, when he clears a `held` question that was never approved. | Waiting for review. |
| `approved` | q-reviewer, for a new approval or a passed recheck of a `held` question that was approved before. | Checked against its sources. May be served. |
| `returned` | q-reviewer | Sent back to q-writer with findings in `notes`. |
| `held` | q-reviewer | Needs Rick: a source conflict, a source not in the references, suspected copied content, or an approved question that failed a recheck. Reason in `notes`. |
| `retired` | Rick only | Withdrawn. Never drawn into new exams; the file stays. |

Rules per status (the validator enforces these):

| Status | `reviewed_by`, `reviewed_at` | `notes` | `content_hash` |
| --- | --- | --- | --- |
| `draft` | any | any | must be `null` |
| `returned` | required; `reviewed_by` is `q-reviewer` or `rick` | required | must be `null` |
| `approved` | required; `reviewed_by` must be `q-reviewer` | any | required, and must match |
| `held` | required; `reviewed_by` is `q-reviewer` or `rick` | required | `null` if it was never approved; if not `null`, it must match |
| `retired` | any | any | `null` if it was never approved; if not `null`, it must match |

Lifecycle rules:

- q-reviewer may change only the five review fields. q-writer writes `status: draft`; for a new question the other four fields are `null`. When revising a returned question, q-writer sets `status: draft` and leaves the other review fields alone.
- Approved content is never edited. To fix an approved question, Rick retires it and q-writer writes a new question with a new ID. Past exam attempts point to the old ID and must keep showing exactly what the user saw (D-020, D-021).
- An approved question that fails a recheck goes to `held` and keeps its hash.
- A `held` question leaves `held` by one of these paths, depending on its hash:
  - `content_hash: null` (never approved): Rick may clear it to `draft`. It then needs q-reviewer to reach `approved`.
  - A non-null `content_hash` (was approved): it may only go back to `approved`, when q-reviewer rechecks it with the content unchanged and the same hash, or to `retired`, by Rick. It never returns to `draft`. To fix it, Rick retires it and q-writer writes a new question with a new ID.
- The validator checks each file on its own and cannot see a question's history, so it cannot catch a once-approved question that was moved back to `draft`. The loader enforces this instead (section 8).
- A source edition that no longer matches `data/references.json` is an error for `draft`, `returned`, and `held` with a null hash. For `approved`, `retired`, and `held` with a hash, it is a warning that the question needs a recheck; warnings do not fail the validator.

## 7. content_hash

The hash proves that an approved question has not changed since q-reviewer approved it. It covers the whole file except the review block, so changing the status or notes never changes it.

Algorithm:

1. The file must be UTF-8 with no byte order mark. A file with a BOM is rejected, not stripped.
2. Convert CRLF and lone CR line endings to LF.
3. Remove the line `review:` and every line after it, up to but not including the closing `---` of the front matter.
4. Strip trailing spaces and tabs from every line.
5. Remove trailing empty lines, then end the text with exactly one LF.
6. Take the SHA-256 of the UTF-8 bytes and write it as 64 lowercase hex characters.

Compute it with:

```
npm run qbank:hash -- questions/RPR-0001.md
```

The one implementation is `computeContentHash` in `scripts/qbank/lib/hash.ts`. The database loader must import it, not re-implement it.

## 8. Loader contract

For the future plan that loads the database from these files:

- Load every `approved` question. Also load `held` and `retired` questions that have a non-null `content_hash` that matches, marked as not drawable. These were once approved and may appear in past attempts.
- Never draw a `held` or `retired` question into a new exam. Never load `draft` or `returned` questions, or `held` and `retired` questions with a null hash.
- Never delete database rows. A question that stops being drawable is marked, not removed, so past attempts and reviews keep their questions.
- Any hash mismatch fails the whole load. A partial load would silently shrink the bank.
- Once the database holds a `content_hash` for a question ID, any later file for that ID must carry the same hash, or the whole load fails. A `null` hash or a different hash both count as a failure. This keeps approved content unchanged across history, which the validator cannot check because it sees only the current files.
- Take ACS area numerals and titles from `data/acs-10b-knowledge.json`, not from hardcoded lists.

## 9. The validator

Run from the repository root:

| Command | What it does |
| --- | --- |
| `npm run qbank:validate` | Checks every file in `questions/`. Prints one line per issue and a summary with counts by status. Exits 1 on any error; warnings do not change the exit code. |
| `npm run qbank:hash -- FILE...` | Prints each file's content hash. |
| `npm run qbank:acs:extract` | Re-extracts `data/acs-10b-knowledge.json` from `references/uas_acs.pdf` using `pdftotext -raw`. |
| `npm run qbank:acs:check` | Re-extracts and compares with the committed file. |
| `npm run qbank:refs:check` | Compares each file in `references/` with its SHA-256 in `data/references.json`. A missing file is reported but does not fail. |
| `npm run qbank:test` | Runs the validator's own tests and fixtures. |
| `npm run qbank:typecheck` | Type-checks the scripts. |

Checks, by ID:

| ID | Rejects |
| --- | --- |
| `data` | An invalid `data/references.json`, `data/acs-10b-knowledge.json` (not 176 unique valid codes, or a source checksum that differs from `acs-10b`), or `figures/index.json`. |
| `file-name` | Anything in `questions/` that isn't `RPR-NNNN.md`, apart from `.gitkeep`. `RPR-0000.md` is rejected. |
| `parse` | Missing or unclosed front matter, invalid YAML, duplicate keys, a BOM, invalid UTF-8, YAML comments, `<!--` anywhere in the front matter. |
| `schema` | Missing, unknown, or out-of-order keys; wrong types; options not exactly A, B, C; duplicate, empty, or unquoted options; a source `edition`, `location`, or `passage` that isn't double-quoted; an answer that isn't A, B, or C; `figures` not a list; empty sources or an incomplete source entry; a review block that isn't last or is in `{ ... }` style. |
| `body` | No stem, a missing or repeated `## Explanation`, an empty explanation, other headings, HTML or HTML comments, images. |
| `id-match` | An `id` that doesn't equal the file name. |
| `id-sequence` | Gaps between `RPR-0001` and the highest ID. |
| `acs-code` | A code that isn't in the ACS data file. |
| `source-doc` | A `doc` that isn't a key in `data/references.json`. |
| `source-edition` | An `edition` that doesn't match the references file exactly (error or warning, per section 6). |
| `area-i-cfr` | An Area I question with no source of kind `cfr`. |
| `figure` | Malformed figure keys, keys not in `figures/index.json`, keys listed twice, and keys whose image file is missing. |
| `status` | A status that isn't one of the five; `reviewed_by` other than `q-reviewer` or `rick`; `approved` with `reviewed_by` other than `q-reviewer`; a bad date; review fields missing for that status (section 6). |
| `content-hash` | A hash rule from section 6 not met, or a hash that doesn't match the file. |
| `option-text` | An option containing one of the phrases listed in section 4. |

## 10. Complete example

This example is an illustration only. It is never copied into `questions/`. A test validates it as `RPR-0001.md`, so this document and the validator can't drift apart.

```markdown
---
id: RPR-0001
acs_code: UA.I.B.K21a
figures: []
options:
  A: "100 knots"
  B: "87 knots"
  C: "87 miles per hour"
answer: B
sources:
  - doc: cfr-107
    edition: "eCFR, current as of Sept. 30, 2026"
    location: "§ 107.51(a)"
    passage: "The groundspeed of the small unmanned aircraft may not exceed 87 knots (100 miles per hour)."
review:
  status: approved
  reviewed_by: q-reviewer
  reviewed_at: "2026-10-07"
  content_hash: "31c75f5510260a955df9bb6cec270305a2fec0b158323bd9f4b39af880889255"
  notes: null
---
Under 14 CFR part 107, what is the maximum groundspeed allowed for a small unmanned aircraft?

## Explanation

Section 107.51(a) limits a small unmanned aircraft to a groundspeed of 87 knots, which is 100 miles per hour. A limit of 87 miles per hour is lower than the rule allows, and 100 knots is higher.
```
