import AttackManager from './attack.js';
import logger from './logger.js';

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
                try {
                    const menuText = `
🤖 *BOT WHATSAPP MENU* 🤖

*🔧 PERINTAH YANG TERSEDIA:*

*📊 INFORMATION*
• *.menu* - Menampilkan menu ini
• *.help* - Bantuan command
• *.status* - Status bot dan statistics
• *.info* - Info tentang bot
• *.ping* - Test respon bot
• *.logs* - Lihat log terbaru

*⚡ ATTACK COMMANDS*
• *.attack <url> <detik>* - Attack website (max 300s)
• *.stopattack* - Hentikan semua attack
• *.stats* - Lihat statistics attack
• *.listattack* - Lihat attack aktif

*🛠️ UTILITY*
• *.time* - Waktu server sekarang
• *.calc <expression>* - Kalkulator sederhana
• *.quote* - Dapatkan random quote

*👤 USER*
• *.profile* - Info profile Anda
• *.mystats* - Statistics penggunaan Anda

*⚙️ SYSTEM*
• *.restart* - Restart bot
• *.cleanup* - Bersihkan session
• *.clearlogs* - Bersihkan logs

*⚠️ PERINGATAN:*
Gunakan fitur ini dengan bijak dan hanya untuk testing legal!
                    `;
                    await this.sendMessage(sender, menuText);
                } catch (error) {
                    logger.error('Error in menu command', error);
                    await this.sendMessage(sender, '❌ Error menampilkan menu');
                }
            }
        });

        // Command .help
        this.commands.set('help', {
            description: 'Bantuan command',
            usage: '.help [command]',
            handler: async (message, args, sender) => {
                try {
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
                        const categories = {};
                        
                        this.commands.forEach((cmd, name) => {
                            const category = cmd.description.includes('attack') ? 'ATTACK' :
                                            cmd.description.includes('status') ? 'INFO' :
                                            cmd.description.includes('user') ? 'USER' :
                                            cmd.description.includes('system') ? 'SYSTEM' : 'UTILITY';
                            
                            if (!categories[category]) categories[category] = [];
                            categories[category].push(`• *.${name}* - ${cmd.description}`);
                        });

                        for (const [category, commands] of Object.entries(categories)) {
                            helpText += `*${category}:*\n${commands.join('\n')}\n\n`;
                        }
                        
                        helpText += 'ℹ️ Gunakan *.help <command>* untuk info detail command';
                        await this.sendMessage(sender, helpText);
                    }
                } catch (error) {
                    logger.error('Error in help command', error);
                    await this.sendMessage(sender, '❌ Error menampilkan bantuan');
                }
            }
        });

        // Command .attack (Improved with error handling)
        this.commands.set('attack', {
            description: 'Melakukan attack ke URL tertentu',
            usage: '.attack <url> <duration_in_seconds> [concurrency]',
            handler: async (message, args, sender) => {
                try {
                    this.updateUserStats(sender, 'attack');
                    
                    if (args.length < 2) {
                        await this.sendMessage(sender, 
                            '❌ Format salah! Gunakan: .attack <url> <detik> [concurrency]\n' +
                            'Contoh: .attack example.com 30 5\n' +
                            'Contoh: .attack https://example.com 60'
                        );
                        return;
                    }

                    let url = args[0];
                    const duration = parseInt(args[1]) * 1000;
                    const concurrency = args[2] ? parseInt(args[2]) : 3;

                    // Validasi duration
                    if (isNaN(duration) || duration <= 0) {
                        await this.sendMessage(sender, '❌ Durasi harus angka positif!');
                        return;
                    }

                    if (duration > 300000) {
                        await this.sendMessage(sender, '❌ Durasi maksimal 300 detik (5 menit)');
                        return;
                    }

                    if (concurrency > 10) {
                        await this.sendMessage(sender, '❌ Concurrency maksimal 10');
                        return;
                    }

                    await this.sendMessage(sender, 
                        `⚡ *Command terdeteksi .attack akan di jalankan segera...*\n\n` +
                        `📡 Target: ${url}\n` +
                        `⏰ Durasi: ${args[1]} detik\n` +
                        `🔢 Concurrency: ${concurrency}\n` +
                        `🔄 Memulai attack...`
                    );

                    const attackId = await this.attackManager.startAttack(url, duration, concurrency);
                    
                    // Kirim update berkala
                    const interval = setInterval(async () => {
                        try {
                            const status = this.attackManager.getAttackStatus(attackId);
                            if (!status || !status.active) {
                                clearInterval(interval);
                                return;
                            }

                            await this.sendMessage(sender,
                                `📊 *Attack Progress [${attackId}]*\n\n` +
                                `✅ Requests: ${status.requests}\n` +
                                `🎯 Success: ${status.successful}\n` +
                                `⏱️ Elapsed: ${status.elapsed}s\n` +
                                `⏳ Remaining: ${status.remaining}s\n` +
                                `📈 Progress: ${status.progress}%`
                            );
                        } catch (error) {
                            logger.error('Error in attack progress update', error);
                            clearInterval(interval);
                        }
                    }, 15000);

                } catch (error) {
                    logger.error('Error in attack command', error);
                    await this.sendMessage(sender, 
                        `❌ Error: ${error.message}\n` +
                        `💡 Pastikan URL valid dan koneksi internet stabil`
                    );
                }
            }
        });

        // Command .logs
        this.commands.set('logs', {
            description: 'Lihat log terbaru',
            usage: '.logs [limit]',
            handler: async (message, args, sender) => {
                try {
                    const limit = args[0] ? parseInt(args[0]) : 5;
                    const logs = logger.getRecentLogs(limit);
                    
                    if (logs.length === 0) {
                        await this.sendMessage(sender, '📭 Tidak ada log tersedia');
                        return;
                    }

                    let logText = `📋 *LOG TERBARU (${logs.length})*\n\n`;
                    
                    logs.forEach((log, index) => {
                        const time = new Date(log.timestamp).toLocaleTimeString('id-ID');
                        logText += `*[${index + 1}]* ${time} - ${log.level.toUpperCase()}: ${log.message}\n`;
                    });

                    await this.sendMessage(sender, logText);
                } catch (error) {
                    logger.error('Error in logs command', error);
                    await this.sendMessage(sender, '❌ Error menampilkan logs');
                }
            }
        });

        // Command .clearlogs
        this.commands.set('clearlogs', {
            description: 'Bersihkan logs',
            usage: '.clearlogs',
            handler: async (message, args, sender) => {
                try {
                    logger.clearLogs();
                    await this.sendMessage(sender, '🧹 Logs berhasil dibersihkan');
                } catch (error) {
                    logger.error('Error in clearlogs command', error);
                    await this.sendMessage(sender, '❌ Error membersihkan logs');
                }
            }
        });

        // ... (other commands with similar error handling)
    }

    // Helper methods dengan error handling
    updateUserStats(sender, command) {
        try {
            const now = new Date().toLocaleString('id-ID');
            if (!this.userStats.has(sender)) {
                this.userStats.set(sender, { commands: 0, lastCommand: null });
            }
            
            const stats = this.userStats.get(sender);
            stats.commands++;
            stats.lastCommand = now;
        } catch (error) {
            logger.error('Error updating user stats', error);
        }
    }

    formatUptime(seconds) {
        try {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            
            return `${days}d ${hours}h ${minutes}m ${secs}s`;
        } catch (error) {
            return 'Unknown';
        }
    }

    async handleCommand(message) {
        try {
            // Extract text dengan error handling
            let text = '';
            try {
                text = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || 
                       message.message?.buttonsResponseMessage?.selectedDisplayText || '';
            } catch (error) {
                logger.warn('Failed to extract message text', error);
                return false;
            }
            
            if (!text.startsWith('.')) return false;

            const args = text.slice(1).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const sender = message.key.remoteJid;

            logger.info(`Command detected`, { command: commandName, sender });

            if (this.commands.has(commandName)) {
                // Kirim notifikasi command terdeteksi
                await this.sendMessage(sender, 
                    `⚡ *Command terdeteksi .${commandName} akan di jalankan segera...*\n` +
                    `🔄 Memproses permintaan Anda...`,
                    false
                );

                try {
                    const command = this.commands.get(commandName);
                    await command.handler(message, args, sender);
                    return true;
                } catch (error) {
                    logger.error(`Error executing command .${commandName}`, error);
                    await this.sendMessage(sender, 
                        `❌ Error menjalankan command: ${error.message}\n` +
                        `💡 Gunakan *.help ${commandName}* untuk bantuan`
                    );
                    return true;
                }
            }

            // Jika command tidak ditemukan
            await this.sendMessage(sender, 
                `❌ Command *.${commandName}* tidak ditemukan!\n` +
                `ℹ️ Gunakan *.menu* untuk melihat daftar command yang tersedia.`
            );
            return true;

        } catch (error) {
            logger.error('Error handling command', error);
            return false;
        }
    }

    async sendMessage(jid, text, log = true) {
        try {
            await this.sock.sendMessage(jid, { text: text });
            if (log) {
                logger.debug('Message sent', { to: jid, length: text.length });
            }
            return true;
        } catch (error) {
            logger.error('Error sending message', { to: jid, error: error.message });
            return false;
        }
    }

    stopAllAttacks() {
        try {
            this.attackManager.stopAllAttacks();
        } catch (error) {
            logger.error('Error stopping attacks', error);
        }
    }

    cleanup() {
        try {
            this.attackManager.cleanup();
            logger.info('Command handler cleaned up');
        } catch (error) {
            logger.error('Error during cleanup', error);
        }
    }
}

export default CommandHandler;