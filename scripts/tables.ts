/** @prose
 * # The tables
 *
 * Turns what [survey.ts](survey.ts) found into the two tables on the home page. The build
 * puts them where `index.html` says `__DRIFT__`, so the page stays plain HTML with no script.
 *
 * The first table has a row per check and a column per repository, the versions first and
 * then the setup. A cell shows what the repository has, like the version it pins, and what has
 * drifted. The second lists every
 * script by name, the shared ones first, so a name that means different things in two
 * repositories is easy to spot. A required script that's missing says so, and an optional one
 * that's absent is a dash.
 */
import { CHECKS, SHARED, type Result } from "./survey.ts";

const escape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// A command breaks only between words, never at the hyphen in a flag like `--watch`. A word too
// long for its column, like a beta version, is left free to break anywhere.
const code = (command: string): string =>
  `<code>${escape(command)
    .split(" ")
    .map((word) => (word.length > 20 ? word : `<span>${word}</span>`))
    .join(" ")}</code>`;

// Both tables share one set of columns, the ask and then a column per repository, so a
// repository's column lines up from one table to the next.
const head = (results: Result[], first: string): string =>
  `<colgroup><col class="ask" />${results.map(() => "<col />").join("")}</colgroup><thead><tr><th scope="col">${first}</th>${results
    .map((r) => `<th scope="col">${r.repo}</th>`)
    .join("")}</tr></thead>`;

function checkCell(result: Result, index: number): string {
  if (result.error) return `<td class="bad">${escape(result.error)}</td>`;
  const finding = result.findings[index];
  if (!finding) return `<td class="na">—</td>`;
  const value = finding.value ? ` ${code(finding.value)}` : "";
  if (finding.unchecked) return `<td class="na">Not checked: ${escape(finding.unchecked)}</td>`;
  if (!finding.drift.length) return `<td class="ok">✓${value}</td>`;
  const list = finding.drift.map((d) => `<li>${escape(d)}</li>`).join("");
  if (finding.held) {
    const why = `<p class="why">Held: ${escape(finding.held)}</p>`;
    return `<td class="held">${value.trim()}<ul>${list}</ul>${why}</td>`;
  }
  return `<td class="bad">${value.trim()}<ul>${list}</ul></td>`;
}

const group = (results: Result[], label: string): string =>
  `<tr class="group"><th colspan="${results.length + 1}" scope="rowgroup">${label}</th></tr>`;

// A group's heading goes above its first check, so versions and setup read as two sections.
function checksTable(results: Result[]): string {
  const rows = CHECKS.map(
    (check, i) =>
      `${check.group === CHECKS[i - 1]?.group ? "" : group(results, check.group)}<tr><th scope="row">${
        check.name
      }<small>${escape(check.rule)}</small></th>${results.map((r) => checkCell(r, i)).join("")}</tr>`,
  );
  return `<table>${head(results, "Check")}<tbody>${rows.join("")}</tbody></table>`;
}

// The Scripts check already decides which names are required, so a missing one is found
// in its drift rather than worked out again here.
function scriptCell(result: Result, name: string): string {
  const command = result.scripts[name];
  if (command) return `<td>${code(command)}</td>`;
  const scripts = CHECKS.findIndex((c) => c.name === "Scripts");
  if (result.findings[scripts]?.drift.includes(`no ${name} script`)) {
    return `<td class="bad">missing</td>`;
  }
  return `<td class="na">—</td>`;
}

function scriptsTable(results: Result[]): string {
  const own = [...new Set(results.flatMap((r) => Object.keys(r.scripts)))]
    .filter((name) => !SHARED.includes(name))
    .sort();
  const row = (name: string): string =>
    `<tr><th scope="row"><code>${name}</code></th>${results
      .map((r) => scriptCell(r, name))
      .join("")}</tr>`;
  return `<table>${head(results, "Script")}<tbody>${group(results, "Shared")}${SHARED.map(row).join(
    "",
  )}${group(results, "The repository's own")}${own.map(row).join("")}</tbody></table>`;
}

export function tables(results: Result[], checked: Date): string {
  const when = checked.toISOString().slice(0, 16).replace("T", " ");
  return [
    `<h2>Checks</h2>`,
    `<div class="scroll">${checksTable(results)}</div>`,
    `<h2>Scripts</h2>`,
    `<div class="scroll">${scriptsTable(results)}</div>`,
    `<p class="note">Checked ${when} UTC, from each repository's <code>main</code>.</p>`,
  ].join("\n");
}
