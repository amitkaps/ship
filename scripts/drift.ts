/** @prose
 * # Drift
 *
 * Prints where each repository has drifted from the standard, and exits 1 when anything has. It
 * only reads. [align.ts](align.ts) is what writes.
 *
 * Each repository's files come from what [survey.ts](survey.ts) finds, read from GitHub's `main`,
 * as the site does. The settings outside the files come from [settings.ts](settings.ts): the merge
 * settings when `gh` is logged in, and each Worker's build settings when `cf` is. Without a login,
 * drift says once what it couldn't check, rather than calling it drift, so a run with no logins
 * still checks every file. A held check is printed with its reason, and doesn't count as drift.
 *
 * A folder named on the command line, like `pnpm drift ../markz`, is checked from disk in place
 * of the repositories. That checks a fix before it's pushed, with a listed repository's holds
 * found by the folder's name. It also checks one that follows the standard without being in
 * `REPOS`, such as a private repository, which the public dashboard shouldn't name. The folder's
 * name is taken as the repository's on GitHub, and an internal site's Access is checked too.
 */
import { basename, resolve } from "node:path";
import { type Finding, checkFolder, survey } from "./survey.ts";
import { accessDrift, cloudflareLogin, githubLogin, mergeDrift, workerDrift } from "./settings.ts";

const folders = process.argv.slice(2);

const github = githubLogin();
const cloudflare = cloudflareLogin();
if (!github) console.log("not checked: GitHub's merge settings, since gh isn't logged in");
if (cloudflare) console.log(`not checked: the Workers' build settings, since ${cloudflare}`);

function settings(repo: string, worker?: { name: string }): string[] {
  return [
    ...(github ? mergeDrift(repo) : []),
    ...(worker && !cloudflare ? workerDrift(worker.name) : []),
  ];
}

function print(name: string, drift: string[], findings: Finding[]): boolean {
  console.log(drift.length ? `✗ ${name}` : `✓ ${name}`);
  for (const line of drift) console.log(`    ${line}`);
  for (const f of findings.filter((f) => f.held)) {
    console.log(`    held: ${f.drift.join("; ")}\n      ${f.held}`);
  }
  for (const f of findings.filter((f) => f.unchecked))
    console.log(`    not checked: ${f.unchecked}`);
  return drift.length > 0;
}

let drifted = false;
for (const folder of folders) {
  const { findings, worker: site } = await checkFolder(resolve(folder));
  const drift = findings.flatMap((f) => (f.held ? [] : f.drift));
  drift.push(...settings(basename(resolve(folder)), site));
  if (site?.internal && !cloudflare) drift.push(...accessDrift(site));
  drifted = print(folder, drift, findings) || drifted;
}
for (const result of folders.length ? [] : await survey()) {
  const findings = result.findings.flatMap((f) => (f ? [f] : []));
  const drift = result.error ? [result.error] : findings.flatMap((f) => (f.held ? [] : f.drift));
  if (!result.error) drift.push(...settings(result.repo, result.worker));
  drifted = print(result.repo, drift, findings) || drifted;
}
process.exitCode = drifted ? 1 : 0;
