import { describe, expect, it } from "vitest";
import { normalizePhone } from "../hooks/useChatStore";

describe("normalizePhone", () => {
  it("accepts a valid RF number (11 digits starting with 7)", () => {
    expect(normalizePhone("79991234567")).toBe("79991234567");
  });

  it("converts a leading 8 to 7 (RF local format)", () => {
    expect(normalizePhone("89991234567")).toBe("79991234567");
  });

  it("strips formatting characters", () => {
    expect(normalizePhone("+7 (999) 123-45-67")).toBe("79991234567");
  });

  it("accepts a valid RB number (12 digits starting with 375)", () => {
    expect(normalizePhone("375291234567")).toBe("375291234567");
  });

  it("rejects a too-short number", () => {
    expect(normalizePhone("7999123")).toBeNull();
  });

  it("rejects an RF-length number not starting with 7/8", () => {
    expect(normalizePhone("19991234567")).toBeNull();
  });

  it("rejects an RB-length number not starting with 375", () => {
    expect(normalizePhone("999291234567")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(normalizePhone("")).toBeNull();
  });
});
