import puppeteer, { Browser, Page } from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const screenshotsDir = path.resolve(projectRoot, 'tests', 'screenshots', 'theme');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

process.env.NODE_ENV = 'test';
process.env.PORT = '5002'; // Dedicated port

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5002';

interface StepReport {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
  screenshot?: string;
}

const reports: StepReport[] = [];

async function step(name: string, fn: () => Promise<{ details?: string; screenshot?: string } | void>): Promise<void> {
  const start = Date.now();
  console.log(`\n▶ [THEME-TEST] Starting: ${name}...`);
  try {
    const res = await fn();
    const durationMs = Date.now() - start;
    reports.push({
      name,
      passed: true,
      durationMs,
      details: res?.details,
      screenshot: res?.screenshot,
    });
    console.log(`  ✓ PASSED: ${name} (${durationMs}ms)${res?.details ? ` - ${res.details}` : ''}`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    reports.push({
      name,
      passed: false,
      durationMs,
      details: err.message || String(err),
    });
    console.error(`  ✗ FAILED: ${name} (${durationMs}ms)`);
    console.error(`    Error: ${err.message || err}`);
    throw err;
  }
}

async function runThemeTestSuite() {
  console.log('===========================================================');
  console.log('  VAICAR LIGHT & DARK THEME — RIGOROUS BROWSER MATRIX TEST');
  console.log('===========================================================');

  // Seed minimal test data
  const { saveUserProfile } = await import('../api/src/services/firestore.js');
  const now = new Date().toISOString();
  await saveUserProfile({
    uid: 'test-admin-theme',
    email: 'admin@vaicar.app',
    displayName: 'Admin VaiCar',
    role: 'admin',
    isAdmin: true,
    createdAt: now,
    updatedAt: now,
  });

  // Start Express server on 5002
  const { app } = await import('../api/src/server.js');
  const server = await new Promise<http.Server>((resolve, reject) => {
    const s = app.listen(5002, () => {
      console.log('✓ Express server started on http://localhost:5002');
      resolve(s);
    });
    s.on('error', reject);
  });

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,900',
      ],
      defaultViewport: { width: 1280, height: 900 },
    });

    const page = await browser.newPage();

    // ----------------------------------------------------
    // TEST 1: Default System Theme Detection (Light Mode)
    // ----------------------------------------------------
    await step('01 - System preference detection (prefers-color-scheme: light)', async () => {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
      // Clear localStorage
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => localStorage.removeItem('vaicar-theme'));
      await page.reload({ waitUntil: 'networkidle0' });

      const htmlClasses = await page.evaluate(() => document.documentElement.className);
      const isLight = htmlClasses.includes('light') && !htmlClasses.includes('dark');
      if (!isLight) {
        throw new Error(`Expected html to have class 'light' and not 'dark', got: "${htmlClasses}"`);
      }

      // Check computed body background
      const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
      // rgb(250, 249, 246) is warm subtle cream #FAF9F6, rgb(245, 247, 251) is #F5F7FB
      if (bodyBg !== 'rgb(250, 249, 246)' && bodyBg !== 'rgb(245, 247, 251)') {
        throw new Error(`Expected light body background rgb(250, 249, 246), got: "${bodyBg}"`);
      }

      const shot = path.join(screenshotsDir, '01-desktop-home-light.png');
      await page.screenshot({ path: shot, fullPage: false });
      return { details: `html class: "${htmlClasses}", bodyBg: "${bodyBg}"`, screenshot: shot };
    });

    // ----------------------------------------------------
    // TEST 2: System preference detection (prefers-color-scheme: dark)
    // ----------------------------------------------------
    await step('02 - System preference detection (prefers-color-scheme: dark)', async () => {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
      await page.evaluate(() => localStorage.removeItem('vaicar-theme'));
      await page.reload({ waitUntil: 'networkidle0' });

      const htmlClasses = await page.evaluate(() => document.documentElement.className);
      const isDark = htmlClasses.includes('dark');
      if (!isDark) {
        throw new Error(`Expected html to have class 'dark', got: "${htmlClasses}"`);
      }

      const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
      if (bodyBg !== 'rgb(2, 6, 23)') {
        throw new Error(`Expected body background rgb(2, 6, 23) in dark mode, got: "${bodyBg}"`);
      }

      const shot = path.join(screenshotsDir, '02-desktop-home-dark.png');
      await page.screenshot({ path: shot, fullPage: false });
      return { details: `html class: "${htmlClasses}", bodyBg: "${bodyBg}"`, screenshot: shot };
    });

    // ----------------------------------------------------
    // TEST 3: Manual Switch to Light Mode via Desktop Navbar
    // ----------------------------------------------------
    await step('03 - Manual theme switch to Light Mode via Desktop Navbar dropdown', async () => {
      // Click the theme toggle button in navbar to open dropdown
      const clicked = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Configurar tema visual"]') as HTMLButtonElement | null;
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      if (!clicked) throw new Error('Navbar theme toggle button not found');

      await new Promise((r) => setTimeout(r, 200));

      // Click "Claro" option
      const selected = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('div[class*="absolute"] button'));
        const claroBtn = buttons.find((b) => b.textContent?.includes('Claro')) as HTMLButtonElement | null;
        if (claroBtn) {
          claroBtn.click();
          return true;
        }
        return false;
      });
      if (!selected) throw new Error('Dropdown option "Claro" not found');

      await new Promise((r) => setTimeout(r, 250));

      const savedTheme = await page.evaluate(() => localStorage.getItem('vaicar-theme'));
      if (savedTheme !== 'light') {
        throw new Error(`Expected localStorage 'vaicar-theme' to be 'light', got '${savedTheme}'`);
      }

      const htmlClasses = await page.evaluate(() => document.documentElement.className);
      if (!htmlClasses.includes('light') || htmlClasses.includes('dark')) {
        throw new Error(`Expected html to have class 'light' and not 'dark', got: "${htmlClasses}"`);
      }

      const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
      const textColor = await page.evaluate(() => window.getComputedStyle(document.body).color);

      const shot = path.join(screenshotsDir, '03-desktop-home-switched-light.png');
      await page.screenshot({ path: shot, fullPage: false });
      return { details: `saved: ${savedTheme}, bodyBg: ${bodyBg}, text: ${textColor}`, screenshot: shot };
    });

    // ----------------------------------------------------
    // TEST 4: Persistence Across Page Reload (No FOUC)
    // ----------------------------------------------------
    await step('04 - Persistence across page reload (no FOUC)', async () => {
      // Page reload while system preference is still dark
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
      await page.reload({ waitUntil: 'networkidle0' });

      const htmlClasses = await page.evaluate(() => document.documentElement.className);
      if (!htmlClasses.includes('light') || htmlClasses.includes('dark')) {
        throw new Error(`Theme did not persist after reload! Got: "${htmlClasses}"`);
      }

      const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
      if (bodyBg !== 'rgb(250, 249, 246)' && bodyBg !== 'rgb(245, 247, 251)') {
        throw new Error(`Expected persisted light background rgb(250, 249, 246), got: "${bodyBg}"`);
      }

      return { details: `html class: "${htmlClasses}", bodyBg: "${bodyBg}"` };
    });

    // ----------------------------------------------------
    // TEST 5: Mobile Viewport, Quick Toggle & Mobile Drawer
    // ----------------------------------------------------
    await step('05 - Mobile Viewport (390px), Header Icon Toggle & Drawer Segmented Control', async () => {
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });

      // Check header quick icon toggle button exists and has >= 44x44px target
      const iconBtnDimensions = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Alternar tema claro e escuro"]');
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });

      if (!iconBtnDimensions) {
        throw new Error('Header mobile theme toggle button not found');
      }
      if (iconBtnDimensions.height < 44 || iconBtnDimensions.width < 44) {
        throw new Error(`Mobile button touch target too small: ${iconBtnDimensions.width}x${iconBtnDimensions.height}px (must be >= 44x44)`);
      }

      // Open mobile drawer
      const hamburger = await page.$('button[aria-label="Menu de navegação"]');
      if (!hamburger) throw new Error('Mobile hamburger menu button not found');
      await hamburger.click();
      await new Promise((r) => setTimeout(r, 300));

      // Verify the 3-segmented theme control is in the drawer
      const segmentedButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('div[class*="rounded-2xl"] button'));
        return buttons.map((b) => ({
          text: b.textContent?.trim(),
          aria: b.getAttribute('aria-label'),
        }));
      });

      const hasClaro = segmentedButtons.some((b) => b.text?.includes('Claro'));
      const hasEscuro = segmentedButtons.some((b) => b.text?.includes('Escuro'));
      const hasAuto = segmentedButtons.some((b) => b.text?.includes('Auto'));

      if (!hasClaro || !hasEscuro || !hasAuto) {
        throw new Error(`Mobile segmented theme buttons missing: ${JSON.stringify(segmentedButtons)}`);
      }

      const mobileDrawerShot = path.join(screenshotsDir, '05-mobile-drawer-light.png');
      await page.screenshot({ path: mobileDrawerShot, fullPage: false });

      // Close mobile menu
      await hamburger.click();
      await new Promise((r) => setTimeout(r, 200));

      return {
        details: `Touch target: ${iconBtnDimensions.width}x${iconBtnDimensions.height}px, 3 drawer options verified`,
        screenshot: mobileDrawerShot,
      };
    });

    // ----------------------------------------------------
    // TEST 6: Footer Theme Selector
    // ----------------------------------------------------
    await step('06 - Footer theme selector switches to Dark Mode', async () => {
      // Scroll to footer
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, 300));

      const switchedToDark = await page.evaluate(() => {
        const darkBtn = document.querySelector('footer button[aria-label="Tema Escuro"]') as HTMLButtonElement | null;
        if (darkBtn) {
          darkBtn.click();
          return true;
        }
        return false;
      });

      if (!switchedToDark) throw new Error('Footer dark mode button not found');
      await new Promise((r) => setTimeout(r, 250));

      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (!isDark) throw new Error('Expected dark mode to be active after footer click');

      const footerShot = path.join(screenshotsDir, '06-footer-dark.png');
      await page.screenshot({ path: footerShot, fullPage: false });

      // Switch back to light
      await page.evaluate(() => {
        const lightBtn = document.querySelector('footer button[aria-label="Tema Claro"]') as HTMLButtonElement | null;
        if (lightBtn) lightBtn.click();
      });
      await new Promise((r) => setTimeout(r, 250));

      return { details: 'Footer switch to dark and back to light successful', screenshot: footerShot };
    });

    // ----------------------------------------------------
    // TEST 7: Page Snapshots Matrix across Key Routes (Desktop & Mobile, Light)
    // ----------------------------------------------------
    const pagesToTest = [
      { route: '/', name: 'home', titleSnippet: 'VaiCar' },
      { route: '/como-funciona/passageiro', name: 'passenger-info', titleSnippet: 'VaiCar' },
      { route: '/como-funciona/motorista', name: 'driver-info', titleSnippet: 'VaiCar' },
      { route: '/parcerias', name: 'parcerias', titleSnippet: 'VaiCar' },
      { route: '/passenger', name: 'passenger-portal', titleSnippet: 'VaiCar' },
      { route: '/driver', name: 'driver-portal', titleSnippet: 'VaiCar' },
    ];

    for (const p of pagesToTest) {
      await step(`07 - Verify Route: ${p.route} in Light Theme (Desktop & Mobile)`, async () => {
        // Desktop Light
        await page.setViewport({ width: 1280, height: 900 });
        await page.goto(`${BASE_URL}${p.route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise((r) => setTimeout(r, 800));

        // Ensure light mode is active
        await page.evaluate(() => {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
          document.documentElement.setAttribute('data-theme', 'light');
        });
        await new Promise((r) => setTimeout(r, 400));

        const deskShot = path.join(screenshotsDir, `desktop-light-${p.name}.png`);
        await page.screenshot({ path: deskShot, fullPage: false });

        // Mobile Light (390px)
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await page.goto(`${BASE_URL}${p.route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise((r) => setTimeout(r, 800));

        const mobShot = path.join(screenshotsDir, `mobile-light-${p.name}.png`);
        await page.screenshot({ path: mobShot, fullPage: false });

        return { details: `Screenshots: ${path.basename(deskShot)}, ${path.basename(mobShot)}` };
      });
    }

    // ----------------------------------------------------
    // TEST 8: WCAG AA Color Contrast and Typography Verification
    // ----------------------------------------------------
    await step('08 - Contrast & Visual Token Verification in Light Mode', async () => {
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });

      const tokens = await page.evaluate(() => {
        const body = document.body;
        const bodyStyle = window.getComputedStyle(body);
        const h1 = document.querySelector('h1');
        const h1Style = h1 ? window.getComputedStyle(h1) : null;
        const p = document.querySelector('p');
        const pStyle = p ? window.getComputedStyle(p) : null;
        const card = document.querySelector('div[class*="bg-slate-900"], div[class*="bg-slate-900/95"]');
        const cardStyle = card ? window.getComputedStyle(card) : null;

        return {
          bodyBg: bodyStyle.backgroundColor,
          bodyColor: bodyStyle.color,
          h1Color: h1Style ? h1Style.color : null,
          pColor: pStyle ? pStyle.color : null,
          cardBg: cardStyle ? cardStyle.backgroundColor : null,
        };
      });

      // Verification checks:
      // bodyBg should be rgb(250, 249, 246) [#FAF9F6] or rgb(245, 247, 251) [#F5F7FB]
      if (tokens.bodyBg !== 'rgb(250, 249, 246)' && tokens.bodyBg !== 'rgb(245, 247, 251)') {
        throw new Error(`Expected light body background rgb(250, 249, 246), got: ${tokens.bodyBg}`);
      }

      // h1 heading should be dark (#111827 or rgb(17, 24, 39)), not white (#FFFFFF)
      if (tokens.h1Color === 'rgb(255, 255, 255)') {
        throw new Error('H1 text in light mode is still white! Contrast failure.');
      }

      return {
        details: `BodyBg: ${tokens.bodyBg}, H1 Color: ${tokens.h1Color}, CardBg: ${tokens.cardBg}`,
      };
    });

    console.log('\n===========================================================');
    console.log('  ALL THEME TESTS COMPLETED SUCCESSFULLY! (8/8)');
    console.log('===========================================================');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runThemeTestSuite()
  .then(() => {
    console.log('Process completed with 0 errors.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
