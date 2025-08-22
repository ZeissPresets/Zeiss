const {
  default: makeWASocket,
  useMultiFileAuthState,
  Browsers,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');
const qrcode = require('qrcode-terminal');
const Pino = require('pino');
const { handleCommand } = require('./command');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const SESSION_DIR = path.join(__dirname, 'session');

(async () => {
  const argv = process.argv.slice(2);
  if (argv.includes('--reset')) {
    await fs.remove(SESSION_DIR);
    console.log('🧹 Session dihapus. Jalankan ulang untuk login ulang.');
    process.exit(0);
  }

  const cfg = await loadOrCreateConfig();
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  async function startSock() {
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: Pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome')
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        console.log('✅ Bot terhubung ke WhatsApp!');
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.log('❌ Logged out. Menghapus session...');
          await fs.remove(SESSION_DIR);
        }
        console.log('🔄 Reconnecting...');
        startSock();
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages?.[0];
      if (!msg?.message || msg.key.fromMe) return;
      try {
        await handleCommand({ sock, msg, cfg });
      } catch (err) {
        console.error('Command error:', err.message);
      }
    });
  }

  async function loadOrCreateConfig() {
    if (!(await fs.pathExists(CONFIG_PATH))) {
      const prompt = require('prompt-sync')({ sigint: true });
      const admin = prompt('Masukkan nomor admin (628xxxx): ').replace(/[^\d]/g, '');
      const conf = { admin, prefix: '.' };
      await fs.writeJson(CONFIG_PATH, conf, { spaces: 2 });
      return conf;
    }
    return fs.readJson(CONFIG_PATH);
  }

  await startSock();
})();