/** @prose
 * # The rules
 *
 * Each rule of [the standard](../docs/standard.md) that has an id, like `scripts.verify`. The
 * standard states it, as a list item that opens with its id, and says why. Here is only what the
 * words can't do: the check that finds where a repository has drifted from it, and the fix, where
 * one can be automated. It's how markz's grammar names its side rules, and
 * [rules.test.ts](rules.test.ts) holds the two to the same ids, so a rule can't be stated without
 * a check, or checked without being stated.
 *
 * A check returns `undefined` when its rule doesn't apply, like `scripts.preview` for a package.
 * What it `wants`, like a version, goes before the rule on the dashboard. A fix in `files` edits
 * a clone to match the folder that holds the standard, and `pnpm align` puts it in the
 * repository's pull request. It changes nothing in a clone already in line, so it's safe to run
 * on every one. A fix in `github` is written directly, since there's no file to review. A rule
 * with no fix is fixed by hand, as the standard says.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Pkg, VERSIONS, here, read, standard, versionsIn } from "./ship.ts";
import { writeRuleset } from "./settings.ts";
import type { BranchRule, Finding, Repo } from "./survey.ts";

export type Fix =
  | { in: "files"; apply: (dir: string, std: string) => void }
  | { in: "github"; apply: (repo: string) => void };

export type Rule = {
  id: string;
  wants?: string;
  check: (repo: Repo) => Finding | undefined;
  fix?: Fix;
};

/** @prose
 * # Where each rule is stated
 *
 * A rule in the standard is a list item on one line, `` - `id`: text ``, under a heading. Its
 * part is the second-level heading it's under, like Scripts, which the dashboard groups it by.
 * The link `pnpm drift` prints goes to the nearest heading, by the slug GitHub and markz both give
 * it. Code blocks are skipped, so an example can't state a rule.
 */
export type Stated = { id: string; text: string; part: string; link: string };

const STANDARD = join(here, "docs", "standard.md");

// Each line outside a code block, with the headings it's under.
function* lines(markdown: string): Generator<{ line: string; part: string; heading: string }> {
  let part = "";
  let heading = "";
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    part = /^## (.+)$/.exec(line)?.[1] ?? part;
    heading = /^#{2,6} (.+)$/.exec(line)?.[1] ?? heading;
    yield { line, part, heading };
  }
}

export function stated(markdown = read(STANDARD)): Stated[] {
  const found: Stated[] = [];
  for (const { line, part, heading } of lines(markdown)) {
    const rule = /^- `([a-z]+\.[a-z-]+)`: (.+)$/.exec(line);
    if (rule?.[1] && rule[2]) {
      found.push({ id: rule[1], text: rule[2], part, link: `${STANDARD_URL}#${slug(heading)}` });
    }
  }
  return found;
}

/** The standard's parts, its second-level headings, in order. */
export function parts(markdown = read(STANDARD)): string[] {
  return [...lines(markdown)].flatMap(({ line }) => /^## (.+)$/.exec(line)?.[1] ?? []);
}

const STANDARD_URL = "https://ship.amitkaps.com/docs/standard.md";

const slug = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{Nd}\p{Pc} -]/gu, "")
    .replaceAll(" ", "-");

const pnpm = standard.packageManager?.replace(/^pnpm@/, "");
const standardScripts = standard.scripts ?? {};

/** The shared script names, in the order the dashboard lists them. */
export const SHARED = [
  "dev",
  "build",
  "preview",
  "check",
  "fix",
  "test",
  "verify",
  "ship",
  "prose",
];
const BUILT = ["dev", "build"];
const REQUIRED = ["check", "fix", "verify", "prose"];
const PNPM_COMMANDS = ["deploy", "publish", "audit", "ci", "pipeline", "pack"];

const ruleset = JSON.parse(read(join(here, ".github", "ruleset.json"))) as { rules: BranchRule[] };

// Each rule in the file has to be there, with the parameters the file sets. Other parameters,
// and rules the file doesn't name, are the repository's own.
function rulesDrift(found: BranchRule[]): string[] {
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

const drifted = (drift: string[]): Finding => ({ drift });

const readPkg = (dir: string): Pkg =>
  JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Pkg;
const writePkg = (dir: string, pkg: Pkg): void =>
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

// Sets a dependency to the standard's version, in whichever list the repository has it.
function pin(dir: string, std: string, name: string): void {
  const want = versionsIn(std)[name];
  const pkg = readPkg(dir);
  if (!want) return;
  for (const field of ["dependencies", "devDependencies"] as const) {
    const deps = pkg[field];
    if (deps?.[name]) deps[name] = want;
  }
  writePkg(dir, pkg);
}

/** @prose
 * # A shared version
 *
 * A tool every repository writes as this one does, checked where a repository has it.
 */
const version = (id: string, name: string): Rule => ({
  id,
  wants: VERSIONS[name],
  check: ({ deps }) => {
    const value = deps[name];
    if (!value) return undefined;
    const want = VERSIONS[name];
    return { value, drift: value === want ? [] : [`${name} is ${value}, not ${want}`] };
  },
  fix: { in: "files", apply: (dir, std) => pin(dir, std, name) },
});

const node = standard.devEngines?.runtime;
const vitePlus = VERSIONS["vite-plus"];
const OVERRIDE = /vite-plus-core@[\w.-]+/;

/** @prose
 * # The toolchain
 *
 * A tsconfig's options and the lint block are found by regular expressions rather than by
 * parsing, since a tsconfig can hold comments, base's extends the one SvelteKit generates, and
 * `vite.config.ts` is code. Neither has a fix, since editing either means reading it. The
 * options this repository sets for itself, like `noEmit`, aren't checked.
 *
 * The editor settings are compared one key at a time, and only this repository's keys, since a
 * repository can add its own, like base's for Svelte. Its fix merges this repository's over the
 * repository's own, so an added setting stays.
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

const EDITOR = [".vscode/settings.json", ".vscode/extensions.json"];
type Json = Record<string, unknown>;
const readJson = (file: string): Json => JSON.parse(readFileSync(file, "utf8")) as Json;
const editor = Object.fromEntries(EDITOR.map((file) => [file, readJson(join(here, file))]));
const recommended = (json: Json): string[] =>
  Array.isArray(json.recommendations) ? (json.recommendations as string[]) : [];

/** @prose
 * # The cooldown
 *
 * pnpm's one-day wait is its default, so a repository keeps it by not setting
 * `minimumReleaseAge`. The fix removes that line and writes this repository's exclusions.
 */
const EXCLUDE = /^minimumReleaseAgeExclude:\n(?:[ \t]+-.*\n?)*/m;

export const RULES: Rule[] = [
  {
    id: "versions.node",
    wants: node?.version,
    check: ({ pkg }) => {
      const runtime = pkg.devEngines?.runtime;
      const drift: string[] = [];
      if (runtime?.version !== node?.version) {
        drift.push(`devEngines asks for Node ${runtime?.version}, not ${node?.version}`);
      }
      if (runtime?.onFail !== node?.onFail) {
        drift.push(`devEngines Node onFail is ${runtime?.onFail}, not ${node?.onFail}`);
      }
      if (pkg.engines?.node !== standard.engines?.node) {
        drift.push(`engines asks for Node ${pkg.engines?.node}, not ${standard.engines?.node}`);
      }
      return { value: runtime?.version, drift };
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        const want = readPkg(std);
        const pkg = readPkg(dir);
        pkg.devEngines = { ...pkg.devEngines, runtime: want.devEngines?.runtime };
        pkg.engines = { ...pkg.engines, node: want.engines?.node };
        writePkg(dir, pkg);
      },
    },
  },
  {
    id: "versions.pnpm",
    wants: pnpm,
    check: ({ pkg }) => {
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
    fix: {
      in: "files",
      apply: (dir, std) => {
        const want = readPkg(std);
        const pkg = readPkg(dir);
        pkg.packageManager = want.packageManager;
        pkg.devEngines = { ...pkg.devEngines, packageManager: want.devEngines?.packageManager };
        writePkg(dir, pkg);
      },
    },
  },
  version("versions.types-node", "@types/node"),
  {
    id: "versions.vite-plus",
    wants: vitePlus,
    check: ({ files, deps, vitePlus: own }) => {
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
    // Moves vite-plus and the override together. A repository not on Vite+ moves by hand.
    fix: {
      in: "files",
      apply: (dir, std) => {
        pin(dir, std, "vite-plus");
        const want = versionsIn(std)["vite-plus"];
        const workspace = join(dir, "pnpm-workspace.yaml");
        const text = read(workspace);
        if (want && OVERRIDE.test(text)) {
          writeFileSync(workspace, text.replace(OVERRIDE, `vite-plus-core@${want}`));
        }
      },
    },
  },
  version("versions.typescript", "typescript"),
  version("versions.prose", "@amitkaps/prose"),
  version("versions.markz", "@amitkaps/markz"),
  version("versions.cf", "cf"),
  version("versions.cf-vite-plugin", "@cloudflare/vite-plugin"),
  version("versions.wrangler", "wrangler"),
  version("versions.publint", "publint"),
  {
    id: "versions.cooldown",
    check: ({ files }) => {
      const workspace = files["pnpm-workspace.yaml"] ?? "";
      const drift: string[] = [];
      const age = /^minimumReleaseAge:\s*(\S+)/m.exec(workspace)?.[1];
      if (age) drift.push(`sets minimumReleaseAge to ${age}, not pnpm's default`);
      const exclude = EXCLUDE.exec(workspace)?.[0] ?? "";
      const names = [...exclude.matchAll(/-\s*"?([^"\n]+)"?/g)].map((m) => m[1]?.trim());
      if (!names.includes("@amitkaps/*")) drift.push("doesn't exclude @amitkaps/*");
      for (const name of names.filter((n) => n !== "@amitkaps/*")) {
        drift.push(`excludes ${name}`);
      }
      return drifted(drift);
    },
    fix: {
      in: "files",
      apply: (dir, std) => {
        const file = join(dir, "pnpm-workspace.yaml");
        const want = EXCLUDE.exec(read(join(std, "pnpm-workspace.yaml")))?.[0];
        let text = read(file).replace(/^minimumReleaseAge:.*\n?/m, "");
        if (want) {
          text = EXCLUDE.test(text)
            ? text.replace(EXCLUDE, want)
            : `${text.trimEnd()}\n\n${want.trimEnd()}\n`;
        }
        writeFileSync(file, text);
      },
    },
  },
  {
    id: "toolchain.types",
    check: ({ files }) => {
      const tsconfig = files["tsconfig.json"];
      if (!tsconfig) return drifted(["no tsconfig.json"]);
      return drifted(
        STRICT.filter((flag) => !new RegExp(`"${flag}"\\s*:\\s*true`).test(tsconfig)).map(
          (flag) => `tsconfig.json doesn't set ${flag}`,
        ),
      );
    },
  },
  {
    id: "toolchain.lint",
    check: ({ files, vitePlus: own }) => {
      // Without Vite+ there's no lint block to read, and versions.vite-plus already says so.
      if (!own) return undefined;
      const vite = files["vite.config.ts"] ?? "";
      const drift: string[] = [];
      if (!/typeAware:\s*true/.test(vite)) drift.push("lint isn't type-aware");
      if (!/typeCheck:\s*true/.test(vite)) drift.push("lint doesn't type-check");
      return drifted(drift);
    },
  },
  {
    id: "toolchain.editor",
    check: ({ files }) =>
      drifted(
        EDITOR.flatMap((file) => {
          const text = files[file];
          if (!text) return [`no ${file}`];
          let have: Json;
          try {
            have = JSON.parse(text) as Json;
          } catch {
            return [`${file} isn't plain JSON`];
          }
          const want = editor[file] ?? {};
          // One line says the file differs, since the fix writes this repository's keys at once.
          const same = file.endsWith("extensions.json")
            ? recommended(want).every((name) => recommended(have).includes(name))
            : Object.keys(want).every(
                (key) => JSON.stringify(have[key]) === JSON.stringify(want[key]),
              );
          return same ? [] : [`${file} differs from ship's`];
        }),
      ),
    fix: {
      in: "files",
      apply: (dir, std) => {
        for (const file of EDITOR) {
          const ours = readJson(join(std, file));
          const path = join(dir, file);
          const theirs = existsSync(path) ? readJson(path) : {};
          const merged = file.endsWith("extensions.json")
            ? {
                ...theirs,
                recommendations: [...new Set([...recommended(ours), ...recommended(theirs)])],
              }
            : { ...theirs, ...ours };
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, JSON.stringify(merged, null, 2) + "\n");
        }
      },
    },
  },
  {
    id: "scripts.required",
    check: ({ pkg, worker: site }) => {
      const scripts = pkg.scripts ?? {};
      // A tool, private and with no site, has nothing to serve or build.
      const tool = pkg.private && !site;
      const required = [
        ...(tool ? [] : BUILT),
        ...REQUIRED,
        ...(site ? ["ship"] : []),
        ...(site && pkg.private ? ["preview"] : []),
      ];
      return drifted(required.filter((name) => !scripts[name]).map((name) => `no ${name} script`));
    },
  },
  {
    id: "scripts.check",
    check: ({ pkg, vitePlus }) => {
      const check = pkg.scripts?.check;
      if (!vitePlus || !check) return undefined;
      return drifted(/(^|&& )vp check( &&|$)/.test(check) ? [] : ["check doesn't run vp check"]);
    },
  },
  {
    id: "scripts.fix",
    check: ({ pkg, vitePlus }) => {
      const fix = pkg.scripts?.fix;
      if (!vitePlus || !fix) return undefined;
      return drifted(
        fix === standardScripts.fix ? [] : [`fix is ${fix}, not ${standardScripts.fix}`],
      );
    },
  },
  {
    id: "scripts.one-checker",
    check: ({ pkg, vitePlus }) => {
      if (!vitePlus) return undefined;
      return drifted(
        ["lint", "fmt"]
          .filter((name) => pkg.scripts?.[name])
          .map((name) => `has a ${name} script, which check and fix cover`),
      );
    },
  },
  {
    id: "scripts.verify",
    check: ({ pkg }) => {
      const verify = pkg.scripts?.verify;
      if (!verify) return undefined;
      return drifted(
        /(^|&& )pnpm prose check( &&|$)/.test(verify)
          ? []
          : ["verify doesn't run pnpm prose check"],
      );
    },
  },
  {
    id: "scripts.prose",
    check: ({ pkg }) => {
      const prose = pkg.scripts?.prose;
      // prose's own repository runs its command line from source.
      if (!prose || pkg.name === "@amitkaps/prose") return undefined;
      return drifted(prose === "prose" ? [] : [`prose is ${prose}, not prose`]);
    },
  },
  {
    id: "scripts.preview",
    check: ({ pkg }) => {
      const preview = pkg.scripts?.preview;
      if (!preview) return undefined;
      if (!pkg.private) return drifted(["has a preview script, which is a site's"]);
      return drifted(
        preview === standardScripts.preview
          ? []
          : [`preview is ${preview}, not ${standardScripts.preview}`],
      );
    },
  },
  {
    id: "scripts.pnpm-names",
    check: ({ pkg }) =>
      drifted(
        PNPM_COMMANDS.filter((name) => pkg.scripts?.[name]).map(
          (name) => `has a ${name} script, which pnpm ${name} never runs`,
        ),
      ),
  },
  {
    id: "github.rules",
    check: ({ rules }) => {
      if (!rules) return undefined;
      // GitHub's rate limit isn't drift: the check says it wasn't made.
      if (rules instanceof Error && rules.name === "RateLimit") {
        return { drift: [], unchecked: rules.message };
      }
      if (rules instanceof Error) return drifted([`GitHub couldn't be read: ${rules.message}`]);
      return drifted(rulesDrift(rules));
    },
    fix: { in: "github", apply: writeRuleset },
  },
];

/** Applies every fix that's written on GitHub, for `pnpm align` and `pnpm new --push`. */
export function fixGitHub(repo: string): void {
  for (const rule of RULES) if (rule.fix?.in === "github") rule.fix.apply(repo);
}
