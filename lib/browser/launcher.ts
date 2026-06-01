/**
 * lib/browser/launcher.ts
 *
 * Unified Playwright browser launcher that works both locally and on Vercel.
 *
 * - Local dev  : uses the full `playwright` package (chromium already installed)
 * - Vercel/prod: uses `playwright-core` + `@sparticuz/chromium` (pre-built binary)
 */

export async function launchBrowser() {
  const isVercel = !!process.env.VERCEL || process.env.NODE_ENV === "production";

  if (isVercel) {
    const chromium       = await import("@sparticuz/chromium");
    const { chromium: pw } = await import("playwright-core");

    return pw.launch({
      args:           chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless:       true,
    });
  } else {
    // Local: use the full playwright package with its own bundled chromium
    const { chromium } = await import("playwright");
    return chromium.launch({ headless: true });
  }
}
