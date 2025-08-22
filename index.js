import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import { pino } from 'pino';
import chalk from 'chalk';
import CommandHandler from './command.js';

const CONFIG_FILE = './config.json';

// Logger yang benar
const logger = pino({ level: 'silent' });

let commandHandler = null;
let sock = null;

async function startBot() {
    try {
        let config = {};
        if (fs.existsSync(CONFIG_FILE)) {
            try {
                config = fs.readJsonSync(CONFIG_FILE);
            } catch (error) {
                console.log(chalk.yellow('📝 Membuat config baru...'));
                config = {};
            }
        }

        if (!config.phoneNumber) {
            const inputNumber = readlineSync.question('📱 Masukkan nomor WhatsApp (62xxx): ');
            config.phoneNumber = inputNumber.replace(/\D/g, '');
            fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
            console.log(chalk.green(`✅ Nomor ${config.phoneNumber} berhasil disimpan`));
        }

        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        const { version } = await fetchLatestBaileysVersion();

        console.log(chalk.blue('🔄 Membuat koneksi WhatsApp...'));

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['Ubuntu', 'Chrome', '120.0.0.0'],
            logger: logger,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true
        });

        // Inisialisasi command handler
        commandHandler = new CommandHandler(sock);

        // Menyimpan kredensial ketika diperbarui
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (connection === 'open') {
                console.log(chalk.green('✅ Berhasil terhubung ke WhatsApp!'));
                console.log(chalk.green('✅ Sesi tersimpan, bot siap digunakan'));
                
                if (config.pairingRequested) {
                    config.pairingRequested = false;
                    fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
                }
                
                const user = sock.user;
                console.log(chalk.blue(`🤖 Bot berjalan sebagai: ${user.name || user.id}`));
                console.log(chalk.blue('✨ Bot sekarang aktif dan siap menerima command!'));
                console.log(chalk.blue('🔧 Gunakan .menu untuk melihat daftar command'));
                
                // Kirim welcome message ke console
                console.log(chalk.green('\n========================================'));
                console.log(chalk.green('🚀 BOT BERHASIL DIJALANKAN!'));
                console.log(chalk.green('========================================'));
            } 
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(chalk.red('❌ Koneksi terputus'));
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(chalk.red('🔒 Anda telah logout, hapus folder auth_info dan jalankan ulang'));
                    process.exit(0);
                }
                
                if (shouldReconnect) {
                    console.log(chalk.yellow('🔄 Mencoba menghubungkan ulang dalam 3 detik...'));
                    await delay(3000);
                    startBot();
                }
            }
            
            // Jika QR code muncul (fallback)
            if (qr) {
                console.log(chalk.yellow('📱 QR code tersedia sebagai alternatif'));
            }
        });

        // Jika belum terdaftar, minta kode pairing
        if (!state.creds.registered) {
            setTimeout(async () => {
                try {
                    const phoneNumber = config.phoneNumber.startsWith('62') ? 
                        config.phoneNumber : '62' + config.phoneNumber;
                    
                    console.log(chalk.yellow('\n📞 Meminta pairing code untuk nomor:', phoneNumber));
                    
                    const code = await sock.requestPairingCode(phoneNumber);
                    
                    console.log(chalk.green('\n══════════════════════════════════════════'));
                    console.log(chalk.green('              PAIRING CODE'));
                    console.log(chalk.green('══════════════════════════════════════════'));
                    console.log(chalk.green('           ' + code));
                    console.log(chalk.green('══════════════════════════════════════════'));
                    console.log(chalk.blue('📱 Cara menggunakan:'));
                    console.log(chalk.blue('1. Buka WhatsApp di ponsel Anda'));
                    console.log(chalk.blue('2. Pergi ke Settings → Linked Devices'));
                    console.log(chalk.blue('3. Pilih "Link a Device"'));
                    console.log(chalk.blue('4. Masukkan kode di atas'));
                    console.log(chalk.blue('5. Tunggu hingga terhubung'));
                    console.log(chalk.green('══════════════════════════════════════════\n'));
                    
                    config.pairingRequested = true;
                    fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
                    
                } catch (err) {
                    console.error(chalk.red('❌ Gagal membuat pairing code:'), err.message);
                    console.log(chalk.yellow('🔄 Mencoba lagi dalam 5 detik...'));
                    await delay(5000);
                    startBot();
                }
            }, 2000);
        }

        // Menangani pesan masuk dan command
        sock.ev.on('messages.upsert', async (m) => {
            try {
                const message = m.messages[0];
                if (!message.key.fromMe && m.type === 'notify') {
                    const sender = message.key.remoteJid;
                    console.log(chalk.cyan('📩 Pesan diterima dari:'), sender);
                    
                    // Coba handle command
                    const isCommand = await commandHandler.handleCommand(message);
                    
                    // Jika bukan command, balas dengan pesan default
                    if (!isCommand && message.message) {
                        let text = '';
                        
                        if (message.message.conversation) {
                            text = message.message.conversation;
                        } else if (message.message.extendedTextMessage) {
                            text = message.message.extendedTextMessage.text;
                        }
                        
                        if (text) {
                            await sock.sendMessage(sender, { 
                                text: `Hai! 👋\nSaya adalah bot WhatsApp yang dilengkapi dengan berbagai fitur.\n\nGunakan command *.menu* untuk melihat daftar perintah yang tersedia!\n\n💡 *Tips:* Semua command dimulai dengan tanda titik (.)` 
                            });
                            console.log(chalk.green('✅ Pesan default dibalas ke:'), sender);
                        }
                    }
                }
            } catch (error) {
                console.error(chalk.red('❌ Error menangani pesan:'), error.message);
            }
        });

        // Handle pesan yang dikirim sendiri
        sock.ev.on('messages.upsert', async (m) => {
            if (m.messages[0].key.fromMe) {
                console.log(chalk.gray('📤 Pesan dikirim:'), m.messages[0].message?.conversation?.substring(0, 50) || 'Media/Other');
            }
        });

        console.log(chalk.yellow('⏳ Menunggu koneksi...'));

    } catch (error) {
        console.error(chalk.red('❌ Error starting bot:'), error.message);
        console.log(chalk.yellow('🔄 Restarting in 5 seconds...'));
        await delay(5000);
        startBot();
    }
}

// Menangani error
process.on('uncaughtException', (error) => {
    console.error(chalk.red('❌ Uncaught Exception:'), error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('❌ Unhandled Rejection:'), reason);
});

// Handle Ctrl+C untuk graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Menghentikan bot...'));
    if (commandHandler) {
        commandHandler.stopAllAttacks();
    }
    console.log(chalk.green('✅ Bot berhasil dihentikan. Sampai jumpa!'));
    process.exit(0);
});

// Clear console dan mulai bot
console.clear();
console.log(chalk.green('🚀 Starting Advanced WhatsApp Bot...'));
console.log(chalk.green('========================================'));

startBot().catch(error => {
    console.error(chalk.red('❌ Error starting bot:'), error.message);
    console.log(chalk.yellow('🔄 Restarting in 3 seconds...'));
    setTimeout(startBot, 3000);
});