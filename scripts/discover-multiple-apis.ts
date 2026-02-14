/**
 * Discover APIs from multiple Turkish financial sites
 */

import { chromium } from 'playwright';

async function discoverAPI(url: string, siteName: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${siteName}: ${url}`);
  console.log('='.repeat(70));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const apiCalls: Array<{ url: string; method: string; status?: number; data?: any }> = [];

  // Intercept requests
  page.on('request', (request) => {
    const reqUrl = request.url();
    if (
      reqUrl.includes('/api/') ||
      reqUrl.includes('/data/') ||
      reqUrl.includes('.json') ||
      reqUrl.includes('altin') ||
      reqUrl.includes('doviz') ||
      reqUrl.includes('kur') ||
      reqUrl.includes('chart') ||
      reqUrl.includes('history') ||
      reqUrl.includes('arsiv')
    ) {
      apiCalls.push({ url: reqUrl, method: request.method() });
    }
  });

  // Intercept responses
  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.includes('application/json')) {
      const call = apiCalls.find((c) => c.url === url);
      if (call) {
        call.status = response.status();
        try {
          call.data = await response.json();
        } catch (e) {
          // Not JSON
        }
      }
    }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
  } catch (error) {
    console.log('Error loading page:', error instanceof Error ? error.message : error);
  } finally {
    await browser.close();
  }

  // Print findings
  const jsonAPIs = apiCalls.filter((c) => c.data);
  console.log(`\nFound ${jsonAPIs.length} JSON API endpoints:\n`);

  jsonAPIs.forEach((call) => {
    console.log(`${call.method} ${call.url}`);
    if (call.data) {
      const keys = Array.isArray(call.data) ? `Array[${call.data.length}]` : Object.keys(call.data).join(', ');
      console.log(`  → ${keys}`);
      if (Array.isArray(call.data) && call.data.length > 0) {
        console.log(`  → Sample: ${JSON.stringify(call.data[0]).substring(0, 150)}...`);
      } else if (typeof call.data === 'object') {
        console.log(`  → Sample: ${JSON.stringify(call.data).substring(0, 150)}...`);
      }
    }
    console.log('');
  });

  return jsonAPIs;
}

async function main() {
  const sites = [
    { name: 'Harem Altın', url: 'https://www.haremaltin.com' },
    { name: 'Doviz.com', url: 'https://www.doviz.com' },
    { name: 'Doviz.com - Altın', url: 'https://www.doviz.com/altin' },
    { name: 'Harem Altın - Grafikler', url: 'https://www.haremaltin.com/grafikler' },
  ];

  const allAPIs: any[] = [];

  for (const site of sites) {
    try {
      const apis = await discoverAPI(site.url, site.name);
      allAPIs.push(...apis);
    } catch (error) {
      console.error(`Error with ${site.name}:`, error);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total JSON APIs found: ${allAPIs.length}`);

  // Group by domain
  const byDomain: Record<string, any[]> = {};
  allAPIs.forEach((api) => {
    const domain = new URL(api.url).hostname;
    if (!byDomain[domain]) byDomain[domain] = [];
    byDomain[domain].push(api);
  });

  Object.entries(byDomain).forEach(([domain, apis]) => {
    console.log(`\n${domain}: ${apis.length} endpoints`);
    apis.forEach((api) => {
      console.log(`  ${api.method} ${new URL(api.url).pathname}`);
    });
  });
}

main().catch(console.error);
