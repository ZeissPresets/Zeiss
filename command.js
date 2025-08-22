const { attack } = require('./attack');

async function handleCommand({ sock, msg, cfg }) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const m = msg.message;
  const text =
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    '';

  const p = cfg.prefix || '.';
  if (!text.startsWith(p)) return;

  const args = text.slice(p.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (cmd === 'attack') {
    // Cek admin
    if (!sender.includes(cfg.admin)) {
      return sock.sendMessage(from, { text: '❌ Anda tidak memiliki izin menjalankan perintah ini.' });
    }

    if (args.length < 2) {
      return sock.sendMessage(from, { text: `Format: ${p}attack <url> <durasi>` });
    }

    const url = args[0];
    const duration = parseInt(args[1]);

    await sock.sendMessage(from, {
      text: `🚀 Memulai pengujian ke ${url} selama ${duration}s (100 threads, delay 100ms)`
    });

    attack(url, duration, (status) => {
      sock.sendMessage(from, { text: status });
    });
  }
}

module.exports = { handleCommand };