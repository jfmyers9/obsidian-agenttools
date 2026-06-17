import { describe, expect, it } from "vitest";
import { hashPath, hashText } from "../src/hash";

describe("hash helpers", () => {
  it("hashes deterministically", () => {
    expect(hashText("hello")).toBe(hashText("hello"));
    expect(hashText("hello")).not.toBe(hashText("world"));
  });

  it("normalizes paths for path hashing", () => {
    expect(hashPath("Docs/Spec.md")).toBe(hashPath("docs/spec.md"));
  });
});
