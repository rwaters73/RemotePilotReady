// Parses the text that "pdftotext -raw -enc UTF-8" produces from FAA-S-ACS-10B into areas
// and knowledge elements. Pure function; extract-acs.ts handles the PDF and the files.
// Always use -raw output. -layout output pairs codes with the wrong descriptions.

import type { AcsElement } from './types.ts';

const ELEMENT_LINE = /^(UA\.(I|II|III|IV|V)\.([A-Z])\.K\d+[a-z]?)\s+(\S.*)$/;
const AREA_SHARE_LINE = /^(I|II|III|IV|V)\. (.+?) \d+-\d+%$/;
const STOP_LINE = /^(Risk Management|Skills|References|Objective|Knowledge|Task |Appendix|(I|II|III|IV|V)\. )/;
const PAGE_NUMBER_LINE = /^\d+$/;

function clean(line: string): string {
  // Page breaks arrive as a form feed at the start of a line (UA.I.B.K24 is one).
  return line.replace(/\f/g, '').replace(/ /g, ' ').replace(/[ \t\r]+$/, '');
}

export function parseAcsText(text: string): { areas: { numeral: string; title: string }[]; elements: AcsElement[] } {
  const lines = text.split('\n').map(clean);
  const elements: AcsElement[] = [];
  const areas: { numeral: string; title: string }[] = [];
  let current: { el: AcsElement; parts: string[] } | null = null;

  const finish = () => {
    if (current !== null) {
      current.el.description = current.parts.join(' ').replace(/\s+/g, ' ').trim();
      elements.push(current.el);
      current = null;
    }
  };

  for (const line of lines) {
    const area = AREA_SHARE_LINE.exec(line);
    if (area) {
      finish();
      areas.push({ numeral: area[1], title: area[2].trim() });
      continue;
    }
    const m = ELEMENT_LINE.exec(line);
    if (m) {
      finish();
      current = { el: { code: m[1], area: m[2], task: m[3], description: '' }, parts: [m[4]] };
      continue;
    }
    if (current === null) continue;
    if (line.trim() === '' || PAGE_NUMBER_LINE.test(line.trim())) continue;
    if (STOP_LINE.test(line)) {
      finish();
      continue;
    }
    current.parts.push(line.trim());
  }
  finish();
  return { areas, elements };
}
