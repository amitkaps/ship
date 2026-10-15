/** @prose
 * # New
 *
 * Starts a repository that follows the standard from its first commit. `pnpm new <name> --package`
 * starts an npm package, `pnpm new <name> --site` a site on Cloudflare, and `pnpm new <name> --tool`
 * scripts run on a laptop, with no site or release. `--internal` makes a site or a tool private: its
 * GitHub repository is private, it isn't added to `REPOS`, and a site turns off `workers.dev` and
 * preview URLs, to sit behind Cloudflare Access. It writes the folder
 * next to this one, installs, formats, runs `verify` and makes the first commit, so what it hands over
 * already passes.
 *
 * Nothing here is a template. Each file is built from this repository's own: the versions,
 * engines and scripts from `package.json`, the strict options from `tsconfig.json`, the `lint`
 * block from `vite.config.ts`, the Vite+ override, the editor settings, CI, the shared sections of `AGENTS.md`, and a
 * package's release files from `package/`. The docs are the outline the standard names. A tool this repository doesn't use, like publint, is
 * at the version in its `catalog`, as the survey wants. So a change to the standard reaches the next repository
 * with no second copy to update, and `pnpm test` checks what it writes against the survey.
 *
 * `--push` also creates the repository on GitHub, pushes the first commit and writes its GitHub
 * settings, as `pnpm align` does. That first push is the only one to `main` the standard allows, since the
 * rules aren't on yet. What's left is printed at the end: adding it to `REPOS`, and the Worker,
 * Access or npm's setup, which have no API to do them from here.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OWNER, VERSIONS } from "./survey.ts";
import { writeGitHub } from "./settings.ts";

export type Kind = "package" | "site" | "tool";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string): string => readFileSync(join(here, file), "utf8");

type Pkg = {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  devEngines: unknown;
  engines: unknown;
  packageManager: string;
};
const ship = JSON.parse(read("package.json")) as Pkg;

// The two shared sections of this repository's `AGENTS.md`, word for word.
function sections(): string {
  const text = read("AGENTS.md");
  const from = text.indexOf("## Standard");
  return text.slice(from, text.indexOf("\n## ", text.indexOf("## Prose"))).trim();
}

// A block of `vite.config.ts` or `pnpm-workspace.yaml`, as this repository has it.
function block(text: string, pattern: RegExp): string {
  const found = pattern.exec(text)?.[0];
  if (!found) throw new Error(`ship's config has no ${pattern}`);
  return found;
}

async function packageJson(name: string, kind: Kind, description: string): Promise<string> {
  const npm = (tool: string): string => {
    const version = VERSIONS[tool];
    if (!version) throw new Error(`ship names no version for ${tool}`);
    return version;
  };
  const ours = (...tools: string[]) =>
    Object.fromEntries(tools.map((tool) => [tool, ship.devDependencies[tool]]));
  const scripts = (...names: string[]) =>
    Object.fromEntries(names.map((script) => [script, ship.scripts[script]]));
  const shared = {
    devEngines: ship.devEngines,
    engines: ship.engines,
    packageManager: ship.packageManager,
  };

  if (kind === "site") {
    return JSON.stringify(
      {
        name,
        private: true,
        description,
        type: "module",
        scripts: scripts("dev", "build", "preview", "check", "fix", "verify", "ship", "prose"),
        devDependencies: {
          "@amitkaps/prose": npm("@amitkaps/prose"),
          ...ours("@cloudflare/vite-plugin", "@types/node", "cf", "vite-plus"),
        },
        ...shared,
      },
      null,
      2,
    );
  }
  if (kind === "tool") {
    return JSON.stringify(
      {
        name,
        private: true,
        description,
        type: "module",
        scripts: {
          ...scripts("check", "fix", "test"),
          verify: "pnpm check && pnpm test",
          ...scripts("prose"),
        },
        devDependencies: {
          "@amitkaps/prose": npm("@amitkaps/prose"),
          ...ours("@types/node", "vite-plus"),
        },
        ...shared,
      },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      name: `@${OWNER}/${name}`,
      version: "0.0.0",
      description,
      license: "MIT",
      repository: { type: "git", url: `git+https://github.com/${OWNER}/${name}.git` },
      files: ["dist"],
      type: "module",
      exports: {
        ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
        "./package.json": "./package.json",
      },
      publishConfig: { access: "public" },
      scripts: {
        prepack: "pnpm run build",
        dev: "vp pack --watch",
        build: "vp pack",
        ...scripts("check", "fix"),
        test: "vp test --run",
        ...scripts("prose"),
        verify: "pnpm check && pnpm test && pnpm build",
      },
      devDependencies: {
        "@amitkaps/prose": npm("@amitkaps/prose"),
        ...ours("@types/node"),
        publint: npm("publint"),
        ...ours("vite-plus"),
      },
      ...shared,
    },
    null,
    2,
  );
}

function workspace(kind: Kind): string {
  const text = read("pnpm-workspace.yaml");
  const blocks = text.split(/\n(?=# @prose\n)/);
  const pick = (key: string): string => {
    const found = blocks.find((b) => b.includes(`\n${key}:`));
    if (!found) throw new Error(`ship's pnpm-workspace.yaml has no ${key}`);
    return found.trim();
  };
  const header = [
    "# @prose",
    "# # pnpm's settings",
    "#",
    "# pnpm 12 reads project settings from here. It's a settings file, not a workspace, and its",
    "# settings are the standard's, from ship.",
  ].join("\n");
  const parts = [
    header,
    pick("minimumReleaseAgeExclude"),
    ...(kind === "site" ? [pick("allowBuilds")] : []),
    pick("overrides"),
  ];
  return parts.join("\n\n");
}

function tsconfig(kind: Kind): string {
  const compilerOptions = (JSON.parse(read("tsconfig.json")) as { compilerOptions: object })
    .compilerOptions;
  const include =
    kind === "site"
      ? ["src", "vite.config.ts", "cloudflare.config.ts"]
      : ["src", "tests", "vite.config.ts"];
  return JSON.stringify({ compilerOptions, include }, null, 2);
}

function viteConfig(kind: Kind): string {
  const lint = block(read("vite.config.ts"), /^ {2}lint: \{[\s\S]*?^ {2}\},$/m);
  if (kind === "site") {
    return `/** @prose
 * # The build
 *
 * One Vite+ config builds the site and checks it. The Cloudflare plugin writes an assets-only
 * Build Output, which \`cf deploy --prebuilt\` uploads as it is. The Worker itself is in
 * [cloudflare.config.ts](cloudflare.config.ts).
 */
import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare({ assetsOnly: true })],

  // oxfmt's defaults.
  fmt: {},

  // Type-aware lint that also type-checks, so \`pnpm check\` needs no separate \`tsc\`.
${lint}
});
`;
  }
  if (kind === "tool") {
    return `/** @prose
 * # The checks
 *
 * There's nothing to build or serve, so Vite+ is here for its checks and tests.
 */
import { defineConfig } from "vite-plus";

export default defineConfig({
  // oxfmt's defaults.
  fmt: {},

  // Type-aware lint that also type-checks, so \`pnpm check\` needs no separate \`tsc\`.
${lint}

  test: {
    expect: { requireAssertions: true },
    include: ["tests/**/*.test.ts"],
  },
});
`;
  }
  return `/** @prose
 * # The build
 *
 * One Vite+ config packs the package and checks it. \`vp pack\` writes ESM with its types, and
 * runs publint, which fails the build on a package npm would serve badly.
 */
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    platform: "node",
    // Oxc writes the types, so there's no typescript dependency, and fails on an export
    // whose type isn't written out.
    dts: { generator: "oxc" },
    clean: true,
    fixedExtension: false,
    publint: { strict: true },
  },

  // oxfmt's defaults.
  fmt: {},

  // Type-aware lint that also type-checks, so \`pnpm check\` needs no separate \`tsc\`.
${lint}

  test: {
    expect: { requireAssertions: true },
    include: ["tests/**/*.test.ts"],
  },
});
`;
}

// This repository's CI, with a header that fits the new one.
function ci(kind: Kind): string {
  const job = read(".github/workflows/ci.yml").slice(
    read(".github/workflows/ci.yml").indexOf("name: CI"),
  );
  const header = [
    "# @prose",
    "# # CI",
    "#",
    "# Checks every pull request and every push to `main` with `pnpm run verify`.",
    {
      site: "# Cloudflare runs the same script before each deploy, which its Git integration does.",
      package: "# The release workflow runs the same script before it stages a version.",
      tool: "# Nothing deploys or releases: the scripts run on a laptop.",
    }[kind],
    "# The job is named `ci`, the check that branch protection requires.",
  ].join("\n");
  return `${header}\n${job}`;
}

function agents(name: string, description: string): string {
  // A description in the packages' style, like "markz — small, opinionated Markdown.", names it.
  const intro = description.startsWith(name) ? description : `${name}: ${description}`;
  return `# AGENTS.md

${intro}

${sections()}

## This repository

- Nothing yet beyond the standard. What's particular to ${name} goes here.
`;
}

function readme(name: string, kind: Kind, description: string): string {
  const install =
    kind === "package"
      ? `\n## Install\n\n\`\`\`sh\npnpm add @${OWNER}/${name}\n\`\`\`\n\nIt needs Node 26 or newer, the Node it's built and tested on.\n`
      : "";
  return `# ${name}

${description}
${install}
## Development

\`\`\`sh
pnpm install${kind === "tool" ? "" : "\npnpm dev"}
pnpm verify    # what CI runs
\`\`\`

Read [the docs](docs/README.md) for its design, plan and lessons. It follows [ship's standard](https://ship.amitkaps.com/docs/standard.md) for how it ${
    { site: "builds, checks and deploys", package: "builds, checks and releases", tool: "checks" }[
      kind
    ]
  }.
`;
}

/** @prose
 * # The docs
 *
 * The docs every repository has, each a first version to write over. They say what goes in each
 * section rather than leaving it empty, so the outline is there from the first commit.
 */
function docs(name: string, kind: Kind, description: string): Record<string, string> {
  const standard = "https://ship.amitkaps.com/docs/standard.md";
  type Page = [file: string, title: string, what: string];
  const usage: Page = ["usage.md", "Usage", "install it, use it, and the snippet for agents."];
  const pages: Page[] = [
    ["design.md", "Design", "what it is, why it's built this way, and what it isn't."],
    ...(kind === "package" ? [usage] : []),
    ["plan.md", "Plan", "what's done and what's next, in order."],
    ["lessons.md", "Lessons", "what building it taught, for the next change."],
    [
      "development.md",
      "Development",
      {
        site: "build, test and deploy it.",
        package: "build, test and release it.",
        tool: "check and test it.",
      }[kind],
    ],
  ];
  const files: Record<string, string> = {
    "docs/README.md": `---
nav: [${pages.map(([file]) => file).join(", ")}]
---

# Docs

The writing that spans the code, in reading order.

${pages.map(([file, title, what], i) => `${i + 1}. [${title}](${file}): ${what}`).join("\n")}
`,
    "docs/design.md": `# Design

## What it is

${description}

## Why

Why it's built this way, and the choices that follow from that.

## What it isn't

What it leaves out on purpose, so nobody adds it back.
`,
    "docs/plan.md": `# Plan

## Where it is

### ${kind === "package" ? "0.0.0" : "Started"}

Started from [ship's standard](${standard}), with \`pnpm new\`.

## Next, in order

1. The first thing ${name} does.

## Later

## Open questions
`,
    "docs/lessons.md": `# Lessons

What building ${name} taught, for whoever changes it next. Each lesson says what happened and what to do about it.
`,
    "docs/development.md": `# Development

How ${name} is built and changed. What every repository shares, like the scripts${
      { site: ", CI and deploys", package: ", CI and releases", tool: " and CI" }[kind]
    }, is in [ship's standard](${standard}), and isn't repeated here.

## Build and test

\`\`\`sh
pnpm install${kind === "tool" ? "" : "\npnpm dev"}
pnpm verify    # what CI runs
\`\`\`
`,
  };
  if (kind === "package") {
    files["docs/usage.md"] = `# Usage

## Install

\`\`\`sh
pnpm add @${OWNER}/${name}
\`\`\`

It needs Node 26 or newer, the Node it's built and tested on.

## Use

\`\`\`ts
import { hello } from "@${OWNER}/${name}";

hello("world"); // "Hello, world."
\`\`\`

## For agents

What an agent using ${name} should know, as a snippet to copy into its instructions.
`;
  }
  return files;
}

function cloudflareConfig(name: string, internal: boolean): string {
  const today = new Date().toISOString().slice(0, 10);
  const why = internal
    ? `
 *
 * It's internal, so Cloudflare Access covers its domain, and \`workers.dev\` and preview URLs
 * are off, since either would serve the same Worker without a login.`
    : "";
  const off = internal ? "\n    workersDev: false,\n    previewUrls: false," : "";
  return `/** @prose
 * # The Worker
 *
 * What Cloudflare runs: its name, compatibility date, domain and how it serves the files. Keep
 * the name equal to the Worker connected to this repository in the dashboard. The build and
 * deploy commands are set on the Worker, as ship's standard lists.${why}
 */
import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "${name}",
    compatibilityDate: "${today}",
    domains: ["${name}.amitkaps.com"],${off}
  },
});
`;
}

const page = (name: string, description: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <meta name="description" content="${description}" />
  </head>
  <body>
    <h1>${name}</h1>
    <p>${description}</p>
  </body>
</html>
`;

const entry = (name: string, description: string): string => `/** @prose
 * # ${name}
 *
 * ${description}
 */

/** Says hello, as a start to replace. */
export function hello(who: string): string {
  return \`Hello, \${who}.\`;
}
`;

const test = `import { expect, test } from "vite-plus/test";
import { hello } from "../src/index.ts";

test("says hello", () => {
  expect(hello("world")).toBe("Hello, world.");
});
`;

/** Writes a new repository's files into `dir`, which must not exist. */
export async function write(
  dir: string,
  name: string,
  kind: Kind,
  description: string,
  internal = false,
): Promise<void> {
  if (existsSync(dir)) throw new Error(`${dir} already exists`);
  const files: Record<string, string> = {
    "package.json": `${await packageJson(name, kind, description)}\n`,
    "pnpm-workspace.yaml": `${workspace(kind)}\n`,
    "tsconfig.json": `${tsconfig(kind)}\n`,
    "vite.config.ts": viteConfig(kind),
    ".github/workflows/ci.yml": ci(kind),
    "AGENTS.md": agents(name, description),
    "CLAUDE.md": "@AGENTS.md\n",
    "README.md": readme(name, kind, description),
    ".gitignore": read(".gitignore"),
    ".vscode/settings.json": read(".vscode/settings.json"),
    ".vscode/extensions.json": read(".vscode/extensions.json"),
    // An internal repository isn't shared, so it has no licence to share it under.
    ...(internal ? {} : { LICENSE: read("LICENSE") }),
    ...docs(name, kind, description),
  };
  if (kind === "site") {
    files["cloudflare.config.ts"] = cloudflareConfig(name, internal);
    files["index.html"] = page(name, description);
  } else {
    files["src/index.ts"] = entry(name, description);
    files["tests/index.test.ts"] = test;
  }
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
  if (kind === "package")
    cpSync(join(here, "package", ".github"), join(dir, ".github"), { recursive: true });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string): boolean => {
    const at = args.indexOf(name);
    if (at !== -1) args.splice(at, 1);
    return at !== -1;
  };
  const value = (name: string): string | undefined => {
    const at = args.indexOf(name);
    return at === -1 ? undefined : args.splice(at, 2)[1];
  };
  const description = value("--description");
  const push = flag("--push");
  const internal = flag("--internal");
  const kind: Kind | undefined = flag("--package")
    ? "package"
    : flag("--site")
      ? "site"
      : flag("--tool")
        ? "tool"
        : undefined;
  const [name] = args;
  // A package is published to npm, so it can't be internal.
  if (
    !name ||
    !kind ||
    !description ||
    !/^[a-z][a-z0-9-]*$/.test(name) ||
    (internal && kind === "package")
  ) {
    console.error(
      'Usage: pnpm new <name> --package|--site|--tool --description "What it is, in a sentence." [--internal] [--push]\n--internal is for a site or a tool, since a package is public on npm.',
    );
    process.exit(1);
  }

  const dir = join(dirname(here), name);
  await write(dir, name, kind, description, internal);
  const run = (command: string, ...a: string[]): void => {
    execFileSync(command, a, { cwd: dir, stdio: "inherit" });
  };
  // oxfmt formats what was written, so the generator needn't copy its rules.
  run("pnpm", "install");
  run("pnpm", "run", "fix");
  run("pnpm", "run", "verify");
  run("git", "init", "-q", "-b", "main");
  run("git", "add", "-A");
  run("git", "commit", "-q", "-m", `Start ${name} from ship's standard`);

  if (push) {
    run(
      "gh",
      "repo",
      "create",
      `${OWNER}/${name}`,
      internal ? "--private" : "--public",
      "--source",
      ".",
      "--push",
      "--description",
      description,
    );
    writeGitHub(name, kind === "package");
  }

  const left = [
    ...(push ? [] : [`Create ${OWNER}/${name} on GitHub, push main, then run pnpm align ${name}.`]),
    internal
      ? `Leave it out of REPOS, since the home page is public. Check it with pnpm drift ../${name}.`
      : `Add "${name}" to REPOS in scripts/survey.ts, in a pull request here.`,
    ...(kind === "site"
      ? [
          `Connect the Worker "${name}" to the repository, then run pnpm align ${name} to write its build settings.`,
        ]
      : []),
    ...(kind === "site" && internal
      ? [
          `Add an Access application for ${name}.amitkaps.com, with a policy that lets in only who it's for.`,
        ]
      : []),
    ...(kind === "package"
      ? [
          'Publish the first version by hand, then add the trusted publisher on npmjs.com, as the standard\'s "Setting up a new package" says.',
        ]
      : []),
  ];
  console.log(`\n✓ ${dir}\n\nStill to do:`);
  for (const step of left) console.log(`- ${step}`);
}
