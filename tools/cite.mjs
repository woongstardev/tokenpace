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

> Woongstar (${year}). *tokenpace: 언어별 토큰 밀도와 tok/s 로 환산한 읽기 속도*
> (측정 ${measuredAt}). <https://tokenpace.woongstar.com/>

기계가 읽는 형식은 [\`CITATION.cff\`](../CITATION.cff) 에 있다 (CFF 1.2.0).`;
}
