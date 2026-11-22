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

const pwaAssets = [
  "/manifest.webmanifest",
  "/sw.js",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
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

async function signIn(email, password) {
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginResponse.ok) {
    throw new Error(`Demo sign-in failed for ${email} with status ${loginResponse.status}. Run npm run db:seed first.`);
  }
  const cookieHeaders = typeof loginResponse.headers.getSetCookie === "function"
    ? loginResponse.headers.getSetCookie()
    : [loginResponse.headers.get("set-cookie") ?? ""];
  const sessionCookieHeader = cookieHeaders.find((header) => header.startsWith("graintrace_session="));
  const sessionValue = sessionCookieHeader?.match(/graintrace_session=([^;]+)/)?.[1];
  if (!sessionValue) {
    throw new Error(`Demo sign-in for ${email} did not return a session cookie.`);
  }
  return {
    name: "graintrace_session",
    value: sessionValue,
    url: baseUrl,
    httpOnly: true,
    sameSite: "Lax",
  };
}

try {
  const sessionCookie = await signIn("owner@graintrace.local", "Owner!2026");

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
      mobileTriggerVisible: (() => {
        const trigger = document.querySelector('[aria-label="Open navigation"]');
        return trigger ? getComputedStyle(trigger).display !== "none" : false;
      })(),
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

  const salesmanCookie = await signIn("salesman@graintrace.local", "Sales!2026");
  const salesmanViewports = viewports.filter((viewport) => viewport.width <= 1024);
  for (const viewport of salesmanViewports) {
    const page = await browser.newPage();
    await page.setCookie(salesmanCookie);
    const errors = [];
    watchConsole(page, `salesman-${viewport.label}`, errors);
    await page.setViewport({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/orders`, { waitUntil: "networkidle0", timeout: 30000 });

    const metrics = await page.evaluate(() => ({
      heading: document.querySelector("h1")?.textContent?.trim() ?? "",
      text: document.body.textContent ?? "",
      ...(() => {
        const uncontained = Array.from(document.querySelectorAll("main *"))
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
          }));
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          uncontained,
        };
      })(),
    }));

    if (metrics.scrollWidth > metrics.clientWidth + 1) {
      failures.push(
        `salesman-${viewport.label}: mobile orders overflow horizontally (${metrics.scrollWidth} > ${metrics.clientWidth}) uncontained=${JSON.stringify(metrics.uncontained)}`,
      );
    }
    if (!metrics.heading.includes("Orders, one hand at a time")) {
      failures.push(`salesman-${viewport.label}: mobile order console heading missing`);
    }
    if (!metrics.text.includes("LOCAL QUEUE") || !metrics.text.includes("Sync now")) {
      failures.push(`salesman-${viewport.label}: offline queue controls missing`);
    }
    if (screenshotDir) {
      await page.screenshot({
        path: join(screenshotDir, `salesman-orders-${viewport.width}.png`),
        fullPage: true,
      });
    }
    failures.push(...errors);
    await page.close();
  }

  for (const viewport of viewports) {
    const page = await browser.newPage();
    const errors = [];
    watchConsole(page, `offline-${viewport.label}`, errors);
    await page.setViewport({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/offline`, { waitUntil: "networkidle0", timeout: 30000 });
    const metrics = await page.evaluate(async () => {
      const assets = await Promise.all(
        ["/manifest.webmanifest", "/sw.js", "/icons/icon-192.png", "/icons/icon-512.png"].map(async (path) => {
          const response = await fetch(path);
          return { path, ok: response.ok };
        }),
      );
      return {
        heading: document.querySelector("h1")?.textContent?.trim() ?? "",
        text: document.body.textContent ?? "",
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        assets,
      };
    });
    if (!metrics.heading.includes("You are offline")) {
      failures.push(`offline-${viewport.label}: fallback heading missing`);
    }
    if (!metrics.text.includes("LOCAL QUEUE")) {
      failures.push(`offline-${viewport.label}: local queue panel missing`);
    }
    if (metrics.scrollWidth > metrics.clientWidth + 1) {
      failures.push(
        `offline-${viewport.label}: fallback overflows horizontally (${metrics.scrollWidth} > ${metrics.clientWidth})`,
      );
    }
    for (const asset of metrics.assets) {
      if (!asset.ok) failures.push(`offline-${viewport.label}: PWA asset ${asset.path} unavailable`);
    }
    if (screenshotDir) {
      await page.screenshot({ path: join(screenshotDir, `offline-${viewport.width}.png`), fullPage: true });
    }
    failures.push(...errors);
    await page.close();
  }

  const routePage = await browser.newPage();
  await routePage.setCookie(sessionCookie);
  const routeErrors = [];
  let allowExpected404 = false;
  let currentRoute = "";
  routePage.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    const location = message.location();
    if (message.text().includes("404") && allowExpected404) {
      return;
    }
    routeErrors.push(`routes ${currentRoute}: ${message.text()} ${location.url ?? ""}`);
  });
  routePage.on("pageerror", (error) => {
    routeErrors.push(`routes ${currentRoute}: ${error.message}`);
  });
  await routePage.setViewport({ width: 1440, height: 900 });

  for (const route of routeChecks) {
    currentRoute = route.path;
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

  const publicOfflineResponse = await fetch(`${baseUrl}/offline`);
  if (!publicOfflineResponse.ok) {
    failures.push(`/offline: public fallback returned ${publicOfflineResponse.status}`);
  }
  const manifest = await (await fetch(`${baseUrl}/manifest.webmanifest`)).json();
  if (!Array.isArray(manifest.icons) || !manifest.icons.some((icon) => icon.sizes === "512x512")) {
    failures.push("/manifest.webmanifest: missing 512x512 install icon");
  }
  for (const asset of pwaAssets) {
    const response = await fetch(`${baseUrl}${asset}`);
    if (!response.ok) {
      failures.push(`${asset}: PWA asset returned ${response.status}`);
    }
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Responsive checks passed at 375px, 768px, 1024px, and 1440px. Mobile offline console, PWA assets, public fallback, and ${routeChecks.length} route checks passed.\n`,
);
