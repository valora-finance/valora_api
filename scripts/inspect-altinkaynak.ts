/**
 * Inspect altinkaynak.com to understand the API structure
 */

async function inspectPage(url: string) {
  console.log(`\nInspecting: ${url}`);
  console.log('='.repeat(60));

  try {
    // Try direct fetch
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('\nPage length:', text.length);

    // Check if it's a SPA (contains React/Vue/etc)
    const isSPA =
      text.includes('react') || text.includes('vue') || text.includes('angular') || text.includes('type="module"');

    console.log('Is SPA:', isSPA);

    // Look for API endpoints in the HTML
    const apiMatches = text.match(/api\/[a-z\/\-]+/gi);
    if (apiMatches) {
      console.log('\nPotential API endpoints found:');
      const unique = [...new Set(apiMatches)];
      unique.forEach((match) => console.log(`  - ${match}`));
    }

    // Look for data URLs
    const dataMatches = text.match(/https?:\/\/[a-z0-9\.\-\/]+\/data[a-z0-9\.\-\/]*/gi);
    if (dataMatches) {
      console.log('\nPotential data URLs found:');
      const unique = [...new Set(dataMatches)];
      unique.forEach((match) => console.log(`  - ${match}`));
    }

    // Check for JSON data embedded in page
    const jsonMatches = text.match(/\{[^\}]{100,}\}/g);
    if (jsonMatches && jsonMatches.length > 0) {
      console.log(`\nFound ${jsonMatches.length} potential JSON objects`);
      // Try to parse the first one
      try {
        const parsed = JSON.parse(jsonMatches[0]);
        console.log('Sample JSON structure:', Object.keys(parsed));
      } catch (e) {
        // Not valid JSON
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

async function main() {
  await inspectPage('https://www.altinkaynak.com/Altin/Arsiv');
  await inspectPage('https://www.altinkaynak.com/Doviz/Arsiv');

  // Try to find the actual API endpoint
  console.log('\n' + '='.repeat(60));
  console.log('Testing potential API patterns...');
  console.log('='.repeat(60));

  const testUrls = [
    'https://www.altinkaynak.com/api/altin/arsiv',
    'https://www.altinkaynak.com/api/data/altin',
    'https://www.altinkaynak.com/data/altin/arsiv',
    'https://api.altinkaynak.com/altin/arsiv',
  ];

  for (const testUrl of testUrls) {
    try {
      const response = await fetch(testUrl);
      if (response.ok) {
        console.log(`✓ Found working endpoint: ${testUrl}`);
        const data = await response.text();
        console.log(`  Response preview: ${data.substring(0, 200)}`);
      }
    } catch (e) {
      // Expected to fail for most
    }
  }
}

main().catch(console.error);
