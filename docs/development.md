# Development

How this repository is built and changed. What every repository shares is in [the standard](standard.md), and isn't repeated here.

## Changing the standard

A change to how things are done starts here: in the config, in [the standard](standard.md) and, when it can be checked, in [scripts/survey.ts](../scripts/survey.ts). `pnpm drift` then lists the repositories to bring in line, each with its own pull request. What the change taught goes in [the lessons](lessons.md), in the same pull request.

## The scripts

The scripts keep the repositories in step, and run with Node, so there's no build. [scripts/](../scripts/README.md) says what each one does.

## The site

The home page is `index.html`, with the survey's tables written in at build time, and `404.html`. The build also renders `docs/` with markz, so the standard reads at `ship.amitkaps.com/docs/standard.md`, and a bar on every page links the docs in their `nav` order ([scripts/docs.ts](../scripts/docs.ts)). `pnpm dev` renders a doc on each request, so it reads as it's written. All the pages share `style.css`.

The Worker `ship` is connected to this repository, and each push to `main` builds and deploys it. Its dashboard settings are the ones every Worker has, listed in [the standard](standard.md#cloudflare).

## Beta packages

Two packages are still beta. Check them with `pnpm view <name> dist-tags`.

| Package                   | Pinned                     | Status (2026-10-09)                 | Done when                      |
| ------------------------- | -------------------------- | ----------------------------------- | ------------------------------ |
| `@cloudflare/vite-plugin` | `2.0.0-beta.sha-91c870c02` | `beta` tag only; `latest` is 1.63.1 | `latest` is a 2.x release      |
| `cf`                      | `1.0.0-beta.14`            | `latest` is the beta                | `latest` is a non-beta release |

When a package graduates, update the pins in `package.json` and the table above. Then run `pnpm run verify` and a deploy from the Git-connected Worker before you rely on it.
