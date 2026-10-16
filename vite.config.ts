/** @prose
 * # The build
 *
 * One Vite+ config hands the site to Cloudflare. Vite+ also runs the format and lint checks, so
 * the only other tool config is `tsconfig.json`, for the types. The Worker itself is described
 * in [cloudflare.config.ts](cloudflare.config.ts), not here.
 *
 * `defineConfig` comes from `vite-plus`, not `vite`, so the `fmt` and `lint` blocks below
 * type-check too.
 */
import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";

/** @prose
 * # A site that's a folder
 *
 * The site is the folder `prose build` writes, with the dashboard filled in by
 * [scripts/dashboard.ts](scripts/dashboard.ts). Vite builds nothing of its own. It copies the
 * folder as its `publicDir`, and the Cloudflare plugin hands it on. cf's config has no field for
 * an assets folder, so this is how a folder reaches `cf deploy`.
 *
 * Vite won't build without an entry. With no `index.html` at the root and files in `publicDir`,
 * the plugin builds an empty one and deletes it, so only the folder's files are deployed.
 */
export default defineConfig({
  publicDir: ".prose",
  plugins: [
    /** @prose
     * # Assets only
     *
     * `assetsOnly` makes the plugin write an assets-only Build Output into
     * `.cloudflare/output/`, which `cf deploy --prebuilt` uploads as it is. There's no Worker
     * code: Cloudflare serves the files, and prose's 404 page for a missing address.
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
