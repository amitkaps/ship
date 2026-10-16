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
 * A fix in `files` edits a clone, and `pnpm align` puts it in the repository's pull request. A
 * fix in `github` is written directly, since there's no file to review. A rule with no fix is
 * fixed by hand, as the standard says.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Pkg, here, read, standard } from "./ship.ts";
import { writeRuleset } from "./settings.ts";
import type { BranchRule, Finding, Repo } from "./survey.ts";

export type Fix =
  | { in: "files"; apply: (dir: string) => void }
  | { in: "github"; apply: (repo: string) => void };

export type Rule = {
  id: string;
  group: "Versions" | "Setup" | "Release";
  check: (repo: Repo) => Finding | undefined;
  fix?: Fix;
};

/** @prose
 * # Where each rule is stated
 *
 * A rule in the standard is a list item on one line, `` - `id`: text ``, under the heading of
 * its part. The link `pnpm drift` prints goes to that heading, by the slug GitHub and markz both
 * give it. Code blocks are skipped, so an example can't state a rule.
 */
export type Stated = { id: string; text: string; link: string };

export function stated(markdown = read(join(here, "docs", "standard.md"))): Stated[] {
  const found: Stated[] = [];
  let heading = "";
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    heading = /^#{2,6} (.+)$/.exec(line)?.[1] ?? heading;
    const rule = /^- `([a-z]+\.[a-z-]+)`: (.+)$/.exec(line);
    if (rule?.[1] && rule[2]) {
      found.push({ id: rule[1], text: rule[2], link: `${STANDARD_URL}#${slug(heading)}` });
    }
  }
  return found;
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

export const RULES: Rule[] = [
  {
    id: "versions.pnpm",
    group: "Versions",
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
      apply: (dir) => {
        const file = join(dir, "package.json");
        const pkg = JSON.parse(readFileSync(file, "utf8")) as Pkg;
        pkg.packageManager = standard.packageManager;
        pkg.devEngines = { ...pkg.devEngines, packageManager: standard.devEngines?.packageManager };
        writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
      },
    },
  },
  {
    id: "scripts.required",
    group: "Setup",
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
    group: "Setup",
    check: ({ pkg, vitePlus }) => {
      const check = pkg.scripts?.check;
      if (!vitePlus || !check) return undefined;
      return drifted(/(^|&& )vp check( &&|$)/.test(check) ? [] : ["check doesn't run vp check"]);
    },
  },
  {
    id: "scripts.fix",
    group: "Setup",
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
    group: "Setup",
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
    group: "Setup",
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
    group: "Setup",
    check: ({ pkg }) => {
      const prose = pkg.scripts?.prose;
      // prose's own repository runs its command line from source.
      if (!prose || pkg.name === "@amitkaps/prose") return undefined;
      return drifted(prose === "prose" ? [] : [`prose is ${prose}, not prose`]);
    },
  },
  {
    id: "scripts.preview",
    group: "Setup",
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
    group: "Setup",
    check: ({ pkg }) =>
      drifted(
        PNPM_COMMANDS.filter((name) => pkg.scripts?.[name]).map(
          (name) => `has a ${name} script, which pnpm ${name} never runs`,
        ),
      ),
  },
  {
    id: "github.rules",
    group: "Setup",
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
