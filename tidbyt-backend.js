```js
// Tidbyt + Syncro 24/7 Backend
// Displays only the overall unresolved ticket count

const axios = require('axios');
const http = require('http');
const sharp = require('sharp');

const TIDBYT_API = 'https://api.tidbyt.com/v0';
const SYNCRO_SUBDOMAIN = process.env.SYNCRO_SUBDOMAIN || 'YOUR_SUBDOMAIN';
const SYNCRO_API = `https://${SYNCRO_SUBDOMAIN}.syncromsp.com/api/v1`;

const TIDBYT_KEY = process.env.TIDBYT_KEY;
const TIDBYT_DEVICE = process.env.TIDBYT_DEVICE;
const SYNCRO_TOKEN = process.env.SYNCRO_TOKEN;

if (
  !TIDBYT_KEY ||
  !TIDBYT_DEVICE ||
  !SYNCRO_TOKEN ||
  SYNCRO_SUBDOMAIN === 'YOUR_SUBDOMAIN'
) {
  console.error('❌ ERROR: Missing environment variables!');
  process.exit(1);
}

console.log('✅ All credentials loaded');
console.log(`📱 Tidbyt Device: ${TIDBYT_DEVICE}`);
console.log(`🔧 Syncro Subdomain: ${SYNCRO_SUBDOMAIN}`);
console.log('🔄 Starting automatic updates...\n');

async function updateTidbyt() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Updating ticket count...`);

    let ticketCount = 0;

    try {
      const url = `${SYNCRO_API}/tickets?ticket_search_id=50059&api_key=${SYNCRO_TOKEN}`;

      const syncroRes = await axios.get(url, {
        timeout: 10000
      });

      ticketCount = syncroRes.data.tickets?.length || 0;

      console.log(`🎫 Unresolved tickets: ${ticketCount}`);
    } catch (syncroError) {
      console.error(`❌ Syncro API error: ${syncroError.message}`);
      return;
    }

    // Display only the overall ticket count
    // Large, bold, white text on a black background
    const svgImage = `
      <svg width="64" height="32" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="32" fill="#000000"/>
        <text
          x="32"
          y="24"
          font-family="Arial, sans-serif"
          font-size="32"
          fill="#ffffff"
          text-anchor="middle"
          font-weight="bold"
        >${ticketCount}</text>
      </svg>
    `;

    try {
      const imageBuffer = await sharp(Buffer.from(svgImage))
        .webp()
        .toBuffer();

      const base64Image = imageBuffer.toString('base64');

      const url = `${TIDBYT_API}/devices/${TIDBYT_DEVICE}/push`;

      await axios.post(
        url,
        {
          image: base64Image,
          duration: 300
        },
        {
          headers: {
            Authorization: `Bearer ${TIDBYT_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      console.log(`✅ Tidbyt updated: ${ticketCount}\n`);
    } catch (tidbytError) {
      console.error(
        `❌ Tidbyt API error: ${
          tidbytError.response?.status || tidbytError.message
        }`
      );
    }
  } catch (error) {
    console.error(`❌ Update error: ${error.message}\n`);
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

server.listen(PORT, () => {
  console.log(`🌐 HTTP Server listening on port ${PORT}\n`);
});

updateTidbyt();
setInterval(updateTidbyt, 5 * 60 * 1000);

console.log('💚 Backend running. Updates every 5 minutes.\n');

process.on('SIGTERM', () => process.exit(0));
```
