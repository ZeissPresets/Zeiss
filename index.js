const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, getCodeFromWASocket } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const commandHandler = require('./command');

// Load config
let config = {};
const configPath = path.join(__dirname, 'config.json');

if (fs.existsSync(configPath)) {
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!config.admin) config.admin = null;
        if (!config.prefix) config.prefix = '.';
        if (!config.blockedUsers) config.blockedUsers = [];
    } catch (e) {
        console.log('Error reading config, creating new one...');
        config = { 
            admin: null, 
            prefix: '.',
            blockedUsers: []
        };
    }
} else {
    config = { 
        admin: null, 
        prefix: '.',
        blockedUsers: []
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Load custom commands if exists
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

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome')
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Connected to WhatsApp successfully!');
            
            // Save admin number if not set
            if (!config.admin) {
                const user = sock.user;
                if (user && user.id) {
                    config.admin = user.id;
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    console.log('Admin number saved:', user.id);
                    
                    // Send welcome message to admin
                    await sock.sendMessage(config.admin, { 
                        text: `🤖 *Bot Berhasil Terhubung!*\n\nGunakan ${config.prefix}help untuk melihat daftar perintah.` 
                    });
                }
            }
        }
    });

    // Listen for pairing code
    sock.ev.on('creds.update', saveCreds);
    
    // Generate and display pairing code
    try {
        const code = await getCodeFromWASocket(sock);
        console.log('PAIRING CODE:', code);
        console.log('Instruksi: Buka WhatsApp → Settings → Linked Devices → Link a Device → Masukkan kode di atas');
    } catch (error) {
        console.log('Error getting pairing code:', error);
    }

    // Handle incoming messages
    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.message) return;
        
        const messageType = Object.keys(message.message)[0];
        let text = '';
        
        if (messageType === 'conversation') {
            text = message.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
            text = message.message.extendedTextMessage.text;
        } else {
            return; // Skip non-text messages
        }
        
        const sender = message.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        const pushName = message.pushName || 'User';
        
        // Check if user is blocked
        if (config.blockedUsers.includes(sender)) {
            console.log(`Blocked user ${sender} tried to send message`);
            return;
        }
        
        // Check if message starts with prefix
        if (text.startsWith(config.prefix)) {
            console.log(`Command from ${pushName} (${sender}): ${text}`);
            
            // Handle admin commands
            if (sender === config.admin) {
                await commandHandler(sock, text, sender, pushName, isGroup, config);
            } 
            // Handle public commands for everyone
            else {
                await handlePublicCommands(sock, text, sender, pushName, isGroup, config);
            }
        }
        
        // Handle pairing for new admin
        else if (text === `${config.prefix}pair` && !config.admin) {
            config.admin = sender;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            await sock.sendMessage(sender, { 
                text: '✅ Anda sekarang adalah admin bot!' 
            });
            console.log(`Admin set to: ${sender}`);
        }
        
        // Handle custom commands
        else if (customCommands[text.toLowerCase()]) {
            await sock.sendMessage(sender, { 
                text: customCommands[text.toLowerCase()] 
            });
        }
    });
}

// Handle public commands (available for everyone)
async function handlePublicCommands(sock, text, sender, pushName, isGroup, config) {
    const args = text.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    switch (command) {
        case 'help':
            await sock.sendMessage(sender, {
                text: `🤖 *BOT PUBLIC COMMANDS* 🤖

🔹 ${config.prefix}help - Tampilkan bantuan
🔹 ${config.prefix}menu - Menu utama bot
🔹 ${config.prefix}owner - Info pemilik bot
🔹 ${config.prefix}status - Status bot
🔹 ${config.prefix}sticker - Buat sticker dari gambar
🔹 ${config.prefix}tts <teks> - Convert teks ke voice

Kirim gambar dengan caption ${config.prefix}sticker untuk membuat sticker!`
            });
            break;
            
        case 'menu':
            await sock.sendMessage(sender, {
                text: `📋 *MENU BOT* 📋

1. ${config.prefix}help - Bantuan
2. ${config.prefix}owner - Info pemilik
3. ${config.prefix}status - Status bot
4. ${config.prefix}sticker - Buat sticker
5. ${config.prefix}tts - Text to speech

Bot oleh: ${config.admin ? config.admin.split('@')[0] : 'Admin'}`
            });
            break;
            
        case 'owner':
            await sock.sendMessage(sender, {
                text: `👤 *OWNER BOT* 👤

Nama: Admin Bot
Nomor: ${config.admin ? config.admin.split('@')[0] : 'Tidak tersedia'}
Status: Online

Hubungi owner untuk pertanyaan lebih lanjut.`
            });
            break;
            
        case 'status':
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            await sock.sendMessage(sender, {
                text: `📊 *STATUS BOT* 📊

🟢 Status: Online
⏰ Uptime: ${hours}h ${minutes}m ${seconds}s
👤 Admin: ${config.admin ? 'Tersedia' : 'Tidak tersedia'}
🚀 Prefix: ${config.prefix}
📞 Pengguna: ${pushName}

Bot berjalan dengan normal.`
            });
            break;
            
        default:
            await sock.sendMessage(sender, {
                text: `❌ Command "${command}" tidak dikenali. Ketik ${config.prefix}help untuk melihat commands.`
            });
    }
}

connectToWhatsApp().catch(err => console.log('Error:', err));