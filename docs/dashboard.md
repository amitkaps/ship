# Dashboard

How far each repository has drifted from [the standard](standard.md), as of the site's last deploy. `pnpm drift` prints the same checks, and [usage](usage.md#checking) says how to read them.

Each column is a repository, as it is on `main`. A check that passes is green, one that has drifted is red with what's off, and a held one is amber with the reason the tool can't follow yet.

## Checks

{@section #checks-table}
The build writes the checks here. Run `pnpm dashboard` after `pnpm prose build` to see them.
{/section}

## Scripts

Every script by name, the shared ones first, so a name that means different things in two repositories is easy to spot.

{@section #scripts-table}
The build writes the scripts here.
{/section}

```=html
<style>
  :is(#checks-table, #scripts-table) {
    width: min(var(--wide), calc(100cqw - var(--docked) - 2 * var(--side)));
    max-width: none;
    overflow-x: auto;
    font-size: var(--text-s);
    & table {
      display: table;
      table-layout: fixed;
      width: 100%;
      min-width: 56rem;
      max-width: none;
    }
    & col.ask {
      width: 12rem;
    }
    & th,
    & td {
      vertical-align: top;
    }
    & th:first-child {
      position: sticky;
      left: 0;
      z-index: 1;
      background: var(--paper);
    }
    & th small {
      display: block;
      font-weight: normal;
      color: var(--muted);
      white-space: normal;
    }
    & tbody th {
      white-space: nowrap;
    }
    & .group th {
      color: var(--muted);
      font-size: var(--text-xs);
      font-weight: normal;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    & td ul {
      margin: 0;
      padding-left: 1.1em;
    }
    & code span {
      white-space: nowrap;
    }
    & .na,
    & .why {
      color: var(--muted);
    }
    & .ok {
      color: light-dark(oklch(0.5 0.13 148), oklch(0.75 0.14 148));
    }
    & .bad {
      color: light-dark(oklch(0.5 0.17 27), oklch(0.78 0.12 27));
      background: light-dark(oklch(0.96 0.02 27), oklch(0.27 0.03 27));
    }
    & .held {
      color: light-dark(oklch(0.5 0.11 75), oklch(0.8 0.12 85));
      background: light-dark(oklch(0.96 0.03 85), oklch(0.27 0.03 85));
    }
  }
</style>
```
