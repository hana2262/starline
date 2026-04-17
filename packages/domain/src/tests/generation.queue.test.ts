import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenerationQueue } from "../generation/generation.queue.js";

describe("GenerationQueue", () => {
  beforeEach(() => { vi.useRealTimers(); });

  it("push() calls executor with the correct jobId", async () => {
    const executor = vi.fn().mockResolvedValue(undefined);
    const queue = new GenerationQueue(executor);

    queue.push("job-1");
    await queue.waitForIdle();

    expect(executor).toHaveBeenCalledOnce();
    expect(executor).toHaveBeenCalledWith("job-1");
  });

  it("processes jobs serially by default", async () => {
    const order: string[] = [];
    let resolveFirst!: () => void;
    const executor = vi.fn().mockImplementation(async (jobId: string) => {
      if (jobId === "job-1") {
        await new Promise<void>((resolve) => { resolveFirst = resolve; });
      }
      order.push(jobId);
    });
    const queue = new GenerationQueue(executor);

    queue.push("job-1");
    queue.push("job-2");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual([]);

    resolveFirst();
    await queue.waitForIdle();

    expect(order).toEqual(["job-1", "job-2"]);
  });

  it("runs up to configured concurrency in parallel", async () => {
    const started: string[] = [];
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const executor = vi.fn().mockImplementation(async (jobId: string) => {
      started.push(jobId);
      if (jobId === "job-1") {
        await new Promise<void>((resolve) => { resolveFirst = resolve; });
      }
      if (jobId === "job-2") {
        await new Promise<void>((resolve) => { resolveSecond = resolve; });
      }
    });
    const queue = new GenerationQueue(executor, 2);

    queue.push("job-1");
    queue.push("job-2");
    queue.push("job-3");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toEqual(["job-1", "job-2"]);

    resolveFirst();
    resolveSecond();
    await queue.waitForIdle();

    expect(started).toEqual(["job-1", "job-2", "job-3"]);
  });

  it("executor throwing does not stop later jobs", async () => {
    const executor = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const queue = new GenerationQueue(executor);

    queue.push("job-1");
    queue.push("job-2");
    await queue.waitForIdle();

    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor).toHaveBeenNthCalledWith(1, "job-1");
    expect(executor).toHaveBeenNthCalledWith(2, "job-2");
  });

  it("waitForIdle() resolves immediately when queue is empty", async () => {
    const queue = new GenerationQueue(vi.fn().mockResolvedValue(undefined));
    await expect(queue.waitForIdle()).resolves.toBeUndefined();
  });

  it("waitForIdle() resolves only after all pending jobs complete", async () => {
    const completed: string[] = [];
    const executor = vi.fn().mockImplementation(async (jobId: string) => {
      completed.push(jobId);
    });
    const queue = new GenerationQueue(executor);

    queue.push("job-a");
    queue.push("job-b");
    await queue.waitForIdle();

    expect(completed).toEqual(["job-a", "job-b"]);
  });

  it("scheduleRetry() enqueues jobId after the specified delay", async () => {
    vi.useFakeTimers();
    const executor = vi.fn().mockResolvedValue(undefined);
    const queue = new GenerationQueue(executor);

    queue.scheduleRetry("job-retry", 500);
    expect(executor).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    await queue.waitForIdle();

    expect(executor).toHaveBeenCalledOnce();
    expect(executor).toHaveBeenCalledWith("job-retry");
  });

  it("destroy() cancels scheduled retry timers", async () => {
    vi.useFakeTimers();
    const executor = vi.fn().mockResolvedValue(undefined);
    const queue = new GenerationQueue(executor);

    queue.scheduleRetry("job-cancel", 1000);
    queue.destroy();

    await vi.advanceTimersByTimeAsync(2000);
    expect(executor).not.toHaveBeenCalled();
  });
});
