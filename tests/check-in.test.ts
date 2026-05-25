import { describe, expect, it } from "vitest";
import { hashParticipantToken } from "../lib/token";
import { checkInSchema } from "../lib/validation";

describe("live check-in validation", () => {
  it("accepts a valid live classroom check-in", () => {
    const parsed = checkInSchema.parse({
      classSessionCode: "MBA26",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      valuationAmount: "2500",
      attendanceMode: "ONLINE"
    });
    expect(parsed.valuationAmount).toBe(2500);
    expect(parsed.attendanceMode).toBe("ONLINE");
  });

  it("requires a positive valuation", () => {
    expect(() =>
      checkInSchema.parse({
        classSessionCode: "MBA26",
        displayName: "Grace",
        valuationAmount: 0
      })
    ).toThrow();
  });

  it("requires attendance mode and allows email to be omitted", () => {
    const parsed = checkInSchema.parse({
      classSessionCode: "MBA26",
      displayName: "Lin",
      valuationAmount: 1800,
      attendanceMode: "IN_PERSON"
    });
    expect(parsed.attendanceMode).toBe("IN_PERSON");
    expect(() =>
      checkInSchema.parse({
        classSessionCode: "MBA26",
        displayName: "No Mode",
        valuationAmount: 1800
      })
    ).toThrow();
  });

  it("hashes participant session tokens before storage", () => {
    const hash = hashParticipantToken("secret-token");
    expect(hash).not.toBe("secret-token");
    expect(hash).toHaveLength(64);
    expect(hashParticipantToken("secret-token")).toBe(hash);
  });
});
