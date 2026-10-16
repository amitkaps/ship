/** @prose
 * # The rules' test
 *
 * Holds [the standard](../docs/standard.md) and [rules.ts](rules.ts) to the same ids, so a rule
 * can't be stated without a check, or checked without being stated.
 */
import { expect, test } from "vite-plus/test";
import { RULES, stated } from "./rules.ts";

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
      link: "https://ship.amitkaps.com/docs/standard.md#scripts-and-node",
    },
  ]);
});
