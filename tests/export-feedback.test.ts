import { describe, expect, it } from "vitest";
import { formatReviewFeedback } from "../src/export-feedback";
import type { ReviewRecord } from "../src/types";

describe("formatReviewFeedback", () => {
  it("groups open annotations by source path", () => {
    const feedback = formatReviewFeedback([
      {
        schemaVersion: 1,
        sourcePath: "docs/spec.md",
        sourceHash: "hash",
        decision: "changes_requested",
        updatedAt: "now",
        annotations: [
          {
            id: "ann-1",
            kind: "replacement",
            status: "open",
            quote: "old",
            line: 12,
            replacement: "new",
            createdAt: "now",
            updatedAt: "now"
          }
        ]
      }
    ] satisfies ReviewRecord[]);

    expect(feedback).toContain("## docs/spec.md");
    expect(feedback).toContain("Decision: changes_requested");
    expect(feedback).toContain("Line: 12");
    expect(feedback).toContain("Suggested replacement:");
  });
});
