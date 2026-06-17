import type { ReviewAnnotation, ReviewRecord } from "./types";

export function formatReviewFeedback(records: ReviewRecord[]): string {
  const sections = records.map(formatRecordFeedback);
  return ["# Review Feedback", ...sections].join("\n\n").trimEnd() + "\n";
}

export function formatRecordFeedback(record: ReviewRecord): string {
  const lines = [
    `## ${record.sourcePath}`,
    "",
    `Decision: ${record.decision}`,
    `Open annotations: ${record.annotations.filter((annotation) => annotation.status === "open").length}`
  ];

  const annotations = record.annotations.filter((annotation) => annotation.status === "open" || annotation.status === "conflict");

  if (annotations.length === 0) {
    lines.push("", "No open annotations.");
    return lines.join("\n");
  }

  annotations.forEach((annotation, index) => {
    lines.push("", `### ${index + 1}. ${formatAnnotationTitle(annotation)}`, "", "Quote:", "", quoteBlock(annotation.quote));

    if (annotation.body) {
      lines.push("", "Comment:", "", annotation.body);
    }

    if (annotation.replacement) {
      lines.push("", "Suggested replacement:", "", fenced(annotation.replacement));
    }
  });

  return lines.join("\n");
}

function formatAnnotationTitle(annotation: ReviewAnnotation): string {
  const status = annotation.status === "conflict" ? "conflict" : annotation.kind;
  return `${status} (${annotation.id})`;
}

function quoteBlock(value: string): string {
  return value
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function fenced(value: string): string {
  return ["```markdown", value, "```"].join("\n");
}
