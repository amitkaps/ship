/** @prose
 * # Drift
 *
 * Prints where each repository has drifted from the standard, from what
 * [survey.ts](survey.ts) finds, and exits 1 when anything has. It reads the other repositories
 * from GitHub's `main`, as the site does, or from the folders beside this one with `--local`.
 *
 * `--cloudflare` also reads each Worker's build settings from Cloudflare, which needs `cf`
 * logged in and `CLOUDFLARE_ACCOUNT_ID` set. A held check is printed with its reason, and doesn't
 * count as drift. That check stays here and off the site, since
 * the build has no Cloudflare login.
 *
 * GitHub answers only 60 requests an hour without a login, so with no `GITHUB_TOKEN` set, it
 * uses `gh`'s login when there is one. A check the limit stopped is printed as not checked.
 *
 * `--github` also reads each repository's merge settings, which GitHub shows only to its owner, so
 * it needs `gh` logged in. They're compared with [.github/settings.json](../.github/settings.json).
 *
 * A folder named on the command line, like `pnpm drift ../site`, is checked in place of the
 * repositories, from disk. That's for one that follows the standard without being in `REPOS`, such
 * as a private repository, which the public home page shouldn't name. Its branch rules, labels and
 * holds aren't checked, since they belong to a listed repository. `--cloudflare` reads its Worker
 * from its own config, and `--github` takes the folder's name as the repository's.
 *
 * With more than one Cloudflare account, `cf` can't pick one on its own, so `--cloudflare` stops
 * at once without `CLOUDFLARE_ACCOUNT_ID`, rather than partway through.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OWNER, checkFolder, folderWorker, nodeMajor, survey } from "./survey.ts";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cloudflare = process.argv.includes("--cloudflare");
const local = process.argv.includes("--local");
const github = process.argv.includes("--github");
const folders = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

if (cloudflare && !process.env["CLOUDFLARE_ACCOUNT_ID"]) {
  console.error(
    "--cloudflare needs CLOUDFLARE_ACCOUNT_ID set, to say which account's Workers to read.",
  );
  process.exit(1);
}

if (!process.env["GITHUB_TOKEN"]) {
  try {
    const token = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (token) process.env["GITHUB_TOKEN"] = token;
  } catch {}
}

const settings = JSON.parse(readFileSync(join(here, ".github", "settings.json"), "utf8")) as Record<
  string,
  unknown
>;

function merges(repo: string): string[] {
  const out = execFileSync("gh", ["api", `repos/${OWNER}/${repo}`], { encoding: "utf8" });
  const found = JSON.parse(out) as Record<string, unknown>;
  return Object.entries(settings)
    .filter(([key, want]) => found[key] !== want)
    .map(([key, want]) => `GitHub ${key} is ${String(found[key])}, not ${String(want)}`);
}

/** @prose
 * # The dashboard's settings
 *
 * The build and deploy commands live on the Worker, not in the repository, so they're read
 * back from Cloudflare and compared with what every Worker should have.
 */
const BUILD = {
  build_command: "pnpm run verify",
  deploy_command: "pnpm run ship",
  root_directory: "/",
  build_caching_enabled: true,
};

let workers: { id: string; name: string }[] | undefined;

function cf(...args: string[]): unknown {
  const bin = join(here, "node_modules", ".bin", "cf");
  const out = execFileSync(bin, args, { encoding: "utf8", env: { ...process.env, CF_QUIET: "1" } });
  return JSON.parse(out);
}

function builds(name: string): string[] {
  workers ??= cf("workers", "list") as { id: string; name: string }[];
  const tag = workers.find((w) => w.name === name)?.id;
  if (!tag) return [`no Worker named ${name} on Cloudflare`];
  const config = cf("builds", "workers", "get", tag) as {
    production_settings: Record<string, unknown> & {
      environment_variables: Record<string, { value?: string }>;
    };
  };
  const settings = config.production_settings;
  const drift: string[] = [];
  for (const [key, want] of Object.entries(BUILD)) {
    if (settings[key] !== want) {
      drift.push(`Worker ${key} is ${String(settings[key])}, not ${want}`);
    }
  }
  const node = settings.environment_variables.NODE_VERSION?.value;
  if (node !== nodeMajor) drift.push(`Worker NODE_VERSION is ${node}, not ${nodeMajor}`);
  return drift;
}

let drifted = false;
for (const folder of folders) {
  const drift = (await checkFolder(resolve(folder))).flatMap((f) => f.drift);
  const site = folderWorker(resolve(folder));
  if (cloudflare && site) drift.push(...builds(site.name));
  if (github) drift.push(...merges(basename(resolve(folder))));
  drifted ||= drift.length > 0;
  console.log(drift.length ? `✗ ${folder}` : `✓ ${folder}`);
  for (const line of drift) console.log(`    ${line}`);
}
for (const result of folders.length ? [] : await survey({ local })) {
  const findings = result.findings.flatMap((f) => (f ? [f] : []));
  const drift = result.error ? [result.error] : findings.flatMap((f) => (f.held ? [] : f.drift));
  if (cloudflare && result.worker) drift.push(...builds(result.worker.name));
  if (github) drift.push(...merges(result.repo));
  const held = findings.filter((f) => f.held);
  drifted ||= drift.length > 0;
  console.log(drift.length ? `✗ ${result.repo}` : `✓ ${result.repo}`);
  for (const line of drift) console.log(`    ${line}`);
  for (const f of held) console.log(`    held: ${f.drift.join("; ")}\n      ${f.held}`);
  for (const f of findings.filter((f) => f.unchecked))
    console.log(`    not checked: ${f.unchecked}`);
}
process.exitCode = drifted ? 1 : 0;
