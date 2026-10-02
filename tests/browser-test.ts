import puppeteer, { Browser, Page } from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const screenshotsDir = path.resolve(projectRoot, 'tests', 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Set test environment flag before loading app
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5001';

interface TestStepResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  screenshot?: string;
}

const testResults: TestStepResult[] = [];

async function recordStep(name: string, fn: () => Promise<string | void>): Promise<void> {
  const start = Date.now();
  console.log(`\n▶ [TEST] Starting: ${name}...`);
  try {
    const screenshot = await fn();
    const durationMs = Date.now() - start;
    testResults.push({
      name,
      passed: true,
      durationMs,
      screenshot: screenshot || undefined,
    });
    console.log(`  ✓ PASSED: ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    testResults.push({
      name,
      passed: false,
      durationMs,
      error: err.message || String(err),
    });
    console.error(`  ✗ FAILED: ${name} (${durationMs}ms)`);
    console.error(`    Error: ${err.message || err}`);
    throw err;
  }
}

async function clickButtonByText(p: Page, textSnippet: string): Promise<boolean> {
  const lower = textSnippet.toLowerCase();
  return await p.evaluate((l) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) =>
      b.textContent?.toLowerCase().includes(l) ||
      b.innerText?.toLowerCase().includes(l)
    );
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }, lower);
}

async function waitForText(p: Page, text: string, timeout = 10000): Promise<void> {
  const lower = text.toLowerCase();
  await p.waitForFunction(
    `document.body && document.body.innerText.toLowerCase().includes(${JSON.stringify(lower)})`,
    { timeout }
  );
}

function attachLogger(p: Page, prefix = '[PAGE]') {
  p.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[VaiCar]') || text.includes('Error') || text.includes('Exception') || text.includes('warn')) {
      console.log(`    ${prefix} ${text}`);
    }
  });
  p.on('pageerror', (err) => {
    console.error(`    ${prefix} ERROR: ${err.message}`);
  });
}

async function runBrowserTestSuite() {
  console.log('====================================================');
  console.log('  VAICAR PLATFORM — BROWSER END-TO-END VERIFICATION');
  console.log('  Testing UI, Real Flows, State Machines & Receipts');
  console.log('====================================================');

  // 1. Seed authoritative data into the in-memory database
  const {
    saveUserProfile,
    saveDriverProfile,
    savePassengerProfile,
  } = await import('../api/src/services/firestore.js');

  const now = new Date().toISOString();

  // Admin user
  await saveUserProfile({
    uid: 'test-admin-01',
    email: 'admin@vaicar.app',
    displayName: 'Administrador Chefe',
    role: 'admin',
    isAdmin: true,
    createdAt: now,
    updatedAt: now,
  });

  // Approved Driver user
  await saveUserProfile({
    uid: 'test-driv-01',
    email: 'motorista@teste.vaicar.app',
    displayName: 'Carlos Santos',
    role: 'driver',
    createdAt: now,
    updatedAt: now,
  });

  await saveDriverProfile({
    uid: 'test-driv-01',
    name: 'Carlos Santos',
    email: 'motorista@teste.vaicar.app',
    whatsapp: '12999887766',
    cpf: '12345678909',
    cnh: '12345678901',
    birthDate: '1985-05-15',
    status: 'APPROVED',
    isOnline: false,
    rating: 4.95,
    totalRides: 42,
    completedRidesCount: 42,
    operatingZones: ['Centro & Porto Grande', 'Maresias & Boiçucanga'],
    vehicle: {
      make: 'Toyota',
      model: 'Corolla',
      year: 2021,
      plate: 'BRA2E19',
      color: 'Prata',
    },
    documents: {
      cnhPhotoUrl: 'https://vaicar.app/docs/cnh.jpg',
      crlvPhotoUrl: 'https://vaicar.app/docs/crlv.jpg',
      vehiclePhotoUrl: 'https://vaicar.app/docs/car.jpg',
    },
    termsAccepted: true,
    createdAt: now,
    updatedAt: now,
  });

  // Passenger user
  await saveUserProfile({
    uid: 'test-pass-01',
    email: 'passenger@teste.vaicar.app',
    displayName: 'Maria Fernandes',
    role: 'passenger',
    createdAt: now,
    updatedAt: now,
  });

  await savePassengerProfile({
    uid: 'test-pass-01',
    name: 'Maria Fernandes',
    email: 'passenger@teste.vaicar.app',
    whatsapp: '12998765432',
    photoUrl: 'https://vaicar.app/avatars/passenger.jpg',
    termsAccepted: true,
    rating: 5.0,
    totalRides: 12,
    createdAt: now,
    updatedAt: now,
  });

  console.log('✓ Initial test data seeded in Firestore service');

  // 2. Start Express server
  const { app } = await import('../api/src/server.js');
  const server = await new Promise<http.Server>((resolve, reject) => {
    const s = app.listen(5001, () => {
      console.log('✓ Express server started on http://localhost:5001');
      resolve(s);
    });
    s.on('error', reject);
  });

  let browser: Browser | null = null;

  try {
    // 3. Launch Chrome
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
      defaultViewport: { width: 1280, height: 800 },
    });
    console.log('✓ Chrome browser launched successfully via puppeteer-core');

    const page = await browser.newPage();
    attachLogger(page, '[MAIN_PAGE]');

    // ----------------------------------------------------
    // TEST 1: Homepage & Brand Identity
    // ----------------------------------------------------
    await recordStep('01 - Homepage loads and displays VaiCar brand', async () => {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0', timeout: 15000 });

      // Verify title
      const title = await page.title();
      if (!title.includes('VaiCar')) {
        throw new Error(`Expected title to include "VaiCar", got "${title}"`);
      }

      // Verify logo image
      const logo = await page.$('img[alt="VaiCar"]');
      if (!logo) {
        throw new Error('VaiCar logo img[alt="VaiCar"] not found');
      }

      // Verify CTA buttons
      const ctaButtons = await page.$$('a[href*="/passenger"], a[href*="/driver"]');
      if (ctaButtons.length === 0) {
        throw new Error('CTA buttons for passenger/driver not found');
      }

      const shotPath = path.join(screenshotsDir, '01-homepage.png');
      await page.screenshot({ path: shotPath, fullPage: false });
      return shotPath;
    });

    // ----------------------------------------------------
    // TEST 2: Admin Login & Dashboard Navigation
    // ----------------------------------------------------
    await recordStep('02 - Admin Login and KPI Dashboard', async () => {
      await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle0', timeout: 15000 });

      // Check heading
      const heading = await page.$eval('h2', (el) => el.textContent);
      if (!heading?.includes('Painel Administrativo')) {
        throw new Error(`Expected Admin heading, got "${heading}"`);
      }

      // Click quick test admin button
      const clicked = await clickButtonByText(page, 'Admin Geral');
      if (!clicked) {
        throw new Error('Test admin quick login button not found');
      }

      // Wait for React Router navigation to /admin
      await page.waitForFunction(() => window.location.pathname === '/admin', { timeout: 10000 });

      // Wait for metrics to load
      await waitForText(page, 'Passageiros Cadastrados');

      // Verify tabs switch cleanly using page.evaluate clicks
      await clickButtonByText(page, 'Motoristas');
      await new Promise((r) => setTimeout(r, 600));

      await clickButtonByText(page, 'Tarifas');
      await new Promise((r) => setTimeout(r, 600));

      const shotPath = path.join(screenshotsDir, '02-admin-dashboard.png');
      await page.screenshot({ path: shotPath, fullPage: false });
      return shotPath;
    });

    // ----------------------------------------------------
    // TEST 3: Passenger Registration Form Validation
    // ----------------------------------------------------
    await recordStep('03 - Passenger Registration Form Validation', async () => {
      await page.goto(`${BASE_URL}/passenger/register`, { waitUntil: 'networkidle0', timeout: 15000 });

      const heading = await page.$eval('h2', (el) => el.textContent);
      if (!heading?.includes('Passageiro')) {
        throw new Error(`Expected Passenger Register heading, got "${heading}"`);
      }

      const inputs = await page.$$('input');
      if (inputs.length < 4) {
        throw new Error(`Expected at least 4 input fields, found ${inputs.length}`);
      }

      const shotPath = path.join(screenshotsDir, '03-passenger-register.png');
      await page.screenshot({ path: shotPath, fullPage: false });
      return shotPath;
    });

    // ----------------------------------------------------
    // TEST 4: Passenger Login & Dashboard Interaction
    // ----------------------------------------------------
    await recordStep('04 - Passenger Dashboard, Fare Simulation & Popular Places', async () => {
      await page.goto(`${BASE_URL}/passenger/login`, { waitUntil: 'networkidle0', timeout: 15000 });

      const clicked = await clickButtonByText(page, 'Acesso Rápido de Teste (Passageiro)');
      if (!clicked) {
        throw new Error('Test passenger quick login button not found');
      }

      await page.waitForFunction(() => window.location.pathname === '/passenger', { timeout: 10000 });

      // Select popular destination: Praia de Maresias
      await waitForText(page, 'Maresias');
      await clickButtonByText(page, 'Maresias');

      // Wait for fare calculation to appear
      await waitForText(page, 'Tarifa Prevista');

      const shotPath = path.join(screenshotsDir, '04-passenger-dashboard.png');
      await page.screenshot({ path: shotPath, fullPage: false });
      return shotPath;
    });

    // ----------------------------------------------------
    // TEST 5: Driver Registration Form
    // ----------------------------------------------------
    await recordStep('05 - Driver Registration & Approval Gate', async () => {
      await page.goto(`${BASE_URL}/driver/register`, { waitUntil: 'networkidle0', timeout: 15000 });

      const heading = await page.$eval('h2', (el) => el.textContent);
      if (!heading?.includes('Cadastro de Motorista')) {
        throw new Error(`Expected Driver Register heading, got "${heading}"`);
      }

      const pageText = await page.evaluate(() => document.body.innerText);
      if (!pageText.includes('CPF') || !pageText.includes('CNH')) {
        throw new Error('Driver form missing CPF or CNH fields');
      }

      const shotPath = path.join(screenshotsDir, '05-driver-register.png');
      await page.screenshot({ path: shotPath, fullPage: false });
      return shotPath;
    });

    // ----------------------------------------------------
    // TEST 6: Driver Login & Online Availability Toggle
    // ----------------------------------------------------
    await recordStep('06 - Driver Dashboard and Online Availability Toggle', async () => {
      await page.goto(`${BASE_URL}/driver/login`, { waitUntil: 'networkidle0', timeout: 15000 });

      const clicked = await clickButtonByText(page, 'Acesso Rápido de Teste (Motorista Aprovado)');
      if (!clicked) {
        throw new Error('Test driver quick login button not found');
      }

      // Explicitly wait for navigation from /driver/login to /driver
      await page.waitForFunction(() => window.location.pathname === '/driver', { timeout: 10000 });

      // Wait for driver dashboard to load and show online toggle
      await waitForText(page, 'Ficar Online');
      await clickButtonByText(page, 'Ficar Online');

      // Wait for status to show Online
      await waitForText(page, 'Online (Disponível)');

      const shotPath = path.join(screenshotsDir, '06-driver-dashboard.png');
      await page.screenshot({ path: shotPath, fullPage: false });
      return shotPath;
    });

    // ----------------------------------------------------
    // TEST 7: End-to-End Live Ride Flow, 4-min Wait Timer & Receipt
    // ----------------------------------------------------
    await recordStep('07 - End-to-End Ride Flow, 4-min Wait Timer & Receipt Generation', async () => {
      // Driver page is already online in `page`. Let's create a passenger page
      const passengerPage = await browser!.newPage();
      attachLogger(passengerPage, '[PASSENGER_PAGE]');
      await passengerPage.setViewport({ width: 1280, height: 800 });

      await passengerPage.goto(`${BASE_URL}/passenger/login`, { waitUntil: 'networkidle0' });
      await clickButtonByText(passengerPage, 'Acesso Rápido de Teste (Passageiro)');
      await passengerPage.waitForFunction(() => window.location.pathname === '/passenger', { timeout: 10000 });

      // In passenger page: select Maresias
      await waitForText(passengerPage, 'Maresias');
      await clickButtonByText(passengerPage, 'Maresias');

      await waitForText(passengerPage, 'Confirmar e Pedir VaiCar');

      // Click "Confirmar e Pedir VaiCar"
      await clickButtonByText(passengerPage, 'Confirmar e Pedir VaiCar');
      console.log('    ✓ Passenger confirmed and requested ride');

      // Now switch back to driver page (`page`) and wait for incoming ride
      await page.bringToFront();
      await waitForText(page, 'Aceitar Corrida', 15000);
      console.log('    ✓ Driver received incoming ride offer');

      // Click "Aceitar Corrida"
      await clickButtonByText(page, 'Aceitar Corrida');

      // Wait for status DRIVER_ARRIVING
      await waitForText(page, 'Cheguei no Embarque');
      console.log('    ✓ Driver accepted ride -> DRIVER_ARRIVING');

      // Click "Cheguei no Embarque" -> Triggers ARRIVED & 4-minute tolerance countdown
      await clickButtonByText(page, 'Cheguei no Embarque');

      // Verify 4-minute waiting timer is visible!
      await waitForText(page, 'Tempo de Espera');
      console.log('    ✓ Driver arrived -> 4-minute waiting timer active');

      const timerShot = path.join(screenshotsDir, '07-waiting-timer.png');
      await page.screenshot({ path: timerShot, fullPage: false });

      // Click "Passageiro Embarcou — Iniciar Viagem"
      await waitForText(page, 'Iniciar Viagem');
      await clickButtonByText(page, 'Iniciar Viagem');

      // Wait for status IN_PROGRESS
      await waitForText(page, 'Finalizar Viagem');
      console.log('    ✓ Trip started -> IN_PROGRESS');

      // Click "Finalizar Viagem & Gerar Recibo"
      await clickButtonByText(page, 'Finalizar Viagem');

      // Verify trip completed and receipt modal appears!
      await waitForText(page, 'Recibo da Corrida', 15000);
      console.log('    ✓ Trip completed -> COMPLETED & Receipt generated');

      const receiptShot = path.join(screenshotsDir, '08-receipt-modal.png');
      await page.screenshot({ path: receiptShot, fullPage: false });

      // Verify Passenger gets rating modal
      await passengerPage.bringToFront();
      await waitForText(passengerPage, 'Viagem Concluída', 15000);
      console.log('    ✓ Passenger prompt for 5-star rating displayed');

      const ratingShot = path.join(screenshotsDir, '09-passenger-rating.png');
      await passengerPage.screenshot({ path: ratingShot, fullPage: false });

      await passengerPage.close();
      return receiptShot;
    });

    // ----------------------------------------------------
    // TEST 8: Admin Dashboard Real-Time Reflection
    // ----------------------------------------------------
    await recordStep('08 - Admin Dashboard Real-Time Ride Reflection', async () => {
      await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle0', timeout: 15000 });
      await clickButtonByText(page, 'Admin Geral');
      await page.waitForFunction(() => window.location.pathname === '/admin', { timeout: 10000 });

      // Click Corridas tab
      await waitForText(page, 'Corridas');
      await clickButtonByText(page, 'Corridas');

      await waitForText(page, 'COMPLETED');
      console.log('    ✓ Admin Corridas table displays newly completed ride');

      const shotPath = path.join(screenshotsDir, '10-admin-corridas-verified.png');
      await page.screenshot({ path: shotPath, fullPage: false });
      return shotPath;
    });

  } finally {
    if (browser) {
      await browser.close();
      console.log('✓ Chrome browser closed');
    }
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('✓ Express server stopped cleanly');
        resolve();
      });
    });
  }

  // Summary Report
  console.log('\n====================================================');
  console.log('  TEST SUMMARY REPORT');
  console.log('====================================================');
  let allPassed = true;
  for (const res of testResults) {
    const mark = res.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${mark} | ${res.name} (${res.durationMs}ms)`);
    if (res.screenshot) {
      console.log(`       Screenshot: ${res.screenshot}`);
    }
    if (res.error) {
      console.log(`       Error: ${res.error}`);
      allPassed = false;
    }
  }
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runBrowserTestSuite().catch((err) => {
  console.error('\nFatal Browser Test Runner Failure:', err);
  process.exit(1);
});
