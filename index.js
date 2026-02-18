// const { Client, LocalAuth } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');
// const axios = require('axios');

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
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: SUPABASE_URL atau SUPABASE_KEY belum diisi!");
  process.exit(1);
}

// State sementara per user
const pendingNote = {}; // { '628xxx@c.us': 'isi catatan yang nunggu judul' }

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "auth_info" }),
  puppeteer: {
    headless: true,
    executablePath:
      "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium-browser",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
    ],
  },
});

client.on("qr", (qr) => {
  console.clear();
  console.log("SCAN QR DI BAWAH INI (Linked Devices):");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("NOTE BOT (APPEND STYLE) SUDAH ONLINE 24/7!");
});

client.on("authenticated", () => {
  console.log("Login berhasil – tidak perlu scan QR lagi mulai sekarang");
});

client.on("auth_failure", () => {
  console.log("Login gagal – hapus folder auth_info lalu restart bot");
});

// Ambil semua judul user
async function getUserTitles(userId) {
  const { data } = await axios
    .get(
      `${SUPABASE_URL}/rest/v1/user_notes?user_id=eq.${userId}&select=title`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      },
    )
    .catch(() => ({ data: [] }));
  return data.map((x) => x.title);
}

// Simpan atau append note
async function saveOrAppendNote(userId, title, newContent) {
  const { data } = await axios.get(
    `${SUPABASE_URL}/rest/v1/user_notes?user_id=eq.${userId}&title=eq.${encodeURIComponent(title)}&select=id,content`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    },
  );

  if (data && data[0]) {
    // Judul sudah ada → append
    const oldContent = data[0].content.trim();
    const updatedContent = oldContent
      ? `${oldContent}\n- ${newContent.trim()}`
      : `- ${newContent.trim()}`;

    await axios.patch(
      `${SUPABASE_URL}/rest/v1/user_notes?id=eq.${data[0].id}`,
      { content: updatedContent, updated_at: new Date().toISOString() },
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      },
    );
  } else {
    // Judul baru
    await axios.post(
      `${SUPABASE_URL}/rest/v1/user_notes`,
      {
        user_id: userId,
        title,
        content: `- ${newContent.trim()}`,
      },
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "resolution=merge-duplicates",
        },
      },
    );
  }
}

client.on("message", async (msg) => {
  const from = msg.from;
  const text = msg.body.trim();

  // 1. User kirim /note [isi]
  if (text.startsWith("/note ")) {
    const content = text.slice(6).trim();
    if (!content) return msg.reply("Kirim /note [isi catatan]");

    pendingNote[from] = content;

    const titles = await getUserTitles(from);
    const defaultTitles =
      titles.length > 0 ? titles : ["Thoughts", "Diary", "Work", "Ideas"];

    let reply = "Catatan diterima!\n\nPilih atau buat judul baru:\n";
    defaultTitles.forEach((t, i) => (reply += `${i + 1}. ${t}\n`));
    reply += "\n(balas angka atau ketik judul baru)";

    msg.reply(reply);
    return;
  }

  // 2. User lagi nunggu judul (ada pending note)
  if (pendingNote[from]) {
    const content = pendingNote[from];
    let chosenTitle = "Thoughts"; // default

    const num = parseInt(text);
    const titles = await getUserTitles(from);
    const availableTitles =
      titles.length > 0 ? titles : ["Thoughts", "Diary", "Work", "Ideas"];

    if (!isNaN(num) && num > 0 && num <= availableTitles.length) {
      chosenTitle = availableTitles[num - 1];
    } else if (text.length > 0) {
      chosenTitle = text.trim();
    }

    await saveOrAppendNote(from, chosenTitle, content);
    delete pendingNote[from];

    msg.reply(
      `Berhasil ditambahkan ke:\n*${chosenTitle}*\n\n(Total isi akan bertambah dengan bullet baru)`,
    );
  }
});

client.initialize();


