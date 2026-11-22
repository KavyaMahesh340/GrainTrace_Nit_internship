import { describe, expect, it } from "vitest";
import {
  enqueueMutation,
  getQueueCount,
  listMutations,
  removeMutation,
} from "@/lib/offline/queue";

describe("offline mutation queue", () => {
  it("enqueues, lists, counts, and removes a mutation", async () => {
    const before = await getQueueCount();
    const mutation = await enqueueMutation({
      id: `test-${Date.now()}`,
      type: "preview.action",
      payload: JSON.stringify({ reference: "SO-2481" }),
      createdAt: new Date().toISOString(),
    });

    expect(mutation.status).toBe("queued");
    expect(await getQueueCount()).toBe(before + 1);
    expect((await listMutations()).some((item) => item.id === mutation.id)).toBe(true);

    await removeMutation(mutation.id);
    expect((await listMutations()).some((item) => item.id === mutation.id)).toBe(false);
    expect(await getQueueCount()).toBe(before);
  });

  it("rejects invalid mutation payloads", async () => {
    await expect(
      enqueueMutation({
        id: "",
        type: "preview.action",
        payload: "{}",
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toThrow();
  });
});
