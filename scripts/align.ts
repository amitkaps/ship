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
 * pull request.
 */
import { execFile } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { RULES, fixGitHub } from "./rules.ts";
import { OWNER, TOOLS, catalog } from "./ship.ts";
import { HELD, REPOS, worker } from "./survey.ts";
import { cloudflareLogin, githubLogin, writeGitHub, writeWorker } from "./settings.ts";

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
 * major version they're on, which pnpm's one-day wait allows. A new major can change what the code
 * has to do, so it's listed in the pull request rather than taken. Below 1.0, a minor counts as a
 * major, as npm's ranges treat it. The beta packages, cf and its Vite plugin, are pinned by hand,
 * as [development.md](../docs/development.md#beta-packages) says, since their tags don't say which
 * build goes with which.
 */
const BETA = ["cf", "@cloudflare/vite-plugin"];

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
    if (skip.includes(name) || BETA.includes(name)) continue;
    if (breaking(current, latest)) majors.push(`${name} ${latest}, from ${current}`);
    else minor.push(name);
  }
  if (minor.length) await sh(dir, log, "pnpm", "update", "--latest", ...minor);
  return majors;
}

/** @prose
 * # This repository first
 *
 * The standard is this repository's versions, so `pnpm align` moves them first: its own
 * libraries and tools as above, the Vite+ override with `vite-plus`, and the `catalog` of the
 * tools it doesn't use, each resolved by pnpm in an empty folder with the same settings, so the
 * wait applies. The other repositories are then aligned with what this clone holds, so one run
 * moves everything together.
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
  for (const rule of RULES) {
    if (rule.fix?.in === "files" && !HELD[repo]?.[rule.id]) rule.fix.apply(dir, std);
  }

  await sh(dir, log, "pnpm", "install");
  return update(dir, log, [...TOOLS, "vite-plus"]);
}

/** @prose
 * # The pull request
 *
 * After the changes, the clone installs, checks its lockfile the way CI does, writes the format
 * and lint fixes, and runs `verify`. A clean tree means the repository was already in line. The
 * pull request lists every version that moved, read from `package.json` before and after, and the
 * majors left for review. It's opened from a branch named `align`, which a later run updates
 * rather than opening a second one.
 */
type Outcome = { repo: string; lines: string[]; failed?: string };

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

    const changed = (await sh(dir, log, "git", "status", "--porcelain")).trim();
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

    await sh(dir, log, "pnpm", "run", "verify");

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
    return { repo, lines };
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
process.exitCode = failed ? 1 : 0;
