/** @prose
 * # The survey
 *
 * Reads every repository and checks it against the standard, returning what it found as data.
 * `pnpm drift` prints it, and the build turns it into the tables on the site's home page.
 *
 * The standard is this repository's own settings, read from its files, so there's no second
 * copy of it to keep in step. [docs/standard.md](../docs/standard.md) says what each check means.
 *
 * The other repositories are read from GitHub, from `main`, so a check run on a laptop and the
 * one Cloudflare runs at build time see the same thing. Cloudflare's build clones only this
 * repository, so the sibling folders on disk aren't there. This repository is read from disk,
 * since that's the commit being built. `local` reads the siblings from disk too, to check a fix
 * before it's pushed.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPOS = ["base", "markz", "prose", "pagez", "sitez", "ship"];

export const OWNER = "amitkaps";
const SELF = "ship";
const FILES = [
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "vite.config.ts",
  "cloudflare.config.ts",
  "wrangler.jsonc",
  "wrangler.toml",
  "AGENTS.md",
  "CLAUDE.md",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  ".github/release.yml",
  ".github/dependabot.yml",
  "README.md",
  "docs/README.md",
  "docs/design.md",
  "docs/plan.md",
  "docs/development.md",
  "docs/lessons.md",
  "docs/usage.md",
];

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type Files = Record<string, string>;

type Pkg = {
  name?: string;
  private?: boolean;
  files?: string[];
  publishConfig?: { access?: string };
  packageManager?: string;
  devEngines?: {
    packageManager?: { version?: string; onFail?: string };
    runtime?: { version?: string; onFail?: string };
  };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: { node?: string };
};

const read = (file: string): string => (existsSync(file) ? readFileSync(file, "utf8") : "");

function fromDisk(dir: string): Files {
  return Object.fromEntries(FILES.map((file) => [file, read(join(dir, file))]));
}

// A missing file is an empty one, as on disk. Any other failure means the repository couldn't
// be read, and the survey says so rather than reporting drift that isn't there.
async function fromGitHub(repo: string): Promise<Files> {
  const entries = await Promise.all(
    FILES.map(async (file) => {
      const url = `https://raw.githubusercontent.com/${OWNER}/${repo}/main/${file}`;
      const res = await fetch(url);
      if (res.status === 404) return [file, ""];
      if (!res.ok) throw new Error(`${file} returned HTTP ${res.status}`);
      return [file, await res.text()];
    }),
  );
  return Object.fromEntries(entries);
}

const standard = JSON.parse(read(join(here, "package.json"))) as Pkg;
const pnpm = standard.packageManager?.replace(/^pnpm@/, "");
const standardDeps = standard.devDependencies ?? {};
const vitePlus = standardDeps["vite-plus"];
const node = standard.devEngines?.runtime;
export const nodeMajor = /\d+/.exec(standard.engines?.node ?? "")?.[0];

// `^7.0.2` and `7.0.2` name the same release here, so a range is compared by its version.
const bare = (version: string): string => version.replace(/^[\^~>=<\s]+/, "");
const major = (version = ""): string | undefined => /\d+/.exec(version)?.[0];

/** @prose
 * # The latest releases
 *
 * Some tools have no version in this repository to copy, since it doesn't use them. A
 * repository that does should be on the latest release, read from npm when the survey runs.
 * That covers our own packages, so a new prose or markz shows up as drift everywhere it's used,
 * and the tools that aren't ours yet are on their way out, like wrangler.
 *
 * A failed lookup shows in that row, rather than failing the survey.
 */
const LATEST = ["typescript", "wrangler", "publint", "@amitkaps/prose", "@amitkaps/markz"];

type Latest = Record<string, string | Error>;

export async function latest(): Promise<Latest> {
  const entries = await Promise.all(
    LATEST.map(async (name) => {
      try {
        const res = await fetch(`https://registry.npmjs.org/${name}/latest`);
        if (!res.ok) throw new Error(`npm returned HTTP ${res.status}`);
        const { version } = (await res.json()) as { version: string };
        return [name, version];
      } catch (error) {
        return [name, error instanceof Error ? error : new Error(String(error))];
      }
    }),
  );
  return Object.fromEntries(entries);
}

/** @prose
 * # The type checks
 *
 * The compiler options every `tsconfig.json` turns on, beyond what a repository's own build
 * needs. Each is found by a regular expression rather than by parsing, since a tsconfig can hold
 * comments, and base's extends the one SvelteKit generates. The options this repository sets
 * for itself, like `noEmit` and `allowImportingTsExtensions`, aren't checked.
 */
const STRICT = [
  "strict",
  "noUncheckedIndexedAccess",
  "noImplicitOverride",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "verbatimModuleSyntax",
  "isolatedModules",
  "forceConsistentCasingInFileNames",
];

/** @prose
 * # The scripts
 *
 * Every repository uses the same names for the same jobs, so `pnpm verify` means one thing
 * everywhere. Most are required. `test` is there when a repository has tests, and `ship` when it
 * has a site. On Vite+, `fix` is `vp check --fix` everywhere, and `check` runs `vp check`. A
 * framework may add its own steps around it, like SvelteKit's `svelte-kit sync` before and
 * `svelte-check` after, but never a second formatter or linter. A separate `lint` or `fmt`
 * script would only repeat half of `check`. `prose` is `prose` alone, which reads the current
 * folder, so `pnpm prose build` passes `build` straight through. The others differ by kind: a package's
 * `build` is `vp pack`, and a site's is `vp build`.
 *
 * Anything else, like a package's `size` or `fuzz`, is the repository's own. Names that are
 * pnpm's own commands are ruled out, since `pnpm <name>` skips a script by that name.
 */
export const SHARED = ["dev", "build", "check", "fix", "test", "verify", "ship", "prose"];
const REQUIRED = ["dev", "build", "check", "fix", "verify", "prose"];
const standardScripts = standard.scripts ?? {};
const PNPM_COMMANDS = ["deploy", "publish", "audit", "ci", "pipeline", "pack"];

/** @prose
 * # A repository's Worker
 *
 * A repository deploys if it has a Cloudflare config, and the Worker's name is read from it.
 * `cloudflare.config.ts` is the target; `wrangler.jsonc` and `wrangler.toml` are the ones
 * still on wrangler. A regular expression is enough, since each file states `name` once.
 *
 * Its domain is read the same way, the first in `domains` or the first route's `pattern`, and
 * the page links to it under the repository's name.
 */
export type Worker = { file: string; name: string; domain?: string };

function worker(files: Files): Worker | undefined {
  for (const file of ["cloudflare.config.ts", "wrangler.jsonc", "wrangler.toml"]) {
    const text = files[file] ?? "";
    const name = /^\s*"?name"?\s*[:=]\s*"([^"]+)"/m.exec(text)?.[1];
    const domain = /(?:domains"?\s*:\s*\[\s*|"?pattern"?\s*[:=]\s*)"([^"]+)"/.exec(text)?.[1];
    if (name) return { file, name, domain };
  }
  return undefined;
}

/** @prose
 * # A package's release
 *
 * The version npm gives a user today, read from npm when the survey runs, so the page shows what
 * people install rather than what's on `main`. A package npm doesn't have yet has no version.
 */
export type Release = { name: string; version?: string } | Error;

async function release(name: string): Promise<Release> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${name}/latest`);
    if (res.status === 404) return { name };
    if (!res.ok) throw new Error(`npm returned HTTP ${res.status}`);
    const { version } = (await res.json()) as { version: string };
    return { name, version };
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

/** @prose
 * # Branch rules
 *
 * Every repository protects `main` with the same ruleset, kept in
 * [.github/ruleset.json](../.github/ruleset.json) and applied by `pnpm protect`. GitHub shows a
 * public repository's branch rules to anyone, so the survey reads them without a login. A
 * `GITHUB_TOKEN`, when set, only raises the rate limit.
 *
 * Each rule in the file has to be there, with the parameters the file sets. Other parameters,
 * and rules the file doesn't name, are the repository's own.
 */
type Rule = { type: string; parameters?: Record<string, unknown> };

const ruleset = JSON.parse(read(join(here, ".github", "ruleset.json"))) as { rules: Rule[] };

/** @prose
 * # GitHub's rate limit
 *
 * Without a login, GitHub answers 60 requests an hour, and each survey makes a few for every
 * repository, so a handful of runs can use them up. That's not drift: the check says it wasn't
 * made, and doesn't fail `pnpm drift`. `pnpm drift` logs in with `gh` when it can.
 */
class RateLimit extends Error {}

async function github(path: string): Promise<unknown> {
  try {
    const token = process.env["GITHUB_TOKEN"];
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if ([403, 429].includes(res.status) && res.headers.get("x-ratelimit-remaining") === "0") {
      return new RateLimit("GitHub's rate limit was reached");
    }
    if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

function unread(error: Error): Finding {
  if (error instanceof RateLimit) return { drift: [], unchecked: error.message };
  return { drift: [`GitHub couldn't be read: ${error.message}`] };
}

const branchRules = (repo: string) =>
  github(`${repo}/rules/branches/main`) as Promise<Rule[] | Error>;

function rulesDrift(found: Rule[]): string[] {
  if (!found.length) return ["main has no branch rules"];
  const drift: string[] = [];
  for (const want of ruleset.rules) {
    const name = want.type.replaceAll("_", " ");
    const have = found.find((rule) => rule.type === want.type);
    if (!have) {
      drift.push(`no ${name} rule`);
      continue;
    }
    for (const [key, value] of Object.entries(want.parameters ?? {})) {
      const got = JSON.stringify(have.parameters?.[key]);
      if (got !== JSON.stringify(value)) {
        drift.push(`${name}: ${key} is ${got}, not ${JSON.stringify(value)}`);
      }
    }
  }
  return drift;
}

/** @prose
 * # Packages
 *
 * A repository whose `package.json` isn't private is a package, published to npm. Every package
 * releases the same way, with the files in [package/](../package/README.md) copied in unchanged,
 * and labels its pull requests with the labels in [.github/labels.json](../.github/labels.json),
 * which its release notes are grouped by. GitHub shows a public repository's labels to anyone.
 *
 * A package bundles our other packages rather than depending on them, so each releases on its
 * own and a user never installs two versions that disagree.
 */
const RELEASE_FILES = [".github/workflows/release.yml", ".github/release.yml"];
const released = Object.fromEntries(
  RELEASE_FILES.map((file) => [file, read(join(here, "package", file))]),
);
const labelNames = (
  JSON.parse(read(join(here, ".github", "labels.json"))) as { name: string }[]
).map((label) => label.name);

async function repoLabels(repo: string): Promise<string[] | Error> {
  const found = (await github(`${repo}/labels?per_page=100`)) as { name: string }[] | Error;
  return found instanceof Error ? found : found.map((label) => label.name);
}

/** @prose
 * # The agents' instructions
 *
 * Every `AGENTS.md` opens with the same two sections, word for word as in this repository's:
 * "Standard", which points at this standard, and "Prose", which points at prose's rules. The
 * rules themselves live in one place each and aren't copied, so they can't drift. What's below
 * those sections is the repository's own. A `CLAUDE.md` that says `@AGENTS.md` makes Claude
 * Code read the same file.
 */
const SECTIONS = ["Standard", "Prose"];

function section(text: string, heading: string): string | undefined {
  const found = new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(text);
  return found?.[1]?.trim();
}

const agents = read(join(here, "AGENTS.md"));

/** @prose
 * # The docs
 *
 * Every repository has the same docs in `docs/`, and a package has `usage.md` too. Each is listed
 * in the `nav` of `docs/README.md`, which sets the reading order on GitHub and on the site, and
 * the README links to the docs. Only the files are checked, not what's in them.
 */
const DOCS = ["design.md", "plan.md", "development.md", "lessons.md"];

const nav = (text: string): string[] =>
  (/^nav:\s*\[([^\]]*)\]/m.exec(text)?.[1] ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

/** @prose
 * # The actions
 *
 * Every workflow uses the actions at the versions this repository's do, read from its CI and
 * release workflows. A repository can add steps of its own, like sitez installing its packed
 * tarball, so the workflows aren't compared word for word, only the versions. They move here
 * first, like every other version, so nothing else bumps them, and Dependabot isn't set up.
 */
const actionVersions = (text: string): [string, string][] =>
  [...text.matchAll(/uses:\s*([^@\s]+)@(\S+)/g)].map((m) => [m[1] ?? "", m[2] ?? ""]);

const ACTIONS = Object.fromEntries(
  actionVersions(
    read(join(here, ".github", "workflows", "ci.yml")) + released[".github/workflows/release.yml"],
  ),
);

type Repo = {
  pkg: Pkg;
  files: Files;
  deps: Record<string, string>;
  vitePlus?: string;
  worker?: Worker;
  latest: Latest;
  // Left out for a folder that isn't on GitHub yet.
  rules?: Rule[] | Error;
  labels?: string[] | Error;
};

/** @prose
 * # The checks
 *
 * Each check covers one part of the standard, and says what it expects in a line the page shows
 * beside it. The versions come first, then how the repository is set up. A check returns what
 * the repository has, like the version it pins, and what has drifted, which is empty when
 * nothing has. It returns `undefined` when it doesn't apply, like the Cloudflare check for a
 * package with no site, or the typescript check for a repository without typescript. A check
 * that couldn't be made says why in `unchecked`, with no drift.
 */
export type Finding = { value?: string; drift: string[]; held?: string; unchecked?: string };

/** @prose
 * # Held
 *
 * Some drift can't be fixed yet, because a tool the repository depends on doesn't support the
 * standard. Each hold names the repository and the check, says why, and says when to look
 * again. A held check shows amber on the page with its reason, and doesn't fail `pnpm drift`.
 *
 * A hold is for what a tool can't do, never for a choice. When the reason goes away, so does
 * the hold: a held check that has nothing left to hold reports that as drift, so a hold can't
 * outlive its reason.
 */
// cf deploys what its Vite plugin builds. A site that `prose build` writes isn't built by Vite, so
// `cf deploy` hands it to wrangler, and cf's config has no field for the folder.
const PROSE_SITE =
  "cf deploys only a Vite build, and this site is written by prose build. Move when cf's config takes an assets folder.";

const HELD: Record<string, Record<string, string>> = {
  markz: { Cloudflare: PROSE_SITE },
  prose: { Cloudflare: PROSE_SITE },
  base: {
    typescript: "svelte-check accepts TypeScript 5 and 6 only. Move when its peer range takes 7.",
    Cloudflare:
      "cf can't deploy SvelteKit, since the adapter doesn't write cf's Build Output. Move when it does.",
  },
};

function hold(repo: string, check: Check, finding: Finding | undefined): Finding | undefined {
  const reason = HELD[repo]?.[check.name];
  if (!reason) return finding;
  if (!finding?.drift.length) {
    return { ...finding, drift: [`${check.name} is held, but nothing has drifted: drop the hold`] };
  }
  return { ...finding, held: reason };
}

export type Check = {
  name: string;
  group: "Versions" | "Setup" | "Release";
  rule: string;
  run: (repo: Repo) => Finding | undefined;
};

// A tool that should match npm's latest release, where a repository uses it.
const toLatest = (name: string, rule: string): Check => ({
  name,
  group: "Versions",
  rule,
  run: ({ deps, latest: found }) => {
    const value = deps[name];
    if (!value) return undefined;
    const want = found[name];
    if (want instanceof Error) return { value, drift: [`npm couldn't be read: ${want.message}`] };
    return { value, drift: bare(value) === want ? [] : [`${name} is ${value}, not ${want}`] };
  },
});

// A tool that should match this repository's version, where another repository uses it.
const toOurs = (name: string): Check => ({
  name,
  group: "Versions",
  rule: `${standardDeps[name]}, where a repository deploys with cf`,
  run: ({ deps }) => {
    const value = deps[name];
    if (!value) return undefined;
    const want = standardDeps[name];
    return { value, drift: value === want ? [] : [`${name} is ${value}, not ${want}`] };
  },
});

export const CHECKS: Check[] = [
  {
    name: "Node",
    group: "Versions",
    rule: `${node?.version} in devEngines, with onFail: ${node?.onFail}, and the same in engines`,
    run: ({ pkg }) => {
      const runtime = pkg.devEngines?.runtime;
      const drift: string[] = [];
      if (runtime?.version !== node?.version) {
        drift.push(`devEngines asks for Node ${runtime?.version}, not ${node?.version}`);
      }
      if (runtime?.onFail !== node?.onFail) {
        drift.push(`devEngines Node onFail is ${runtime?.onFail}, not ${node?.onFail}`);
      }
      // A repository supports the Node it's built on, and nothing older.
      if (pkg.engines?.node !== standard.engines?.node) {
        drift.push(`engines asks for Node ${pkg.engines?.node}, not ${standard.engines?.node}`);
      }
      return { value: runtime?.version, drift };
    },
  },
  {
    name: "@types/node",
    group: "Versions",
    rule: "the major version of the Node that engines allows",
    run: ({ pkg, deps }) => {
      const value = deps["@types/node"];
      if (!value) return undefined;
      const oldest = major(pkg.engines?.node ?? pkg.devEngines?.runtime?.version);
      const drift =
        major(value) === oldest
          ? []
          : [`@types/node is ${value}, but engines allows Node ${oldest}`];
      return { value, drift };
    },
  },
  {
    name: "pnpm",
    group: "Versions",
    rule: `${pnpm}, pinned in devEngines with onFail: download`,
    run: ({ pkg }) => {
      const drift: string[] = [];
      if (pkg.packageManager !== `pnpm@${pnpm}`) {
        drift.push(`packageManager is ${pkg.packageManager}, not pnpm@${pnpm}`);
      }
      const engine = pkg.devEngines?.packageManager;
      if (engine?.version !== pnpm) {
        drift.push(`devEngines pins pnpm ${engine?.version}, not ${pnpm}`);
      }
      if (engine?.onFail !== "download") {
        drift.push(`devEngines pnpm onFail is ${engine?.onFail}, not download`);
      }
      return { value: pkg.packageManager?.replace(/^pnpm@/, ""), drift };
    },
  },
  {
    name: "vite-plus",
    group: "Versions",
    rule: `${vitePlus}, with every vite pointed at the same version, and no vite of its own`,
    run: ({ files, deps, vitePlus: own }) => {
      if (!own) return { drift: ["not on Vite+"] };
      const drift: string[] = [];
      if (own !== vitePlus) drift.push(`vite-plus is ${own}, not ${vitePlus}`);
      const override = /vite-plus-core@([\w.-]+)/.exec(files["pnpm-workspace.yaml"] ?? "")?.[1];
      if (!override) drift.push("pnpm-workspace.yaml has no vite override");
      else if (override !== vitePlus) {
        drift.push(`pnpm-workspace.yaml points vite at ${override}, not ${vitePlus}`);
      }
      if (deps.vite) drift.push(`depends on vite ${deps.vite} directly`);
      return { value: own, drift };
    },
  },
  toLatest("typescript", "npm's latest, where a repository has it"),
  toLatest("@amitkaps/prose", "npm's latest, where a repository uses it"),
  toLatest("@amitkaps/markz", "npm's latest, where a repository uses it"),
  toOurs("cf"),
  toOurs("@cloudflare/vite-plugin"),
  toLatest("wrangler", "npm's latest, while a repository is still on it"),
  toLatest("publint", "npm's latest, in every package"),
  {
    name: "Types",
    group: "Setup",
    rule: "tsconfig.json turns on the strict options",
    run: ({ files }) => {
      const tsconfig = files["tsconfig.json"];
      if (!tsconfig) return { drift: ["no tsconfig.json"] };
      const drift = STRICT.filter(
        (flag) => !new RegExp(`"${flag}"\\s*:\\s*true`).test(tsconfig),
      ).map((flag) => `tsconfig.json doesn't set ${flag}`);
      return { drift };
    },
  },
  {
    name: "Lint",
    group: "Setup",
    rule: "type-aware lint that also type-checks",
    run: ({ files, vitePlus: own }) => {
      // Without Vite+ there's no lint block to read, and the vite-plus check already says so.
      if (!own) return undefined;
      const vite = files["vite.config.ts"] ?? "";
      const drift: string[] = [];
      if (!/typeAware:\s*true/.test(vite)) drift.push("lint isn't type-aware");
      if (!/typeCheck:\s*true/.test(vite)) drift.push("lint doesn't type-check");
      return { drift };
    },
  },
  {
    name: "Cooldown",
    group: "Setup",
    rule: "pnpm's wait on a new version, with only our own scope excluded",
    run: ({ files }) => {
      const workspace = files["pnpm-workspace.yaml"] ?? "";
      const drift: string[] = [];
      const age = /^minimumReleaseAge:\s*(\S+)/m.exec(workspace)?.[1];
      if (age) drift.push(`sets minimumReleaseAge to ${age}, not pnpm's default`);
      const exclude = /^minimumReleaseAgeExclude:\n((?:\s+-.*\n?)*)/m.exec(workspace)?.[1] ?? "";
      const names = [...exclude.matchAll(/-\s*"?([^"\n]+)"?/g)].map((m) => m[1]?.trim());
      if (!names.includes("@amitkaps/*")) drift.push("doesn't exclude @amitkaps/*");
      for (const name of names.filter((n) => n !== "@amitkaps/*")) {
        drift.push(`excludes ${name}`);
      }
      return { drift };
    },
  },
  {
    name: "Scripts",
    group: "Setup",
    rule: "the shared names, and none of pnpm's own",
    run: ({ pkg, vitePlus: own, worker: site }) => {
      const scripts = pkg.scripts ?? {};
      const required = site ? [...REQUIRED, "ship"] : REQUIRED;
      // On Vite+, `fix` is this repository's exactly, and `check` runs `vp check` among any
      // steps a framework needs.
      const wrong: string[] = [];
      if (own && scripts.fix && scripts.fix !== standardScripts.fix) {
        wrong.push(`fix is ${scripts.fix}, not ${standardScripts.fix}`);
      }
      if (own && scripts.check && !/(^|&& )vp check( &&|$)/.test(scripts.check)) {
        wrong.push(`check doesn't run vp check`);
      }
      // prose takes its command before any folder, so `pnpm prose build` works only when the
      // script is `prose` alone. prose itself runs its own command line.
      if (scripts.prose && scripts.prose !== "prose" && pkg.name !== "@amitkaps/prose") {
        wrong.push(`prose is ${scripts.prose}, not prose`);
      }
      const drift = [
        ...required.filter((name) => !scripts[name]).map((name) => `no ${name} script`),
        ...wrong,
        ...(own ? ["lint", "fmt"] : [])
          .filter((name) => scripts[name])
          .map((name) => `has a ${name} script, which check and fix cover`),
        ...PNPM_COMMANDS.filter((name) => scripts[name]).map(
          (name) => `has a ${name} script, which pnpm ${name} never runs`,
        ),
      ];
      return { drift };
    },
  },
  {
    name: "Cloudflare",
    group: "Setup",
    rule: "a site deploys with cloudflare.config.ts",
    run: ({ worker: site }) => {
      if (!site) return undefined;
      const drift =
        site.file === "cloudflare.config.ts" ? [] : [`still on wrangler (${site.file})`];
      return { value: site.file, drift };
    },
  },
  {
    name: "wrangler.toml",
    group: "Setup",
    rule: "a site still on wrangler uses wrangler.toml, whose comments prose reads",
    run: ({ worker: site }) => {
      if (!site || site.file === "cloudflare.config.ts") return undefined;
      const drift = site.file === "wrangler.toml" ? [] : [`${site.file}, not wrangler.toml`];
      return { value: site.file, drift };
    },
  },
  {
    name: "Branch rules",
    group: "Setup",
    rule: "main takes squashed pull requests that pass ci, from .github/ruleset.json",
    run: ({ rules }) => {
      if (!rules) return undefined;
      if (rules instanceof Error) return unread(rules);
      return { drift: rulesDrift(rules) };
    },
  },
  {
    name: "Actions",
    group: "Setup",
    rule: "workflows use ship's action versions, and nothing else bumps them",
    run: ({ files }) => {
      const drift: string[] = [];
      for (const file of [".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
        for (const [action, version] of actionVersions(files[file] ?? "")) {
          const want = ACTIONS[action];
          if (want && version !== want) drift.push(`${action} is ${version}, not ${want}`);
        }
      }
      if (files[".github/dependabot.yml"]) drift.push("has a dependabot.yml");
      return { drift: [...new Set(drift)] };
    },
  },
  {
    name: "Docs",
    group: "Setup",
    rule: "docs/ has design, plan, development and lessons, and usage for a package, in its nav",
    run: ({ pkg, files }) => {
      const want = pkg.private ? DOCS : [...DOCS, "usage.md"];
      const index = files["docs/README.md"];
      const drift = want.filter((name) => !files[`docs/${name}`]).map((name) => `no docs/${name}`);
      if (!index) drift.push("no docs/README.md");
      else {
        const listed = nav(index);
        for (const name of want.filter((n) => files[`docs/${n}`] && !listed.includes(n))) {
          drift.push(`${name} isn't in the nav`);
        }
      }
      if (!/\]\(\.?\/?docs\//.test(files["README.md"] ?? ""))
        drift.push("README.md doesn't link to docs/");
      return { drift };
    },
  },
  {
    name: "AGENTS.md",
    group: "Setup",
    rule: "opens with the shared Standard and Prose sections, and CLAUDE.md reads it",
    run: ({ files }) => {
      const text = files["AGENTS.md"];
      if (!text) return { drift: ["no AGENTS.md"] };
      const drift = SECTIONS.flatMap((heading) => {
        const have = section(text, heading);
        if (!have) return [`no ${heading} section`];
        return have === section(agents, heading) ? [] : [`${heading} section differs from ship's`];
      });
      if (files["CLAUDE.md"]?.trim() !== "@AGENTS.md") drift.push("CLAUDE.md isn't @AGENTS.md");
      return { drift };
    },
  },
  {
    name: "Release workflow",
    group: "Release",
    rule: "a package's release.yml and notes config are ship's, word for word",
    run: ({ pkg, files }) => {
      if (pkg.private) return undefined;
      const drift = RELEASE_FILES.flatMap((file) => {
        if (!files[file]) return [`no ${file}`];
        return files[file] === released[file] ? [] : [`${file} differs from ship's`];
      });
      return { drift };
    },
  },
  {
    name: "Package",
    group: "Release",
    rule: "packs dist with publint and Oxc's types, publishes publicly, and bundles our packages",
    run: ({ pkg, files, deps }) => {
      if (pkg.private) return undefined;
      const drift: string[] = [];
      if (pkg.scripts?.prepack !== "vp pack")
        drift.push(`prepack is ${pkg.scripts?.prepack}, not vp pack`);
      if (JSON.stringify(pkg.files) !== '["dist"]')
        drift.push(`files is ${JSON.stringify(pkg.files)}, not ["dist"]`);
      if (pkg.publishConfig?.access !== "public") drift.push("publishConfig.access isn't public");
      if (!deps.publint) drift.push("no publint dev dependency");
      if (!/publint:\s*\{[^}]*strict:\s*true/.test(files["vite.config.ts"] ?? "")) {
        drift.push("pack doesn't run publint with strict: true");
      }
      // Oxc writes the types, file by file, which needs each export's type written out.
      if (!/"isolatedDeclarations"\s*:\s*true/.test(files["tsconfig.json"] ?? "")) {
        drift.push("tsconfig.json doesn't set isolatedDeclarations");
      }
      if (deps.typescript) drift.push("has typescript, which Oxc's types don't need");
      for (const name of Object.keys(pkg.dependencies ?? {})) {
        if (name.startsWith("@amitkaps/"))
          drift.push(`depends on ${name}, rather than bundling it`);
      }
      return { drift };
    },
  },
  {
    name: "Labels",
    group: "Release",
    rule: "a package has the labels its release notes are grouped by",
    run: ({ pkg, labels }) => {
      if (pkg.private || !labels) return undefined;
      if (labels instanceof Error) return unread(labels);
      return {
        drift: labelNames
          .filter((name) => !labels.includes(name))
          .map((name) => `no ${name} label`),
      };
    },
  },
];

export type Result = {
  repo: string;
  // Set when the repository couldn't be read, and then nothing else is.
  error?: string;
  // One entry per check, in the order of `CHECKS`.
  findings: (Finding | undefined)[];
  scripts: Record<string, string>;
  worker?: Worker;
  // Set for a package.
  release?: Release;
};

function repoOf(files: Files, found: Latest): Repo {
  const pkg = JSON.parse(files["package.json"] ?? "{}") as Pkg;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return { pkg, files, deps, vitePlus: deps["vite-plus"], worker: worker(files), latest: found };
}

async function check(repo: string, local: boolean, found: Latest): Promise<Result> {
  const rules = branchRules(repo);
  let files: Files;
  try {
    const dir = repo === SELF ? here : join(dirname(here), repo);
    files = repo === SELF || local ? fromDisk(dir) : await fromGitHub(repo);
  } catch (error) {
    return { repo, error: `couldn't be read: ${String(error)}`, findings: [], scripts: {} };
  }
  if (!files["package.json"]) return { repo, error: "no package.json", findings: [], scripts: {} };
  const it = repoOf(files, found);
  const published = it.pkg.private || !it.pkg.name ? undefined : release(it.pkg.name);
  it.rules = await rules;
  if (!it.pkg.private) it.labels = await repoLabels(repo);
  return {
    repo,
    findings: CHECKS.map((c) => hold(repo, c, c.run(it))),
    scripts: it.pkg.scripts ?? {},
    worker: it.worker,
    release: await published,
  };
}

export async function survey({ local = false } = {}): Promise<Result[]> {
  const found = await latest();
  return Promise.all(REPOS.map((repo) => check(repo, local, found)));
}

/** @prose
 * # A folder
 *
 * Checks a folder that isn't on GitHub yet, like one `pnpm new` just wrote. Its branch rules and
 * labels come with `pnpm protect`, so they aren't checked, and neither are holds, which belong to
 * a named repository.
 */
export async function checkFolder(dir: string): Promise<Finding[]> {
  const it = repoOf(fromDisk(dir), await latest());
  return CHECKS.flatMap((c) => c.run(it) ?? []);
}
