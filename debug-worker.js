// Quick debug script to test your Cloudflare Worker API
// Replace YOUR_WORKER_URL with your actual Cloudflare Worker URL

const WORKER_URL = "https://promo-code-manager.bluepavilionemail.workers.dev";
const API_KEY = "promo-manager-2024-secure-key";

async function testAPI() {
  console.log("🔍 Testing Cloudflare Worker API...\n");

  const tests = [
    { name: "Stats", endpoint: "/api/promo-codes/stats", method: "GET" },
    { name: "Campaigns", endpoint: "/api/campaigns", method: "GET" },
    {
      name: "Promo Codes (first page)",
      endpoint: "/api/promo-codes?page=1&limit=5",
      method: "GET",
    },
  ];

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);

      const response = await fetch(`${WORKER_URL}${test.endpoint}`, {
        method: test.method,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
      });

      console.log(`  Status: ${response.status} ${response.statusText}`);
      console.log(`  Headers:`, Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ Success:`, JSON.stringify(data, null, 2));
      } else {
        const errorText = await response.text();
        console.log(`  ❌ Error Response:`, errorText);
      }
    } catch (error) {
      console.log(`  💥 Network Error:`, error.message);
    }

    console.log(""); // Empty line for readability
  }
}

// For browser console
if (typeof window !== "undefined") {
  window.testAPI = testAPI;
  console.log("Run testAPI() in the browser console to debug your API");
}

// For Node.js
if (typeof module !== "undefined") {
  testAPI().catch(console.error);
}
