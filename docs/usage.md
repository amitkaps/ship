# Usage

ship's site is something to read. Its commands are how it's used: checking the repositories, bringing them in line, releasing a package and starting a new repository. They run from a checkout of this repository, on `main`, after `pnpm install`. [The standard](standard.md) says what they hold each repository to, and [scripts/](../scripts/README.md) says how they work.

## Logins

The commands use the logins `gh` and `cf` already have, so there's no token to keep.

| Command        | `gh`         | `cf`                                |
| -------------- | ------------ | ----------------------------------- |
| `pnpm drift`   | optional     | optional                            |
| `pnpm align`   | needed       | optional, for the Workers' settings |
| `pnpm release` | needed       | not used                            |
| `pnpm new`     | for `--push` | not used                            |

`gh auth login` logs in to GitHub, as the owner. `pnpm exec cf auth login` logs in to Cloudflare. When the login sees more than one account, the account named like the GitHub owner is used, and `CLOUDFLARE_ACCOUNT_ID` overrides it.

## Checking

```sh
pnpm drift            # every repository
pnpm drift ../markz   # a folder from disk, to check a fix before it's pushed
```

Each repository gets a line, ✓ or ✗, with what has drifted below it. Held checks are listed with their reason and don't count. A missing login prints one `not checked:` line at the top, and the rest still runs. It exits 1 when anything has drifted.

drift only reads, so it's safe to run any time.

## Bringing in line

```sh
pnpm align            # this repository first, then every other one
pnpm align markz      # one repository, against this one as it is
```

align moves this repository's versions to the newest releases within their majors, then brings every other repository in line with it. Each repository gets a pull request titled "Align with ship", opened only when its `verify` passes, with auto-merge on, so CI merges it. A repository already in line gets none. Its GitHub settings, and its Worker's when `cf` is logged in, are written directly.

The output has a line per repository:

- `✓` with the pull request's link, what moved, and any new major release `left for review`.
- `✗` with the reason, the log and the clone, which are kept in a temporary folder for a look.

When this repository fails, the others aren't touched, since their versions come from it. A new major is taken by hand, in a pull request here first. Running align again changes nothing that's already in line, so it's also how to retry.

## Releasing a package

```sh
pnpm release sitez 0.5.0 --notes "What this release is for."
```

It opens the pull request that sets the version, labelled `internal`, with auto-merge on. Once CI passes it merges, and the package's release workflow asks for approval before publishing to npm. Without `--notes`, the editor opens for the summary.

## Starting a repository

```sh
pnpm new <name> --package --description "What it is, in a sentence." --push
pnpm new <name> --site --description "What it is, in a sentence." --push
pnpm new <name> --tool --internal --description "What it is, in a sentence." --push
```

It writes the repository in the folder next to this one, runs its `verify` and makes the first commit. `--push` creates it on GitHub and writes its settings. It prints what's left to do by hand: adding it to `REPOS`, and connecting the Worker or setting up npm. After that, `pnpm align <name>` writes the Worker's build settings.
