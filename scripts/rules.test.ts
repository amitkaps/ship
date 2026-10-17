/** @prose
 * # The rules' test
 *
 * Holds [the standard](../docs/standard.md) and [rules.ts](rules.ts) to the same ids, so a rule
 * can't be stated without a check, or checked without being stated. Every check, with an id or
 * not yet, is under one of the standard's parts, which is how the dashboard groups it.
 */
import { expect, test } from "vite-plus/test";
import { BETA, RULES, parts, stated } from "./rules.ts";
import { standard } from "./ship.ts";
import { CHECKS, type Repo } from "./survey.ts";

const checked = RULES.map((rule) => rule.id);
const statedIds = stated().map((s) => s.id);

test("each rule has one id", () => {
  expect(new Set(checked).size).toBe(checked.length);
  expect(new Set(statedIds).size).toBe(statedIds.length);
});

test("the standard states every rule that's checked, and only those", () => {
  expect([...statedIds].sort()).toEqual([...checked].sort());
});

test("a rule's link goes to the heading it's under", () => {
  const markdown =
    "## Scripts and Node\n\n- `scripts.x`: a rule.\n\n```md\n- `scripts.y`: an example.\n```\n";
  expect(stated(markdown)).toEqual([
    {
      id: "scripts.x",
      text: "a rule.",
      part: "Scripts and Node",
      link: "https://ship.amitkaps.com/docs/standard.md#scripts-and-node",
    },
  ]);
});

test("every check is under a part of the standard", () => {
  const found = parts();
  for (const check of CHECKS) expect(found, check.name).toContain(check.group);
});

test("a part is its second-level heading", () => {
  expect(parts("## Scripts\n\n### The editor\n\n```md\n## An example\n```\n")).toEqual(["Scripts"]);
});

test("only the standard's betas are on a pre-release, each an exact build", () => {
  const rule = RULES.find((r) => r.id === "versions.beta");
  const drift = (deps: Record<string, string>) => rule?.check({ deps } as Repo)?.drift;
  const [beta = ""] = BETA;
  expect(drift({ [beta]: "1.0.0-beta.17" })).toEqual([]);
  expect(drift({ [beta]: "^1.0.0-beta.17" })).toEqual([
    `${beta} is ^1.0.0-beta.17, not an exact build`,
  ]);
  expect(drift({ zod: "4.0.0-beta.1" })).toEqual(["zod is on a pre-release, 4.0.0-beta.1"]);
  expect(drift({ zod: "^4.0.0", vite: "npm:@voidzero-dev/vite-plus-core@1.3.0" })).toBeUndefined();
});

test("the betas this repository is on are the ones the standard names", () => {
  const deps = { ...standard.dependencies, ...standard.devDependencies };
  const pre = Object.keys(deps).filter((name) => /^\d+\.\d+\.\d+-/.test(deps[name] ?? ""));
  expect(pre.sort()).toEqual([...BETA].sort());
});
