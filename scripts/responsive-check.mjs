import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3100";
const screenshotDir = process.env.SCREENSHOT_DIR;

if (screenshotDir) {
  mkdirSync(screenshotDir, { recursive: true });
}
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));

if (!executablePath) {
  process.stderr.write("No Chrome or Edge executable found. Set CHROME_PATH and retry.\n");
  process.exit(1);
}

const viewports = [
  { width: 375, height: 812, label: "375px" },
  { width: 768, height: 1024, label: "768px" },
  { width: 1024, height: 768, label: "1024px" },
  { width: 1440, height: 900, label: "1440px" },
];

const routeChecks = [
  { path: "/", expectedStatus: 200 },
  { path: "/orders?focus=SO-2481", expectedStatus: 200 },
  { path: "/production?exception=EX-0142", expectedStatus: 200 },
  { path: "/batch-dna", expectedStatus: 200 },
  { path: "/offline", expectedStatus: 200 },
  { path: "/unauthorized", expectedStatus: 200 },
  { path: "/does-not-exist", expectedStatus: 404 },
];

const failures = [];
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

function watchConsole(page, label, errors) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`${label}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`${label}: ${error.message}`);
  });
}

try {
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@graintrace.local", password: "Owner!2026" }),
  });
  if (!loginResponse.ok) {
    throw new Error(`Demo sign-in failed with status ${loginResponse.status}. Run npm run db:seed first.`);
  }

  const cookieHeaders = typeof loginResponse.headers.getSetCookie === "function"
    ? loginResponse.headers.getSetCookie()
    : [loginResponse.headers.get("set-cookie") ?? ""];
  const sessionCookieHeader = cookieHeaders.find((header) => header.startsWith("graintrace_session="));
  const sessionValue = sessionCookieHeader?.match(/graintrace_session=([^;]+)/)?.[1];
  if (!sessionValue) {
    throw new Error("Demo sign-in did not return a session cookie.");
  }

  const sessionCookie = {
    name: "graintrace_session",
    value: sessionValue,
    url: baseUrl,
    httpOnly: true,
    sameSite: "Lax",
  };

  for (const viewport of viewports) {
    const page = await browser.newPage();
    await page.setCookie(sessionCookie);
    const errors = [];
    watchConsole(page, viewport.label, errors);
    await page.setViewport({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 30000 });

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      heading: document.querySelector("h1")?.textContent?.trim() ?? "",
      mobileTriggerVisible:
        getComputedStyle(document.querySelector('[aria-label="Open navigation"]')).display !== "none",
      overflowing: Array.from(document.querySelectorAll("*"))
        .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 12)
        .map((element) => ({
          tag: element.tagName,
          className: String(element.className ?? "").slice(0, 120),
          right: Math.round(element.getBoundingClientRect().right),
          width: Math.round(element.getBoundingClientRect().width),
        })),
      uncontained: Array.from(document.querySelectorAll("main *"))
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.overflowX === "visible" && element.scrollWidth > element.clientWidth + 1;
        })
        .slice(0, 12)
        .map((element) => ({
          tag: element.tagName,
          className: String(element.className ?? "").slice(0, 120),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          parent: String(element.parentElement?.className ?? "").slice(0, 120),
          children: Array.from(element.children)
            .slice(0, 5)
            .map((child) => `${child.tagName}.${String(child.className ?? "").slice(0, 80)}`),
        })),
    }));

    if (metrics.scrollWidth > metrics.clientWidth + 1) {
      failures.push(
        `${viewport.label}: document overflows horizontally (${metrics.scrollWidth} > ${metrics.clientWidth}) uncontained=${JSON.stringify(metrics.uncontained)} overflowing=${JSON.stringify(metrics.overflowing)}`,
      );
    }
    if (!metrics.heading) {
      failures.push(`${viewport.label}: overview heading missing`);
    }
    if (viewport.width < 768 && !metrics.mobileTriggerVisible) {
      failures.push(`${viewport.label}: mobile navigation trigger hidden`);
    }
    if (viewport.width >= 768 && metrics.mobileTriggerVisible) {
      failures.push(`${viewport.label}: mobile navigation trigger unexpectedly visible`);
    }
    if (screenshotDir) {
      await page.screenshot({
        path: join(screenshotDir, `overview-${viewport.width}.png`),
        fullPage: true,
      });
    }
    failures.push(...errors);
    await page.close();
  }

  const routePage = await browser.newPage();
  await routePage.setCookie(sessionCookie);
  const routeErrors = [];
  let allowExpected404 = false;
  routePage.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    if (allowExpected404 && message.text().includes("404")) {
      return;
    }
    routeErrors.push(`routes: ${message.text()}`);
  });
  routePage.on("pageerror", (error) => {
    routeErrors.push(`routes: ${error.message}`);
  });
  await routePage.setViewport({ width: 1440, height: 900 });

  for (const route of routeChecks) {
    allowExpected404 = route.expectedStatus === 404;
    const response = await routePage.goto(`${baseUrl}${route.path}`, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    if (!response || response.status() !== route.expectedStatus) {
      failures.push(`${route.path}: unexpected status ${response?.status() ?? "none"}`);
    }
  }

  failures.push(...routeErrors);
  await routePage.close();
} finally {
  await browser.close();
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Responsive checks passed at 375px, 768px, 1024px, and 1440px. Route and console checks passed for ${routeChecks.length} routes.\n`,
);
