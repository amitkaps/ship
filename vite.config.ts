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
import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { survey } from "./scripts/survey.ts";
import { tables } from "./scripts/tables.ts";
import { bar, pages } from "./scripts/docs.ts";

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
 * # The docs
 *
 * [scripts/docs.ts](scripts/docs.ts) renders `docs/` with markz, and the build adds the pages
 * to what Cloudflare serves, beside the two pages Vite builds. The dev server renders them on
 * each request, so a doc reads as it's written. Every page, the home page too, opens with the
 * bar that links the docs.
 */
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
      name: "docs",
      transformIndexHtml: (html) => html.replace("__BAR__", bar()),
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const page = pages(commit).find((p) => p.address === req.url?.split(/[?#]/)[0]);
          if (!page) return next();
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(page.html);
        });
      },
      generateBundle() {
        for (const { fileName, html } of pages(commit)) {
          this.emitFile({ type: "asset", fileName, source: html });
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
