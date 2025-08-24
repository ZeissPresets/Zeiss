import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import { pino } from 'pino';
import chalk from 'chalk';
import qrcode from 'qrcode-terminal';
import CommandHandler from './command.js';

const CONFIG_FILE = './config.json';

// Enhanced design functions
const design = {
    box: (title, content, color = 'cyan') => {
        const lines = content.split('\n').filter(line => line.trim());
        const maxLength = Math.max(...lines.map(line => line.length), title.length + 4);
        
        const colorFn = chalk[color] || chalk.cyan;
        
        let result = `╭───${'─'.repeat(title.length)}───╮\n`;
        result += `│   ${colorFn.bold(title)}   │\n`;
        result += `├${'─'.repeat(maxLength + 6)}┤\n`;
        
        lines.forEach(line => {
            result += `│ ${line}${' '.repeat(maxLength - line.length)} │\n`;
        });
        
        result += `╰${'─'.repeat(maxLength + 6)}╯`;
        return result;
    },

    header: (text) => chalk.green.bold(`\n✨ ${text} ✨\n`),
    success: (text) => chalk.green(`✅ ${text}`),
    error: (text) => chalk.red(`❌ ${text}`),
    warning: (text) => chalk.yellow(`⚠️ ${text}`),
    info: (text) => chalk.blue(`ℹ️ ${text}`),
    system: (text) => chalk.magenta(`⚙️ ${text}`),
    admin: (text) => chalk.cyan(`👑 ${text}`)
};

// Fixed logger untuk Baileys
const baileysLogger = pino({ 
    level: 'silent',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
});

let commandHandler = null;
let sock = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

class WhatsAppBot {
    constructor() {
        this.isConnected = false;
        this.config = {};
        this.state = null;
        this.saveCreds = null;
        this.reconnectTimer = null;
    }

    async setupAdmin() {
        console.log('\n' + design.box('ADMIN SETUP', 'Setting up bot administrator', 'green'));
        
        console.log(design.info('Current admin: ' + (this.config.adminNumber || 'Not set')));
        
        const inputNumber = readlineSync.question('📱 Enter admin WhatsApp number (62xxx): ');
        const adminNumber = inputNumber.replace(/\D/g, '');
        
        if (!adminNumber.startsWith('62')) {
            this.config.adminNumber = '62' + adminNumber;
        } else {
            this.config.adminNumber = adminNumber;
        }

        this.config.selfMode = this.config.selfMode !== undefined ? this.config.selfMode : false;
        
        fs.writeJsonSync(CONFIG_FILE, this.config, { spaces: 2 });
        
        console.log(design.success(`Admin number set to: ${this.config.adminNumber}`));
        console.log(design.info('Self mode: ' + (this.config.selfMode ? 'ON (Only admin can use bot)' : 'OFF (Everyone can use bot)')));
        console.log(design.info('Continuing with bot startup...'));
    }

    async initialize() {
        console.log(design.header('INITIALIZING PREMIUM BOT v4.0'));
        console.log(design.info('Loading configuration and preparing system...'));
        
        await this.loadConfig();
        
        // Check if admin is set, if not, setup admin
        if (!this.config.adminNumber) {
            await this.setupAdmin();
        }

        const authState = await useMultiFileAuthState('auth_info');
        this.state = authState.state;
        this.saveCreds = authState.saveCreds;
        
        const { version } = await fetchLatestBaileysVersion();
        this.version = version;
        
        console.log(design.success('Bot initialized successfully'));
        console.log(design.admin(`Admin: ${this.config.adminNumber}`));
        console.log(design.info(`Self mode: ${this.config.selfMode ? 'ON' : 'OFF'}`));
        
        return true;
    }

    async loadConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                this.config = fs.readJsonSync(CONFIG_FILE);
                console.log(design.info('Configuration loaded from file'));
            } else {
                this.config = {
                    phoneNumber: '',
                    adminNumber: '',
                    selfMode: false,
                    pairingRequested: false,
                    firstRun: true
                };
                console.log(design.info('Creating new configuration'));
            }

            if (!this.config.phoneNumber) {
                console.log('\n' + design.box('PHONE REGISTRATION', 'Please enter your WhatsApp number', 'green'));
                const inputNumber = readlineSync.question('📱 Enter WhatsApp number (62xxx): ');
                this.config.phoneNumber = inputNumber.replace(/\D/g, '');
                
                if (!this.config.phoneNumber.startsWith('62')) {
                    this.config.phoneNumber = '62' + this.config.phoneNumber;
                }
                
                fs.writeJsonSync(CONFIG_FILE, this.config, { spaces: 2 });
                console.log(design.success(`Number ${this.config.phoneNumber} registered successfully`));
            }

        } catch (error) {
            console.log(design.error('Configuration loading failed: ' + error.message));
            throw error;
        }
    }

    async connect() {
        console.log('\n' + design.header('ESTABLISHING SECURE CONNECTION'));
        console.log(design.info('Creating secure WhatsApp connection...'));

        try {
            sock = makeWASocket({
                version: this.version,
                auth: this.state,
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome'),
                logger: baileysLogger,
                markOnlineOnConnect: true,
                syncFullHistory: false,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 2000,
                maxRetries: 5,
                emitOwnEvents: true,
                defaultQueryTimeoutMs: 60000
            });

            this.setupEventHandlers();
            commandHandler = new CommandHandler(sock, this.config);

            console.log(design.success('Connection established successfully'));
            console.log(design.info('Bot is ready to receive commands'));
            console.log(design.info('Type .menu in any chat to see available commands'));

            this.isConnected = true;
            reconnectAttempts = 0;

            return true;

        } catch (error) {
            console.log(design.error('Connection failed: ' + error.message));
            await this.handleReconnection();
            return false;
        }
    }

    setupEventHandlers() {
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('\n' + design.box('QR CODE SCAN REQUIRED', 'Please scan the QR code to authenticate', 'yellow'));
                qrcode.generate(qr, { small: true });
                console.log('\n' + design.info('Scan the QR code above with WhatsApp'));
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
                
                console.log(design.warning(`Connection closed: ${lastDisconnect?.error?.message || 'Unknown reason'}`));
                
                if (shouldReconnect) {
                    await this.handleReconnection();
                } else {
                    console.log(design.error('Logged out from WhatsApp. Please restart the bot.'));
                    process.exit(1);
                }
            } else if (connection === 'open') {
                console.log(design.success('Successfully connected to WhatsApp'));
                this.isConnected = true;
                reconnectAttempts = 0;
            } else if (connection === 'connecting') {
                console.log(design.info('Connecting to WhatsApp servers...'));
            }
        });

        sock.ev.on('creds.update', this.saveCreds);

        sock.ev.on('messages.upsert', async (m) => {
            try {
                if (m.type !== 'notify') return;

                const message = m.messages[0];
                if (!message || !message.key) return;

                // Skip messages from status broadcasts and group notifications
                if (message.key.remoteJid === 'status@broadcast' || 
                    (message.key.remoteJid.endsWith('@g.us') && !message.message)) {
                    return;
                }

                // Handle commands
                const isCommand = await commandHandler.handleCommand(message);
                
                if (!isCommand) {
                    // Auto-response for non-commands
                    const sender = message.key.remoteJid;
                    const isGroup = sender.endsWith('@g.us');
                    
                    if (!isGroup && message.message && !message.key.fromMe) {
                        const response = `
╭───🤖 *AUTO RESPONSE* ───
│
│ 👋 Hello! I'm Premium Bot v4.0
│ 📋 Type .menu to see commands
│ ⚡ I can help with stress testing
│
│ 🚀 *Available Commands:*
│ ◈ .menu - Show all commands
│ ◈ .info - Bot information
│ ◈ .idgc - Get group ID (group only)
│
│ 🔒 *Admin Commands:*
│ ◈ .attack - Start stress test
│ ◈ .stopattack - Stop attacks
│ ◈ .stats - Show statistics
│ ◈ .self - Toggle self mode
│
╰───────────────────────⪨
                        `.trim();
                        await sock.sendMessage(sender, { text: response.trim() });
                    }
                }
            } catch (error) {
                console.log(design.error('Message processing error: ' + error.message));
            }
        });

        // Handle other events
        sock.ev.on('contacts.update', () => {});
        sock.ev.on('chats.update', () => {});
        sock.ev.on('presence.update', () => {});
    }

    async handleReconnection() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log(design.error('Maximum reconnection attempts reached. Please restart the bot.'));
            process.exit(1);
        }

        reconnectAttempts++;
        const delayTime = Math.min(5000 * reconnectAttempts, 30000);
        
        console.log(design.warning(`Reconnecting in ${delayTime/1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`));
        
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(async () => {
            console.log(design.info('Attempting to reconnect...'));
            await this.connect();
        }, delayTime);
    }

    async cleanup() {
        console.log(design.info('Cleaning up resources...'));
        
        if (commandHandler) {
            commandHandler.cleanup();
        }
        
        clearTimeout(this.reconnectTimer);
        
        if (sock) {
            try {
                await sock.end();
                console.log(design.success('Connection closed gracefully'));
            } catch (error) {
                console.log(design.error('Error closing connection: ' + error.message));
            }
        }
    }

    async start() {
        try {
            await this.initialize();
            await this.connect();

            // Graceful shutdown handler
            process.on('SIGINT', async () => {
                console.log('\n' + design.header('SHUTTING DOWN BOT'));
                await this.cleanup();
                process.exit(0);
            });

            process.on('SIGTERM', async () => {
                console.log('\n' + design.header('SHUTTING DOWN BOT'));
                await this.cleanup();
                process.exit(0);
            });

            process.on('uncaughtException', async (error) => {
                console.log(design.error('Uncaught Exception: ' + error.message));
                await this.cleanup();
                process.exit(1);
            });

            process.on('unhandledRejection', async (reason, promise) => {
                console.log(design.error('Unhandled Rejection at: ' + promise + ' reason: ' + reason));
                await this.cleanup();
                process.exit(1);
            });

        } catch (error) {
            console.log(design.error('Bot startup failed: ' + error.message));
            console.log(design.error('Stack: ' + error.stack));
            process.exit(1);
        }
    }
}

// Enhanced startup sequence
console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                🚀 PREMIUM BOT v4.0 STARTING 🚀               ║
║              ⭐ With Admin Control & Features ⭐              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

const bot = new WhatsAppBot();
bot.start().catch(error => {
    console.log(design.error('Fatal startup error: ' + error.message));
    process.exit(1);
});

export { sock };