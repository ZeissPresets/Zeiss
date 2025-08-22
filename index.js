const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const path = require('path');
const { handleCommand } = require('./command');

const configPath = path.join(__dirname, 'config.json');

(async () => {
    // Cek apakah nomor WA sudah disimpan
    if (!fs.existsSync(configPath)) {
        const prompt = require('prompt-sync')();
        const nomor = prompt("Masukkan Nomor WhatsApp (Format: 628xxxxxx): ");
        fs.writeFileSync(configPath, JSON.stringify({ nomor }, null, 2));
        console.log(`Nomor ${nomor} disimpan di config.json`);
    }

    // Setup session
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    // Event koneksi
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) {
            console.log('Scan QR Code berikut untuk koneksi WhatsApp:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('✅ Koneksi Berhasil ke WhatsApp!');
        } else if (connection === 'close') {
            console.log('❌ Koneksi Terputus, mencoba reconnect...');
        }
    });

    // Event pesan masuk
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const pesan = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (pesan && pesan.startsWith('.')) {
            await handleCommand(sock, msg, pesan);
        }
    });

    // Simpan session credentials
    sock.ev.on('creds.update', saveCreds);
})();