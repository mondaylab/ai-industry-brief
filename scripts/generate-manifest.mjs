import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "brief-data");
const briefsDir = path.join(root, "briefs");
const outputPath = path.join(dataDir, "manifest.json");
const filePattern = /^\d{4}-\d{2}-\d{2}\.json$/;
const htmlPattern = /^(\d{4}-\d{2}-\d{2})\.html$/;

function textContent(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const files = fs.readdirSync(dataDir).filter((name) => filePattern.test(name)).sort().reverse();
const dataIssues = files.map((name) => {
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
  const items = (data.sections || []).flatMap((section) => section.items || []);
  return {
    date: data.date,
    weekday: data.weekday,
    headline: data.homepage?.headline || data.opening,
    summary: data.homepage?.summary || data.insight,
    opening: data.opening,
    sections: (data.sections || []).map((section) => section.name),
    itemCount: items.length,
    dataUrl: `brief-data/${name}`,
    legacyUrl: `briefs/${data.date}.html`,
  };
});

const dataDates = new Set(dataIssues.map((issue) => issue.date));
const legacyIssues = fs.readdirSync(briefsDir)
  .map((name) => ({ name, match: name.match(htmlPattern) }))
  .filter(({ match }) => match && !dataDates.has(match[1]))
  .map(({ name, match }) => {
    const html = fs.readFileSync(path.join(briefsDir, name), "utf8");
    const titleWeekday = html.match(/<title[^>]*>[\s\S]*?·\s*(星期[^|<]+?)(?:\s*\||<\/title>)/i)?.[1]?.trim();
    const quote = html.match(/<div class="quote-card">([\s\S]*?)<\/div>\s*<section/i)?.[1] || "";
    const opening = textContent(quote.replace(/<div class="quote-label">[\s\S]*?<\/div>/i, ""));
    return {
      date: match[1],
      weekday: titleWeekday || "往期",
      headline: opening || "早期简报",
      summary: "早期 HTML 归档",
      opening,
      sections: [],
      itemCount: null,
      legacyUrl: `briefs/${name}`,
      legacyOnly: true,
    };
  });

const issues = [...dataIssues, ...legacyIssues].sort((a, b) => b.date.localeCompare(a.date));

if (!issues.length) throw new Error("No daily brief JSON files found.");

const manifest = {
  publication: "The AI Industry Brief",
  publisher: "星期一研究室",
  generatedAt: new Date().toISOString(),
  latest: dataIssues[0].date,
  issueCount: issues.length,
  issues,
};

fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${path.relative(root, outputPath)} with ${issues.length} issues.`);
