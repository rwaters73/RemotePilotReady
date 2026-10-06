// Shared types for the question bank tools.

export type Severity = 'error' | 'warning';

export interface Issue {
  file: string;
  check: string;
  severity: Severity;
  message: string;
}

export const STATUSES = ['draft', 'approved', 'returned', 'held', 'retired'] as const;
export type Status = (typeof STATUSES)[number];

export const REVIEWERS = ['q-reviewer', 'rick'] as const;

export interface Source {
  doc: string;
  edition: string;
  location: string;
  passage: string;
}

export interface Review {
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  content_hash: string | null;
  notes: string | null;
}

// A question whose front matter passed the schema check.
export interface Question {
  id: string;
  acs_code: string;
  figures: string[];
  options: { A: string; B: string; C: string };
  answer: 'A' | 'B' | 'C';
  sources: Source[];
  review: Review;
}

export interface ReferenceDoc {
  key: string;
  kind: string;
  title: string;
  document_number: string | null;
  edition: string;
  official_url: string;
  local_file: string;
  sha256: string;
}

export interface AcsElement {
  code: string;
  area: string;
  task: string;
  description: string;
}

export interface AcsData {
  doc: string;
  source_sha256: string;
  extracted_with: string;
  areas: { numeral: string; title: string }[];
  elements: AcsElement[];
}

export interface FigureItem {
  key: string;
  type: 'figure' | 'legend';
  number: number;
  file: string;
}

export interface FigureIndex {
  source_doc: string;
  items: FigureItem[];
}
