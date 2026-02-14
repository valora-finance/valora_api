/**
 * Use Playwright to discover altinkaynak.com API endpoints
 */

import { chromium } from 'playwright';

async function discoverAPI(url: string, category: 'altin' | 'doviz') {
  console.log(`\nDiscovering ${category} API from ${url}`);
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const apiCalls: Array<{ url: string; method: string; response?: any }> = [];

  // Intercept all network requests
  page.on('request', (request) => {
    const url = request.url();
    // Look for API calls (usually JSON)
    if (
      url.includes('/api/') ||
      url.includes('/data/') ||
      url.includes('.json') ||
      url.includes(category)
    ) {
      console.log(`[REQUEST] ${request.method()} ${url}`);
      apiCalls.push({ url, method: request.method() });
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    // Look for JSON responses
    if (contentType.includes('application/json')) {
      console.log(`[RESPONSE] ${response.status()} ${url}`);

      try {
        const data = await response.json();
        console.log(`[JSON] Keys: ${Object.keys(data).slice(0, 5).join(', ')}`);

        // Save this API call
        const call = apiCalls.find((c) => c.url === url);
        if (call) {
          call.response = data;
        }
      } catch (e) {
        // Not valid JSON
      }
    }
  });

  try {
    // Navigate to the page
    console.log(`\nNavigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait a bit for any delayed API calls
    await page.waitForTimeout(3000);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Found ${apiCalls.length} potential API calls:`);
    apiCalls.forEach((call) => {
      console.log(`\n${call.method} ${call.url}`);
      if (call.response) {
        console.log(`  Response keys: ${Object.keys(call.response).slice(0, 10).join(', ')}`);
      }
    });

    // Try to find and click the date picker or form
    console.log(`\n${'='.repeat(60)}`);
    console.log('Looking for date input elements...');

    const inputs = await page.$$('input[type="date"], input[name*="tarih"], input[name*="date"]');
    console.log(`Found ${inputs.length} date inputs`);

    const buttons = await page.$$('button, input[type="submit"]');
    console.log(`Found ${buttons.length} buttons/submit inputs`);

    if (inputs.length > 0 && buttons.length > 0) {
      console.log('\nTrying to interact with form...');

      // Set dates (last 30 days)
      const today = new Date();
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);

      const todayStr = today.toISOString().split('T')[0];
      const monthAgoStr = monthAgo.toISOString().split('T')[0];

      if (inputs[0]) {
        await inputs[0].fill(monthAgoStr);
        console.log(`Set start date: ${monthAgoStr}`);
      }
      if (inputs[1]) {
        await inputs[1].fill(todayStr);
        console.log(`Set end date: ${todayStr}`);
      }

      // Click submit
      if (buttons[0]) {
        console.log('Clicking submit button...');
        await buttons[0].click();
        await page.waitForTimeout(2000);
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  } finally {
    await browser.close();
  }

  return apiCalls;
}

async function main() {
  console.log('Discovering altinkaynak.com API endpoints...\n');

  // Discover gold API
  const altinCalls = await discoverAPI('https://www.altinkaynak.com/Altin/Arsiv', 'altin');

  console.log('\n\n');

  // Discover forex API
  const dovizCalls = await discoverAPI('https://www.altinkaynak.com/Doviz/Arsiv', 'doviz');

  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Gold API calls: ${altinCalls.length}`);
  console.log(`Forex API calls: ${dovizCalls.length}`);

  // Print the most promising API endpoints
  const allCalls = [...altinCalls, ...dovizCalls];
  const jsonAPIs = allCalls.filter((call) => call.response);

  if (jsonAPIs.length > 0) {
    console.log('\nPotential JSON API endpoints:');
    jsonAPIs.forEach((call) => {
      console.log(`\n${call.method} ${call.url}`);
      if (call.response) {
        const sample = JSON.stringify(call.response).substring(0, 200);
        console.log(`Sample: ${sample}...`);
      }
    });
  }
}

main().catch(console.error);
