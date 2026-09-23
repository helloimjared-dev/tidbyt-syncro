// Tidbyt + Syncro 24/7 Backend
// Automatically updates your Tidbyt display with open ticket count every 5 minutes

const axios = require('axios');
const http = require('http');

// Tidbyt endpoint
const TIDBYT_API = 'https://api.tidbyt.com/v0';

// Syncro endpoint
const SYNCRO_SUBDOMAIN = process.env.SYNCRO_SUBDOMAIN || 'YOUR_SUBDOMAIN';
const SYNCRO_API = `https://${SYNCRO_SUBDOMAIN}.syncromsp.com/api/v1`;

// Get credentials from environment variables
const TIDBYT_KEY = process.env.TIDBYT_KEY;
const TIDBYT_DEVICE = process.env.TIDBYT_DEVICE;
const SYNCRO_TOKEN = process.env.SYNCRO_TOKEN;

// Validate all credentials are set
if (!TIDBYT_KEY || !TIDBYT_DEVICE || !SYNCRO_TOKEN || SYNCRO_SUBDOMAIN === 'YOUR_SUBDOMAIN') {
  console.error('❌ ERROR: Missing environment variables!');
  console.error('Set these in your deployment platform:');
  console.error('  - TIDBYT_KEY');
  console.error('  - TIDBYT_DEVICE');
  console.error('  - SYNCRO_TOKEN');
  console.error('  - SYNCRO_SUBDOMAIN (e.g., "noobeh" from https://noobeh.syncromsp.com)');
  process.exit(1);
}

console.log('✅ All credentials loaded');
console.log(`📱 Tidbyt Device: ${TIDBYT_DEVICE}`);
console.log(`🔧 Syncro Subdomain: ${SYNCRO_SUBDOMAIN}`);
console.log('🔄 Starting automatic updates...\n');

// Main update function
async function updateTidbyt() {
  try {
    // Step 1: Fetch open tickets from Syncro
    console.log(`[${new Date().toLocaleTimeString()}] Fetching open tickets from Syncro...`);
    
    let ticketCount = 0;
    try {
      const syncroRes = await axios.get(`${SYNCRO_API}/tickets?status=open&api_key=${SYNCRO_TOKEN}`, {
        timeout: 10000
      });
      
      ticketCount = syncroRes.data.tickets?.length || 0;
      console.log(`✅ Found ${ticketCount} open tickets`);
    } catch (syncroError) {
      console.error(`❌ Syncro API error: ${syncroError.message}`);
      console.error(`   Response: ${JSON.stringify(syncroError.response?.data)}`);
      return;
    }
    
    // Step 2: Create the Pixlet app code
    const appletCode = `load("render.star", "render")

def main(config):
    count = ${ticketCount}
    
    # Determine color based on ticket count
    if count > 10:
        color = "#ff0000"  # Red
    elif count > 5:
        color = "#ffaa00"  # Orange
    else:
        color = "#00ff00"  # Green
    
    return render.Root(
        child=render.Box(
            color="#000",
            child=render.Column(
                main_align="space_around",
                cross_align="center",
                children=[
                    render.Text(
                        text="OPEN",
                        font="tb-8",
                        color="#0ff"
                    ),
                    render.Text(
                        text="TICKETS",
                        font="tb-8",
                        color="#0ff"
                    ),
                    render.BigText(
                        text=str(count),
                        font="6x13",
                        color=color
                    ),
                    render.Text(
                        text="Synced",
                        font="tom-thumb",
                        color="#888"
                    )
                ]
            )
        )
    )
`;

    // Step 3: Send to Tidbyt using /push endpoint
    console.log('📤 Pushing to Tidbyt...');
    
    const url = `${TIDBYT_API}/devices/${TIDBYT_DEVICE}/push`;
    
    console.log(`   URL: ${url}`);
    console.log(`   Payload size: ${appletCode.length} bytes`);
    
    try {
      const tidbytRes = await axios({
        method: 'POST',
        url: url,
        data: appletCode,
        headers: {
          'Authorization': `Bearer ${TIDBYT_KEY}`,
          'Content-Type': 'text/plain'
        },
        timeout: 15000
      });
      
      console.log(`✅ Successfully updated Tidbyt! (${ticketCount} tickets)\n`);
      
    } catch (tidbytError) {
      console.error(`❌ Tidbyt API error:`);
      console.error(`   Status: ${tidbytError.response?.status}`);
      console.error(`   Message: ${JSON.stringify(tidbytError.response?.data)}\n`);
    }
    
  } catch (error) {
    console.error(`❌ Unexpected error: ${error.message}\n`);
  }
}

// Create HTTP server for Render
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Tidbyt Syncro Backend Running\n');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 HTTP Server listening on port ${PORT}\n`);
});

// Run immediately on startup
updateTidbyt();

// Then run every 5 minutes
setInterval(updateTidbyt, 5 * 60 * 1000);

console.log('💚 Backend running. Updates every 5 minutes.\n');
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  process.exit(0);
});
