export async function handler(event, context) {
  const params = event.queryStringParameters || {};
  const spreadsheetId = params.spreadsheet_id || "16bU5xUuPDvI6xIpuBabK9j_EiUFgcgMTq1T0S2LeVgQ";
  const gid = params.gid || "999482111";
  const timestamp = Date.now();
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&_=${timestamp}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NetlifyDashboardProxy/1.0)'
      }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        },
        body: `Error fetching Google Sheet CSV (${response.status}): ${response.statusText}`
      };
    }

    const csvData = await response.text();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      },
      body: csvData
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      body: `Netlify Proxy Error: ${error.message}`
    };
  }
}
