const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@adiwajshing/baileys');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Membaca atau membuat config.json
let config = {};
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} else {
    // Jika belum ada, minta input nomor admin
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Masukkan nomor admin (contoh: 628123456789): ', (number) => {
        config.adminNumber = number.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        rl.close();
        startBot();
    });
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome')
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            // Tidak menggunakan QR, tapi pairing code
            console.log('QR code diabaikan, menggunakan pairing code.');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Bot terhubung!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Generate pairing code
    sock.ev.on('connection.update', async (update) => {
        if (update.connection === 'connecting') {
            const { registration } = sock.authState.creds;
            if (!registration) {
                const phoneNumber = config.adminNumber.split('@')[0];
                try {
                    const pairingCode = await sock.requestPairingCode(phoneNumber);
                    console.log(`Pairing Code: ${pairingCode}`);
                } catch (error) {
                    console.error('Gagal mendapatkan pairing code:', error);
                }
            }
        }
    });

    // Handle messages
    sock.ev.on('messages.upsert', ({ messages }) => {
        if (messages[0].key.remoteJid.endsWith('@s.whatsapp.net')) {
            require('./command')(sock, messages[0], config);
        }
    });
}

// Jika config sudah ada, langsung start bot
if (Object.keys(config).length !== 0) {
    startBot();
}