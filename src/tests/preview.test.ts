import { describe, expect, it } from "vitest";
import { previewSnapshot, previewSnapshotSchema } from "@/lib/data/preview";

describe("preview snapshot", () => {
  it("parses against the declared preview schema", () => {
    expect(() => previewSnapshotSchema.parse(previewSnapshot)).not.toThrow();
  });

  it("is explicitly marked as non-live preview data", () => {
    expect(previewSnapshot.dataMode).toBe("PREVIEW");
    expect(previewSnapshot.isLive).toBe(false);
  });

  it("contains the complete eleven-stage material journey", () => {
    expect(previewSnapshot.flow).toHaveLength(11);
    expect(previewSnapshot.flow.map((stage) => stage.label)).toContain("Audit");
  });
});
