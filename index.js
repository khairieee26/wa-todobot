// const { Client, LocalAuth } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');
// const axios = require('axios');

// const SUPABASE_URL = 'https://ltgtjdvegouzwosezmex.supabase.co';     // GANTI INI
// const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0Z3RqZHZlZ291endvc2V6bWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNDY5MDYsImV4cCI6MjA3OTkyMjkwNn0.mrK5Eex7foSdVTuJ2rSfYOmmzb8WQcWcbKvfIBNFpjc'; // GANTI INI

// const client = new Client({
//     authStrategy: new LocalAuth(),
//     puppeteer: { headless: true }
// });

// client.on('qr', qr => {
//     qrcode.generate(qr, { small: true });
// });

// client.on('ready', () => {
//     console.log('Bot WhatsApp SIAP! Kirim /todo atau /note');
// });

// client.on('message', async msg => {
//     const text = msg.body;

//     // /todo Beli susu @2025-12-05   ← format dengan tanggal opsional
//     if (text.startsWith('/todo')) {
//         let content = text.slice(5).trim();
//         let planned_at = null;

//         const dateMatch = content.match(/@(\d{4}-\d{2}-\d{2})/);
//         if (dateMatch) {
//             planned_at = dateMatch[1];
//             content = content.replace(/@\d{4}-\d{2}-\d{2}/, '').trim();
//         }

//         await axios.post(`${SUPABASE_URL}/rest/v1/todos`, {
//             content,
//             type: 'todo',
//             planned_at
//         }, {
//             headers: {
//                 apikey: SUPABASE_KEY,
//                 Authorization: `Bearer ${SUPABASE_KEY}`,
//                 'Content-Type': 'application/json',
//                 Prefer: 'return=minimal'
//             }
//         });

//         msg.reply(`Todo tersimpan:\n${content}${planned_at ? '\nRencana: ' + planned_at : ''}`);
//     }

//     if (text.startsWith('/note')) {
//         const content = text.slice(5).trim();
//         await axios.post(`${SUPABASE_URL}/rest/v1/todos`, {
//             content,
//             type: 'note'
//         }, {
//             headers: {
//                 apikey: SUPABASE_KEY,
//                 Authorization: `Bearer ${SUPABASE_KEY}`,
//                 'Content-Type': 'application/json'
//             }
//         });
//         msg.reply(`Catatan tersimpan:\n${content}`);
//     }
// });

// client.initialize();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL atau SUPABASE_KEY belum diisi di Variables!');
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: 'auth_info' }),
  puppeteer: {
    headless: true,
    executablePath: '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  }
});

client.on('qr', (qr) => {
  console.log('\n\nSCAN QR INI DI WHATSAPP KAMU (Linked Devices):');
  qrcode.generate(qr, { small: true });
  console.log('\nQR akan hilang setelah discan. Bot akan jalan otomatis selamanya.\n');
});

client.on('ready', () => {
  console.log('BOT WHATSAPP SUDAH ONLINE 24/7 DI REPLIT!');
});

client.on('authenticated', () => {
  console.log('Login berhasil – tidak perlu scan QR lagi mulai sekarang');
});

client.on('auth_failure', () => {
  console.log('Login gagal – hapus folder auth_info lalu restart bot');
});

client.on('message', async (msg) => {
  const text = msg.body.trim();

  if (text.startsWith('/todo')) {
    let content = text.slice(5).trim();
    let planned_at = null;

    const match = content.match(/@(\d{4}-\d{2}-\d{2})$/);
    if (match) {
      planned_at = match[1];
      content = content.replace(/@\d{4}-\d{2}-\d{2}$/, '').trim();
    }

    if (content === '') return;

    try {
      await axios.post(`${SUPABASE_URL}/rest/v1/todos`, {
        content,
        type: 'todo',
        planned_at
      }, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        }
      });
      msg.reply(`Todo tersimpan:\n${content}${planned_at ? '\nRencana: ' + planned_at : ''}`);
    } catch (e) {
      msg.reply('Gagal simpan todo');
    }
  }

  else if (text.startsWith('/note')) {
    const content = text.slice(5).trim();
    if (content === '') return;

    try {
      await axios.post(`${SUPABASE_URL}/rest/v1/todos`, {
        content,
        type: 'note'
      }, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      msg.reply(`Catatan tersimpan:\n${content}`);
    } catch (e) {
      msg.reply('Gagal simpan catatan');
    }
  }
});

client.initialize();
