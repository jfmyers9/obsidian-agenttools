import { describe, expect, it } from "vitest";
import { filterReviewFiles, isReviewablePath } from "../src/review-index";
import type { AgentToolsSettings } from "../src/types";

const settings: AgentToolsSettings = {
  reviewRoots: ["blueprints", "docs"],
  sidecarRoot: ".agenttools/reviews",
  defaultExportMode: "agent_feedback",
  showRibbonIcon: true
};

describe("review index filters", () => {
  it("includes markdown files under configured roots", () => {
    expect(isReviewablePath("blueprints/spec/example.md", settings)).toBe(true);
    expect(isReviewablePath("docs/example.md", settings)).toBe(true);
  });

  it("excludes sidecar records and unrelated files", () => {
    expect(isReviewablePath(".agenttools/reviews/abc.json", settings)).toBe(false);
    expect(isReviewablePath("notes/example.md", settings)).toBe(false);
  });

  it("supports empty root configuration as all markdown files outside sidecars", () => {
    expect(isReviewablePath("notes/example.md", { ...settings, reviewRoots: [] })).toBe(true);
  });

  it("filters file-like entries", () => {
    const files = [
      { path: "docs/one.md", basename: "one", stat: { mtime: 1 } },
      { path: "notes/two.md", basename: "two", stat: { mtime: 2 } }
    ];

    expect(filterReviewFiles(files, settings).map((file) => file.path)).toEqual(["docs/one.md"]);
  });
});
