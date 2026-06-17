import { describe, expect, it } from "vitest";
import { createAnchor, findAnchor } from "../src/anchors";

describe("anchors", () => {
  it("matches original offsets", () => {
    const content = "alpha beta gamma";
    const anchor = createAnchor(content, 6, 10);

    expect(findAnchor(content, anchor)).toEqual({ matched: true, from: 6, to: 10 });
  });

  it("recovers from shifted text with context", () => {
    const anchor = createAnchor("alpha beta gamma", 6, 10);

    expect(findAnchor("prefix alpha beta gamma", anchor)).toEqual({ matched: true, from: 13, to: 17 });
  });

  it("reports conflict when quote is absent", () => {
    const anchor = createAnchor("alpha beta gamma", 6, 10);

    expect(findAnchor("alpha delta gamma", anchor)).toMatchObject({ matched: false });
  });
});
