/** @prose
 * # Align
 *
 * Brings repositories in line with the standard: `pnpm align` does every one in `REPOS`, and
 * `pnpm align markz` does one. It's what writes, where [drift.ts](drift.ts) only reads, and it
 * needs `gh` logged in as the owner.
 *
 * Each repository gets two things. Its settings outside the files, on GitHub and on its Worker,
 * are written directly by [settings.ts](settings.ts), since there's no file to review. Its files
 * change in a pull request, from a fresh clone of `main` in a temporary folder, so a checkout on
 * a branch of its own is never touched. The pull request opens only when `verify` passes, with
 * auto-merge on, so CI merges it. One that fails leaves its clone and log for a look.
 *
 * Running it twice changes nothing the second time, and a repository already in line gets no
 * pull request. A run ends by waiting for its pull requests to merge, then rebuilding ship's site,
 * so the dashboard shows what it did.
 */
import { execFile } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { fixFiles, fixGitHub } from "./rules.ts";
import { OWNER, TOOLS, catalog } from "./ship.ts";
import { HELD, REPOS, worker } from "./survey.ts";
import { cloudflareLogin, githubLogin, rebuild, writeGitHub, writeWorker } from "./settings.ts";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = "ship";
const run = promisify(execFile);

if (!githubLogin()) {
  console.error("pnpm align needs gh logged in as the owner.");
  process.exit(1);
}
const cloudflare = cloudflareLogin();
if (cloudflare) console.log(`not written: the Workers' build settings, since ${cloudflare}`);

const named = process.argv.slice(2);
const targets = named.length ? named : REPOS;
const work = mkdtempSync(join(tmpdir(), "align-"));

type Pkg = {
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
type Deps = Record<string, string>;

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;
const writeJson = (file: string, value: unknown): void =>
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const depsOf = (pkg: Pkg): Deps => ({ ...pkg.dependencies, ...pkg.devDependencies });

// Runs a command in a clone, with its output kept in the repository's log.
async function sh(dir: string, log: string[], cmd: string, ...args: string[]): Promise<string> {
  log.push(`$ ${cmd} ${args.join(" ")}`);
  try {
    const { stdout, stderr } = await run(cmd, args, { cwd: dir, maxBuffer: 64 << 20 });
    log.push(stdout, stderr);
    return stdout;
  } catch (error) {
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };
    log.push(stdout, stderr);
    throw error;
  }
}

/** @prose
 * # Updates
 *
 * A repository's own libraries, like zod or happy-dom, move to their newest release within the
 * major version they're on, which pnpm's one-day wait allows.
 *
 * A new major can change what the code has to do, so it's listed in the pull request rather than taken. Below 1.0, a minor counts as a
 * major, as npm's ranges treat it.
 *
 * A pre-release is pinned by hand, as [development.md](../docs/development.md#beta-packages)
 * says, since its tags don't say which build goes with which. Once npm's latest for it is a
 * release at its major or later, that's listed too.
 */
const major = (version: string): number => Number(version.split(".")[0]);

function breaking(from: string, to: string): boolean {
  const [a = 0, b = 0] = from.split(".").map(Number);
  const [c = 0, d = 0] = to.split(".").map(Number);
  return a !== c || (a === 0 && b !== d);
}

async function update(dir: string, log: string[], skip: string[]): Promise<string[]> {
  let out: string;
  try {
    out = await sh(dir, log, "pnpm", "outdated", "--format", "json");
  } catch (error) {
    // pnpm outdated exits 1 when anything is outdated, with the list on stdout.
    out = (error as { stdout?: string }).stdout ?? "{}";
  }
  const found = JSON.parse(out || "{}") as Record<string, { current: string; latest: string }>;
  const minor: string[] = [];
  const majors: string[] = [];
  for (const [name, { current, latest }] of Object.entries(found)) {
    if (skip.includes(name)) continue;
    if (current.includes("-")) {
      if (!latest.includes("-") && major(latest) >= major(current)) {
        majors.push(`${name} ${latest}, a release of the beta ${current}`);
      }
      continue;
    }
    if (breaking(current, latest)) majors.push(`${name} ${latest}, from ${current}`);
    else minor.push(name);
  }
  if (minor.length) await sh(dir, log, "pnpm", "update", "--latest", ...minor);
  return majors;
}

/** @prose
 * # This repository first
 *
 * The standard is this repository's versions, so `pnpm align` moves them first. The other
 * repositories are then aligned with what this clone holds, so one run moves everything together.
 *
 * It moves its own libraries and tools as above, and the Vite+ override with `vite-plus`. The
 * `catalog` of the tools it doesn't use is resolved by pnpm in an empty folder with the same
 * settings, so the wait applies there too.
 */
async function updateSelf(dir: string, log: string[]): Promise<string[]> {
  await sh(dir, log, "pnpm", "install");
  const majors = await update(dir, log, []);
  const vitePlus = depsOf(readJson<Pkg>(join(dir, "package.json")))["vite-plus"];
  const workspace = join(dir, "pnpm-workspace.yaml");
  let text = readFileSync(workspace, "utf8").replace(
    /vite-plus-core@[\w.-]+/,
    `vite-plus-core@${vitePlus}`,
  );

  const listed = catalog(text);
  const scratch = mkdtempSync(join(work, "catalog-"));
  writeJson(join(scratch, "package.json"), { name: "catalog", private: true });
  cpSync(workspace, join(scratch, "pnpm-workspace.yaml"));
  const names = Object.keys(listed);
  if (!names.length) {
    writeFileSync(workspace, text);
    return majors;
  }
  await sh(scratch, log, "pnpm", "add", "-D", "--lockfile-only", "--ignore-scripts", ...names);
  const resolved = depsOf(readJson<Pkg>(join(scratch, "package.json")));
  for (const [name, from] of Object.entries(listed)) {
    const to = resolved[name];
    if (!to || to === from) continue;
    if (breaking(from.replace(/^\D+/, ""), to.replace(/^\D+/, ""))) {
      majors.push(`${name} ${to} in the catalog, from ${from}`);
      continue;
    }
    const old = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^(\\s+"?${name}"?:\\s*)"?${old}"?$`, "m"), `$1${to}`);
  }
  writeFileSync(workspace, text);
  return majors;
}

/** @prose
 * # Another repository
 *
 * Every rule with a fix in the files, from [rules.ts](rules.ts), fixes the clone, like
 * `versions.typescript`, except where a hold says it can't move yet, like base's TypeScript. A
 * fix reads the standard from `std`, the clone of this repository when `pnpm align` just moved
 * it, so the others take its new versions. A fix changes nothing that's in line already.
 */
async function alignTo(dir: string, std: string, repo: string, log: string[]): Promise<string[]> {
  fixFiles(dir, std, HELD[repo]);

  await sh(dir, log, "pnpm", "install");
  return update(dir, log, [...TOOLS, "vite-plus"]);
}

/** @prose
 * # The pull request
 *
 * After the changes, the clone installs, checks its lockfile the way CI does, writes the format
 * and lint fixes, and runs `verify`. A clean tree means the repository was already in line.
 *
 * The pull request lists every version that moved, read from `package.json` before and after, and the
 * majors left for review. It's opened from a branch named `align`, which a later run updates
 * rather than opening a second one.
 *
 * The repositories clone and install side by side, but `verify` runs one at a time. markz's
 * timing tests failed when five ran at once, since they measured a busy machine, not the code.
 */
type Outcome = { repo: string; lines: string[]; failed?: string; pr?: string };

let turn: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = turn.then(task);
  turn = run.catch(() => undefined);
  return run;
}

async function files(repo: string, std: string): Promise<Outcome> {
  const dir = join(work, repo);
  const log: string[] = [];
  const lines: string[] = [];
  const logFile = join(work, `${repo}.log`);
  try {
    await sh(work, log, "gh", "repo", "clone", `${OWNER}/${repo}`, dir, "--", "--quiet");
    const before = depsOf(readJson<Pkg>(join(dir, "package.json")));
    const majors = repo === SELF ? await updateSelf(dir, log) : await alignTo(dir, std, repo, log);
    await sh(dir, log, "pnpm", "install", "--frozen-lockfile");
    await sh(dir, log, "pnpm", "run", "fix");

    // trimEnd, since each line opens with a status column that may be a space.
    const changed = (await sh(dir, log, "git", "status", "--porcelain")).trimEnd();
    if (!changed) return { repo, lines: ["in line"] };

    const after = depsOf(readJson<Pkg>(join(dir, "package.json")));
    const moved = Object.keys(after)
      .filter((name) => before[name] !== after[name])
      .map((name) => `${name} ${after[name]}, from ${before[name] ?? "nothing"}`);
    const other = changed
      .split("\n")
      .map((line) => line.slice(3))
      .filter((path) => !["package.json", "pnpm-lock.yaml"].includes(path))
      .map((path) => `${path} from ship`);

    await oneAtATime(() => sh(dir, log, "pnpm", "run", "verify"));

    const pkg = readJson<Pkg>(join(dir, "package.json"));
    const body = [
      "Brings this repository in line with ship's standard, from `pnpm align`.",
      "",
      ...[...moved, ...other].map((line) => `- ${line}`),
      ...(majors.length
        ? ["", "New majors, left for review:", "", ...majors.map((line) => `- ${line}`)]
        : []),
      "",
      "`verify` passed on this branch before it was pushed.",
    ].join("\n");
    await sh(dir, log, "git", "checkout", "-b", "align");
    await sh(dir, log, "git", "add", "-A");
    await sh(dir, log, "git", "commit", "-m", "Align with ship", "--quiet");
    await sh(dir, log, "git", "push", "--force", "-u", "origin", "align", "--quiet");
    let url: string;
    try {
      const label = pkg.private ? [] : ["--label", "internal"];
      url = await sh(
        dir,
        log,
        "gh",
        "pr",
        "create",
        "--title",
        "Align with ship",
        "--body",
        body,
        ...label,
      );
    } catch {
      url = await sh(dir, log, "gh", "pr", "view", "align", "--json", "url", "-q", ".url");
      await sh(dir, log, "gh", "pr", "edit", "align", "--body", body);
    }
    await sh(dir, log, "gh", "pr", "merge", "align", "--auto", "--squash");
    lines.push(...moved, ...other, ...majors.map((m) => `left for review: ${m}`), url.trim());
    return { repo, lines, pr: url.trim() };
  } catch (error) {
    writeFileSync(logFile, log.join("\n"));
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { repo, lines, failed: `${reason}\n      log: ${logFile}\n      clone: ${dir}` };
  }
}

/** @prose
 * # Settings
 *
 * GitHub's settings are written for every repository, with each rule's fix on GitHub, like
 * `github.rules`, and a site's Worker settings when `cf` is logged in. Whether a repository is a package, and the name of its Worker, are read from the
 * clone, after its pull request, so they're what `main` is about to hold.
 */
function settings(repo: string): string[] {
  const dir = join(work, repo);
  const pkg = existsSync(join(dir, "package.json")) ? readJson<Pkg>(join(dir, "package.json")) : {};
  writeGitHub(repo);
  fixGitHub(repo, pkg);
  const files = Object.fromEntries(
    ["cloudflare.config.ts", "wrangler.jsonc", "wrangler.toml"].map((f) => [
      f,
      existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "",
    ]),
  );
  const site = worker(files);
  if (!site || cloudflare) return [];
  return writeWorker(site.name).map((line) => `fixed: ${line}`);
}

// This repository goes first when it's named, so the others align with its new versions.
const std = targets.includes(SELF) ? join(work, SELF) : here;
const outcomes: Outcome[] = [];
if (targets.includes(SELF)) outcomes.push(await files(SELF, std));
const selfFailed = outcomes[0]?.failed;
if (selfFailed) {
  console.log(`✗ ${SELF}: ${selfFailed}`);
  console.log("The others weren't aligned, since their standard is what this run couldn't make.");
  process.exit(1);
}
outcomes.push(
  ...(await Promise.all(targets.filter((r) => r !== SELF).map((repo) => files(repo, std)))),
);

let failed = false;
for (const outcome of outcomes) {
  const lines = [...outcome.lines, ...settings(outcome.repo)];
  failed ||= Boolean(outcome.failed);
  console.log(outcome.failed ? `✗ ${outcome.repo}` : `✓ ${outcome.repo}`);
  for (const line of lines) console.log(`    ${line}`);
  if (outcome.failed) console.log(`    failed: ${outcome.failed}`);
}

/** @prose
 * # The website
 *
 * ship's dashboard shows each repository's `main` as of its last build, so a run ends by
 * rebuilding it. align waits for its pull requests to merge first, since a build while they're
 * open would show the versions they replace.
 *
 * It asks GitHub every ten seconds, as `pnpm pr --wait` does. A check counts by its latest run,
 * since adding a label starts a new run that cancels the old one. One that falls behind `main` has
 * its branch updated, as `pnpm pr --wait` does. A pull request that fails or
 * closes is reported and not waited for. The rebuild runs once any of them merged, and needs `cf`
 * logged in.
 */
type Check = { name?: string; conclusion?: string; startedAt?: string };
const FAILED = ["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"];

async function merge(url: string): Promise<string | undefined> {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const { stdout } = await run("gh", [
      "pr",
      "view",
      url,
      "--json",
      "state,mergeStateStatus,statusCheckRollup",
    ]);
    const pr = JSON.parse(stdout) as {
      state: string;
      mergeStateStatus: string;
      statusCheckRollup: Check[];
    };
    if (pr.state === "MERGED") return undefined;
    if (pr.state === "CLOSED") return `${url} was closed without merging`;
    if (pr.mergeStateStatus === "BEHIND") {
      // A pull request that's merging reads as behind its own merge for a moment, so a failed update
      // only means asking again.
      await run("gh", ["pr", "update-branch", url]).catch(() => undefined);
      continue;
    }
    const latest = new Map<string, Check>();
    for (const check of pr.statusCheckRollup) {
      const seen = latest.get(check.name ?? "");
      if ((check.startedAt ?? "") >= (seen?.startedAt ?? "")) latest.set(check.name ?? "", check);
    }
    const bad = [...latest.values()].find((check) => FAILED.includes(check.conclusion ?? ""));
    if (bad) return `${bad.name ?? "a check"} failed on ${url}`;
  }
}

const opened = outcomes.flatMap((outcome) => (outcome.pr ? [outcome] : []));
if (opened.length) {
  console.log(`Waiting for ${opened.length} pull request${opened.length > 1 ? "s" : ""} to merge.`);
  const merged = await Promise.all(
    opened.map(async ({ repo, pr = "" }) => ({ repo, problem: await merge(pr) })),
  );
  for (const { repo, problem } of merged) {
    failed ||= Boolean(problem);
    console.log(problem ? `✗ ${repo}: ${problem}` : `✓ ${repo} merged`);
  }
  if (merged.some(({ problem }) => !problem)) {
    console.log(cloudflare ? `not rebuilt: ${SELF}'s site, since ${cloudflare}` : rebuild(SELF));
  }
}
process.exitCode = failed ? 1 : 0;
