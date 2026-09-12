import { searchTools } from "../src/lib/tools";

const tests = [
  "merge",
  "Merge",
  "MERGE",
  "MeRgE",
  "mer",
  "spl",
  "comp",
  "pass",
  "reduc",
  "dupl",
  "word",
  "excel",
  "powerpoint",
  "image",
  "passport",
  "reduction",
  "duplex",
  "pdf merge",
  "pdf split",
  "pdf compression",
  "9 page",
  "12 page",
  "16 page",
  "pdf word",
  "ai passport",
];

for (const q of tests) {
  const res = searchTools(q);
  console.log(`${q.padEnd(16)} -> count: ${res.length.toString().padStart(2)} | ${res.slice(0, 3).map((r) => r.name).join(", ")}`);
}
