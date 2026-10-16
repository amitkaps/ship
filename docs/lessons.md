# Lessons

What setting up the repositories' builds and deploys taught, for whoever changes them next. Each lesson says what happened and what to do about it. Lessons that belong to one repository stay there, like SvelteKit's in base's `src/content/lessons.md`.

## pnpm

- **An exact pin with `onFail: error` breaks on every pnpm release.** A newer global pnpm refused to run with `ERR_PNPM_BAD_PM_VERSION`. `onFail: download` makes it fetch and run the pinned version instead. A range would also work, but lets machines run different versions.
- **npm's `latest` for pnpm runs behind its releases.** pnpm 12.13.0 was out on GitHub while `latest` still pointed at 12.11.2. The pin is exact, so the standard can name any published version, whatever `latest` says.
- **pnpm 12.13.0 needs its install script.** Its `pnpm` file is a placeholder the script swaps for the native binary, so an installer that skips scripts runs it through Node, or fails. Install the global pnpm from its GitHub release, as mise's default source does, not from npm.
- **npm's latest and pnpm's wait disagreed for a day.** The survey called a version drift that pnpm's one-day wait wouldn't install yet, so nobody could fix it. drift now compares with ship, not npm, and `pnpm align` moves ship with pnpm itself, so the wait is pnpm's rule and not a copy of it.
- **A catalog entry nothing uses is left alone.** pnpm accepts one, but `pnpm update --latest` never moves it, so `pnpm align` resolves those with `pnpm add --lockfile-only` in an empty folder with ship's settings.
- **Some script names never run.** `pnpm deploy`, `audit`, `publish` and `ci` are pnpm's own commands, so a script by one of those names is skipped. That's why the deploy script is `ship`.
- **`npx` refuses to run where `devEngines` names pnpm.** Use `pnpm exec` for an installed tool, and `pnpm dlx` for one that isn't.
- **A list of exceptions to the wait needed an edit on every release.** pnpm rewrote `minimumReleaseAgeExclude` on install, in a form `vp check` rejects. The wait is on everywhere with `@amitkaps/*` excluded, a pattern pnpm keeps, so a release changes nothing.
- **Turning the wait back on failed a lockfile that had skipped it.** `pnpm install` passed, but the frozen install CI runs checks each locked version against the wait. Run `pnpm install --frozen-lockfile` locally before pushing a change to these settings.

## Vite+

- **`vp check` is the whole check.** Type-aware lint with `typeCheck: true` reports compiler errors too, so it replaces `tsc`, with no `typescript` dependency. `vp check --fix` writes the fixes, so there's no `vp fix`, and no separate lint and format steps.
- **The editor formatted with a different oxfmt from `check`.** User settings pointed VS Code's oxc extension at a global oxfmt and a deleted config. Without them, the extension finds `vite-plus` and runs `vp fmt --lsp`. So there's no global oxfmt to pin, and each repository commits the `.vscode/` settings Vite+ writes.
- **With no `fmt` block, `vp fmt` prints "No config found".** An empty `fmt: {}` keeps the defaults and drops the notice.
- **A framework needs steps around `vp check`.** SvelteKit generates types that `svelte-kit sync` and `wrangler types` write first, and oxlint doesn't type-check `.svelte` files, so `svelte-check` runs after. The standard holds `check` to running `vp check`, not to being only that.
- **Moving between toolchains needs a fresh lockfile.** A lockfile keeps the optional peers it already resolved, so remove `node_modules` and `pnpm-lock.yaml` before installing.

## The survey

- **The Cloudflare build can't see the other repositories.** Workers Builds clones only this one, so the survey reads the others from GitHub's `main`. An outage shows in the table rather than failing the build.
- **Checking versions found drift the setup checks missed.** prose asked for Node 24, had no Vite+ override, and two repositories were behind on markz. A version nobody looks at since it was set drifts, so the survey checks every shared one.
- **One script name ran two commands.** prose reads `build` only as its first argument, so `prose . build` built nothing in two repositories. The script is `prose` alone, and the survey checks it.
- **Reading the domains found one the config didn't name.** prose's domain was set only in the dashboard, where a deploy could drop it. Every config names its domains now, and the dashboard links them.
- **A new column can make the table scroll.** Look at the page at a laptop's width after adding a repository.

- **A rule said in two places drifts in one.** The standard said a rule in words and the survey said it again in a check's label, and the two disagreed. A rule now has an id, like markz's grammar gives its side rules: the standard states it once, as a list item that opens with the id, and `scripts/rules.ts` has only the check and the fix. A test fails if either has an id the other doesn't, and `pnpm drift` prints the id with a link to where it's stated.

## GitHub and agents

- **Bringing six repositories in line was a script nobody had written.** Each move to a new tool took six hand-made pull requests, and drift only listed them. `pnpm align` makes the edits, runs `verify` and opens the pull requests, with GitHub's settings written in the same run.
- **Five repositories protected `main` four ways.** A ruleset is one JSON document, so it lives here and `pnpm align` applies it everywhere.
- **GitHub shows anyone a public repository's branch rules, but not its merge settings.** The dashboard checks the rules, and `pnpm drift` checks the settings with `gh`'s login.
- **GitHub's rate limit looked like drift.** Logged out, 60 requests an hour turned every rule red with HTTP 403. drift uses `gh`'s login when it can, and a check the limit stopped says it wasn't made.
- **Dependabot duplicated what moves from here.** It can't move the Vite+ override with Vite+, and every npm pull request it opened was closed. The survey checks the actions' versions, and Dependabot is gone.
- **A lesson named a private repository.** It reached the docs, a commit and a pull request before it was caught, and GitHub keeps the old text. `AGENTS.md` now says never to name one, anywhere this repository reaches.
- **Copied rules drift.** The `@prose` rules had started to differ across four `AGENTS.md` files. Each links to the one copy in prose's docs, and the survey checks the section word for word.

## Releases

- **Three copies of one release workflow had drifted.** Each staged differently, and only one had labels or a size budget. The workflow names no package now, so one file is copied everywhere and checked word for word.
- **publint needn't be a separate step.** `vp pack` runs it with `publint: { strict: true }` and fails the build on a problem. It needs `publint` installed.
- **A summary in an annotated tag can't be reviewed.** It's the description of the pull request that bumps the version, reviewed like any change, and the workflow reads it from the merged commit.
- **Supporting an older Node than we build on took a workaround.** pnpm won't run on a Node older than `devEngines`, so testing on 24 meant switching Node after the install. With no users on 24, `engines` became `>=26`. If a package gains some, that job is how to test it.
- **Pushing a tag by hand was the step that went wrong.** A branch named `v0.4.0` made the tag's push ambiguous. The workflow tags the merged commit itself, the bump branch is `release-X.Y.Z`, and npm's 2FA approval is the one step by hand. `pnpm release` opens the pull request with the owner's login, since GitHub runs no CI on one a workflow's token opens.
- **Bundling our own packages removes the release order.** A package with markz as a dev dependency puts it in `dist/`, so it depends on nothing at install and releases at any time.
- **A label checked at release time is checked too late.** prose's v0.5.0 notes were all Other until the labels were added by hand. A package's `ci` fails without exactly one label, and every `AGENTS.md` says which to pass to `gh pr create`.

## New repositories

- **A tool had to explain itself away.** A repository of scripts has nothing to serve, but drift wanted a `dev` and a `build`, and its docs said why it had none. A rule a repository argues against in its docs is the standard's gap, so a tool is now a kind of its own.
- **A generator copies the standard, so it's tested against it.** `pnpm test` runs the survey and `verify` on what `pnpm new` writes. Its first run showed oxfmt formats arrays differently from `JSON.stringify`, so the generator runs `fix` rather than copying oxfmt's rules.
- **Types for a package came from three places.** `vp pack` needed `typescript` installed, or `isolatedDeclarations` in `tsconfig.json`, which the editor then applied to tests and config, and which `vp check` doesn't check. `dts: { generator: "oxc" }` in the pack block applies it only to what's packed, and a missing type still fails the pack.
- **pagez was the first repository `pnpm new` started.** CI passed on the first push. Run it without `--push` first, to read the files before they reach GitHub. A package's first push changes `package.json`, so the release workflow stops for a package npm doesn't have yet.

## Cloudflare

- **An internal site leaks through `workers.dev`.** Access covers a domain, not a Worker, so its `workers.dev` address and preview URLs serve the site to anyone. An internal site turns both off in its config, and the survey checks them.
- **`private` in `package.json` already meant something.** It means "not on npm", and ship is `private` with a public site. Whether a site is internal comes from the repository's visibility, and its config says so where it takes effect.
- **The Git integration deploys whether or not CI passed.** A build command of `pnpm run verify` fails first, so nothing deploys.
- **The Worker's settings can be written with cf.** cf's config has no field for the build commands, but `cf builds triggers` sets them and `NODE_VERSION`, so `pnpm align` writes them. Set `NODE_VERSION` on every Worker: the integration reads pnpm's version from the repository but not Node's. It installs dependencies itself, so the build command doesn't.
- **Reconnecting a repository resets the Worker's build settings.** The commands, `NODE_VERSION`, the cache and previews went back to the defaults. Run `pnpm align` after any reconnect.
- **cf has no command to rename a Worker, but the dashboard does.** Settings → General → Name keeps its ID, Git connection and domains. Rename it there first, then in the config, since a new name in the config deploys a new Worker.
- **The config lists the Worker's domains.** Change one in the dashboard and the config together, so a deploy can't put the old one back.
- **cf needs `CLOUDFLARE_ACCOUNT_ID` when the login has several accounts.** drift and align pick the account named like the GitHub owner. A `pnpm ship` by hand doesn't, so set it there.
- **A prose site reaches cf through Vite.** cf's config has no assets folder, so cf couldn't deploy one that Vite didn't build. Vite takes `.prose` as its `publicDir`, and the plugin with `assetsOnly` writes it out for `cf deploy --prebuilt`. ship ran this way for two days before markz, prose and sitez moved off wrangler.
- **The plugin already did what ship's empty entry did.** Vite won't build without an entry, so ship gave it an empty one. The plugin does the same when there's no `index.html`. Read a workaround's reason against the tool's current release before copying it.
- **cf can't deploy SvelteKit yet.** The adapter doesn't write cf's Build Output, so base stays on wrangler, with `wrangler.toml`, since prose reads comments in TOML but not JSONC.
- **The Vite plugin's `beta` tag isn't the build to take.** It can point at a build inside pnpm's wait. Take the newest `2.0.0-beta.sha-…` past the wait that depends on the same `@cloudflare/config` as cf, read with `pnpm view <package>@<version> dependencies`.
- **Void deploys a folder in one command, on more machinery than a folder needs.** It installs 304 packages, a database toolkit and its own state. Tried as of void 1.1.11 and left, since Vite and the plugin already do the job.
- **A build machine is slower than a laptop.** A timing test in markz passed locally and in CI, then stopped a deploy on Cloudflare's machine, since the build command is `verify`. A timing test takes the best of several runs, after warming up, on inputs big enough to measure.

## Docs

- **prose builds the last commit, not the working tree.** A new doc is missing from the site until it's committed. Commit before building to see it, as the Cloudflare build does.
- **A page from the build fits in prose as a doc with a hole in it.** ship's dashboard is `docs/dashboard.md`, with an empty `{@section}` for each table that a script fills after `prose build`, so it has prose's bar and styles, with no renderer of its own. A section's id can't be a heading's, and markz warns `duplicate-id` when it is.
- **A copy of a tool's layout breaks when the tool moves.** The dashboard sized itself with prose's `--docked`, which prose renamed. It keeps only what's its own now, and takes the rest, like the status colours, from prose's tokens.
- **A hand-written `.html` page ships its comments.** Vite doesn't strip them, so such a page carries no prose.
- **A copy of the standard goes stale where it's copied.** Development docs described settings the standard had moved past, and READMEs pinned versions. `development.md` links the standard for anything shared, and a plan lists only its own repository's steps.
- **prose's check found only text nobody meant to be right.** Its warnings were on test corpora and fixtures that are wrong on purpose. Mark those `linguist-vendored`, which prose skips.
