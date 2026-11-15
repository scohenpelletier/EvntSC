import { describe, expect, it } from "vitest";
import { isUscEmail } from "@/lib/usc-email";

describe("isUscEmail", () => {
  it("accepts usc.edu and its subdomains", () => {
    expect(isUscEmail("ttrojan@usc.edu")).toBe(true);
    expect(isUscEmail(" TTrojan@USC.EDU ")).toBe(true);
    expect(isUscEmail("x@marshall.usc.edu")).toBe(true);
  });
  it("rejects look-alikes and other domains", () => {
    expect(isUscEmail("x@gmail.com")).toBe(false);
    expect(isUscEmail("x@notusc.edu")).toBe(false);
    expect(isUscEmail("x@usc.edu.evil.com")).toBe(false);
    expect(isUscEmail("usc.edu")).toBe(false);
    expect(isUscEmail("a b@usc.edu")).toBe(false);
  });
});
