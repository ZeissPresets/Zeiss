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
    console.log('🧹 Session dihapus. Jalankan ulang untuk pairing ulang.');
    process.exit(0);
  }

  const cfg = await loadOrCreateConfig();
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  let sock;
  let connected = false;
  let pairingTimer = null;
  let lastPairReq = 0;

  async function startSock() {
    const browser =
      cfg.authMethod === 'pairing'
        ? Browsers.macOS('Google Chrome')
        : Browsers.ubuntu('Terminal');

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: cfg.authMethod === 'qr',
      logger: Pino({ level: 'silent' }),
      browser
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && cfg.authMethod === 'qr') {
        console.log('📱 Scan QR berikut:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        connected = true;
        clearPairing();
        console.log('✅ Bot terhubung ke WhatsApp!');
      }

      if (connection === 'close') {
        connected = false;
        clearPairing();
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.log('❌ Logged out. Menghapus session dan memulai ulang...');
          await fs.remove(SESSION_DIR);
        } else {
          console.log('🔄 Reconnecting...');
        }
        startSock();
      }

      if (connection === 'connecting' && cfg.authMethod === 'pairing') {
        startPairingLoop();
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages?.[0];
      if (!msg?.message || msg.key.fromMe) return;
      try {
        await handleCommand({ sock, msg, cfg });
      } catch (err) {
        console.error('Command error:', err.message || err);
      }
    });
  }

  function startPairingLoop() {
    clearPairing();
    requestPairing();
    pairingTimer = setInterval(requestPairing, 60000);
  }

  async function requestPairing() {
    if (connected) return;
    const now = Date.now();
    if (now - lastPairReq < 45000) return;
    lastPairReq = now;
    try {
      const code = await sock.requestPairingCode(cfg.phone);
      const formatted = code.replace(/(.{4})/g, '$1-').replace(/-$/, '');
      console.log(`🔐 Pairing Code: ${formatted} (WhatsApp > Perangkat Tertaut > Masukkan Kode)`);
    } catch (e) {
      console.log('Pairing gagal:', e.message);
    }
  }

  function clearPairing() {
    if (pairingTimer) {
      clearInterval(pairingTimer);
      pairingTimer = null;
    }
  }

  async function loadOrCreateConfig() {
    if (!(await fs.pathExists(CONFIG_PATH))) {
      const prompt = require('prompt-sync')({ sigint: true });
      const phone = prompt('Nomor WhatsApp (628xxxx): ').replace(/[^\d]/g, '');
      let method = prompt('Metode login [pairing/qr] (default pairing): ').trim().toLowerCase() || 'pairing';
      if (!['pairing', 'qr'].includes(method)) method = 'pairing';
      const conf = { phone, authMethod: method, prefix: '.' };
      await fs.writeJson(CONFIG_PATH, conf, { spaces: 2 });
      return conf;
    }
    return fs.readJson(CONFIG_PATH);
  }

  await startSock();
})();