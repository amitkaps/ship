/** @prose
 * # The build
 *
 * One Vite+ config builds the two pages and hands them to Cloudflare. Vite+ also runs the
 * format and lint checks, so the only other tool config is `tsconfig.json`, for the types. The
 * Worker itself is described in [cloudflare.config.ts](cloudflare.config.ts), not here.
 *
 * `defineConfig` comes from `vite-plus`, not `vite`, so the `fmt` and `lint` blocks below
 * type-check too.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { survey } from "./scripts/survey.ts";
import { tables } from "./scripts/tables.ts";

/** @prose
 * # The commit in the footer
 *
 * Each page shows the commit it was built from, so a glance at the live site says whether the
 * last push deployed. Workers Builds sets `WORKERS_CI_COMMIT_SHA`, and a local build says `dev`.
 */
const commit = (process.env.WORKERS_CI_COMMIT_SHA ?? "dev").slice(0, 7);

/** @prose
 * # The tables on the home page
 *
 * The build surveys every repository and writes the result into `index.html`, so the live
 * site shows how far each one has drifted, as of its last deploy. A survey that can't reach
 * GitHub says so in the table rather than failing the build, since that would block a deploy
 * for a reason that has nothing to do with this repository.
 *
 * The survey runs once per build, or once per dev server, and only for a page that asks.
 */
let drift: Promise<string> | undefined;
const driftTables = () => (drift ??= survey().then((results) => tables(results, new Date())));

/** @prose
 * # The repository as pages
 *
 * The build also runs `prose build` and adds its pages to the site, so the docs read at the same
 * addresses as prose's and markz's, like `/docs/standard.md`, and every repository can link to
 * the standard there. cf deploys only what Vite builds, so the pages go in as part of the build
 * rather than as a second folder. The home page and the 404 page stay this site's own.
 */
const OWN = ["index.html", "404.html", ".prose-build"];

const files = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)));

export default defineConfig({
  build: {
    // Vite builds only index.html unless other pages are listed as inputs.
    rollupOptions: {
      input: ["index.html", "404.html"],
    },
  },
  plugins: [
    {
      name: "commit",
      transformIndexHtml: (html) => html.replaceAll("__COMMIT__", commit),
    },
    {
      name: "drift",
      transformIndexHtml: async (html) =>
        html.includes("__DRIFT__") ? html.replace("__DRIFT__", await driftTables()) : html,
    },
    {
      name: "prose",
      apply: "build",
      generateBundle() {
        execFileSync("pnpm", ["exec", "prose", "build"], { stdio: "ignore" });
        for (const fileName of files(".prose").filter((file) => !OWN.includes(file))) {
          this.emitFile({
            type: "asset",
            fileName,
            source: readFileSync(join(".prose", fileName)),
          });
        }
      },
    },
    /** @prose
     * # Assets only
     *
     * `assetsOnly` makes the plugin write an assets-only Build Output into
     * `.cloudflare/output/`, which `cf deploy --prebuilt` uploads as it is. There's no Worker
     * code: Cloudflare serves the files, and the 404 page for a missing address.
     */
    cloudflare({ assetsOnly: true }),
  ],

  // oxfmt's defaults, as the editor has them. The empty block says so, and quiets the
  // "No config found" notice.
  fmt: {},

  /** @prose
   * # Lint, with types
   *
   * Lint is type-aware, and also type-checks against `tsconfig.json`, so `pnpm check` covers
   * format, lint and types with no separate `tsc` step. The types come from tsgolint, which
   * Vite+ installs, so there's no `typescript` dependency.
   */
  lint: {
    plugins: ["typescript", "unicorn", "import"],
    categories: { correctness: "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
