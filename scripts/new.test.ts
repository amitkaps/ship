/** @prose
 * # The generator's test
 *
 * Writes a package, a site, a tool and an internal site the way `pnpm new` does, then checks
 * each against the survey and runs its `verify`. If the standard changes and the generator doesn't follow, this fails here,
 * before a new repository starts out of line.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { type Kind, write } from "./new.ts";
import { checkFolder } from "./survey.ts";

const kinds: [Kind, boolean][] = [
  ["package", false],
  ["site", false],
  ["tool", false],
  ["site", true],
];

for (const [kind, internal] of kinds) {
  const what = `${internal ? "an internal" : "a new"} ${kind}`;
  test(`${what} follows the standard and passes verify`, { timeout: 300_000 }, async () => {
    const dir = join(mkdtempSync(join(tmpdir(), "ship-new-")), "example");
    await write(dir, "example", kind, "An example, from ship's test.", internal);
    const { findings, worker } = await checkFolder(dir);
    expect(findings.flatMap((f) => f.drift)).toEqual([]);
    expect(worker?.internal ?? false).toBe(internal);
    const run = (...args: string[]) => execFileSync("pnpm", args, { cwd: dir, stdio: "pipe" });
    run("install");
    run("run", "fix");
    run("run", "verify");
  });
}
