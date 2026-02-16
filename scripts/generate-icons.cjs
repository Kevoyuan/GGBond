const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * 🎨 Icon Generation Script (macOS Optimized)
 * This script renders a premium "Squircle" macOS icon with a pink-purple gradient.
 */

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const MASTER_PNG_PATH = path.join(PUBLIC_DIR, 'icon.png');
const ICONSET_DIR = path.join(PUBLIC_DIR, 'icon.iconset');

async function generateIcons() {
    console.log('🎨 Starting premium icon generation...');

    const win = new BrowserWindow({
        show: false,
        width: 1024,
        height: 1024,
        transparent: true,
        frame: false,
        backgroundColor: '#00000000',
        webPreferences: {
            offscreen: true,
            backgroundThrottling: false
        }
    });

    // Luxurious Squircle + Pink-Purple Gradient + Dark Purple Star
    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; padding: 0; background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center; width: 1024px; height: 1024px;">
        <div style="
          width: 824px; 
          height: 824px; 
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 180px;
          box-shadow: 0 40px 100px rgba(0,0,0,0.15);
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.05);
        ">
          <!-- Gemini Star (Purple-Pink Gradient) -->
          <svg width="520" height="520" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="z-index: 10; filter: drop-shadow(0 12px 24px rgba(49, 27, 146, 0.35));">
            <defs>
              <linearGradient id="premium-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#311b92; stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ff80b5; stop-opacity:1" />
              </linearGradient>
            </defs>
            <path d="M12 24C12 17.3726 17.3726 12 24 12C17.3726 12 12 6.62742 12 0C12 6.62742 6.62742 12 0 12C6.62742 12 12 17.3726 12 24Z" fill="url(#premium-gradient)" />
          </svg>
        </div>
      </body>
    </html>
  `;

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Wait for rendering
    await new Promise(r => setTimeout(r, 1000));

    const image = await win.webContents.capturePage();
    const pngBuffer = image.toPNG();

    fs.writeFileSync(MASTER_PNG_PATH, pngBuffer);
    console.log(`✅ Generated premium PNG at ${MASTER_PNG_PATH}`);

    win.close();

    // macOS Iconset Generation
    if (process.platform === 'darwin') {
        console.log('🍎 Generating macOS .icns file...');

        if (fs.existsSync(ICONSET_DIR)) {
            fs.rmSync(ICONSET_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(ICONSET_DIR);

        const sizes = [
            { name: 'icon_16x16.png', size: 16 },
            { name: 'icon_16x16@2x.png', size: 32 },
            { name: 'icon_32x32.png', size: 32 },
            { name: 'icon_32x32@2x.png', size: 64 },
            { name: 'icon_128x128.png', size: 128 },
            { name: 'icon_128x128@2x.png', size: 256 },
            { name: 'icon_256x256.png', size: 256 },
            { name: 'icon_256x256@2x.png', size: 512 },
            { name: 'icon_512x512.png', size: 512 },
            { name: 'icon_512x512@2x.png', size: 1024 },
        ];

        try {
            for (const { name, size } of sizes) {
                execSync(`sips -z ${size} ${size} "${MASTER_PNG_PATH}" --out "${path.join(ICONSET_DIR, name)}"`);
            }
            execSync(`iconutil -c icns "${ICONSET_DIR}" -o "${path.join(PUBLIC_DIR, 'icon.icns')}"`);
            console.log(`✅ Generated icon.icns at ${path.join(PUBLIC_DIR, 'icon.icns')}`);
            fs.rmSync(ICONSET_DIR, { recursive: true, force: true });
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }

    app.quit();
}

app.whenReady().then(generateIcons);
