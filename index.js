import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import { pino } from 'pino';
import chalk from 'chalk';
import CommandHandler from './command.js';

const CONFIG_FILE = './config.json';

// Design functions
const design = {
    box: (title, content) => {
        const lines = content.split('\n').filter(line => line.trim());
        const maxLength = Math.max(...lines.map(line => line.length), title.length + 4);
        
        let result = `╭───${'─'.repeat(title.length)}───╮\n`;
        result += `│   ${chalk.cyan.bold(title)}   │\n`;
        result += `├${'─'.repeat(maxLength + 6)}┤\n`;
        
        lines.forEach(line => {
            result += `│ ${line}${' '.repeat(maxLength - line.length)} │\n`;
        });
        
        result += `╰${'─'.repeat(maxLength + 6)}╯`;
        return result;
    },

    header: (text) => {
        return chalk.green.bold(`\n✨ ${text} ✨\n`);
    },

    success: (text) => {
        return chalk.green(`✅ ${text}`);
    },

    error: (text) => {
        return chalk.red(`❌ ${text}`);
    },

    warning: (text) => {
        return chalk.yellow(`⚠️ ${text}`);
    },

    info: (text) => {
        return chalk.blue(`ℹ️ ${text}`);
    }
};

// Logger untuk Baileys dengan design
const baileysLogger = pino({ 
    level: 'error',
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
const MAX_RECONNECT_ATTEMPTS = 8;

class WhatsAppBot {
    constructor() {
        this.isConnected = false;
        this.config = {};
        this.state = null;
        this.saveCreds = null;
        this.reconnectTimer = null;
    }

    async initialize() {
        console.log(design.header('INITIALIZING PREMIUM BOT'));
        console.log(design.info('Loading configuration and preparing system...'));
        
        await this.loadConfig();
        
        const authState = await useMultiFileAuthState('auth_info');
        this.state = authState.state;
        this.saveCreds = authState.saveCreds;
        
        const { version } = await fetchLatestBaileysVersion();
        this.version = version;
        
        console.log(design.success('Bot initialized successfully'));
        return true;
    }

    async loadConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                this.config = fs.readJsonSync(CONFIG_FILE);
                console.log(design.info('Configuration loaded from file'));
            } else {
                this.config = {};
                console.log(design.info('Creating new configuration'));
            }

            if (!this.config.phoneNumber) {
                console.log('\n' + design.box('PHONE REGISTRATION', 'Please enter your WhatsApp number'));
                const inputNumber = readlineSync.question('📱 Enter WhatsApp number (62xxx): ');
                this.config.phoneNumber = inputNumber.replace(/\D/g, '');
                fs.writeJsonSync(CONFIG_FILE, this.config, { spaces: 2 });
                console.log(design.success(`Number ${this.config.phoneNumber} registered successfully`));
            }
        } catch (error) {
            console.log(design.error('Configuration loading failed'));
            throw error;
        }
    }

    async connect() {
        console.log('\n' + design.header('ESTABLISHING CONNECTION'));
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
                connectTimeoutMs: 45000,
                keepAliveIntervalMs: 25000,
                retryRequestDelayMs: 2000,
                maxRetries: 4
            });

            this.setupEventHandlers();
            commandHandler = new CommandHandler(sock);

            console.log(design.success('Secure connection established'));
            return true;
        } catch (error) {
            console.log(design.error('Connection failed: ' + error.message));
            return false;
        }
    }

    setupEventHandlers() {
        sock.ev.on('creds.update', this.saveCreds);

        sock.ev.on('connection.update', (update) => {
            this.handleConnectionUpdate(update);
        });

        sock.ev.on('messages.upsert', async (m) => {
            try {
                await this.handleMessages(m);
            } catch (error) {
                console.log(design.error('Message processing error: ' + error.message));
            }
        });

        sock.ev.on('connection.error', (error) => {
            console.log(design.error('Connection error: ' + error.message));
        });
    }

    handleConnectionUpdate(update) {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            this.handleConnected();
        } 
        
        if (connection === 'close') {
            this.handleDisconnected(lastDisconnect);
        }
    }

    handleConnected() {
        this.isConnected = true;
        reconnectAttempts = 0;
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        console.log('\n' + design.box('CONNECTION SUCCESS', [
            '✅ WhatsApp connection established',
            '✅ Secure session saved',
            '✅ Bot is now online and ready',
            `✅ User: ${sock.user?.name || 'Unknown'}`,
            '✅ Premium features activated'
        ].join('\n')));

        console.log('\n' + design.box('BOT READY', [
            '🎯 Available commands:',
            '◈ .menu - Show premium menu',
            '◈ .attack - Start attack campaign', 
            '◈ .stopattack - Stop all attacks',
            '',
            '⚡ Bot is listening for commands...'
        ].join('\n')));
        
        if (this.config.pairingRequested) {
            this.config.pairingRequested = false;
            fs.writeJsonSync(CONFIG_FILE, this.config, { spaces: 2 });
        }
    }

    handleDisconnected(lastDisconnect) {
        this.isConnected = false;
        
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(design.warning('Connection interrupted'));

        if (statusCode === DisconnectReason.loggedOut) {
            console.log(design.box('SESSION EXPIRED', [
                '🔒 Your session has expired',
                '🔄 Please restart the bot',
                '💡 Run: npm run reset',
                '📋 This will clean and restart'
            ].join('\n')));
            process.exit(0);
        }
        
        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delayTime = Math.min(4000 * reconnectAttempts, 20000);
            
            console.log(design.info(`Reconnecting in ${delayTime/1000}s (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`));
            
            this.reconnectTimer = setTimeout(async () => {
                await this.restart();
            }, delayTime);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log(design.box('CONNECTION FAILED', [
                '❌ Maximum reconnection attempts reached',
                '🔧 Possible solutions:',
                '◈ Check internet connection',
                '◈ Restart the bot',
                '◈ Use: npm run reset',
                '📞 Contact support if persists'
            ].join('\n')));
            process.exit(1);
        }
    }

    async handleMessages(m) {
        try {
            const message = m.messages[0];
            if (!message.key.fromMe && m.type === 'notify') {
                const sender = message.key.remoteJid;
                
                // Display command received in terminal
                let text = '';
                const msg = message.message;
                
                if (msg.conversation) {
                    text = msg.conversation;
                } else if (msg.extendedTextMessage && msg.extendedTextMessage.text) {
                    text = msg.extendedTextMessage.text;
                }

                if (text && text.startsWith('.')) {
                    const args = text.slice(1).trim().split(/ +/);
                    const commandName = args.shift().toLowerCase();
                    
                    console.log('\n' + design.box('COMMAND RECEIVED', [
                        `⏱️  Time: ${new Date().toLocaleTimeString('id-ID')}`,
                        `👤 From: ${sender.split('@')[0]}`,
                        `🔧 Command: .${commandName}`,
                        `📋 Args: ${args.join(' ') || 'None'}`,
                        `🔄 Status: Processing...`
                    ].join('\n')));
                }

                // Handle command
                const isCommand = await commandHandler.handleCommand(message);
                
                // Default response for non-commands
                if (!isCommand && text && !text.startsWith('.')) {
                    try {
                        await sock.sendMessage(sender, { 
                            text: this.createWelcomeMessage()
                        });
                    } catch (error) {
                        console.log(design.error('Default message failed: ' + error.message));
                    }
                }
            }
        } catch (error) {
            console.log(design.error('Message handling error: ' + error.message));
        }
    }

    createWelcomeMessage() {
        return `
╭───👋 *WELCOME TO PREMIUM BOT* 👋───
│
│ 🎯 *AVAILABLE COMMANDS:*
│ ◈ .menu - Show premium menu
│ ◈ .attack <url> <sec> <threads> - Start attack
│ ◈ .stopattack - Stop all attacks
│
│ ⚡ *BOT FEATURES:*
│ ◈ Multi-thread technology
│ ◈ Real-time monitoring
│ ◈ Premium performance
│
│ 💡 *TIP:*
│ ◈ All commands start with dot (.)
│ ◈ Use .menu for detailed help
│
╰───────────────────────────────⪨
        `;
    }

    async requestPairingCode() {
        try {
            const phoneNumber = this.config.phoneNumber.startsWith('62') ? 
                this.config.phoneNumber : '62' + this.config.phoneNumber;
            
            console.log(design.info('Requesting pairing code...'));
            
            const code = await sock.requestPairingCode(phoneNumber);
            
            console.log('\n' + design.box('PAIRING REQUIRED', [
                '📱 Pairing code generated successfully',
                '🔢 Code: ' + chalk.bold.green(code),
                '',
                '📋 *INSTRUCTIONS:*',
                '1. Open WhatsApp on your phone',
                '2. Go to Settings → Linked Devices',
                '3. Tap "Link a Device"',
                '4. Enter the code above',
                '5. Wait for connection',
                '',
                '⏳ This window will auto-update'
            ].join('\n')));
            
            this.config.pairingRequested = true;
            fs.writeJsonSync(CONFIG_FILE, this.config, { spaces: 2 });
            
        } catch (error) {
            console.log(design.error('Pairing code failed: ' + error.message));
            throw error;
        }
    }

    async restart() {
        console.log(design.info('Initiating system restart...'));
        if (commandHandler) {
            commandHandler.cleanup();
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (sock) {
            try {
                await sock.end();
            } catch (error) {
                // Silent cleanup
            }
            sock = null;
        }
        
        commandHandler = null;
        await this.start();
    }

    async start() {
        try {
            const initialized = await this.initialize();
            if (!initialized) {
                throw new Error('System initialization failed');
            }

            const connected = await this.connect();
            if (!connected) {
                throw new Error('Connection establishment failed');
            }

            if (!this.state.creds.registered) {
                setTimeout(async () => {
                    try {
                        await this.requestPairingCode();
                    } catch (error) {
                        console.log(design.error('Pairing failed: ' + error.message));
                        console.log(design.info('Retrying in 15 seconds...'));
                        await delay(15000);
                        await this.restart();
                    }
                }, 3500);
            }

            console.log(design.info('System ready - Waiting for connection...'));

        } catch (error) {
            console.log(design.error('Startup failed: ' + error.message));
            console.log(design.info('Restarting in 15 seconds...'));
            await delay(15000);
            await this.restart();
        }
    }

    async shutdown() {
        console.log('\n' + design.box('SYSTEM SHUTDOWN', [
            '👋 Initiating graceful shutdown',
            '🛑 Stopping all processes',
            '🧹 Cleaning up resources',
            '📊 Saving final logs',
            '✅ Shutdown complete'
        ].join('\n')));
        
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
                // Silent shutdown
            }
        }
        
        console.log(design.success('Bot shutdown successfully'));
    }
}

// Global bot instance
let bot = null;

async function startBot() {
    bot = new WhatsAppBot();
    await bot.start();
}

// Signal handlers
process.on('SIGINT', async () => {
    console.log('\n');
    if (bot) {
        await bot.shutdown();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n');
    if (bot) {
        await bot.shutdown();
    }
    process.exit(0);
});

process.on('exit', (code) => {
    console.log(design.info(`Process exited with code: ${code}`));
});

// Clear console and start
console.clear();
console.log('\n' + design.box('PREMIUM WHATSAPP BOT', [
    '🚀 Version 2.0 - Premium Edition',
    '⭐ Enhanced with beautiful UI',
    '⚡ Powered by Baileys API',
    '🔒 Secure connection',
    '🎯 3 Powerful commands',
    '',
    '📋 Starting system...'
].join('\n')));

// Start the bot
startBot().catch(error => {
    console.log(design.error('Fatal startup error: ' + error.message));
    process.exit(1);
});