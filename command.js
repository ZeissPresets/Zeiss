import AttackManager from './attack.js';
import chalk from 'chalk';

class CommandHandler {
    constructor(sock) {
        this.sock = sock;
        this.attackManager = new AttackManager();
        this.commands = new Map();
        this.userStats = new Map();
        this.setupCommands();
    }

    setupCommands() {
        // Command .menu
        this.commands.set('menu', {
            description: 'Menampilkan menu bot',
            usage: '.menu',
            handler: async (message, args, sender) => {
                const menuText = `
🤖 *BOT WHATSAPP MENU* 🤖

*🔧 PERINTAH YANG TERSEDIA:*

*📊 INFORMATION*
• *.menu* - Menampilkan menu ini
• *.help* - Bantuan command
• *.status* - Status bot dan statistics
• *.info* - Info tentang bot
• *.ping* - Test respon bot

*⚡ ATTACK COMMANDS*
• *.attack <url> <detik>* - Attack website (max 300s)
• *.stopattack* - Hentikan semua attack
• *.stats* - Lihat statistics attack

*🛠️ UTILITY*
• *.time* - Waktu server sekarang
• *.calc <expression>* - Kalkulator sederhana
• *.quote* - Dapatkan random quote

*👤 USER*
• *.profile* - Info profile Anda
• *.mystats* - Statistics penggunaan Anda

*⚠️ PERINGATAN:*
Gunakan fitur ini dengan bijak dan hanya untuk testing legal!
                `;
                await this.sendMessage(sender, menuText, 'Command .menu berhasil dijalankan!');
            }
        });

        // Command .help
        this.commands.set('help', {
            description: 'Bantuan command',
            usage: '.help [command]',
            handler: async (message, args, sender) => {
                if (args.length > 0) {
                    const cmdName = args[0].toLowerCase();
                    if (this.commands.has(cmdName)) {
                        const cmd = this.commands.get(cmdName);
                        await this.sendMessage(sender, 
                            `*🔧 Bantuan Command: .${cmdName}*\n\n` +
                            `*Deskripsi:* ${cmd.description}\n` +
                            `*Usage:* ${cmd.usage}\n` +
                            `*Contoh:* .${cmdName}${cmd.usage.includes('<') ? ' ' + cmd.usage.split(' ')[1] : ''}`
                        );
                    } else {
                        await this.sendMessage(sender, `❌ Command *.${cmdName}* tidak ditemukan!`);
                    }
                } else {
                    let helpText = '*📚 DAFTAR COMMAND YANG TERSEDIA:*\n\n';
                    this.commands.forEach((cmd, name) => {
                        helpText += `• *.${name}* - ${cmd.description}\n`;
                    });
                    helpText += '\nℹ️ Gunakan *.help <command>* untuk info detail command';
                    await this.sendMessage(sender, helpText);
                }
            }
        });

        // Command .attack
        this.commands.set('attack', {
            description: 'Melakukan attack ke URL tertentu',
            usage: '.attack <url> <duration_in_seconds> [concurrency]',
            handler: async (message, args, sender) => {
                this.updateUserStats(sender, 'attack');
                
                if (args.length < 2) {
                    await this.sendMessage(sender, 
                        '❌ Format salah! Gunakan: .attack <url> <detik> [concurrency]\n' +
                        'Contoh: .attack https://example.com 30 5'
                    );
                    return;
                }

                const url = args[0];
                const duration = parseInt(args[1]) * 1000;
                const concurrency = args[2] ? parseInt(args[2]) : 3;

                if (duration > 300000) {
                    await this.sendMessage(sender, '❌ Durasi maksimal 300 detik (5 menit)');
                    return;
                }

                if (concurrency > 10) {
                    await this.sendMessage(sender, '❌ Concurrency maksimal 10');
                    return;
                }

                await this.sendMessage(sender, 
                    `🚀 *Command terdeteksi .attack akan di jalankan segera...*\n\n` +
                    `📡 Target: ${url}\n` +
                    `⏰ Durasi: ${args[1]} detik\n` +
                    `🔢 Concurrency: ${concurrency}\n` +
                    `🔄 Memulai attack...`
                );

                try {
                    const result = await this.attackManager.startAttack(url, duration, concurrency);
                    await this.sendMessage(sender, 
                        `✅ *Attack Selesai!*\n\n` +
                        `📊 Total Requests: ${result.totalRequests}\n` +
                        `✅ Berhasil: ${result.successful}\n` +
                        `❌ Gagal: ${result.failed}\n` +
                        `🎯 Success Rate: ${result.successRate}%\n` +
                        `⏱️ Waktu: ${result.duration.toFixed(2)} detik\n` +
                        `📈 RPS: ${result.rps} requests/detik`
                    );
                } catch (error) {
                    await this.sendMessage(sender, `❌ Error: ${error.message}`);
                }
            }
        });

        // Command .stopattack
        this.commands.set('stopattack', {
            description: 'Menghentikan semua attack',
            usage: '.stopattack',
            handler: async (message, args, sender) => {
                const stopped = this.attackManager.stopAllAttacks();
                await this.sendMessage(sender, 
                    `🛑 *Attack Dihentikan!*\n` +
                    `Berhasil menghentikan ${stopped} attack yang aktif`
                );
            }
        });

        // Command .status
        this.commands.set('status', {
            description: 'Menampilkan status bot',
            usage: '.status',
            handler: async (message, args, sender) => {
                const stats = this.attackManager.getStatistics();
                const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                const uptime = Math.floor(process.uptime());
                
                const statusText = `
📊 *STATUS BOT - REAL TIME*

• 🟢 Bot Online
• 📡 Total Requests: ${this.attackManager.getTotalRequests().toLocaleString()}
• ⚡ Active Attacks: ${stats.activeAttacks}
• 💾 Memory Usage: ${memoryUsage} MB
• ⏰ Uptime: ${this.formatUptime(uptime)}

📈 *STATISTICS:*
• ✅ Success Rate: ${stats.successRate}%
• ❌ Error Rate: ${stats.errorRate}%
• ⏱️ Timeout Rate: ${stats.timeoutRate}%

🤖 *SYSTEM:*
• Node.js: ${process.version}
• Platform: ${process.platform}
                `;
                await this.sendMessage(sender, statusText);
            }
        });

        // Command .stats
        this.commands.set('stats', {
            description: 'Menampilkan statistics attack',
            usage: '.stats',
            handler: async (message, args, sender) => {
                const stats = this.attackManager.getStatistics();
                const activeAttacks = this.attackManager.getActiveAttacks();
                
                let statsText = `📊 *ATTACK STATISTICS*\n\n`;
                statsText += `• 📨 Total Requests: ${stats.totalRequests.toLocaleString()}\n`;
                statsText += `• ⚡ Active Attacks: ${stats.activeAttacks}\n`;
                statsText += `• ✅ Success Rate: ${stats.successRate}%\n`;
                statsText += `• ❌ Error Rate: ${stats.errorRate}%\n`;
                statsText += `• ⏱️ Timeout Rate: ${stats.timeoutRate}%\n\n`;

                if (activeAttacks.length > 0) {
                    statsText += `🔥 *ACTIVE ATTACKS:*\n`;
                    activeAttacks.forEach(([id, attack]) => {
                        const elapsed = Math.floor((Date.now() - attack.startTime) / 1000);
                        const remaining = Math.floor((attack.endTime - Date.now()) / 1000);
                        statsText += `• ${attack.target} (${elapsed}s/${remaining}s remaining)\n`;
                    });
                }

                await this.sendMessage(sender, statsText);
            }
        });

        // Command .ping
        this.commands.set('ping', {
            description: 'Test respon bot',
            usage: '.ping',
            handler: async (message, args, sender) => {
                const startTime = Date.now();
                await this.sendMessage(sender, '🏓 Pong!');
                const endTime = Date.now();
                const pingTime = endTime - startTime;
                
                await this.sendMessage(sender, 
                    `📡 *PONG!*\n` +
                    `⏱️ Response Time: ${pingTime}ms\n` +
                    `🌐 Bot Status: 🟢 ONLINE`
                );
            }
        });

        // Command .time
        this.commands.set('time', {
            description: 'Waktu server sekarang',
            usage: '.time',
            handler: async (message, args, sender) => {
                const now = new Date();
                await this.sendMessage(sender, 
                    `🕐 *WAKTU SERVER*\n\n` +
                    `📅 Tanggal: ${now.toLocaleDateString('id-ID')}\n` +
                    `⏰ Jam: ${now.toLocaleTimeString('id-ID')}\n` +
                    `🌐 Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n` +
                    `📆 Timestamp: ${now.getTime()}`
                );
            }
        });

        // Command .info
        this.commands.set('info', {
            description: 'Info tentang bot',
            usage: '.info',
            handler: async (message, args, sender) => {
                await this.sendMessage(sender, `
ℹ️ *INFORMASI BOT v2.0*

• 🤖 *Nama:* WhatsApp Bot Advanced
• 📚 *Versi:* 2.0.0
• 🛠️ *Developer:* Your Name
• 📅 *Update:* ${new Date().toLocaleDateString('id-ID')}
• ⚡ *Fitur:* 15+ Command, HTTP Attack, Real-time Stats

*🔧 TEKNOLOGI:*
• Baileys WhatsApp API
• Node.js + Express
• Axios HTTP Client
• Advanced Command System

*📊 PERFORMANCE:*
• Multi-Thread Attack
• Real-time Monitoring
• Request Statistics
• User Management

*⚠️ DISCLAIMER:*
Bot ini dibuat untuk tujuan edukasi dan testing. Gunakan dengan bertanggung jawab!
                `);
            }
        });

        // Command .profile
        this.commands.set('profile', {
            description: 'Info profile Anda',
            usage: '.profile',
            handler: async (message, args, sender) => {
                const userStats = this.userStats.get(sender) || { commands: 0, lastCommand: null };
                await this.sendMessage(sender, 
                    `👤 *PROFILE INFO*\n\n` +
                    `📧 User: ${sender}\n` +
                    `📊 Total Commands: ${userStats.commands}\n` +
                    `⏰ Last Command: ${userStats.lastCommand || 'Never'}\n` +
                    `🎯 Status: 🟢 Active User`
                );
            }
        });

        // Command .mystats
        this.commands.set('mystats', {
            description: 'Statistics penggunaan Anda',
            usage: '.mystats',
            handler: async (message, args, sender) => {
                const userStats = this.userStats.get(sender) || { commands: 0, lastCommand: null };
                await this.sendMessage(sender, 
                    `📊 *MY STATISTICS*\n\n` +
                    `👤 User: ${sender.split('@')[0]}\n` +
                    `📨 Total Commands: ${userStats.commands}\n` +
                    `⏰ Last Activity: ${userStats.lastCommand || 'Never'}\n` +
                    `⭐ User Level: ${this.getUserLevel(userStats.commands)}`
                );
            }
        });

        // Command .calc
        this.commands.set('calc', {
            description: 'Kalkulator sederhana',
            usage: '.calc <expression>',
            handler: async (message, args, sender) => {
                if (args.length === 0) {
                    await this.sendMessage(sender, '❌ Format: .calc <expression>\nContoh: .calc 2+2*3');
                    return;
                }

                try {
                    const expression = args.join(' ');
                    // Basic safety check
                    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
                        await this.sendMessage(sender, '❌ Expression tidak valid!');
                        return;
                    }
                    
                    const result = eval(expression);
                    await this.sendMessage(sender, 
                        `🧮 *KALKULATOR*\n\n` +
                        `📝 Expression: ${expression}\n` +
                        `✅ Result: ${result}\n` +
                        `🔢 Type: ${typeof result}`
                    );
                } catch (error) {
                    await this.sendMessage(sender, `❌ Error: ${error.message}`);
                }
            }
        });

        // Command .quote
        this.commands.set('quote', {
            description: 'Dapatkan random quote',
            usage: '.quote',
            handler: async (message, args, sender) => {
                const quotes = [
                    "Hidup adalah tentang belajar, jika kamu berhenti belajar maka kamu berhenti hidup.",
                    "Kesuksesan bukanlah akhir, kegagalan bukanlah halangan. Keberanian untuk melanjutkan yang penting.",
                    "Masa depan tergantung pada apa yang kamu lakukan hari ini.",
                    "Jangan menunggu kesempatan, ciptakan kesempatan.",
                    "Kualitas bukanlah suatu tindakan, melainkan kebiasaan."
                ];
                
                const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                await this.sendMessage(sender, 
                    `💫 *RANDOM QUOTE*\n\n` +
                    `"${randomQuote}"\n\n` +
                    `✨ Have a nice day!`
                );
            }
        });
    }

    // Helper methods
    updateUserStats(sender, command) {
        const now = new Date().toLocaleString('id-ID');
        if (!this.userStats.has(sender)) {
            this.userStats.set(sender, { commands: 0, lastCommand: null });
        }
        
        const stats = this.userStats.get(sender);
        stats.commands++;
        stats.lastCommand = now;
    }

    getUserLevel(commandCount) {
        if (commandCount >= 50) return '🌟 Elite User';
        if (commandCount >= 20) return '🔥 Power User';
        if (commandCount >= 10) return '⭐ Active User';
        if (commandCount >= 5) return '👍 Regular User';
        return '👶 New User';
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    }

    async handleCommand(message) {
        try {
            const text = message.message.conversation || 
                         message.message.extendedTextMessage?.text || 
                         message.message?.buttonsResponseMessage?.selectedDisplayText || '';
            
            if (!text.startsWith('.')) return false;

            const args = text.slice(1).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const sender = message.key.remoteJid;

            if (this.commands.has(commandName)) {
                console.log(chalk.cyan(`🛠️  Command terdeteksi: .${commandName} dari ${sender}`));
                
                // Kirim notifikasi command terdeteksi
                await this.sendMessage(sender, 
                    `⚡ *Command terdeteksi .${commandName} akan di jalankan segera...*` +
                    `\n🔄 Memproses permintaan Anda...`,
                    false // jangan log ke console
                );

                const command = this.commands.get(commandName);
                await command.handler(message, args, sender);
                return true;
            }

            // Jika command tidak ditemukan
            await this.sendMessage(sender, 
                `❌ Command *.${commandName}* tidak ditemukan!\n` +
                `ℹ️ Gunakan *.menu* untuk melihat daftar command yang tersedia.`
            );
            return true;

        } catch (error) {
            console.error(chalk.red('❌ Error handling command:'), error);
            return false;
        }
    }

    async sendMessage(jid, text, log = true) {
        try {
            await this.sock.sendMessage(jid, { text: text });
            if (log) {
                console.log(chalk.green('✅ Pesan dikirim ke:'), jid);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error sending message:'), error);
        }
    }

    stopAllAttacks() {
        this.attackManager.stopAllAttacks();
    }

    // Method untuk mendapatkan semua commands
    getAllCommands() {
        return Array.from(this.commands.entries());
    }
}

export default CommandHandler;