import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const origin = process.argv[2] ?? "http://127.0.0.1:4392";
const baseline = process.argv.includes("--before");
const output = `tests/evidence/regions-2026-10-24${baseline ? "-before" : ""}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1280, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(origin);
    await page.locator("[data-cell]").first().waitFor();
    assert.equal(await page.locator("[data-cell]").count(), 81, "fresh session defaults to classic 9×9");
    for (const variant of ["classic", "mini"]) {
      if (variant === "mini") {
        await page.locator('button[data-action="new"]:visible').first().click();
        await page.locator('label.choice-card').filter({ has: page.locator('input[value="mini"]') }).click();
        await page.getByRole("button", { name: "Create puzzle", exact: true }).click();
      }
      const size = variant === "classic" ? 9 : 6;
      const rows = variant === "classic" ? 3 : 2;
      assert.equal(await page.locator("[data-cell]").count(), size * size);
      for (const theme of ["parchment", "midnight"]) {
        await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
        const data = await page.locator(".board").evaluate((board) => {
          const cells = [...board.querySelectorAll(".cell")];
          return { right: cells.filter(c => c.classList.contains("box-right")).length,
            bottom: cells.filter(c => c.classList.contains("box-bottom")).length,
            rules: cells.filter(c => c.classList.contains("box-right") || c.classList.contains("box-bottom")).every(c => getComputedStyle(c).boxShadow.includes("3px")),
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        assert.equal(data.right, (size / 3 - 1) * size);
        assert.equal(data.bottom, (size / rows - 1) * size);
        if (!baseline) assert.ok(data.rules, "region rules must be rendered");
        assert.equal(data.overflow, false);
        await page.locator(".board").screenshot({ path: `${output}/${width}-${variant}-${theme}.png` });
        results.push({ width, variant, theme, ...data });
      }
    }
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(`${output}/result.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
