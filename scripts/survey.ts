/** @prose
 * # The survey
 *
 * Reads every repository and checks it against the standard, returning what it found as data.
 * `pnpm drift` prints it, and the build turns it into the tables on the dashboard.
 *
 * The standard is this repository's own settings, read from its files, so there's no second
 * copy of it to keep in step. [docs/standard.md](../docs/standard.md) says what each check means.
 *
 * The other repositories are read from GitHub, from `main`, so a check run on a laptop and the
 * one Cloudflare runs at build time see the same thing. Cloudflare's build clones only this
 * repository, so the sibling folders on disk aren't there. This repository is read from disk,
 * since that's the commit being built. To check a fix before it's pushed, `pnpm drift` takes the
 * folder instead ([A folder](#a-folder)).
 */
import { basename, join } from "node:path";
import { type Rule, RULES, stated } from "./rules.ts";
import { OWNER, type Pkg, here, read, standard } from "./ship.ts";

export const REPOS = ["base", "markz", "prose", "pagez", "sitez", "ship"];

const SELF = "ship";
const FILES = [
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "vite.config.ts",
  ".gitignore",
  ".vscode/settings.json",
  ".vscode/extensions.json",
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

type Files = Record<string, string>;

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

const standardDeps = standard.devDependencies ?? {};
const vitePlus = standardDeps["vite-plus"];
const node = standard.devEngines?.runtime;

/** @prose
 * # The shared versions
 *
 * Every repository that uses one of these tools is on the version this repository names, written
 * the same way, so moving one never leaves two repositories to reconcile. Most come from this
 * repository's own `package.json`. The ones it doesn't use, like wrangler, are named in the
 * `catalog` of its `pnpm-workspace.yaml`, which nothing here installs. npm isn't read: a new
 * release is drift only once this repository moves to it, which `pnpm align` does.
 */
export const TOOLS = [
  "@types/node",
  "typescript",
  "@amitkaps/prose",
  "@amitkaps/markz",
  "cf",
  "@cloudflare/vite-plugin",
  "wrangler",
  "publint",
];

// `name: version` lines under `catalog:`, quoted or not. A regular expression is enough, since
// the block is flat.
export function catalog(workspace: string): Record<string, string> {
  const block = /^catalog:\n((?:[ \t]+.*\n?)*)/m.exec(workspace)?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/^\s+"?([^":\s]+)"?:\s*"?([^"\s]+)"?/gm)].map((m) => [m[1], m[2]]),
  );
}

export const VERSIONS: Record<string, string | undefined> = {
  ...catalog(read(join(here, "pnpm-workspace.yaml"))),
  ...standardDeps,
};

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
 * # The editor
 *
 * Every repository has the `.vscode/` settings Vite+ writes, and recommends oxc's and Vitest's
 * extensions, as this one does. The settings make the editor format with oxc and run the
 * repository's own `vp`, so a file saved in the editor is
 * formatted by the same oxfmt, with the same config, as `check`. A repository can add settings
 * of its own, like base's for Svelte, so only this one's are compared, each to the same value.
 */
const EDITOR = [".vscode/settings.json", ".vscode/extensions.json"];
const editor = Object.fromEntries(
  EDITOR.map((file) => [file, JSON.parse(read(join(here, file))) as Record<string, unknown>]),
);

/** @prose
 * # A repository's Worker
 *
 * A repository deploys if it has a Cloudflare config, and the Worker's name is read from it.
 * `cloudflare.config.ts` is the target; `wrangler.jsonc` and `wrangler.toml` are the ones
 * still on wrangler. A regular expression is enough, since each file states `name` once.
 *
 * Its domain is read the same way, the first in `domains` or the first route's `pattern`, and
 * the page links to it under the repository's name.
 *
 * So is whether it turns off `workers.dev` and preview URLs, each on unless the config says
 * otherwise. cf's config names them `workersDev` and `previewUrls`, and wrangler's `workers_dev`
 * and `preview_urls`.
 */
export type Worker = {
  file: string;
  name: string;
  domain?: string;
  workersDev: boolean;
  previewUrls: boolean;
  // Set once the survey knows the site is internal.
  internal?: boolean;
};

const off = (text: string, key: string): boolean =>
  new RegExp(`"?${key}"?\\s*[:=]\\s*false`).test(text);

export function worker(files: Files): Worker | undefined {
  for (const file of ["cloudflare.config.ts", "wrangler.jsonc", "wrangler.toml"]) {
    const text = files[file] ?? "";
    const name = /^\s*"?name"?\s*[:=]\s*"([^"]+)"/m.exec(text)?.[1];
    const domain = /(?:domains"?\s*:\s*\[\s*|"?pattern"?\s*[:=]\s*)"([^"]+)"/.exec(text)?.[1];
    const workersDev = !off(text, "workersDev") && !off(text, "workers_dev");
    const previewUrls = !off(text, "previewUrls") && !off(text, "preview_urls");
    if (name) return { file, name, domain, workersDev, previewUrls };
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
 * GitHub shows a public repository's branch rules to anyone, so the survey reads them without a
 * login, and `github.rules` compares them with [.github/ruleset.json](../.github/ruleset.json). A
 * `GITHUB_TOKEN`, when set, only raises the rate limit.
 */
export type BranchRule = { type: string; parameters?: Record<string, unknown> };

/** @prose
 * # GitHub's rate limit
 *
 * Without a login, GitHub answers 60 requests an hour, and each survey makes a few for every
 * repository, so a handful of runs can use them up. That's not drift: the check says it wasn't
 * made, and doesn't fail `pnpm drift`. `pnpm drift` logs in with `gh` when it can.
 */
class RateLimit extends Error {
  override name = "RateLimit";
}

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
  github(`${repo}/rules/branches/main`) as Promise<BranchRule[] | Error>;

/** @prose
 * # Internal sites
 *
 * A private repository's site is internal. It deploys like any other, behind Cloudflare Access,
 * with `workers.dev` and preview URLs turned off, since Access covers only the domain and either
 * would serve the same Worker without a login. Turning `workers.dev` off in the config is how
 * the repository says so in its own files, so a folder that isn't on GitHub yet, or one read
 * without a login, is held to the same rule. The listed repositories are public, since the home
 * page names them, so only a folder is looked up on GitHub.
 *
 * GitHub answers 404 for a private repository it won't show, the same as for one that isn't
 * there, so without a login the config is all there is to go on.
 */
type Visibility = "public" | "private" | Error | undefined;

async function visibility(repo: string): Promise<Visibility> {
  const found = (await github(repo)) as { private?: boolean } | Error;
  if (!(found instanceof Error)) return found.private ? "private" : "public";
  if (found instanceof RateLimit) return found;
  return found.message.endsWith("HTTP 404") ? undefined : found;
}

/** @prose
 * # Packages
 *
 * A repository whose `package.json` isn't private is a package, published to npm. Every package
 * releases the same way, with the files in [package/](../package/README.md) copied in unchanged,
 * and labels its pull requests with the labels in [.github/labels.json](../.github/labels.json),
 * which its release notes are grouped by. GitHub shows a public repository's labels to anyone.
 * Its CI has this repository's `Label` step, word for word, and runs again when a label changes,
 * so a pull request without one label can't merge.
 *
 * A package bundles our other packages rather than depending on them, so each releases on its
 * own and a user never installs two versions that disagree.
 */
const RELEASE_FILES = [".github/workflows/release.yml", ".github/release.yml"];
const released = Object.fromEntries(
  RELEASE_FILES.map((file) => [file, read(join(here, "package", file))]),
);
const ciFile = read(join(here, ".github", "workflows", "ci.yml"));
const LABEL_STEP = /^ {6}- name: Label\n[\s\S]*?\n {10}'\n/m.exec(ciFile)?.[0] ?? "";
const LABEL_TRIGGER = /^ {4}types: \[.*labeled.*\]$/m.exec(ciFile)?.[0] ?? "";
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

export type Repo = {
  pkg: Pkg;
  files: Files;
  deps: Record<string, string>;
  vitePlus?: string;
  worker?: Worker;
  // Left out for a folder that isn't on GitHub yet.
  rules?: BranchRule[] | Error;
  visibility?: Visibility;
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
export type Finding = {
  value?: string;
  drift: string[];
  held?: string;
  unchecked?: string;
  // The id of the rule it checks, when the rule has one.
  rule?: string;
};

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
export const HELD: Record<string, Record<string, string>> = {
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
  // Where the standard states it, for a rule with an id.
  link?: string;
  run: (repo: Repo) => Finding | undefined;
};

/** @prose
 * # Rules with an id
 *
 * A rule with an id is stated in the standard and checked in [rules.ts](rules.ts). Its check here
 * is named by its id, and the line the page shows beside it is the rule's first sentence, as the
 * standard has it, so there's no second wording to keep in step.
 */
const statements = new Map(stated().map((s) => [s.id, s]));

function fromRule(rule: Rule): Check {
  const statement = statements.get(rule.id);
  return {
    name: rule.id,
    group: rule.group,
    rule: /^(.+?\.)(\s|$)/.exec(statement?.text ?? "")?.[1] ?? "",
    link: statement?.link,
    run: (repo) => {
      const finding = rule.check(repo);
      return finding && { ...finding, rule: rule.id };
    },
  };
}

const ruled = (prefix: string): Check[] =>
  RULES.filter((rule) => rule.id.startsWith(prefix)).map(fromRule);

// A shared tool, where a repository uses it, written as this repository writes it.
const toOurs = (name: string, rule = "ship's, where a repository has it"): Check => ({
  name,
  group: "Versions",
  rule: `${VERSIONS[name]}: ${rule}`,
  run: ({ deps }) => {
    const value = deps[name];
    if (!value) return undefined;
    const want = VERSIONS[name];
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
  toOurs("@types/node", "the major of the Node that engines allows, as ship has it"),
  ...ruled("versions.pnpm"),
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
  toOurs("typescript"),
  toOurs("@amitkaps/prose"),
  toOurs("@amitkaps/markz"),
  toOurs("cf", "ship's, where a repository deploys with cf"),
  toOurs("@cloudflare/vite-plugin", "ship's, where a repository deploys with cf"),
  toOurs("wrangler", "ship's, while a repository is still on it"),
  toOurs("publint", "ship's, in every package"),
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
    name: "Editor",
    group: "Setup",
    rule: "the .vscode settings Vite+ writes, and the oxc and Vitest extensions, as ship has them",
    run: ({ files }) => {
      const drift = EDITOR.flatMap((file) => {
        const text = files[file];
        if (!text) return [`no ${file}`];
        let have: Record<string, unknown>;
        try {
          have = JSON.parse(text) as Record<string, unknown>;
        } catch {
          return [`${file} isn't plain JSON`];
        }
        const want = editor[file] ?? {};
        // A repository can add settings and recommendations of its own, so only ship's are
        // compared. One line says the file differs, since align copies ship's in whole.
        const same = Array.isArray(want.recommendations)
          ? want.recommendations.every(
              (name) => Array.isArray(have.recommendations) && have.recommendations.includes(name),
            )
          : Object.keys(want).every(
              (key) => JSON.stringify(have[key]) === JSON.stringify(want[key]),
            );
        return same ? [] : [`${file} differs from ship's`];
      });
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
  ...ruled("scripts."),
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
  /** @prose
   * # A prose site on cf
   *
   * A site that's the folder `prose build` writes reaches cf through Vite: the folder is Vite's
   * `publicDir`, the Cloudflare plugin writes it out as assets only, and a `vp build` after
   * `prose build` in `verify` runs the two. In a package, `build` is `vp pack`, so `verify` runs
   * `vp build` itself. The plugin's output is `.cloudflare/`, which isn't committed.
   */
  {
    name: "prose site",
    group: "Setup",
    rule: "a prose site on cf hands .prose to Vite, and verify builds it after prose build",
    run: ({ files, pkg, worker: site }) => {
      const verify = pkg.scripts?.verify ?? "";
      if (site?.file !== "cloudflare.config.ts" || !/pnpm prose build/.test(verify)) {
        return undefined;
      }
      const vite = files["vite.config.ts"] ?? "";
      const drift: string[] = [];
      if (!/publicDir:\s*"\.prose"/.test(vite)) drift.push("vite.config.ts doesn't serve .prose");
      if (!/cloudflare\(\{\s*assetsOnly:\s*true\s*\}\)/.test(vite)) {
        drift.push("vite.config.ts doesn't use the Cloudflare plugin with assetsOnly");
      }
      const after = verify.slice(verify.indexOf("pnpm prose build"));
      const build = pkg.scripts?.build === "vp build" ? /&& (pnpm build|vp build)/ : /&& vp build/;
      if (!build.test(after)) drift.push("verify doesn't run vp build after pnpm prose build");
      if (!/^\/?\.cloudflare\/?$/m.test(files[".gitignore"] ?? "")) {
        drift.push(".gitignore doesn't ignore .cloudflare");
      }
      return { value: "prose", drift };
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
    name: "Internal",
    group: "Setup",
    rule: "a private repository's site turns off workers.dev and preview URLs, and sits behind Access",
    run: ({ worker: site, visibility: seen }) => {
      if (!site) return undefined;
      if (seen instanceof Error && site.workersDev) return unread(seen);
      if (seen !== "private" && site.workersDev) return undefined;
      const drift: string[] = [];
      if (site.workersDev) drift.push(`${site.file} doesn't turn off workers.dev`);
      if (site.previewUrls) drift.push(`${site.file} doesn't turn off preview URLs`);
      return { value: "internal", drift };
    },
  },
  ...ruled("github."),
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
    rule: "a package's release.yml and notes config are ship's, word for word, and CI wants a label",
    run: ({ pkg, files }) => {
      if (pkg.private) return undefined;
      const drift = RELEASE_FILES.flatMap((file) => {
        if (!files[file]) return [`no ${file}`];
        return files[file] === released[file] ? [] : [`${file} differs from ship's`];
      });
      const ci = files[".github/workflows/ci.yml"] ?? "";
      if (!ci.includes(LABEL_STEP)) drift.push("ci.yml doesn't have ship's Label step");
      if (!ci.includes(LABEL_TRIGGER)) drift.push("ci.yml doesn't run again when a label changes");
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
      if (pkg.scripts?.prepack !== "pnpm run build")
        drift.push(`prepack is ${pkg.scripts?.prepack}, not pnpm run build`);
      if (JSON.stringify(pkg.files) !== '["dist"]')
        drift.push(`files is ${JSON.stringify(pkg.files)}, not ["dist"]`);
      if (pkg.publishConfig?.access !== "public") drift.push("publishConfig.access isn't public");
      if (!deps.publint) drift.push("no publint dev dependency");
      if (!/publint:\s*\{[^}]*strict:\s*true/.test(files["vite.config.ts"] ?? "")) {
        drift.push("pack doesn't run publint with strict: true");
      }
      // Oxc writes the types, set in pack rather than tsconfig.json, so the editor doesn't hold
      // tests and config to what only the published code needs.
      if (!/dts:\s*\{[^}]*generator:\s*"oxc"/.test(files["vite.config.ts"] ?? "")) {
        drift.push('pack doesn\'t write types with generator: "oxc"');
      }
      if (/"isolatedDeclarations"\s*:\s*true/.test(files["tsconfig.json"] ?? "")) {
        drift.push("tsconfig.json sets isolatedDeclarations, which pack sets");
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

function repoOf(files: Files): Repo {
  const pkg = JSON.parse(files["package.json"] ?? "{}") as Pkg;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return { pkg, files, deps, vitePlus: deps["vite-plus"], worker: worker(files) };
}

async function check(repo: string): Promise<Result> {
  const rules = branchRules(repo);
  let files: Files;
  try {
    files = repo === SELF ? fromDisk(here) : await fromGitHub(repo);
  } catch (error) {
    return { repo, error: `couldn't be read: ${String(error)}`, findings: [], scripts: {} };
  }
  if (!files["package.json"]) return { repo, error: "no package.json", findings: [], scripts: {} };
  const it = repoOf(files);
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

export async function survey(): Promise<Result[]> {
  return Promise.all(REPOS.map((repo) => check(repo)));
}

/** @prose
 * # A folder
 *
 * Checks a folder from disk: a checkout of a listed repository, to see a fix before it's pushed,
 * or one that isn't in `REPOS`, like one `pnpm new` just wrote or a private one. A listed
 * repository's holds apply, found by the folder's name. Branch rules and labels aren't read,
 * since `pnpm align` writes them and `pnpm drift` reads them from GitHub. Whether it's private is
 * read from GitHub, under the folder's name. Its Worker comes back too, marked internal when it
 * is, so `pnpm drift <folder>` can check its settings.
 */
/** A folder's files, read as the checks read a repository, for `pnpm align`'s fixes. */
export const readFolder = (dir: string): Repo => repoOf(fromDisk(dir));

export async function checkFolder(dir: string): Promise<{ findings: Finding[]; worker?: Worker }> {
  const repo = basename(dir);
  const it = repoOf(fromDisk(dir));
  it.visibility = await visibility(repo);
  const seen = it.visibility;
  const findings = CHECKS.flatMap((c) => hold(repo, c, c.run(it)) ?? []);
  if (it.worker) it.worker.internal = seen === "private" || !it.worker.workersDev;
  return { findings, worker: it.worker };
}
