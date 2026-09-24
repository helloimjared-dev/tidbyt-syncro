const axios = require('axios');
const http = require('http');
const sharp = require('sharp');

const TIDBYT_API = 'https://api.tidbyt.com/v0';
const SYNCRO_SUBDOMAIN = process.env.SYNCRO_SUBDOMAIN || 'YOUR_SUBDOMAIN';
const SYNCRO_API = `https://${SYNCRO_SUBDOMAIN}.syncromsp.com/api/v1`;
const TIDBYT_KEY = process.env.TIDBYT_KEY;
const TIDBYT_DEVICE = process.env.TIDBYT_DEVICE;
const SYNCRO_TOKEN = process.env.SYNCRO_TOKEN;

let flashCounter = 0; // Track flash cycle (0 = bright, 1 = dim, repeat)

if (!TIDBYT_KEY || !TIDBYT_DEVICE || !SYNCRO_TOKEN || SYNCRO_SUBDOMAIN === 'YOUR_SUBDOMAIN') {
  console.error('❌ ERROR: Missing environment variables!');
  process.exit(1);
}

// Store bright/dim images in memory
let brightImageB64 = '';
let dimImageB64 = '';

async function generateFlashImages(ticketCount) {
  try {
    // Create full brightness frame (bright white number)
    const brightSvg = `
<svg width="64" height="32" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="32" fill="#000000"/>
  <text x="32" y="28" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="-1">${ticketCount}</text>
</svg>`;

    // Create dimmed frame (faded white number for flash effect)
    const dimSvg = `
<svg width="64" height="32" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="32" fill="#000000"/>
  <text x="32" y="28" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="900" fill="#333333" text-anchor="middle" letter-spacing="-1">${ticketCount}</text>
</svg>`;

    // Convert to WebP and base64
    brightImageB64 = (await sharp(Buffer.from(brightSvg)).webp().toBuffer()).toString('base64');
    dimImageB64 = (await sharp(Buffer.from(dimSvg)).webp().toBuffer()).toString('base64');
    
    console.log(`📸 Generated flash frames for ${ticketCount} tickets`);
  } catch (error) {
    console.error(`❌ Error generating flash images: ${error.message}`);
  }
}

async function pushImageToTidbyt(base64Image) {
  try {
    await axios.post(
      `${TIDBYT_API}/devices/${TIDBYT_DEVICE}/push`,
      { image: base64Image, duration: 60 },
      { 
        headers: { 
          'Authorization': `Bearer ${TIDBYT_KEY}`, 
          'Content-Type': 'application/json' 
        }, 
        timeout: 10000 
      }
    );
  } catch (error) {
    console.error(`❌ Push error: ${error.message}`);
  }
}

async function updateTidbyt() {
  try {
    let ticketCount = 0;
    const syncroRes = await axios.get(
      `${SYNCRO_API}/tickets?ticket_search_id=50059&api_key=${SYNCRO_TOKEN}`,
      { timeout: 10000 }
    );
    ticketCount = syncroRes.data.tickets?.length || 0;
    console.log(`✅ Found ${ticketCount} unresolved tickets`);

    // Generate new flash frame images
    await generateFlashImages(ticketCount);
  } catch (error) {
    console.error(`❌ Error updating ticket count: ${error.message}`);
    if (error.response) console.error(`   Response: ${JSON.stringify(error.response.data)}`);
  }
}

// Flash animation: alternate between bright and dim every 1 second
async function flashAnimation() {
  if (!brightImageB64 || !dimImageB64) return;
  
  if (flashCounter % 2 === 0) {
    await pushImageToTidbyt(brightImageB64);
  } else {
    await pushImageToTidbyt(dimImageB64);
  }
  flashCounter++;
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(200);
    res.end('Tidbyt Syncro Backend Running\n');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🌐 HTTP Server listening on port ${PORT}\n`));

// Initial fetch and generate flash frames
updateTidbyt();

// Update ticket count every 5 minutes
setInterval(updateTidbyt, 5 * 60 * 1000);

// Flash animation every 1 second (alternates bright/dim)
setInterval(flashAnimation, 1000);

// Push initial bright frame after a short delay
setTimeout(() => flashAnimation(), 500);

process.on('SIGTERM', () => process.exit(0));
