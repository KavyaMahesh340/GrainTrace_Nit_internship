import { describe, expect, it } from "vitest";
import { formatCover, formatCurrency, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

describe("formatters", () => {
  it("formats quantities with Indian grouping", () => {
    expect(formatQuantity(1200)).toBe("1,200");
  });

  it("formats currency as whole INR", () => {
    expect(formatCurrency(92400)).toContain("92,400");
  });

  it("formats days of cover", () => {
    expect(formatCover(1.8)).toBe("1.8 d");
  });
});

describe("cn", () => {
  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
