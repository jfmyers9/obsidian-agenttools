import { findAnchor } from "./anchors";
import type { AnchorMatch, ReviewAnnotation } from "./types";

export interface ApplySuggestionResult {
  applied: boolean;
  content: string;
  match: AnchorMatch;
}

export function applySuggestion(content: string, annotation: ReviewAnnotation): ApplySuggestionResult {
  if (annotation.kind !== "replacement" && annotation.kind !== "deletion") {
    return {
      applied: false,
      content,
      match: { matched: false, reason: "Annotation is not an applyable suggestion." }
    };
  }

  const match = findAnchor(content, annotation);

  if (!match.matched || typeof match.from !== "number" || typeof match.to !== "number") {
    return { applied: false, content, match };
  }

  const replacement = annotation.kind === "replacement" ? annotation.replacement ?? "" : "";

  return {
    applied: true,
    content: `${content.slice(0, match.from)}${replacement}${content.slice(match.to)}`,
    match
  };
}
