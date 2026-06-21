import { describe, expect, it } from "vitest";
import { isAlreadyExistsError, sidecarPathFor } from "../src/review-store";

describe("sidecarPathFor", () => {
  it("builds deterministic JSON sidecar paths", () => {
    const first = sidecarPathFor("docs/My Spec.md", ".agenttools/reviews");
    const second = sidecarPathFor("docs/My Spec.md", ".agenttools/reviews");

    expect(first).toBe(second);
    expect(first).toMatch(/^\.agenttools\/reviews\/[a-z0-9]+-my-spec\.json$/);
  });

  it("recognizes already-exists filesystem errors", () => {
    expect(isAlreadyExistsError(new Error("File already exists"))).toBe(true);
    expect(isAlreadyExistsError(new Error("Folder already exists"))).toBe(true);
    expect(isAlreadyExistsError(new Error("Permission denied"))).toBe(false);
  });
});
