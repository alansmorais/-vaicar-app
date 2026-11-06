import puppeteer, { Browser, Page } from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const screenshotsDir = path.resolve(projectRoot, 'web', 'src', '__tests__', 'screenshots');
const artifactScreenshotsDir = 'C:\\Users\\alanp\\.gemini\\antigravity\\brain\\ded08da4-a548-454b-ae7a-dc68adcccd41\\screenshots';

for (const dir of [screenshotsDir, artifactScreenshotsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

process.env.NODE_ENV = 'test';
process.env.PORT = '5001';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5001';

interface TestResult {
  step: string;
  url: string;
  viewport: string;
  passed: boolean;
  durationMs: number;
  errors: string[];
  consoleLogs: string[];
  screenshotPath?: string;
}

const results: TestResult[] = [];

async function capture(page: Page, filename: string): Promise<string> {
  const localPath = path.join(screenshotsDir, filename);
  const artifactPath = path.join(artifactScreenshotsDir, filename);
  await page.screenshot({ path: localPath, fullPage: false });
  try {
    fs.copyFileSync(localPath, artifactPath);
  } catch {}
  return localPath;
}

async function runVisualValidation() {
  console.log('================================================================');
  console.log('  VAICAR PLATFORM — COMPREHENSIVE VISUAL & FUNCTIONAL VALIDATION');
  console.log('  Testing Desktop, Tablet, Mobile & Complete Route Matrix');
  console.log('================================================================');

  // Start Express server
  const { app } = await import('../../../api/src/server.js');
  const server = await new Promise<http.Server>((resolve, reject) => {
    const s = app.listen(5001, () => {
      console.log('✓ Express platform server active on http://localhost:5001');
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
        '--window-size=1440,900',
      ],
      defaultViewport: { width: 1440, height: 900 },
    });
    console.log('✓ Google Chrome launched successfully via puppeteer-core\n');

    const page = await browser.newPage();

    const currentErrors: string[] = [];
    const currentLogs: string[] = [];

    page.on('console', (msg) => {
      const txt = msg.text();
      currentLogs.push(txt);
      if (msg.type() === 'error' && !txt.includes('favicon')) {
        currentErrors.push(`[CONSOLE_ERROR] ${txt}`);
      }
    });

    page.on('pageerror', (err: any) => {
      currentErrors.push(`[PAGE_ERROR] ${err?.message || String(err)}`);
    });

    page.on('requestfailed', (req) => {
      // Filter out expected missing optional assets like favicon
      if (!req.url().includes('favicon.ico')) {
        currentErrors.push(`[NET_FAILED] ${req.url()} (${req.failure()?.errorText})`);
      }
    });

    async function executeStep(
      step: string,
      route: string,
      viewport: { width: number; height: number; isMobile?: boolean },
      actions?: (p: Page) => Promise<void>,
      screenshotName?: string
    ) {
      const start = Date.now();
      currentErrors.length = 0;
      currentLogs.length = 0;
      await page.setViewport(viewport);

      console.log(`▶ Testing [${step}] ${route} (${viewport.width}x${viewport.height})...`);
      let shot: string | undefined;

      try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle0', timeout: 15000 });
        if (actions) {
          await actions(page);
        }
        if (screenshotName) {
          shot = await capture(page, screenshotName);
        }
        const duration = Date.now() - start;
        results.push({
          step,
          url: route,
          viewport: `${viewport.width}x${viewport.height}`,
          passed: currentErrors.length === 0,
          durationMs: duration,
          errors: [...currentErrors],
          consoleLogs: [...currentLogs],
          screenshotPath: shot,
        });
        if (currentErrors.length === 0) {
          console.log(`  ✓ OK (${duration}ms)`);
        } else {
          console.warn(`  ⚠ OK with ${currentErrors.length} notices (${duration}ms):`, currentErrors);
        }
      } catch (err: any) {
        const duration = Date.now() - start;
        results.push({
          step,
          url: route,
          viewport: `${viewport.width}x${viewport.height}`,
          passed: false,
          durationMs: duration,
          errors: [...currentErrors, err.message],
          consoleLogs: [...currentLogs],
          screenshotPath: shot,
        });
        console.error(`  ✗ FAILED: ${err.message} (${duration}ms)`);
      }
    }

    // 1. Desktop Homepage (1440x900)
    await executeStep(
      '01 - Desktop Homepage',
      '/',
      { width: 1440, height: 900 },
      async (p) => {
        // Verify title
        const title = await p.title();
        if (!title.includes('VaiCar')) throw new Error(`Unexpected title: ${title}`);

        // Verify key Tropical Premium cards
        const audienceCards = await p.$('#servicos-principais');
        if (!audienceCards) throw new Error('#servicos-principais not found');

        // Test FAQ accordion click via evaluate to avoid scroll/viewport issues
        await p.evaluate(() => {
          const btn = document.querySelector('#faq button') as HTMLButtonElement | null;
          if (btn) btn.click();
        });
        await new Promise((r) => setTimeout(r, 400));

        // Test simulator places
        const selects = await p.$$('.vaicar-booking-field select');
        if (selects.length < 2) throw new Error('Simulator dropdowns not found');
      },
      '01-desktop-homepage.png'
    );

    // 2. Desktop Login Modal via Entrar button
    await executeStep(
      '02 - Desktop Login Role Modal',
      '/',
      { width: 1440, height: 900 },
      async (p) => {
        // Click "Entrar" in Navbar
        await p.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const entrar = btns.find((b) => b.textContent?.trim() === 'Entrar');
          if (entrar) entrar.click();
        });
        await new Promise((r) => setTimeout(r, 500));

        // Check if modal dialog appeared
        const modal = await p.$('div[role="dialog"]');
        if (!modal) throw new Error('Role selection modal did not open on Entrar click');
      },
      '02-desktop-login-modal.png'
    );

    // 3. Tablet Homepage (768x1024)
    await executeStep(
      '03 - Tablet Homepage',
      '/',
      { width: 768, height: 1024 },
      async (p) => {
        await new Promise((r) => setTimeout(r, 500));
      },
      '03-tablet-homepage.png'
    );

    // 4. Mobile Homepage & Mobile Drawer (390x844)
    await executeStep(
      '04 - Mobile Homepage & Drawer',
      '/',
      { width: 390, height: 844, isMobile: true },
      async (p) => {
        // Click hamburger menu
        const menuBtn = await p.$('button[aria-label="Menu de navegação"]');
        if (!menuBtn) throw new Error('Mobile menu button not found');
        await menuBtn.click();
        await new Promise((r) => setTimeout(r, 500));

        // Verify drawer is visible
        const drawer = await p.$('.vaicar-mobile-drawer');
        if (!drawer) throw new Error('Mobile drawer not open');
      },
      '04-mobile-drawer.png'
    );

    // 5. How It Works (/como-funciona)
    await executeStep(
      '05 - Como Funciona',
      '/como-funciona',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('Como funciona o VaiCar')) throw new Error('Title missing on /como-funciona');
      },
      '05-desktop-how-it-works.png'
    );

    // 6. Passenger Info (/como-funciona/passageiro)
    await executeStep(
      '06 - Guia do Passageiro',
      '/como-funciona/passageiro',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('Guia do Passageiro')) throw new Error('Expected Guia do Passageiro');
      },
      '06-passenger-info.png'
    );

    // 7. Driver Requirements (/como-funciona/motorista)
    await executeStep(
      '07 - Requisitos do Motorista',
      '/como-funciona/motorista',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('R$ 100/mês')) throw new Error('Plans missing on Driver Requirements');
      },
      '07-driver-requirements.png'
    );

    // 8. Delivery Info & Waitlist (/como-funciona/entregador)
    await executeStep(
      '08 - Entregas & Courier',
      '/como-funciona/entregador',
      { width: 1440, height: 900 },
      async (p) => {
        const form = await p.$('form');
        if (!form) throw new Error('Waitlist form missing on /como-funciona/entregador');
      },
      '08-delivery-info.png'
    );

    // 9. Commercial Partnerships (/parcerias)
    await executeStep(
      '09 - Parcerias Comerciais',
      '/parcerias',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('Parcerias')) throw new Error('Title missing on /parcerias');
      },
      '09-business-partnerships.png'
    );

    // 10. Passenger Login (/passenger/login)
    await executeStep(
      '10 - Login do Passageiro',
      '/passenger/login',
      { width: 1440, height: 900 },
      async (p) => {
        const inputs = await p.$$('input');
        if (inputs.length < 2) throw new Error('Login inputs missing');
      },
      '10-passenger-login.png'
    );

    // 11. Passenger Register (/passenger/register)
    await executeStep(
      '11 - Cadastro do Passageiro',
      '/passenger/register',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('Passageiro')) throw new Error('Heading missing on register');
      },
      '11-passenger-register.png'
    );

    // 12. Driver Login (/driver/login)
    await executeStep(
      '12 - Login do Motorista',
      '/driver/login',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('Motorista')) throw new Error('Heading missing on driver login');
      },
      '12-driver-login.png'
    );

    // 13. Driver Register (/driver/register)
    await executeStep(
      '13 - Cadastro do Motorista',
      '/driver/register',
      { width: 1440, height: 900 },
      async (p) => {
        // Test clicking Bicicleta option to check dynamic CNH exemption
        await p.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const bike = btns.find((b) => b.textContent?.includes('Bicicleta'));
          if (bike) bike.click();
        });
        await new Promise((r) => setTimeout(r, 400));
      },
      '13-driver-register.png'
    );

    // 14. Unified Login (/login)
    await executeStep(
      '14 - Portal de Acesso Unificado',
      '/login',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('Passageiro') || !text.includes('Motorista') || !text.includes('Entregador')) {
          throw new Error('3 roles not present on /login');
        }
      },
      '14-unified-login.png'
    );

    // 15. APK Downloads (/download/passenger & /download/driver)
    await executeStep(
      '15 - Download APK Passageiro',
      '/download/passenger',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('VAICAR PASSAGEIRO') || !text.includes('16.8 MB')) {
          throw new Error('APK metadata missing on /download/passenger');
        }
      },
      '15-download-passenger.png'
    );

    await executeStep(
      '16 - Download APK Motorista',
      '/download/driver',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('VAICAR DRIVER') || !text.includes('18.2 MB')) {
          throw new Error('APK metadata missing on /download/driver');
        }
      },
      '16-download-driver.png'
    );

    // 17. Terms & Privacy (/terms & /privacy)
    await executeStep(
      '17 - Termos de Uso',
      '/terms',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('13.640/2018')) throw new Error('Law 13.640/2018 missing on /terms');
      },
      '17-terms-page.png'
    );

    await executeStep(
      '18 - Política de Privacidade',
      '/privacy',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('LGPD')) throw new Error('LGPD missing on /privacy');
      },
      '18-privacy-page.png'
    );

    // 19. Admin Login (/admin/login)
    await executeStep(
      '19 - Login Administrativo',
      '/admin/login',
      { width: 1440, height: 900 },
      async (p) => {
        const text = await p.evaluate(() => document.body.innerText);
        if (!text.includes('Painel Administrativo')) throw new Error('Heading missing on /admin/login');
      },
      '19-admin-login.png'
    );

  } finally {
    if (browser) await browser.close();
    server.close();
    console.log('✓ Test server stopped cleanly');
  }

  console.log('\n================================================================');
  console.log('  VALIDATION SUMMARY');
  console.log('================================================================');
  let passCount = 0;
  for (const r of results) {
    if (r.passed) passCount++;
    console.log(`${r.passed ? '✓' : '✗'} [${r.step}] ${r.url} (${r.viewport}) - ${r.durationMs}ms - Errors: ${r.errors.length}`);
  }
  console.log(`\nTOTAL: ${passCount}/${results.length} PASSED`);
}

runVisualValidation().catch((err) => {
  console.error('Fatal visual validation error:', err);
  process.exit(1);
});
