import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import { pino } from 'pino';
import logger from './logger.js';
import CommandHandler from './command.js';

const CONFIG_FILE = './config.json';

// Simple logger untuk Baileys
const baileysLogger = pino({ level: 'error' });

let commandHandler = null;
let sock = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 15;
const RECONNECT_DELAY_BASE = 3000;

class WhatsAppBot {
    constructor() {
        this.isConnected = false;
        this.config = {};
        this.state = null;
        this.saveCreds = null;
        this.reconnectTimer = null;
    }

    async initialize() {
        try {
            logger.info('Initializing bot...');
            
            // Load config
            await this.loadConfig();
            
            // Initialize auth state
            const authState = await useMultiFileAuthState('auth_info');
            this.state = authState.state;
            this.saveCreds = authState.saveCreds;
            
            // Get latest version
            const { version } = await fetchLatestBaileysVersion();
            this.version = version;
            
            logger.success('Bot initialized successfully');
            return true;
        } catch (error) {
            logger.error('Error initializing bot', error);
            return false;
        }
    }

    async loadConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                this.config = fs.readJsonSync(CONFIG_FILE);
                logger.debug('Config loaded', this.config);
            } else {
                logger.info('Creating new config...');
                this.config = {};
            }

            if (!this.config.phoneNumber) {
                const inputNumber = readlineSync.question('📱 Masukkan nomor WhatsApp (62xxx): ');
                this.config.phoneNumber = inputNumber.replace(/\D/g, '');
                fs.writeJsonSync(CONFIG_FILE, this.config, { spaces: 2 });
                logger.success(`Nomor ${this.config.phoneNumber} berhasil disimpan`);
            }
        } catch (error) {
            logger.error('Error loading config', error);
            throw error;
        }
    }

    async connect() {
        try {
            logger.info('Creating WhatsApp connection...');

            sock = makeWASocket({
                version: this.version,
                auth: this.state,
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome'),
                logger: baileysLogger,
                markOnlineOnConnect: true,
                syncFullHistory: false,
                generateHighQualityLinkPreview: true,
                retryRequestDelayMs: 2000,
                maxRetries: 5,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 20000,
                emitOwnEvents: true,
                defaultQueryTimeoutMs: 60000
            });

            // Setup event handlers
            this.setupEventHandlers();

            // Initialize command handler
            commandHandler = new CommandHandler(sock);

            logger.success('Socket created successfully');
            return true;
        } catch (error) {
            logger.error('Error creating socket', error);
            return false;
        }
    }

    setupEventHandlers() {
        // Menyimpan kredensial ketika diperbarui
        sock.ev.on('creds.update', this.saveCreds);

        // Connection update handler
        sock.ev.on('connection.update', (update) => {
            this.handleConnectionUpdate(update);
        });

        // Message handler dengan error handling
        sock.ev.on('messages.upsert', async (m) => {
            try {
                await this.handleMessages(m);
            } catch (error) {
                logger.error('Error in message handler', error);
            }
        });

        // Handle other events
        sock.ev.on('connection.phone.code.request', () => {
            logger.info('Verification code requested');
        });

        sock.ev.on('connection.phone.code.verify', () => {
            logger.success('Verification code verified');
        });

        // Handle errors from Baileys
        sock.ev.on('connection.error', (error) => {
            logger.error('Connection error', error);
        });

        sock.ev.on('messages.error', (error) => {
            logger.error('Message error', error);
        });
    }

    handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;
        
        if (connection === 'open') {
            this.handleConnected();
        } 
        
        if (connection === 'close') {
            this.handleDisconnected(lastDisconnect);
        }
        
        if (qr) {
            logger.info('QR code available as alternative');
        }

        // Log other connection states
        if (connection && connection !== 'open' && connection !== 'close') {
            logger.debug('Connection update', { connection });
        }
    }

    handleConnected() {
        try {
            this.isConnected = true;
            reconnectAttempts = 0;
            
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            logger.success('Connected to WhatsApp successfully');
            logger.success('Session saved, bot ready to use');
            
            if (this.config.pairingRequested) {
                this.config.pairingRequested = false;
                fs.writeJsonSync(CONFIG_FILE, this.config, { spaces: 2 });
            }
            
            const user = sock.user;
            logger.info(`Bot running as: ${user.name || user.id}`);
            logger.info('Bot is now active and ready to receive commands');
            
        } catch (error) {
            logger.error('Error in connected handler', error);
        }
    }

    handleDisconnected(lastDisconnect) {
        try {
            this.isConnected = false;
            
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            logger.warn('Connection closed', { statusCode, shouldReconnect });
            
            if (statusCode === DisconnectReason.loggedOut) {
                logger.error('Logged out, please delete auth_info folder and restart');
                logger.info('Use: npm run reset to clean and restart');
                process.exit(0);
            }
            
            if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delayTime = Math.min(RECONNECT_DELAY_BASE * Math.pow(1.5, reconnectAttempts), 30000);
                
                logger.info(`Reconnecting in ${delayTime/1000}s (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                
                this.reconnectTimer = setTimeout(async () => {
                    await this.restart();
                }, delayTime);
            } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                logger.error('Failed to reconnect after maximum attempts');
                logger.info('Please check your internet connection and try again');
                process.exit(1);
            }
        } catch (error) {
            logger.error('Error in disconnected handler', error);
        }
    }

    async handleMessages(m) {
        try {
            const message = m.messages[0];
            if (!message.key.fromMe && m.type === 'notify') {
                const sender = message.key.remoteJid;
                logger.debug('Message received', { from: sender });
                
                // Coba handle command
                const isCommand = await commandHandler.handleCommand(message);
                
                // Jika bukan command, balas dengan pesan default
                if (!isCommand && message.message) {
                    try {
                        let text = '';
                        
                        // Handle berbagai jenis pesan dengan error handling
                        if (message.message.conversation) {
                            text = message.message.conversation;
                        } else if (message.message.extendedTextMessage) {
                            text = message.message.extendedTextMessage.text;
                        } else if (message.message.imageMessage) {
                            text = '[Gambar]';
                        } else if (message.message.videoMessage) {
                            text = '[Video]';
                        } else if (message.message.audioMessage) {
                            text = '[Audio]';
                        } else if (message.message.documentMessage) {
                            text = '[Dokumen]';
                        } else {
                            text = '[Media]';
                        }
                        
                        if (text) {
                            await sock.sendMessage(sender, { 
                                text: `Hai! 👋\nSaya adalah bot WhatsApp yang dilengkapi dengan berbagai fitur.\n\nGunakan command *.menu* untuk melihat daftar perintah yang tersedia!\n\n💡 *Tips:* Semua command dimulai dengan tanda titik (.)` 
                            });
                            logger.debug('Default message sent', { to: sender });
                        }
                    } catch (error) {
                        logger.error('Error handling non-command message', error);
                    }
                }
            }
        } catch (error) {
            logger.error('Error handling messages', error);
        }
    }

    async requestPairingCode() {
        try {
            const phoneNumber = this.config.phoneNumber.startsWith('62') ? 
                this.config.phoneNumber : '62' + this.config.phoneNumber;
            
            logger.info('Requesting pairing code', { phoneNumber });
            
            const code = await sock.requestPairingCode(phoneNumber);
            
            logger.success('Pairing code received');
            console.log('\n══════════════════════════════════════════');
            console.log('              PAIRING CODE');
            console.log('══════════════════════════════════════════');
            console.log('           ' + code);
            console.log('══════════════════════════════════════════');
            console.log('📱 Cara menggunakan:');
            console.log('1. Buka WhatsApp di ponsel Anda');
            console.log('2. Pergi ke Settings → Linked Devices');
            console.log('3. Pilih "Link a Device"');
            console.log('4. Masukkan kode di atas');
            console.log('5. Tunggu hingga terhubung');
            console.log('══════════════════════════════════════════\n');
            
            this.config.pairingRequested = true;
            fs.writeJsonSync(CONFIG_FILE, this.config, { spaces: 2 });
            
        } catch (error) {
            logger.error('Failed to get pairing code', error);
            throw error;
        }
    }

    async restart() {
        try {
            logger.info('Restarting bot...');
            if (commandHandler) {
                commandHandler.cleanup();
            }
            
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            // Clean up socket
            if (sock) {
                try {
                    await sock.end();
                } catch (error) {
                    logger.debug('Error closing socket', error);
                }
                sock = null;
            }
            
            commandHandler = null;
            await this.start();
            
        } catch (error) {
            logger.error('Error during restart', error);
            process.exit(1);
        }
    }

    async start() {
        try {
            logger.info('Starting bot...');
            
            const initialized = await this.initialize();
            if (!initialized) {
                throw new Error('Failed to initialize bot');
            }

            const connected = await this.connect();
            if (!connected) {
                throw new Error('Failed to connect to WhatsApp');
            }

            // Jika belum terdaftar, minta pairing code
            if (!this.state.creds.registered) {
                setTimeout(async () => {
                    try {
                        await this.requestPairingCode();
                    } catch (error) {
                        logger.error('Error requesting pairing code', error);
                        logger.info('Retrying in 10 seconds...');
                        await delay(10000);
                        await this.restart();
                    }
                }, 3000);
            }

            logger.info('Waiting for connection...');

        } catch (error) {
            logger.error('Fatal error starting bot', error);
            logger.info('Restarting in 10 seconds...');
            await delay(10000);
            await this.restart();
        }
    }

    // Clean shutdown
    async shutdown() {
        try {
            logger.info('Shutting down bot gracefully...');
            
            if (commandHandler) {
                commandHandler.cleanup();
            }
            
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            
            if (sock) {
                try {
                    await sock.end();
                } catch (error) {
                    logger.debug('Error during socket shutdown', error);
                }
            }
            
            logger.success('Bot shut down successfully');
            
        } catch (error) {
            logger.error('Error during shutdown', error);
        }
    }
}

// Global bot instance
let bot = null;

async function startBot() {
    bot = new WhatsAppBot();
    await bot.start();
}

// Menangani error
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', reason);
});

// Handle Ctrl+C untuk graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    if (bot) {
        await bot.shutdown();
    }
    process.exit(0);
});

// Handle other signals
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    if (bot) {
        await bot.shutdown();
    }
    process.exit(0);
});

// Handle process exit
process.on('exit', (code) => {
    logger.info(`Process exited with code: ${code}`);
});

// Clear console dan mulai bot
console.clear();
logger.info('🚀 Starting Enhanced WhatsApp Bot v4.0...');
logger.info('========================================');
logger.info('🛡️  Enhanced Error Handling');
logger.info('📊 Advanced Logging System');
logger.info('⚡ Improved Stability');
logger.info('========================================');

// Start the bot
startBot().catch(error => {
    logger.error('Fatal error in main process', error);
    process.exit(1);
});