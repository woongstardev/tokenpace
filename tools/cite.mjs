/**
 * cite.mjs — the one place the citation line is written.
 *
 * Both measurement documents are served on the site, and both are what a
 * reader would cite. They must not describe how to cite this work in two
 * slightly different ways, so neither of them writes that text itself.
 *
 * The machine-readable version is CITATION.cff at the repository root, which
 * ships with the site for the same reason LICENSES.md does: what distributes
 * the measurements has to carry the terms they come under.
 */

/** @param {string} measuredAt ISO date the figures on the page were measured. */
export function citationBlock(measuredAt) {
  const year = measuredAt.slice(0, 4);
  return `## 이 수치를 인용한다면

이 문서의 수치는 **CC BY 4.0** 이다 — 쓰는 데 허락이 필요 없고, 출처 표기만 요구한다.

> Yang, J. (${year}). *tokenpace: 언어별 토큰 밀도와 tok/s 로 환산한 읽기 속도*
> (측정 ${measuredAt}). <https://tokenpace.woongstar.com/>

기계가 읽는 형식은 [\`CITATION.cff\`](../CITATION.cff) 에 있다 (CFF 1.2.0).`;
}

/** English half of the same block. Same citation string, deliberately. */
export function citationBlockEn(measuredAt) {
  const year = measuredAt.slice(0, 4);
  return `## Citing these figures

The figures in this document are **CC BY 4.0**: use them without asking, name
where they came from.

> Yang, J. (${year}). *tokenpace: token density by language, and reading speed
> converted to tok/s* (measured ${measuredAt}). <https://tokenpace.woongstar.com/>

The machine-readable form is [\`CITATION.cff\`](../CITATION.cff) (CFF 1.2.0).`;
}

/**
 * A plain-text pointer to the other language.
 *
 * These documents are served as text/plain — deliberately, because
 * text/markdown makes a browser download them instead of showing them. The
 * consequence is that the markdown anchor link at the top of each file is dead
 * on the site: it says "English ↓" and gives no idea whether that is ten lines
 * away or two hundred. So the pointer is resolved into something that works in
 * raw text, a line number and a string to search for.
 *
 * Filled in after rendering, since the line number is not knowable before.
 */
export const LANGUAGE_MARK = '<!--LANGUAGE-POINTER-->';

export function resolveLanguagePointer(markdown, { heading, ko }) {
  const lines = markdown.split('\n');
  const at = lines.findIndex((line) => line.startsWith(heading));
  if (at < 0) throw new Error(`resolveLanguagePointer: no line starting with ${heading}`);
  const text = ko
    ? `> 영문 절은 ${at + 1}행부터입니다 — \`${heading}\` 를 찾으십시오.`
    : `> The English half starts at line ${at + 1} — search for \`${heading}\`.`;
  return markdown.replace(LANGUAGE_MARK, text);
}
