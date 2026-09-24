// Tidbyt + Syncro 24/7 Backend
// Generates WebP image of unresolved ticket count and pushes to Tidbyt

const axios = require('axios');
const http = require('http');
const sharp = require('sharp');

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
    console.log(`[${new Date().toLocaleTimeString()}] Fetching unresolved tickets from Syncro...`);
    
    let ticketCount = 0;
    try {
      const syncroRes = await axios.get(`${SYNCRO_API}/tickets?filter=unresolved_tickets&api_key=${SYNCRO_TOKEN}`, {
        timeout: 10000
      });
      
      ticketCount = syncroRes.data.tickets?.length || 0;
      console.log(`✅ Found ${ticketCount} unresolved tickets`);
    } catch (syncroError) {
      console.error(`❌ Syncro API error: ${syncroError.message}`);
      return;
    }
    
    // Determine color based on ticket count
    let color = '#00ff00'; // Green
    if (ticketCount > 10) color = '#ff0000'; // Red
    else if (ticketCount > 5) color = '#ffaa00'; // Orange
    
    // Create SVG image
    const svgImage = `
<svg width="64" height="32" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="32" fill="#000000"/>
  <text x="32" y="8" font-family="Arial" font-size="6" fill="#00ffff" text-anchor="middle">UNRESOLVED</text>
  <text x="32" y="22" font-family="Arial" font-size="16" fill="${color}" text-anchor="middle" font-weight="bold">${ticketCount}</text>
</svg>
`;
    
    console.log('🎨 Generating WebP image...');
    
    try {
      const imageBuffer = await sharp(Buffer.from(svgImage))
        .webp()
        .toBuffer();
      
      const base64Image = imageBuffer.toString('base64');
      console.log(`✅ Generated WebP image (${imageBuffer.length} bytes)`);
      
      // Push to Tidbyt
      console.log('📤 Pushing to Tidbyt...');
      
      const url = `${TIDBYT_API}/devices/${TIDBYT_DEVICE}/push`;
      const payload = {
        image: base64Image,
        duration: 300  // 5 minutes in seconds
      };
      
      const tidbytRes = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${TIDBYT_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      console.log(`✅ Successfully updated Tidbyt! (${ticketCount} unresolved tickets)\n`);
      
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
