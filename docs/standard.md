# The standard

How every repository builds, checks and deploys. There's one way to do each thing, and this repository is the working example of it. `pnpm drift` checks the others against it and lists where each has drifted, `pnpm align` brings them back in line, and the home page at ship.amitkaps.com shows the same as tables.

The repositories are base, markz, prose, pagez, sitez and this one. Where this page gives a version, the real value is in this repository's files, and `pnpm drift` reads it from there.

## Kinds

What a repository must have follows from three facts, each read from where it already lives, so none is declared twice.

- **A package** is published to npm, and its `package.json` isn't `private`.
- **A site** deploys to a Cloudflare Worker, and has a Worker config.
- **A tool** is neither: scripts run on a laptop.

A site or a tool is **internal** when its repository is private on GitHub. An internal site is still a site, deployed the same way, but behind Cloudflare Access, as [Internal sites](#internal-sites) says. A package can't be internal, since npm is public.

## Toolchain: Vite+

One `vite.config.ts`, run through `vp`, covers dev, build, format, lint and test. A package builds with `vp pack`, which is part of Vite+, so there's no separate bundler. `defineConfig` comes from `vite-plus`.

Vite+ ships its own build of Vite. Each repository points every `vite` at it with an override in `pnpm-workspace.yaml`, and turns off pnpm's peer checks for `vite`, since that build is an npm alias. Bump `vite-plus` and the override together, in every repository at once. A version that differs between repositories is the drift that makes Vite+ painful.

Formatting runs at oxfmt's defaults, written as an empty `fmt: {}` so the config says so. Lint is type-aware and type-checks too, so `check` covers types without a separate `tsc`:

```ts
lint: {
  plugins: ["typescript", "unicorn", "import"],
  categories: { correctness: "error" },
  options: { typeAware: true, typeCheck: true },
},
```

The types come from `tsconfig.json`, and every one turns on the same strict options: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules` and `forceConsistentCasingInFileNames`. This repository's [tsconfig.json](../tsconfig.json) is the example. The rest of a tsconfig, like `include` and `types`, is the repository's own.

### The editor

Every repository has the `.vscode/settings.json` that Vite+ writes, as [this repository's](../.vscode/settings.json), and a `.vscode/extensions.json`. The check reports each file as one line when it differs, since `pnpm align` copies this repository's settings in whole. The settings make oxc the formatter, on save, with its fixes. The extensions recommended are oxc's and Vitest's, by name, rather than Vite+'s extension pack, which only wraps the two and could add more without a change here. The oxc extension then runs the repository's own `vp fmt` and `vp lint`, so the editor formats with the oxfmt Vite+ pins and the `fmt` block in `vite.config.ts`, the same as `check`. A repository can add settings of its own, like base's for Svelte.

Nothing about oxc goes in VS Code's user settings. A path to oxfmt there, or a config path, overrides every repository's own, and the editor formats differently from `check`.

base, the SvelteKit starter, left Vite+ for the standalone tools. It goes back, and `pnpm drift` lists it until then.

## pnpm and Node

`package.json` is the one place for both versions.

```json
"devEngines": {
  "packageManager": { "name": "pnpm", "version": "12.13.0", "onFail": "download" },
  "runtime": { "name": "node", "version": ">=26", "onFail": "error" }
},
"engines": { "node": ">=26" },
"packageManager": "pnpm@12.13.0"
```

- **pnpm is pinned exactly, with `onFail: download`.** Whatever pnpm is installed globally, pnpm fetches and runs the pinned one, so a new pnpm release never breaks a checkout. CI reads `packageManager`, so keep the two equal.
- **Node fails loudly.** `onFail: error` stops on the wrong Node.
- **One Node, for building and for using.** `engines` says the same `>=26` as `devEngines`. A package supports the Node it's built and tested on, and nothing older, so CI runs on one Node. Node 26 is the LTS release from October 2026. When the next LTS arrives, every repository moves to it at once, and for a package that's a breaking release.
- **Bump deliberately, everywhere at once.** Being on the latest pnpm doesn't matter. Being on the same one does.

## Other versions

The tools every repository shares are on one version, written the same way, so moving one never leaves two repositories to reconcile. Where this repository uses a tool, its `package.json` has the version. Where it doesn't, the `catalog` in its `pnpm-workspace.yaml` does, which nothing here installs. npm isn't read: a new release is drift only once this repository moves to it, and `pnpm align` moves it, past pnpm's one-day wait.

| Tool                                 | Version                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `@types/node`                        | the major of the Node that `engines` allows, so code can't use newer APIs |
| `vite-plus`                          | with the override at the same version and no direct `vite`                |
| `cf`, `@cloudflare/vite-plugin`      | in any repository that deploys with cf, pinned by hand while they're beta |
| `@amitkaps/prose`, `@amitkaps/markz` | where a repository uses them                                              |
| `typescript`                         | from the catalog, where a repository has it                               |
| `wrangler`                           | from the catalog, while a repository is still on it                       |
| `publint`                            | from the catalog, in every package                                        |

A repository's own libraries, like svelte or micromark, are its own to choose. `pnpm align` moves them within their major version, and lists a new major in its pull request for review.

## Held

When a tool a repository depends on can't support the standard yet, the check is held: it shows amber on the home page with its reason, and doesn't fail `pnpm drift`. Each hold says when to look again, like svelte-check accepting TypeScript 7. Holds are listed in [scripts/survey.ts](../scripts/survey.ts).

A hold is for what a tool can't do, never for a preference. The point of one standard is that a choice like Vite+ is made once and paid for once, not argued again in each repository. A hold whose check stops drifting fails `pnpm drift` until it's removed, so none outlives its reason.

`pnpm-workspace.yaml` is a settings file, not a workspace. Every repository has the same three settings: pnpm's one-day wait on a new version, with `@amitkaps/*` excluded so our own releases install at once, `allowBuilds` (esbuild and workerd, when wrangler or the Cloudflare plugin is installed), and the Vite+ override.

## Scripts

Every repository uses these names, and runs them with `pnpm run …` in anything automated.

| Script    | Does                                                                      |
| --------- | ------------------------------------------------------------------------- |
| `dev`     | the dev server, or `vp pack --watch` for a package                        |
| `build`   | the production build                                                      |
| `preview` | a site's: serves what `build` wrote, with `vp preview`                    |
| `check`   | format, lint and types: `vp check`, and a framework's own checker         |
| `fix`     | writes the format and lint fixes: `vp check --fix`                        |
| `test`    | the tests, when there are any                                             |
| `verify`  | `check`, `test` and `build`, then the site if there is one                |
| `ship`    | uploads what `verify` built: `cf deploy --prebuilt`, or `wrangler deploy` |
| `prose`   | reads the repository as a document: `prose`, so `pnpm prose build` works  |

`check`, `fix`, `verify` and `prose` are in every repository, and `dev` and `build` in every site and package. A tool has nothing to serve or build, so its `verify` is `check` and `test`. `test` is there when there are tests, and `ship` when there's a site. `preview` is a site's, and a package, whose build is `dist/`, has none. Any other script is the repository's own, like a package's `size` or `fuzz`. On Vite+, `fix` is exactly `vp check --fix`, and `check` runs `vp check`. A framework can add its own steps around it, like SvelteKit's `svelte-kit sync` before and `svelte-check` after, but no second formatter or linter, and no separate `lint` or `fmt` scripts. The home page lists every script side by side, so two repositories using one name for different jobs shows up.

`verify` is what CI runs and what Cloudflare runs before each deploy, so the two can't disagree. `ship` never builds. Some names are pnpm's own commands, and a script by one of those names is skipped by `pnpm <name>`. Don't use `deploy`, `publish`, `audit`, `ci`, `pipeline` or `pack` for a script.

A lifecycle script, one pnpm runs on its own like `prepare` on install or `prepack` before packing, only does what another step needs first. base's `prepare` generates the types SvelteKit and the Worker need, so a fresh clone type-checks. A package's `prepack` is `pnpm run build`, so a tarball never ships a stale `dist/`. Neither builds a site or deploys.

## Cloudflare

A repository with a site deploys it to a Cloudflare Worker with static assets.

- **Config:** `cloudflare.config.ts`, cf's typed config, is the target. A repository that cf can't deploy yet keeps `wrangler.toml`, never `wrangler.jsonc`, since prose reads comments in TOML but not in JSONC. Either way, the file holds the Worker's name, compatibility date, domain and asset handling.
- **Deploys:** the Worker's Git integration (Workers Builds) builds and deploys `main`. There's no deploy step in GitHub Actions, and no API token or secret.
- **The Worker's settings** are the same on every Worker. Cloudflare's config has no field for them, so `pnpm align` writes them with `cf`, and `pnpm drift` checks them when `cf` is logged in. Only connecting the Worker to its repository is left to the dashboard.

```text
Build command      pnpm run verify
Deploy command     pnpm run ship
Root directory     /
NODE_VERSION       26
Build cache        on
Previews           off
```

`verify` fails on a failing check, so a merge that breaks one doesn't deploy. Previews stay off because CI already checks every pull request. If a public repository turns them on, it sets the preview deploy command too: `pnpm exec wrangler versions upload`, or `pnpm exec cf workers versions create --prebuilt`.

### Internal sites

A private repository's site is internal. It deploys like any other site, and three things keep it private.

- **Access covers its domain.** A Cloudflare Access application on the site's domain, with a policy that lets in only who it's for. Access is turned on once per account, in the Zero Trust dashboard.
- **`workers.dev` is off.** Access covers the domain, not the Worker, so `<name>.<account>.workers.dev` would serve the same site without a login. The config sets `workersDev: false`.
- **Preview URLs are off, always.** Each would be another address outside Access. The config sets `previewUrls: false`, and the Worker's previews stay off.

```ts
worker: {
  name: "…",
  domains: ["….amitkaps.com"],
  workersDev: false,
  previewUrls: false,
},
```

The config is where the repository says it's internal, with a `@prose` comment saying why, not `package.json`, whose `private` already means "not on npm" and which can't hold a comment. `pnpm drift <folder>` reads both facts: a private repository's site whose config leaves either address on has drifted, and so has a site whose config turns `workers.dev` off without the rest. With `cf` logged in, it also checks that an Access application with a policy covers the domain.

## GitHub

Every `main` takes changes the same way. Work happens on a branch, in a pull request, and `ci` has to pass on a branch that's up to date with `main`. The pull request is squash-merged, so `main` reads as one commit per change, and nobody pushes to it, admins included.

- **Branch rules:** one ruleset, named `main`, from [.github/ruleset.json](../.github/ruleset.json). It requires a pull request with no approvals, since there's one maintainer, and the `ci` check. It keeps history linear, and blocks force pushes and deleting the branch. Nobody bypasses it.
- **Actions:** every workflow uses the actions at the versions this repository's do. A repository can add steps of its own, but the versions move here first, like every other version, so there's no Dependabot.
- **Merge settings:** from [.github/settings.json](../.github/settings.json). Squash is the only merge, a branch is deleted once it's merged, and auto-merge is on.

`pnpm align` writes both, to every repository or to the ones named, and removes any classic branch protection. The home page checks the rules, which GitHub shows to anyone. Without a login, GitHub answers 60 requests an hour, so `pnpm drift` uses `gh`'s login when there is one, and a check the limit stopped shows as not checked, not as drift. With that login, it checks the merge settings too, which only the owner can read.

## Agents

Every `AGENTS.md` opens with the same two sections as [this repository's](../AGENTS.md), word for word. "Standard" points at this page, and says how changes reach `main`. "Prose" points at the rules in [prose's usage](https://prose.amitkaps.com/docs/usage.md#for-agents). The rules live there, once, and aren't copied into each repository, since the copies had already started to differ. The rest of an `AGENTS.md` is the repository's own. A `CLAUDE.md` holds only `@AGENTS.md`, so Claude Code reads the same file.

## Docs

Every repository has the same docs, so anyone, or any agent, finds the same things in the same places.

| File                  | Holds                                                                        |
| --------------------- | ---------------------------------------------------------------------------- |
| `README.md`           | what it is, the commands, and a link to `docs/`                              |
| `docs/README.md`      | the docs in reading order: `nav` in its metadata, and a line for each        |
| `docs/design.md`      | what it is, why it's built this way, and what it isn't                       |
| `docs/plan.md`        | where it is, a section per release or milestone, what's next, later and open |
| `docs/development.md` | only what's its own: its extra scripts, its site, its release                |
| `docs/lessons.md`     | what building it taught, each lesson what happened and what to do about it   |
| `docs/usage.md`       | a package's install and use, and a section for agents                        |

A site has no `usage.md`, since the site is what people use. Any other doc is the repository's own, like markz's grammar, and goes in the `nav` too. `development.md` links to this standard for what's shared rather than repeating it. `pnpm new` writes a first version of each.

The docs are published at `/docs/<file>.md`, so a link to one works on GitHub and on the site alike.

- **A package's site is `prose build`,** the repository read as a document, with nothing added to it. Its docs are in the bar, and its code is a page away.
- **A site shows its docs its own way,** read from `docs/`, so GitHub and the site have one set of files. base renders them with SvelteKit, as the starter it is, and ship renders them with markz beside its dashboard.

## Releases

markz, prose, pagez and sitez are packages, published to npm. A package is any repository whose `package.json` isn't private, and every one releases the same way.

- **The release files** are [package/](../package/README.md)'s, copied into the package unchanged: the release workflow and `.github/release.yml`, which groups the notes. They name no package, so the copies stay identical and the survey checks them word for word.
- **Packing:** `files` is `["dist"]`, `prepack` is `pnpm run build`, and `publishConfig.access` is `public`. publint runs inside `vp pack`, with `pack: { publint: { strict: true } }` and `publint` as a dev dependency, so `build` fails on a package npm would serve badly, and there's no separate publint step.
- **Types come from Oxc.** The pack block sets `dts: { generator: "oxc" }`, so `vp pack` writes the `.d.ts` files without the TypeScript compiler, and fails on an export whose type isn't written out. It's set there, not as `isolatedDeclarations` in `tsconfig.json`, which the editor would apply to tests and config too. A package has no `typescript` dependency, like a site: `vp check` type-checks with tsgolint, which Vite+ installs.
- **Our own packages are bundled, not depended on.** prose and sitez have markz as a dev dependency, and `vp pack` puts it inside `dist/`. So a package's users never install a second markz, and each package releases on its own, in any order. Picking up a new markz takes a release of the package that bundles it.

To release, run `pnpm release` here, with the package and its new version.

```sh
pnpm release sitez 0.5.0 --notes "What to change when you upgrade …"
```

It opens a pull request that bumps `version`, from a branch named `release-X.Y.Z`, titled `vX.Y.Z` and labelled `internal`, and turns on auto-merge. Its description, down to the first `---` line, is the release's summary, like what to change in a breaking release. Without `--notes`, the editor opens for it.

Merging a new version is the release, and nobody tags by hand. When a merge changes `package.json`, the workflow looks for a `vX.Y.Z` tag for its version. If there isn't one, it runs `pnpm run verify`, packs the tarball and stages it on npm with trusted publishing. It then tags the merged commit and publishes a GitHub Release, with the summary above notes generated from the merged pull requests. If a run fails, rerun it, since a version already on npm is skipped.

You approve the staged version with 2FA, in the **Staged Packages** tab on npmjs.com or with `npm stage approve <id>`. That step stays by hand, so a merge alone can't put a version in front of users. A version with a pre-release part, like `-rc.0`, goes to npm's `next` tag and is marked a pre-release.

### Release notes

There's no changelog file. Each pull request carries one label, which files it under a heading in the notes. `pnpm align` creates the labels, from [.github/labels.json](../.github/labels.json).

| Label      | Heading            | For                                            |
| ---------- | ------------------ | ---------------------------------------------- |
| `breaking` | Breaking           | a change that needs users to update their code |
| `added`    | Added              | a new feature or warning                       |
| `fixed`    | Fixed              | a bug fix users would notice                   |
| `improved` | Faster and smaller | the same behaviour, faster or smaller          |
| `docs`     | Documentation      | documentation readers use                      |
| `internal` | left out           | tests, tooling, site and lessons               |

A pull request's title is its line in the notes, so a user-facing one is written for the package's users. One with no label falls under Other, so a missed label shows.

### Setting up a new package

`pnpm new` copies in `package/`'s files, and `pnpm align <repo>` makes the labels. A package that isn't on npm yet doesn't release on a merge, since npm trusts the workflow only once the package exists. On npmjs.com, add a trusted publisher for the repository and the workflow `release.yml`, with direct publishing and dist-tags left unchecked, so staging is all it can do. npm may not take that before the package exists. Then publish the first version by hand, from a folder outside the repository, since `npm` refuses to run where `devEngines` names pnpm.

```sh
pnpm pack && cd /tmp && npm login && npm publish ~/code/<repo>/amitkaps-<repo>-<version>.tgz --access public
```

The next merge that changes `package.json` finds that version on npm with no tag, so it skips staging and tags it, with a GitHub Release.

## CI

GitHub Actions runs one job, named `ci`, on pull requests and on `main`. It installs with `pnpm install --frozen-lockfile` and runs `pnpm run verify`, plus whatever a package adds, like publint or a size budget. Branch protection requires `ci`. Cloudflare's own check on each commit isn't required, since it runs after the merge.

## Docs

Explanations live in `@prose` comments, beside the code or setting they explain, and docs that span files live in `docs/`. Both are written in [markz](https://markz.amitkaps.com)'s Markdown, and `pnpm prose` reads them as one document. `package.json` has no comments, so its scripts are explained here. A hand-written `.html` page ships its comments, so it has no prose.

## Repositories

Every repository in the standard is in `REPOS`, in [scripts/survey.ts](../scripts/survey.ts), so the home page and `pnpm drift` check it. A repository joins one of two ways, and both end the same: in `REPOS`, protected, and passing `pnpm drift`.

### Bringing one in

1. Add it to `REPOS`, in a pull request here. `pnpm drift` then lists everything it's missing.
2. Fix what drift lists, in the repository's own pull requests. Where a tool can't meet the standard yet, add a hold rather than a workaround.
3. Connect a site's Worker to the repository, in the dashboard.
4. Run `pnpm align <repo>`, for the branch rules, the merge settings, a package's labels and the Worker's build settings. A package still needs its trusted publisher on npm.

### Keeping them in line

`pnpm drift` reads and `pnpm align` writes, each for every repository or the ones named.

- **drift** checks every repository's files, from GitHub's `main`, or from a folder named on the command line, to see a fix before it's pushed. With `gh` logged in it checks the merge settings too, and with `cf` the Workers' build settings, and without a login it says what it couldn't check.
- **align** moves this repository first: its libraries and tools, the Vite+ override and the catalog, each within its major version. Then it aligns the others with that, from a fresh clone of each `main`. Every shared tool, the override and the editor settings come from here, and each repository's own libraries move within their majors. A pull request opens where `verify` passes, with auto-merge on, and lists any new major left for review. GitHub's settings and the Worker's are written directly, since there's no file to review.

A change to the standard itself, like a new check, is a pull request here, and the next `pnpm align` carries it.

### Following it unlisted

A private repository can follow the standard without joining `REPOS`, since the home page is public and would name it. `pnpm drift <folder>` checks it from disk, everything but its branch rules and labels, which `pnpm align <repo>` still writes, and reads from GitHub whether it's private. Where it can't follow a rule, its own docs say which and why.

### Starting one

`pnpm new` starts a repository that already follows the standard, in the folder next to this one.

```sh
pnpm new <name> --package --description "What it is, in a sentence." --push
pnpm new <name> --site --description "What it is, in a sentence." --push
pnpm new <name> --tool --internal --description "What it is, in a sentence." --push
```

`--internal` makes a site or a tool private on GitHub and leaves it out of `REPOS`, and an internal site's config turns off `workers.dev` and preview URLs. The Access application is the step left to do by hand.

It builds each file from this repository's own, not from a template: the versions, engines and scripts, the strict types and lint, the Vite+ override, CI, the shared `AGENTS.md` sections, and a package's release files. Then it installs, formats with `fix`, runs `verify` and makes the first commit. `--push` creates the repository on GitHub, pushes that commit and writes its GitHub settings, as `pnpm align` does. That first push is the only one to `main` the standard allows, since the rules aren't on yet. It prints what's left: adding the repository to `REPOS`, and the Worker or npm's setup. A SvelteKit app starts from base instead, and is brought in like any other.

`pnpm test` here generates a package and a site, checks each against the survey and runs its `verify`, so the generator can't fall behind the standard.
