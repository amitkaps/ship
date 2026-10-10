# Lessons

What setting up the repositories' builds and deploys taught, for whoever changes them next. Each lesson says what happened and what to do about it. Lessons that belong to one repository stay there, like SvelteKit's in base's `src/content/lessons.md`.

## pnpm

- **An exact pin with `onFail: error` breaks on every pnpm release.** A newer global pnpm refused to run with `ERR_PNPM_BAD_PM_VERSION`. `onFail: download` makes pnpm fetch and run the pinned version instead, which was tested with a global 12.10.1 and a pinned 12.9.1. A range in `devEngines` also works, but lets machines run different versions.
- **Some script names never run.** `pnpm deploy`, `pnpm audit`, `pnpm publish` and `pnpm ci` are pnpm's own commands, so a script by one of those names is skipped. That's why the deploy script is `ship` and the drift check is `drift`.
- **`npx` refuses to run in a repository whose `devEngines` names pnpm.** Use `pnpm exec` for an installed tool, and `pnpm dlx` for one that isn't.
- **An exception for one version needed an edit on every release.** ship and base turned pnpm's one-day wait off, and the others named each of our new versions in `minimumReleaseAgeExclude`. pnpm writes that list itself on install, in a form `vp check` rejects, which failed a pull request in pagez. The wait is pnpm's default everywhere now, with `@amitkaps/*` excluded, a pattern pnpm accepts, so a release changes nothing here.
- **Turning the wait back on failed a lockfile that had skipped it.** base's lockfile held a `@cloudflare/workers-types` published that morning, resolved while its wait was 0. `pnpm install` passed locally, but `pnpm install --frozen-lockfile`, which CI runs, checks each locked version against the wait and failed. `pnpm update` on the package resolved it to the newest one past the wait. Run the frozen install locally before pushing a change to these settings.

## Vite+

- **Type-aware lint finds what the default lint misses.** Turning it on here flagged an `unknown` value in a template string in `drift.ts`. It needs no `typescript` dependency, since Vite+ installs tsgolint. With `typeCheck: true` it also reports compiler errors, like `TS2322`, so `check` replaces `tsc`.
- **There's no `vp fix`.** `vp check --fix` writes the format and lint fixes, so `check` and `fix` are one command with and without a flag. `vp check` also runs the type check when `typeCheck` is on, so `vp lint && vp fmt --check` was doing the same job in two steps.
- **With no `fmt` block, `vp fmt` prints "No config found, using defaults."** It still passes. An empty `fmt: {}` keeps the defaults and drops the notice.

## The survey

- **The Cloudflare build can't see the other repositories.** Workers Builds clones only this one, so a survey that read sibling folders found nothing there. It reads them from GitHub's `main` instead, which is public and needs no token. A GitHub outage shows in the table rather than failing the build, so it never blocks a deploy.

- **Checking versions found drift the setup checks missed.** prose asked for Node 24 in `devEngines`, had no vite override at all, and two repositories were a minor release behind on markz. Each was a version nobody had looked at since it was set. A tool this repository doesn't use is compared with npm's latest, read at build time.

- **One script name ran two commands.** ship and base ran `prose .`, and markz and sitez ran `prose`. prose reads `build` only as its first argument, so `pnpm prose build` became `prose . build` in two of them. The script is `prose` alone, since it reads the current folder anyway, and the survey checks it.

- **A sixth repository made the first table scroll.** Each word in a command was kept from breaking, so a flag's hyphen never split, and `cloudflare.config.ts` no longer fit its narrower column. Only hyphenated words are kept whole now. A new column is worth a look at the page at a laptop's width.

- **Reading the domains found one the config didn't name.** prose's domain was set only in the dashboard, so its heading on the page had no address to link. A domain read from the config is one a deploy can't drop, so prose's `wrangler.toml` names it now, as markz's does.

## Moving base back

- **A framework needs steps around `vp check`.** SvelteKit generates `$app/tsconfig` and the Worker's types, so `svelte-kit sync` and `wrangler types` run first, and oxlint doesn't type-check `.svelte` files, so `svelte-check` runs after. The standard holds `check` to running `vp check`, not to being only that. `fix` stays exact.
- **Moving between toolchains needs a fresh lockfile.** A lockfile keeps the optional peers it already resolved, so base needed `node_modules` and `pnpm-lock.yaml` removed before installing.
- **Dependabot can't bump Vite+ alone.** The override in `pnpm-workspace.yaml` has to move with it, and Dependabot doesn't edit that file, so it ignores `vite-plus`. Vite+ moves from here, in every repository at once.
- **Dependabot's pull requests duplicated the survey.** Only base and markz had it, and every npm pull request it opened was closed, since versions move from here and the survey compares them with npm's latest. Its merged ones were three action bumps in base. The survey checks action versions now, and Dependabot is gone.
- **wrangler.jsonc hides its comments from prose.** prose reads comments in `.toml` but not `.jsonc`, so a repository still on wrangler uses `wrangler.toml`.

## GitHub and agents

- **Five repositories protected `main` four ways.** Classic protection in two, with different settings, a ruleset in one, and nothing in two, including this one. A ruleset is one JSON document, so it can live here and be applied everywhere with `gh api`, which classic protection can't do as cleanly.
- **GitHub shows a public repository's branch rules to anyone, but not its merge settings.** `GET /repos/{owner}/{repo}/rules/branches/main` works without a login, so the home page checks the rules. Settings like squash-only need the owner's token, so `pnpm drift --github` checks those.
- **GitHub's rate limit looked like drift.** Logged out, GitHub answers 60 requests an hour, and each `pnpm drift` made 8, so a busy afternoon of runs turned every branch rule and label red with HTTP 403. The rules live on GitHub, not in each repository's `.github/`, so there's no file to read instead. `pnpm drift` now logs in with `gh` when it can, and a check the limit stopped says it wasn't made.
- **Copied rules drift.** The `@prose` rules were copied into four `AGENTS.md` files and had already started to differ. Each `AGENTS.md` now links to the one copy in prose's docs, and the survey checks the link section is the same everywhere.

## Releases

- **Three copies of one release workflow had drifted.** markz staged with pnpm and sent pre-releases to `next`. prose and sitez staged with npm from a temporary folder, and skipped a version already on npm. Only markz ran its size budget, and only markz had labels, so prose's notes listed every pull request, plans included. The workflow now names no package, so one file is copied everywhere and checked word for word.
- **publint needn't be a separate step.** `vp pack` runs it with `publint: { strict: true }` in the `pack` block, and fails the build on a problem, which was tested by pointing `exports` at a missing file. It needs `publint` installed, or the pack fails with "Failed to import module".
- **A summary in an annotated tag can't be reviewed or fixed.** markz's breaking release put what to change in the tag's message. It's now the description of the pull request that bumps the version, which is reviewed like any change, and the workflow reads it from the tagged commit.
- **Supporting an older Node than we build on took a workaround.** The packages allowed Node 24 in `engines` while building on 26. pnpm won't run on a Node older than `devEngines` asks for (`ERR_PNPM_BAD_RUNTIME_VERSION`), so a CI job for 24 had to install on 26, switch Node and run `node_modules/.bin/vp test --run`. Their only user was on 26, so `engines` became `>=26` and the job went. If a package gains users on an older Node, that job is how to test it.
- **A branch named like its tag blocks the push.** sitez's bump branch was `v0.4.0`, so `git push origin v0.4.0` couldn't tell the branch from the tag, and `git tag` had already made the tag. The branch is `release-X.Y.Z` now. To push a tag whose name is ambiguous, name it in full: `git push origin refs/tags/v0.4.0`.
- **Pushing a tag by hand was the step that went wrong.** A release was a merge, then a tag pushed from a fresh `main`, then npm's approval. The tag held nothing the merge didn't, and pushing it is where the branch named `v0.4.0` got in the way. The workflow now runs on the merge and tags the commit itself, and `pnpm release` opens the pull request. Only npm's 2FA approval is left by hand, since it's the one check a merge shouldn't get past. The pull request is opened with the owner's login, not by a workflow, because GitHub runs no CI on a pull request a workflow's token opens.
- **Bundling our own packages removes the release order.** prose already had markz as a dev dependency, inside its `dist/`, so it depends on nothing at install time. sitez's published types never mention markz, so it can do the same, and then any package can release at any time.

## New repositories

- **A generator copies the standard, so it's tested against it.** `pnpm new` builds each file from ship's own, and `pnpm test` runs the survey and `verify` on what it writes. The first run found two things a template would have hidden. oxfmt keeps short arrays on one line where `JSON.stringify` doesn't, so the generator runs `fix` rather than copying oxfmt's rules. `vp pack` can't write a package's types without `typescript` installed, unless `isolatedDeclarations` is on, which also needs `declaration`. That's now how every package writes its types.
- **`vp check` doesn't report what `isolatedDeclarations` needs.** Turned on in markz and sitez, the check passed, and `vp pack` failed on an export with no written type (TS9010). `verify` runs both, so it's caught either way.
- **`isolatedDeclarations` in `tsconfig.json` reached files nobody publishes.** VS Code applied it to every file the tsconfig includes, so markz's `vite.config.ts` and tests showed 14 errors that `vp check` never reported. `dts: { generator: "oxc" }` in the pack block makes the same choice for only what's packed. markz's `dist/` came out byte for byte the same, and a missing type on an export still fails the pack.
- **pagez was the first repository `pnpm new` started.** CI passed on the first push, and the release workflow stopped at "isn't on npm yet", as it should. The one fix was cosmetic: a description in the packages' style, "pagez — one Markdown page, one HTML file.", came out as "pagez: pagez — …" in `AGENTS.md`. Running it without `--push` first left room to read the files before anything reached GitHub.
- **A package's first push would have run the release.** The push changes `package.json`, and the package isn't on npm yet, so staging would fail. The workflow now stops for a package npm doesn't have, since its first version is published by hand.

## Cloudflare

- **The Git integration deploys whether or not GitHub CI passed.** The fix is a build command that runs the checks. `pnpm run verify` fails first, and nothing deploys.
- **The build and deploy commands can't live in the repository.** `cloudflare.config.ts` has no field for them, as of cf 1.0.0-beta.14 and `@cloudflare/config` 0.24.1. So the dashboard holds two commands that never change, and `package.json` decides what they run.
- **The Git integration installs dependencies itself.** A build command that starts with `pnpm install &&` installs twice.
- **The integration reads pnpm's version from the repository, but not Node's.** Set `NODE_VERSION` on every Worker, or `devEngines` stops the build on the default Node.
- **cf can't deploy SvelteKit yet.** The adapter doesn't write cf's Build Output, so base stays on wrangler. Its lessons have the detail.
- **cf deploys an assets-only Vite site.** `@cloudflare/vite-plugin` with `assetsOnly: true` writes the Build Output, and `cf deploy --prebuilt` uploads it.
- **cf can't deploy a folder that Vite didn't build.** Tried on markz, whose site `prose build` writes into `.prose`. cf's config has no `assets.directory`, as of cf 1.0.0-beta.14 and `@cloudflare/config` 0.24.1. Without `--prebuilt`, `cf deploy` delegates to wrangler. `cf pages deploy` takes a folder, but that's Pages, not a Worker. So markz and prose stay on wrangler, held, until cf's config takes a folder.
- **cf has no command to rename a Worker, but the dashboard does.** Settings → General → Name renames it in place, keeping its ID, Git connection and domains. Rename it there first, then change the name in the config, since a different name in the config deploys to a different Worker.
- **Reconnecting a repository resets the Worker's build settings.** After the GitHub repository was renamed and reconnected, the commands went back to `pnpm run build` and `npx wrangler deploy`, `NODE_VERSION` was gone, the cache was off and previews were on. Check them after any reconnect, with `pnpm drift --cloudflare`.
- **The config lists the Worker's domains too.** Change a domain in the dashboard and in `cloudflare.config.ts` together, so a deploy can't put the old one back.
- **cf needs `CLOUDFLARE_ACCOUNT_ID` when the login has several accounts.** It won't pick one in a script.

## Docs

- **prose builds the last commit, not the working tree.** ship's new docs were missing from its site until they were committed, since `prose build` reads what's committed. Commit before building to see a new file, and the Cloudflare build always does.
- **prose's pages beside a dashboard left the dashboard out.** ship's build added prose's pages to its Vite output, but its home page had no way into them, and prose's frame can't hold a page from outside the commit without becoming a site generator. A package's site is `prose build` alone. A site renders its docs its own way, and ship uses markz, as base does.
- **A hand-written `.html` page ships its comments.** Vite doesn't strip them, so a `<!-- @prose -->` would show in the page source. Pages here carry no prose, and the README says what they are.
