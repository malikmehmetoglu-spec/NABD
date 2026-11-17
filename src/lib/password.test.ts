import { describe, expect, it } from "vitest";
import { generatePassword } from "./password";

describe("generatePassword", () => {
  it("has the requested length and no ambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(12);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });
  it("does not repeat", () => {
    expect(new Set(Array.from({ length: 500 }, () => generatePassword())).size).toBe(500);
  });
});
