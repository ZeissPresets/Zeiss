const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, delay, getContentType } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const menu = require('./menu');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const emoji = require('node-emoji');
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    defaultMeta: { service: 'whatsapp-bot' },
    transports: [
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/bot.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.combine(
            format.colorize(),
            format.simple()
        )
    }));
}

console.log(chalk.blue.bold(`
╔══════════════════════════════════════════╗
║      WhatsApp Admin Bot V4.5.0          ║
║      Enhanced Reply System              ║
╚══════════════════════════════════════════╝
`));

function loadOrCreateConfig() {
    const configPath = path.join(__dirname, 'config.json');
    
    if (fs.existsSync(configPath)) {
        try {
            const configData = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            logger.error('Error membaca config.json, membuat config baru...');
            return { 
                adminNumber: null, 
                settings: { 
                    autoReconnect: true, 
                    logLevel: 'info',
                    maxAttackDuration: 3600,
                    maxThreads: 10,
                    replyToAllMessages: false,
                    allowedUsers: []
                } 
            };
        }
    } else {
        const defaultConfig = { 
            adminNumber: null, 
            settings: { 
                autoReconnect: true, 
                logLevel: 'info',
                maxAttackDuration: 3600,
                maxThreads: 10,
                replyToAllMessages: false,
                allowedUsers: []
            } 
        };
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        logger.info('File config.json dibuat. Silakan isi nomor admin.');
        return defaultConfig;
    }
}

function saveConfig(config) {
    const configPath = path.join(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

async function connectToWhatsApp() {
    const config = loadOrCreateConfig();
    
    if (!config.adminNumber) {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log(chalk.cyan('══════════════════════════════════════'));
        console.log(chalk.yellow('Nomor admin belum dikonfigurasi'));
        console.log(chalk.cyan('Format: kode negara + nomor (contoh: 6281234567890)'));
        
        readline.question(chalk.cyan('Masukkan nomor WhatsApp admin: '), (number) => {
            if (!number.includes('@s.whatsapp.net')) {
                number = number + '@s.whatsapp.net';
            }
            
            config.adminNumber = number;
            saveConfig(config);
            logger.info('Nomor admin disimpan!');
            
            readline.close();
            initializeBot(config);
        });
    } else {
        initializeBot(config);
    }
}

async function initializeBot(config) {
    const sessionFolder = path.join(__dirname, 'session');
    if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder);
        logger.info('Folder session dibuat.');
    }

    if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs');
        logger.info('Folder logs dibuat.');
    }

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: Browsers.ubuntu('Chrome'),
            logger: config.settings.logLevel === 'debug' ? {
                level: 'debug',
                debug: (msg) => logger.debug(msg),
                info: (msg) => logger.info(msg),
                warn: (msg) => logger.warn(msg),
                error: (msg) => logger.error(msg)
            } : undefined,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            getMessage: async (key) => {
                return {
                    conversation: "message"
                }
            }
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;
            
            if (qr) {
                console.log(chalk.cyan('══════════════════════════════════════'));
                console.log(chalk.yellow('Scan QR code berikut untuk login:'));
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
                logger.error(`Koneksi terputus: ${lastDisconnect.error?.message || 'unknown reason'}`);
                
                if (shouldReconnect && config.settings.autoReconnect) {
                    logger.warn('Mencoba menghubungkan kembali dalam 5 detik...');
                    setTimeout(() => connectToWhatsApp(), 5000);
                }
            } else if (connection === 'open') {
                logger.info('✅ Berhasil terhubung ke WhatsApp!');
                
                if (config.adminNumber) {
                    const text = `${emoji.get('robot_face')} WhatsApp Admin Bot V4.5.0 aktif!\nKetik ${emoji.get('page_facing_up')} .menu untuk melihat daftar perintah.`;
                    sock.sendMessage(config.adminNumber, { text: text }).catch(err => {
                        logger.error('Gagal mengirim pesan welcome:', err);
                    });
                }
            }
            
            if (isNewLogin) {
                logger.info('Login baru terdeteksi!');
            }
            
            if (receivedPendingNotifications) {
                logger.info('Menerima notifikasi tertunda');
            }
        });

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('messages.upsert', async (m) => {
            const message = m.messages[0];
            if (m.type === 'notify') {
                const messageText = message.message?.conversation || 
                                   message.message?.extendedTextMessage?.text || 
                                   message.message?.buttonsResponseMessage?.selectedButtonId ||
                                   message.message?.listResponseMessage?.title ||
                                   '';
                
                const sender = message.key.remoteJid;
                const messageId = message.key.id;
                
                const isAdmin = sender === config.adminNumber;
                const isAllowedUser = config.settings.allowedUsers.includes(sender) || isAdmin;
                
                if (messageText && messageText.trim() !== '') {
                    logger.info(`Pesan dari ${isAdmin ? 'ADMIN' : 'USER'}: ${messageText.substring(0, 50)}...`);
                    
                    try {
                        await menu.handleCommand(sock, sender, messageText, isAdmin, isAllowedUser, config, messageId);
                    } catch (error) {
                        logger.error('Error handling command:', error);
                        
                        if (isAdmin) {
                            const errorReply = `${emoji.get('x')} Terjadi error: ${error.message}`;
                            await sock.sendMessage(sender, { 
                                text: errorReply,
                                quoted: message
                            }).catch(err => logger.error('Gagal mengirim error message:', err));
                        }
                    }
                }
                
                if (config.settings.replyToAllMessages && !messageText.startsWith('.') && isAllowedUser) {
                    const autoReply = `${emoji.get('robot_face')} Bot sedang aktif! Ketik .menu untuk melihat perintah yang tersedia.`;
                    await sock.sendMessage(sender, { 
                        text: autoReply,
                        quoted: message
                    }).catch(err => logger.error('Gagal mengirim auto reply:', err));
                }
            }
        });

        sock.ev.on('message-receipt.update', (updates) => {
            updates.forEach(({ key, receipt }) => {
                if (receipt.type === 'read' && key.fromMe) {
                    logger.debug(`Pesan dibaca oleh: ${key.remoteJid}`);
                }
            });
        });

        sock.ev.on('contacts.update', (updates) => {
            updates.forEach((update) => {
                logger.debug(`Kontak diperbarui: ${update.id}`);
            });
        });

        sock.ev.on('chats.set', ({ chats }) => {
            logger.debug(`Chats loaded: ${chats.length}`);
        });

        sock.ev.on('contacts.set', ({ contacts }) => {
            logger.debug(`Contacts loaded: ${contacts.length}`);
        });

    } catch (error) {
        logger.error('Error inisialisasi bot:', error);
        setTimeout(() => connectToWhatsApp(), 10000);
    }
}

connectToWhatsApp();

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('SIGINT', () => {
    logger.info('Bot dimatikan oleh user');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Bot menerima SIGTERM');
    process.exit(0);
});