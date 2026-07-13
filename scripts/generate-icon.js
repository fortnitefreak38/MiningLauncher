const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svg = `
<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="50%" stop-color="#16213e"/>
      <stop offset="100%" stop-color="#0f3460"/>
    </linearGradient>
    <linearGradient id="pick" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <linearGradient id="handle" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#92400e"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>

  <rect x="8" y="8" width="240" height="240" rx="48" ry="48"
        fill="url(#bg)" stroke="url(#accent)" stroke-width="3"/>

  <!-- Mining pick -->
  <path d="M 100 50 L 180 130 Q 190 140 190 150 L 160 180 Q 150 180 140 170 L 60 90 Q 55 80 65 70 Z"
        fill="url(#pick)" stroke="#64748b" stroke-width="2"/>
  <path d="M 100 50 Q 95 45 88 52 L 95 58 Z"
        fill="#e2e8f0" stroke="#64748b" stroke-width="1"/>

  <!-- Handle -->
  <rect x="148" y="166" width="14" height="60" rx="4"
        fill="url(#handle)" transform="rotate(-45 155 196)"/>

  <!-- Gear ring -->
  <circle cx="128" cy="128" r="36" fill="none"
          stroke="url(#accent)" stroke-width="5" stroke-dasharray="8 4"/>
  <circle cx="128" cy="128" r="12" fill="url(#accent)" opacity="0.8"/>

  <!-- Network nodes -->
  <circle cx="128" cy="56" r="5" fill="#3b82f6" opacity="0.7"/>
  <circle cx="200" cy="128" r="5" fill="#06b6d4" opacity="0.7"/>
  <circle cx="128" cy="200" r="5" fill="#3b82f6" opacity="0.7"/>
  <circle cx="56" cy="128" r="5" fill="#06b6d4" opacity="0.7"/>

  <text x="128" y="234" text-anchor="middle" font-family="monospace"
        font-size="14" fill="#3b82f6" font-weight="bold" opacity="0.6">H/s</text>
</svg>
`;

async function gen() {
  const outDir = path.join(__dirname, '..', 'src', 'main');
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  fs.writeFileSync(path.join(outDir, 'icon.png'), buf);
  fs.writeFileSync(path.join(outDir, 'tray-icon.png'), buf);
  console.log('Icon 256x256 generated successfully');
}

gen().catch(console.error);
