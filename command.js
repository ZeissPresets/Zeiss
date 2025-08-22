const attack = require('./attack');
const fs = require('fs');
const path = require('path');

// Load custom commands
let customCommands = {};
const commandsPath = path.join(__dirname, 'custom-commands.json');
if (fs.existsSync(commandsPath)) {
    try {
        customCommands = JSON.parse(fs.readFileSync(commandsPath, 'utf8'));
    } catch (e) {
        console.log('Error reading custom commands:', e);
        customCommands = {};
    }
}

async function commandHandler(sock, text, sender, pushName, isGroup, config) {
    const args = text.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const fullArgs = args.join(' ');

    switch (command) {
        case 'attack':
            if (args.length < 2) {
                await sock.sendMessage(sender, { 
                    text: '❌ Format salah! Gunakan: .attack <url> <duration>'
                });
                return;
            }
            
            const url = args[0];
            const duration = parseInt(args[1]);
            
            if (isNaN(duration) || duration <= 0) {
                await sock.sendMessage(sender, { 
                    text: '❌ Duration harus angka positif!'
                });
                return;
            }

            await sock.sendMessage(sender, { 
                text: `🚀 Memulai attack ke ${url} selama ${duration} detik...`
            });

            attack.startAttack(url, duration, async (status) => {
                await sock.sendMessage(sender, { text: status });
            });
            break;

        case 'stop':
            attack.stopAttack();
            await sock.sendMessage(sender, { 
                text: '⏹️ Attack dihentikan!'
            });
            break;
            
        case 'broadcast':
        case 'bc':
            if (args.length === 0) {
                await sock.sendMessage(sender, {
                    text: '❌ Format: .broadcast <pesan>'
                });
                return;
            }
            
            // This would normally iterate through all chats
            await sock.sendMessage(sender, {
                text: `📢 Broadcast: ${fullArgs}\n\n(Fitur broadcast lengkap membutuhkan penyimpanan daftar chat)`
            });
            break;
            
        case 'block':
            if (args.length === 0) {
                await sock.sendMessage(sender, {
                    text: '❌ Format: .block <nomor|@tag>'
                });
                return;
            }
            
            let target = args[0];
            if (target.includes('@')) {
                if (!config.blockedUsers.includes(target)) {
                    config.blockedUsers.push(target);
                    fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
                    await sock.sendMessage(sender, {
                        text: `✅ ${target} telah diblokir!`
                    });
                } else {
                    await sock.sendMessage(sender, {
                        text: `❌ ${target} sudah diblokir sebelumnya!`
                    });
                }
            } else {
                await sock.sendMessage(sender, {
                    text: '❌ Format nomor tidak valid!'
                });
            }
            break;
            
        case 'unblock':
            if (args.length === 0) {
                await sock.sendMessage(sender, {
                    text: '❌ Format: .unblock <nomor>'
                });
                return;
            }
            
            let unblockTarget = args[0];
            if (config.blockedUsers.includes(unblockTarget)) {
                config.blockedUsers = config.blockedUsers.filter(u => u !== unblockTarget);
                fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
                await sock.sendMessage(sender, {
                    text: `✅ ${unblockTarget} telah diunblokir!`
                });
            } else {
                await sock.sendMessage(sender, {
                    text: `❌ ${unblockTarget} tidak ditemukan dalam daftar blokir!`
                });
            }
            break;
            
        case 'addcmd':
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Format: .addcmd <nama_command> <response>'
                });
                return;
            }
            
            const cmdName = args[0].toLowerCase();
            const cmdResponse = args.slice(1).join(' ');
            
            customCommands[cmdName] = cmdResponse;
            fs.writeFileSync(commandsPath, JSON.stringify(customCommands, null, 2));
            
            await sock.sendMessage(sender, {
                text: `✅ Command "${cmdName}" berhasil ditambahkan!`
            });
            break;
            
        case 'delcmd':
            if (args.length === 0) {
                await sock.sendMessage(sender, {
                    text: '❌ Format: .delcmd <nama_command>'
                });
                return;
            }
            
            const delCmdName = args[0].toLowerCase();
            
            if (customCommands[delCmdName]) {
                delete customCommands[delCmdName];
                fs.writeFileSync(commandsPath, JSON.stringify(customCommands, null, 2));
                
                await sock.sendMessage(sender, {
                    text: `✅ Command "${delCmdName}" berhasil dihapus!`
                });
            } else {
                await sock.sendMessage(sender, {
                    text: `❌ Command "${delCmdName}" tidak ditemukan!`
                });
            }
            break;
            
        case 'listcmd':
            const cmdList = Object.keys(customCommands).join(', ');
            await sock.sendMessage(sender, {
                text: `📋 *LIST CUSTOM COMMANDS* 📋\n\n${cmdList || 'Tidak ada custom commands'}`
            });
            break;
            
        case 'setprefix':
            if (args.length === 0) {
                await sock.sendMessage(sender, {
                    text: '❌ Format: .setprefix <prefix_baru>'
                });
                return;
            }
            
            const newPrefix = args[0];
            config.prefix = newPrefix;
            fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
            
            await sock.sendMessage(sender, {
                text: `✅ Prefix berhasil diubah menjadi "${newPrefix}"`
            });
            break;
            
        case 'stats':
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            await sock.sendMessage(sender, {
                text: `📊 *BOT STATISTICS* 📊

⏰ Uptime: ${hours}h ${minutes}m ${seconds}s
👤 Admin: ${config.admin}
🚀 Prefix: ${config.prefix}
📵 Blocked Users: ${config.blockedUsers.length}
📝 Custom Commands: ${Object.keys(customCommands).length}
💾 Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
            });
            break;

        case 'help':
            await sock.sendMessage(sender, {
                text: `🤖 *ADMIN COMMANDS* 🤖

🔹 ${config.prefix}attack <url> <durasi> - Attack target
🔹 ${config.prefix}stop - Hentikan attack
🔹 ${config.prefix}broadcast <pesan> - Broadcast pesan
🔹 ${config.prefix}block <nomor> - Blokir user
🔹 ${config.prefix}unblock <nomor> - Unblokir user
🔹 ${config.prefix}addcmd <nama> <response> - Tambah custom command
🔹 ${config.prefix}delcmd <nama> - Hapus custom command
🔹 ${config.prefix}listcmd - List custom commands
🔹 ${config.prefix}setprefix <prefix> - Ubah prefix bot
🔹 ${config.prefix}stats - Lihat statistik bot

*PUBLIC COMMANDS*
🔹 ${config.prefix}help - Bantuan
🔹 ${config.prefix}menu - Menu utama
🔹 ${config.prefix}owner - Info pemilik
🔹 ${config.prefix}status - Status bot`
            });
            break;

        default:
            await sock.sendMessage(sender, {
                text: `❌ Command "${command}" tidak dikenali. Ketik ${config.prefix}help untuk melihat commands.`
            });
    }
}

module.exports = commandHandler;