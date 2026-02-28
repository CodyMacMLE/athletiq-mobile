import { describe, it, expect, beforeEach } from "vitest";
import { encrypt, decrypt } from "../encrypt.js";

describe("encrypt / decrypt", () => {
  beforeEach(() => {
    // Provide a deterministic 256-bit hex key for testing
    process.env.ENCRYPTION_KEY = "0".repeat(64);
  });

  it("returns a non-empty ciphertext string", () => {
    const ct = encrypt("hello world");
    expect(typeof ct).toBe("string");
    expect(ct.length).toBeGreaterThan(0);
  });

  it("round-trips plaintext correctly", () => {
    const plain = "sensitive medical data";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("produces different ciphertext for the same input (random IV)", () => {
    const a = encrypt("same input");
    const b = encrypt("same input");
    expect(a).not.toBe(b);
  });

  it("decrypts to the original value after multiple round-trips", () => {
    const values = ["conditions: diabetes", "allergy: penicillin", "insurance: 12345-ABC"];
    for (const v of values) {
      expect(decrypt(encrypt(v))).toBe(v);
    }
  });

  it("returns empty string when encrypting empty string", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("throws when decrypting with wrong key", () => {
    const ct = encrypt("secret");
    process.env.ENCRYPTION_KEY = "f".repeat(64); // different key
    expect(() => decrypt(ct)).toThrow();
  });

  it("throws on malformed ciphertext", () => {
    expect(() => decrypt("not-valid-base64!!")).toThrow();
  });
});
