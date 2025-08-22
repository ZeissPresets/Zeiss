const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, Browsers, delay } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Interface untuk input dari terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Array untuk menyimpan semua koneksi socket
const sockets = [];
const configFile = './config.json';

/**
 * Fungsi utama untuk inisialisasi aplikasi
 * Meminta input nomor admin dan jumlah koneksi
 * Membuat koneksi WhatsApp sebanyak yang diminta
 */
async function init() {
    console.log('=== WhatsApp Bot dengan Multiple Connections ===\n');
    
    try {
        // Baca config jika sudah ada, atau minta input baru
        let adminNumber;
        if (fs.existsSync(configFile)) {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            adminNumber = config.adminNumber;
            console.log(`✅ Nomor admin ditemukan: ${adminNumber}`);
        } else {
            adminNumber = await new Promise(resolve => {
                rl.question('📱 Masukkan nomor WhatsApp admin (contoh: 628123456789): ', resolve);
            });
            
            // Validasi nomor
            if (!adminNumber.startsWith('62')) {
                console.log('❌ Format nomor salah! Gunakan format Indonesia (62)');
                process.exit(1);
            }
            
            const config = { adminNumber };
            fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
            console.log('✅ Config.json berhasil dibuat!');
        }

        // Jumlah koneksi yang ingin dibuat
        const numConnections = await new Promise(resolve => {
            rl.question('🔢 Masukkan jumlah koneksi yang ingin dibuat: ', (answer) => {
                resolve(parseInt(answer) || 1);
            });
        });

        console.log(`\n🔄 Membuat ${numConnections} koneksi...`);

        for (let i = 0; i < numConnections; i++) {
            await createConnection(i, adminNumber);
            await delay(1000); // Delay antar koneksi
        }

        rl.close();
    } catch (error) {
        console.error('❌ Error:', error);
        rl.close();
        process.exit(1);
    }
}

/**
 * Membuat koneksi WhatsApp dengan pairing code
 * @param {number} index - Index koneksi
 * @param {string} adminNumber - Nomor admin WhatsApp
 */
async function createConnection(index, adminNumber) {
    const authFile = `./auth_info_${index}.json`;
    
    console.log(`\n🔗 Membuat Connection-${index}...`);
    
    // Inisialisasi auth state
    const { state, saveState } = useSingleFileAuthState(authFile);

    try {
        // Membuat socket connection dengan pairing code
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS(`Connection-${index}`),
            logger: { level: 'warn' } // Kurangi log untuk multiple connections
        });

        // Handle connection update untuk mendapatkan pairing code
        sock.ev.on('connection.update', (update) => {
            const { connection, qr, pairingCode } = update;
            
            // Tampilkan pairing code jika tersedia
            if (pairingCode) {
                console.log(`\n=== PAIRING CODE untuk Connection-${index} ===`);
                console.log(pairingCode);
                console.log('============================================');
                console.log('📝 Gunakan kode di atas untuk pairing dari device lain');
            }

            if (connection === 'open') {
                console.log(`✅ Connection-${index} berhasil terhubung!`);
                
                // Setup command handler setelah terhubung
                setupCommandHandler(sock, adminNumber, index);
            }

            if (connection === 'close') {
                const shouldReconnect = (new Boom(sock.lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`❌ Connection-${index} tertutup`, shouldReconnect ? 'mencoba reconnect...' : 'silakan pairing ulang');
                
                if (shouldReconnect) {
                    setTimeout(() => createConnection(index, adminNumber), 5000);
                }
            }
        });

        // Save auth state changes
        sock.ev.on('creds.update', saveState);

        // Handle errors
        sock.ev.on('connection.update', (update) => {
            const { lastDisconnect } = update;
            if (lastDisconnect) {
                console.log(`❌ Connection-${index} terputus:`, lastDisconnect.error);
            }
        });

        // Simpan socket ke array
        sockets.push(sock);
        return sock;
    } catch (error) {
        console.error(`❌ Gagal membuat Connection-${index}:`, error);
    }
}

/**
 * Setup handler untuk command WhatsApp
 * @param {object} sock - Socket connection
 * @param {string} adminNumber - Nomor admin WhatsApp
 * @param {number} connectionIndex - Index koneksi
 */
function setupCommandHandler(sock, adminNumber, connectionIndex) {
    // Import command handler
    const { handleCommand } = require('./command');
    
    // Event ketika menerima pesan
    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.key.fromMe && message.key.remoteJid === adminNumber + '@s.whatsapp.net') {
            const text = message.message?.conversation || 
                         message.message?.extendedTextMessage?.text || '';

            // Handle command
            await handleCommand(sock, adminNumber, connectionIndex, text);
        }
    });
}

// Jalankan aplikasi
init();

// Handle proses exit
process.on('SIGINT', () => {
    console.log('\n🛑 Menghentikan aplikasi...');
    process.exit(0);
});