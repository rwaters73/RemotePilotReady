// Checks the Markdown body: the stem, one "## Explanation" line, then the explanation.
// Problems found here are reported under the "body" check.

export const EXPLANATION_HEADING = '## Explanation';

export function checkBody(bodyLines: string[]): string[] {
  const errors: string[] = [];
  const trimmed = bodyLines.map((l) => l.replace(/[ \t]+$/, ''));
  const headingAt = trimmed.flatMap((l, i) => (l === EXPLANATION_HEADING ? [i] : []));

  if (headingAt.length === 0) errors.push(`body has no "${EXPLANATION_HEADING}" line`);
  if (headingAt.length > 1) errors.push(`body has "${EXPLANATION_HEADING}" more than once`);
  if (headingAt.length === 1) {
    const stem = trimmed.slice(0, headingAt[0]).join('\n').trim();
    const explanation = trimmed.slice(headingAt[0] + 1).join('\n').trim();
    if (stem === '') errors.push('the stem (text before "## Explanation") is empty');
    if (explanation === '') errors.push('the explanation (text after "## Explanation") is empty');
  }

  trimmed.forEach((line, i) => {
    const n = i + 1;
    if (line === EXPLANATION_HEADING) return;
    if (/^ {0,3}#{1,6}(\s|$)/.test(line)) errors.push(`body line ${n}: headings other than "${EXPLANATION_HEADING}" are not allowed`);
    if (/^ {0,3}(=+|-+)$/.test(line)) errors.push(`body line ${n}: lines of only "-" or "=" are not allowed`);
    if (/<[A-Za-z/!]/.test(line)) errors.push(`body line ${n}: HTML and HTML comments are not allowed`);
    if (line.includes('![')) errors.push(`body line ${n}: images are not allowed in the body; use the figures key`);
  });
  return errors;
}
