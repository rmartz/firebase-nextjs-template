import { describe, it, expect } from "vitest";
import {
  classifyResult,
  normalizePath,
  buildEditEvents,
  aggregateByFile,
} from "./mine-edit-outcomes.mjs";

// AC1: extract per-file edit-outcome ground truth (failed anchors, retries,
// disambiguation-window size) from agent transcripts.

// Minimal transcript record shapes: an assistant message carries `tool_use`
// blocks, a user message carries the matching `tool_result`.
const use = (id, path, oldString, session = "s1") => ({
  sessionId: session,
  message: {
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id,
        name: "Edit",
        input: { file_path: path, old_string: oldString },
      },
    ],
  },
});
const result = (id, text, isError = false, session = "s1") => ({
  sessionId: session,
  message: {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: id,
        is_error: isError,
        content: text,
      },
    ],
  },
});

describe("classifyResult — anchor-failure detection", () => {
  it("flags a not-found anchor failure", () => {
    expect(classifyResult("String to replace not found in file.", true)).toBe(
      "not_found",
    );
  });

  it("flags a non-unique anchor failure from the match-count message", () => {
    expect(
      classifyResult("Found 3 matches of the string to replace.", true),
    ).toBe("not_unique");
  });

  it("treats a successful edit result as ok", () => {
    expect(
      classifyResult("The file has been updated successfully.", false),
    ).toBe("ok");
  });
});

describe("normalizePath — map an absolute edit path to repo-relative", () => {
  it("strips the repo-root prefix", () => {
    expect(
      normalizePath(
        "/Users/x/Development/firebase-nextjs-template/scripts/a.mjs",
      ),
    ).toBe("scripts/a.mjs");
  });

  it("strips a .git-worktrees/<branch>/ prefix so worktree edits join to source", () => {
    expect(
      normalizePath(
        "/Users/x/Development/firebase-nextjs-template/.git-worktrees/feat-1/src/lib/util.ts",
      ),
    ).toBe("src/lib/util.ts");
  });
});

describe("buildEditEvents — pair tool_use with its result in order", () => {
  it("attaches each edit's outcome and disambiguation-window length", () => {
    const records = [
      use("a", "/repo/firebase-nextjs-template/src/x.ts", "one two three"),
      result("a", "updated", false),
    ];
    const events = buildEditEvents(records);
    expect(events).toHaveLength(1);
    expect(events[0].path).toBe("src/x.ts");
    expect(events[0].windowLen).toBe("one two three".length);
    expect(events[0].outcome).toBe("ok");
  });

  it("defaults to ok when no matching result is present", () => {
    const events = buildEditEvents([
      use("z", "/firebase-nextjs-template/src/y.ts", "abc"),
    ]);
    expect(events[0].outcome).toBe("ok");
  });
});

describe("aggregateByFile — per-file ground-truth stats", () => {
  it("counts failures and a fail→reattempt retry on the same file", () => {
    const records = [
      use("1", "/firebase-nextjs-template/src/a.ts", "needle", "s1"),
      result("1", "String to replace not found", true, "s1"),
      use(
        "2",
        "/firebase-nextjs-template/src/a.ts",
        "needle with more context to disambiguate",
        "s1",
      ),
      result("2", "updated", false, "s1"),
    ];
    const events = buildEditEvents(records);
    const byFile = aggregateByFile(events);
    const a = byFile.get("src/a.ts");
    expect(a.edits).toBe(2);
    expect(a.failures).toBe(1);
    expect(a.notFound).toBe(1);
    expect(a.retries).toBe(1);
    // median window is the larger disambiguating window across the two attempts
    expect(a.maxWindow).toBe("needle with more context to disambiguate".length);
  });

  it("reports zero failures and retries for a clean single edit", () => {
    const events = buildEditEvents([
      use(
        "1",
        "/firebase-nextjs-template/src/b.ts",
        "unique anchor line",
        "s2",
      ),
      result("1", "updated", false, "s2"),
    ]);
    const b = aggregateByFile(events).get("src/b.ts");
    expect(b.failures).toBe(0);
    expect(b.retries).toBe(0);
    expect(b.medianWindow).toBe("unique anchor line".length);
  });
});
