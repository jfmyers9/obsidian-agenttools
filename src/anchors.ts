import type { AnchorMatch, TextAnchor } from "./types";

const CONTEXT_LENGTH = 48;

export function createAnchor(content: string, from: number, to: number): TextAnchor {
  const start = Math.max(0, from);
  const end = Math.max(start, to);
  const quote = content.slice(start, end);

  return {
    quote,
    prefix: content.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: content.slice(end, Math.min(content.length, end + CONTEXT_LENGTH)),
    line: content.slice(0, start).split("\n").length,
    from: start,
    to: end
  };
}

export function findAnchor(content: string, anchor: TextAnchor): AnchorMatch {
  if (!anchor.quote) {
    return { matched: false, reason: "Anchor quote is empty." };
  }

  if (
    typeof anchor.from === "number" &&
    typeof anchor.to === "number" &&
    content.slice(anchor.from, anchor.to) === anchor.quote
  ) {
    return { matched: true, from: anchor.from, to: anchor.to };
  }

  const exactMatches = allIndexesOf(content, anchor.quote);

  if (exactMatches.length === 0) {
    return { matched: false, reason: "Quoted text no longer exists." };
  }

  const contextualMatches = exactMatches.filter((from) => {
    const to = from + anchor.quote.length;
    const prefixMatches = !anchor.prefix || content.slice(Math.max(0, from - anchor.prefix.length), from) === anchor.prefix;
    const suffixMatches = !anchor.suffix || content.slice(to, to + anchor.suffix.length) === anchor.suffix;
    return prefixMatches && suffixMatches;
  });

  const matches = contextualMatches.length > 0 ? contextualMatches : exactMatches;

  if (matches.length > 1) {
    return { matched: false, reason: "Quoted text matches multiple locations." };
  }

  const from = matches[0];
  return { matched: true, from, to: from + anchor.quote.length };
}

function allIndexesOf(content: string, needle: string): number[] {
  const matches: number[] = [];
  let from = 0;

  while (from < content.length) {
    const index = content.indexOf(needle, from);
    if (index === -1) {
      break;
    }
    matches.push(index);
    from = index + Math.max(needle.length, 1);
  }

  return matches;
}
