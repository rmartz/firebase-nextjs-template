import { describe, it, expect } from "vitest";
import {
  spearman,
  classifyFile,
  joinScoresAndOutcomes,
  buildSnapshot,
} from "./eval-edit-fragility.mjs";

// AC2: join fragility scores against ground truth and report correlation.
// AC5: explicit treatment of the false-positive classes.

describe("spearman — rank correlation used for the score↔difficulty join", () => {
  it("is +1 for a perfectly monotonic-increasing relationship", () => {
    const rho = spearman([
      [1, 10],
      [2, 20],
      [3, 30],
      [4, 40],
    ]);
    expect(rho).toBeCloseTo(1, 5);
  });

  it("is -1 for a perfectly monotonic-decreasing relationship", () => {
    const rho = spearman([
      [1, 40],
      [2, 30],
      [3, 20],
      [4, 10],
    ]);
    expect(rho).toBeCloseTo(-1, 5);
  });

  it("returns undefined when there are too few pairs to correlate", () => {
    expect(spearman([[1, 2]])).toBeUndefined();
  });
});

describe("classifyFile — false-positive class buckets (AC5)", () => {
  it("labels spec files as tests", () => {
    expect(classifyFile("src/lib/utils.spec.ts")).toBe("test");
  });

  it("labels stories", () => {
    expect(classifyFile("src/app/Button.stories.tsx")).toBe("story");
  });

  it("labels shared fixtures under a -tests/ directory", () => {
    expect(classifyFile("src/auth/auth-tests/make-user.ts")).toBe("fixture");
  });

  it("labels ordinary source as source", () => {
    expect(classifyFile("src/lib/utils.ts")).toBe("source");
  });
});

describe("joinScoresAndOutcomes — inner join keyed on repo-relative path", () => {
  const scores = [
    { path: "src/a.ts", fragility: 0.5, significant: 40 },
    { path: "src/b.spec.ts", fragility: 0.9, significant: 80 },
    { path: "src/never-edited.ts", fragility: 0.1, significant: 10 },
  ];
  const outcomes = new Map([
    [
      "src/a.ts",
      { edits: 3, failures: 1, retries: 1, medianWindow: 120, maxWindow: 300 },
    ],
    [
      "src/b.spec.ts",
      { edits: 2, failures: 0, retries: 0, medianWindow: 40, maxWindow: 60 },
    ],
    [
      "src/untracked-by-score.ts",
      { edits: 1, failures: 0, retries: 0, medianWindow: 10, maxWindow: 10 },
    ],
  ]);

  it("keeps only files present in both score and outcome sets", () => {
    const joined = joinScoresAndOutcomes(scores, outcomes);
    const paths = joined.map((r) => r.path).sort();
    expect(paths).toEqual(["src/a.ts", "src/b.spec.ts"]);
  });

  it("carries the false-positive class onto each joined row", () => {
    const joined = joinScoresAndOutcomes(scores, outcomes);
    const bySpec = joined.find((r) => r.path === "src/b.spec.ts");
    expect(bySpec.klass).toBe("test");
    expect(bySpec.fragility).toBe(0.9);
    expect(bySpec.failures).toBe(0);
  });
});

describe("buildSnapshot — durable ledger line for persistence (AC3)", () => {
  it("captures date, commit, and a compact per-file score list", () => {
    const scores = [
      {
        path: "src/a.ts",
        fragility: 0.5,
        significant: 40,
        repeats: [{ line: "x", count: 2 }],
      },
    ];
    const line = buildSnapshot(scores, {
      date: "2026-09-14",
      commit: "abc123",
    });
    expect(line.date).toBe("2026-09-14");
    expect(line.commit).toBe("abc123");
    expect(line.files).toEqual([
      { path: "src/a.ts", fragility: 0.5, significant: 40 },
    ]);
  });
});
