// insertReviewWithinRateLimit outcome semantics, with the transaction layer mocked: a genuine cap
// hit must report "rate_limited", retry exhaustion under SERIALIZABLE contention must report
// "contention" (the user may NOT be over the cap — the UI copy differs), and non-serialization
// errors must propagate untouched.
jest.mock("server-only", () => ({}));
jest.mock("@/lib/prisma", () => ({ prisma: { $transaction: jest.fn() } }));

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { insertReviewWithinRateLimit } from "@/lib/reviews/queries";

const $transaction = prisma.$transaction as jest.Mock;

const NOW = new Date("2026-07-23T12:00:00Z");
const minutesAgo = (m: number) => ({ createdAt: new Date(NOW.getTime() - m * 60_000) });

const serializationFailure = () =>
  new Prisma.PrismaClientKnownRequestError(
    "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
    { code: "P2034", clientVersion: "6.19.3" },
  );

// A tx stub whose findMany returns the given recent-submission rows.
const txWith = (rows: { createdAt: Date }[]) => ({
  review: {
    findMany: jest.fn().mockResolvedValue(rows),
    create: jest.fn().mockResolvedValue({}),
  },
});

const DATA = { userId: "u1", modelId: "m1" } as Prisma.ReviewUncheckedCreateInput;

beforeEach(() => $transaction.mockReset());

describe("insertReviewWithinRateLimit", () => {
  it("inserts and reports ok under the cap", async () => {
    const tx = txWith([minutesAgo(50)]);
    $transaction.mockImplementation(async (fn) => fn(tx));
    await expect(insertReviewWithinRateLimit("u1", DATA, NOW)).resolves.toEqual({ ok: true });
    expect(tx.review.create).toHaveBeenCalledTimes(1);
  });

  it("reports rate_limited on a genuine cap hit, without inserting", async () => {
    const tx = txWith([minutesAgo(5), minutesAgo(20), minutesAgo(40)]);
    $transaction.mockImplementation(async (fn) => fn(tx));
    await expect(insertReviewWithinRateLimit("u1", DATA, NOW)).resolves.toEqual({
      ok: false,
      reason: "rate_limited",
    });
    expect(tx.review.create).not.toHaveBeenCalled();
  });

  it("retries a serialization failure and succeeds on a later attempt", async () => {
    const tx = txWith([]);
    $transaction
      .mockRejectedValueOnce(serializationFailure())
      .mockImplementation(async (fn) => fn(tx));
    await expect(insertReviewWithinRateLimit("u1", DATA, NOW)).resolves.toEqual({ ok: true });
    expect($transaction).toHaveBeenCalledTimes(2);
  });

  it("reports contention (not rate_limited) when every retry hits a serialization failure", async () => {
    $transaction.mockRejectedValue(serializationFailure());
    await expect(insertReviewWithinRateLimit("u1", DATA, NOW)).resolves.toEqual({
      ok: false,
      reason: "contention",
    });
    expect($transaction).toHaveBeenCalledTimes(6); // MAX_ATTEMPTS, fail closed after
  });

  it("propagates non-serialization errors instead of retrying", async () => {
    $transaction.mockRejectedValue(new Error("connection refused"));
    await expect(insertReviewWithinRateLimit("u1", DATA, NOW)).rejects.toThrow(
      "connection refused",
    );
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});
