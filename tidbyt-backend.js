// Tidbyt + Syncro 24/7 Backend

const axios = require('axios');
const http = require('http');

const TIDBYT_API = 'https://api.tidbyt.com/v0';
const SYNCRO_SUBDOMAIN = process.env.SYNCRO_SUBDOMAIN || 'YOUR_SUBDOMAIN';
const SYNCRO_API = `https://${SYNCRO_SUBDOMAIN}.syncromsp.com/api/v1`;

const TIDBYT_KEY = process.env.TIDBYT_KEY;
const TIDBYT_DEVICE = process.env.TIDBYT_DEVICE;
const SYNCRO_TOKEN = process.env.SYNCRO_TOKEN;

if (!TIDBYT_KEY || !TIDBYT_DEVICE || !SYNCRO_TOKEN || SYNCRO_SUBDOMAIN === 'YOUR_SUBDOMAIN') {
  console.error('❌ ERROR: Missing environment variables!');
  process.exit(1);
}

console.log('✅ All credentials loaded');
console.log(`📱 Tidbyt Device: ${TIDBYT_DEVICE}`);
console.log(`🔧 Syncro Subdomain: ${SYNCRO_SUBDOMAIN}`);
console.log('🔄 Starting automatic updates...\n');

async function updateTidbyt() {
  try {
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
      return;
    }
    
    const appletCode = `load("render.star", "render")

def main(config):
    count = ${ticketCount}
    
    if count > 10:
        color = "#ff0000"
    elif count > 5:
        color = "#ffaa00"
    else:
        color = "#00ff00"
    
    return render.Root(
        child=render.Box(
            color="#000",
            child=render.Column(
                main_align="space_around",
                cross_align="center",
                children=[
                    render.Text(text="OPEN", font="tb-8", color="#0ff"),
                    render.Text(text="TICKETS", font="tb-8", color="#0ff"),
                    render.BigText(text=str(count), font="6x13", color=color),
                    render.Text(text="Synced", font="tom-thumb", color="#888")
                ]
            )
        )
    )
`;

    console.log('📤 Pushing to Tidbyt...');
    
    const url = `${TIDBYT_API}/devices/${TIDBYT_DEVICE}/push`;
    const payload = { applet: appletCode };
    
    try {
      const tidbytRes = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${TIDBYT_KEY}`,
          'Content-Type': 'application/json'
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
    console.error(`❌ Error: ${error.message}\n`);
  }
}

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
server.listen(PORT, () => console.log(`🌐 HTTP Server listening on port ${PORT}\n`));

updateTidbyt();
setInterval(updateTidbyt, 5 * 60 * 1000);

console.log('💚 Backend running. Updates every 5 minutes.\n');
process.on('SIGTERM', () => process.exit(0));
