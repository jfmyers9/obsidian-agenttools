import { describe, expect, it } from "vitest";
import { createAnchor } from "../src/anchors";
import { applySuggestion } from "../src/apply-suggestion";
import type { ReviewAnnotation } from "../src/types";

describe("applySuggestion", () => {
  it("applies replacement suggestions on exact anchors", () => {
    const content = "alpha beta gamma";
    const annotation: ReviewAnnotation = {
      id: "ann-1",
      kind: "replacement",
      status: "open",
      ...createAnchor(content, 6, 10),
      replacement: "delta",
      createdAt: "now",
      updatedAt: "now"
    };

    expect(applySuggestion(content, annotation)).toMatchObject({
      applied: true,
      content: "alpha delta gamma"
    });
  });

  it("reports conflicts without changing content", () => {
    const content = "alpha beta gamma";
    const annotation: ReviewAnnotation = {
      id: "ann-1",
      kind: "deletion",
      status: "open",
      ...createAnchor(content, 6, 10),
      createdAt: "now",
      updatedAt: "now"
    };

    expect(applySuggestion("alpha delta gamma", annotation)).toMatchObject({
      applied: false,
      content: "alpha delta gamma"
    });
  });
});
