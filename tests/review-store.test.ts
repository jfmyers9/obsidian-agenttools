import { describe, expect, it } from "vitest";
import { sidecarPathFor } from "../src/review-store";

describe("sidecarPathFor", () => {
  it("builds deterministic JSON sidecar paths", () => {
    const first = sidecarPathFor("docs/My Spec.md", ".agenttools/reviews");
    const second = sidecarPathFor("docs/My Spec.md", ".agenttools/reviews");

    expect(first).toBe(second);
    expect(first).toMatch(/^\.agenttools\/reviews\/[a-z0-9]+-my-spec\.json$/);
  });
});
