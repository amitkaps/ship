/** @prose
 * # The dashboard
 *
 * Writes the survey into the dashboard page that `prose build` made from
 * [docs/dashboard.md](../docs/dashboard.md), so the live site shows how far each repository has
 * drifted as of its last deploy. The doc holds the words and an empty section for each table,
 * and this fills them, the way markz's `pnpm quality` adds its report beside the pages prose
 * built. The page keeps prose's bar, styles and contents, since prose wrote it.
 *
 * A survey that can't reach GitHub says so in the table rather than failing, since that would
 * block a deploy for a reason that has nothing to do with this repository. A page without the
 * sections does fail, since then the doc and this script have drifted apart.
 *
 * `pnpm dashboard [file]` writes `.prose/docs/dashboard.md.html` by default.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { survey } from "./survey.ts";
import { tables } from "./tables.ts";

const page = process.argv[2] ?? ".prose/docs/dashboard.md.html";
const sections = tables(await survey(), new Date());

let html = readFileSync(page, "utf8");
for (const [id, table] of Object.entries(sections)) {
  const open = `<section id="${id}">`;
  const start = html.indexOf(open);
  const end = html.indexOf("</section>", start);
  if (start < 0 || end < 0) throw new Error(`${page} has no ${open}, run pnpm prose build first`);
  html = html.slice(0, start + open.length) + table + html.slice(end);
}
writeFileSync(page, html);
console.log(`dashboard: ${page}`);
