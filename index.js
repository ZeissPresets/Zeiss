const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk');
const chalkAnimation = require('chalk-animation');
const figlet = require('figlet');
const inquirer = require('inquirer');
const Spinner = require('cli-spinner').Spinner;
const boxen = require('boxen');
const gradient = require('gradient-string');
const MenuHandler = require('./menu');
const { performance } = require('perf_hooks');

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.authState = null;
        this.isConnected = false;
        this.spinner = new Spinner('%s ');
        this.spinner.setSpinnerString('|/-\\');
        this.menuHandler = null;
        this.connectionStartTime = null;
    }

    // Animasi startup
    async showWelcome() {
        console.clear();
        
        const banner = await new Promise((resolve) => {
            figlet('WHATSAPP BOT DEMO VERSION', {
                font: 'Standard',
                horizontalLayout: 'default',
                verticalLayout: 'default'
            }, (err, data) => {
                if (err) return resolve('');
                resolve(data);
            });
        });

        const rainbowBanner = gradient.rainbow(banner);
        console.log(rainbowBanner);

        const subtitle = gradient.pastel.multiline(`
╔══════════════════════════════════════════════════════════╗
║                WHATSAPPS BOT SYSTEM(DEMO)                ║
║                 Version 3.0 • Ultimate                   ║
║               DDoS Protection • Advanced                 ║
╚══════════════════════════════════════════════════════════╝
        `);

        console.log(subtitle);
        console.log('\n');
    }

    // Start spinner dengan style
    startSpinner(text) {
        this.spinner = new Spinner(chalk.blue(`%s ${text}`));
        this.spinner.setSpinnerString(18);
        this.spinner.start();
    }

    // Stop spinner
    stopSpinner() {
        if (this.spinner.isSpinning()) {
            this.spinner.stop(true);
        }
    }

    // Box message yang stylish
    showBox(message, color = 'green') {
        const box = boxen(message, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: color,
            backgroundColor: '#000000'
        });
        console.log(box);
    }

    // Fungsi untuk menghubungkan ke WhatsApp
    async connect(phoneNumber) {
        try {
            this.connectionStartTime = performance.now();
            this.startSpinner('[SYSTEM] MEMULAI SISTEM...');

            // Validasi nomor telepon
            if (!phoneNumber || !phoneNumber.match(/^\d+$/)) {
                throw new Error('Invalid phone number format');
            }

            const formattedNumber = `${phoneNumber}@s.whatsapp.net`;

            this.stopSpinner();
            this.showBox(`📱 CONNECTING TO: ${formattedNumber}`, 'blue');

            // Menggunakan multi file auth state
            this.startSpinner('🔐 Loading secure session...');
            const { state, saveCreds } = await useMultiFileAuthState('auth_info');
            this.authState = state;
            this.stopSpinner();

            // Membuat socket connection
            this.startSpinner('🌐 Establishing secure connection...');
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                browser: Browsers.macOS('Desktop'),
                logger: { level: 'silent' },
                markOnlineOnConnect: true,
                syncFullHistory: false,
                transactionOpts: {
                    maxCommitRetries: 10,
                    delayBetweenTries: 3000
                }
            });
            this.stopSpinner();

            // Initialize menu handler
            this.menuHandler = new MenuHandler(this.sock);

            // Handle events
            this.setupEventHandlers(saveCreds);

        } catch (error) {
            this.stopSpinner();
            this.showBox(`❌ CONNECTION FAILED: ${error.message}`, 'red');
            this.cleanup();
            process.exit(1);
        }
    }

    // Setup event handlers
    setupEventHandlers(saveCreds) {
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                this.stopSpinner();
                console.log('\n');
                this.showBox('📲 SCAN QR CODE BELOW', 'yellow');
                
                console.log(chalk.yellow('╔══════════════════════════════════════╗'));
                console.log(chalk.yellow('║                                      ║'));
                qrcode.generate(qr, { small: true });
                console.log(chalk.yellow('║                                      ║'));
                console.log(chalk.yellow('╚══════════════════════════════════════╝'));
                
                console.log(chalk.cyan('\n💡 WhatsApp → Three Dots → Linked Devices → Link Device'));
            }

            if (connection === 'open') {
                this.isConnected = true;
                this.stopSpinner();
                
                const connectionTime = (performance.now() - this.connectionStartTime).toFixed(0);
                const successAnimation = chalkAnimation.rainbow(`\n✅ CONNECTION ESTABLISHED IN ${connectionTime}ms`);
                
                setTimeout(() => {
                    successAnimation.stop();
                    this.showConnectionInfo();
                }, 2000);
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    this.startSpinner('🔄 Reconnecting to network...');
                    setTimeout(() => {
                        this.connect(this.sock?.user?.id.split(':')[0] || '');
                    }, 5000);
                } else {
                    this.showBox('❌ LOGGED OUT. Delete auth_info folder and rescan QR.', 'red');
                    this.cleanup();
                }
            }
        });

        this.sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages dengan menu handler
        this.sock.ev.on('messages.upsert', async ({ messages }) => {
            const message = messages[0];
            if (message.key.fromMe) return;

            try {
                await this.menuHandler.handleMessage(message);
            } catch (error) {
                console.error('Message handling error:', error);
            }
        });

        // Handle connection errors
        this.sock.ev.on('connection.quality.update', (update) => {
            const { quality, latency } = update;
            if (quality < 0.5) {
                console.log(chalk.yellow('⚠️  Connection quality degraded'));
            }
        });
    }

    // Menampilkan info koneksi
    async showConnectionInfo() {
        if (this.sock?.user) {
            const userInfo = `
🤖 ELITE BOT SYSTEM ONLINE

👤 User: ${this.sock.user.name || 'Unknown'}
📞 Number: ${this.sock.user.id}
🌐 Platform: ${this.sock.user.platform || 'Unknown'}
🕒 Connected: ${new Date().toLocaleString()}
⚡ Connection Time: ${(performance.now() - this.connectionStartTime).toFixed(0)}ms

⭐ Status: ${chalk.green('OPERATIONAL')}
🔧 Mode: ${chalk.yellow('ULTRA PERFORMANCE')}
            `;

            this.showBox(userInfo, 'green');
            
            console.log(chalk.yellow('\n🎯 AVAILABLE COMMANDS:'));
            console.log(chalk.cyan('   • .menu - Show command menu'));
            console.log(chalk.cyan('   • .attack <url> <time> - DDoS attack'));
            console.log(chalk.cyan('   • .ping <url> - Check target status'));
            console.log(chalk.cyan('   • .stop <id> - Stop attack'));
            console.log(chalk.cyan('   • .list - Show active attacks'));
            
            console.log(chalk.gray('\n──────────────────────────────────────────────────'));
            console.log(chalk.yellow('💡 Press CTRL+C to exit the application'));
        }
    }

    // Cleanup resources
    cleanup() {
        if (this.sock) {
            this.sock.end();
            this.sock = null;
        }
        
        if (this.menuHandler) {
            this.menuHandler.cleanup();
        }
        
        this.isConnected = false;
    }
}

// Fungsi untuk membaca input dari user
function askQuestion(query) {
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

// Fungsi utama
async function main() {
    const bot = new WhatsAppBot();
    
    try {
        // Tampilkan welcome screen
        await bot.showWelcome();

        // Prompt input yang stylish
        const questions = [
            {
                type: 'input',
                name: 'phoneNumber',
                message: chalk.blue('📞 ENTER WHATSAPP NUMBER (ex: 6281234567890):'),
                validate: (input) => {
                    if (!input) return 'Number cannot be empty!';
                    if (!input.match(/^\d+$/)) return 'Only numbers allowed!';
                    if (input.length < 10) return 'Number too short!';
                    return true;
                }
            }
        ];

        const answers = await inquirer.prompt(questions);
        
        const loading = chalkAnimation.rainbow('\n🚀 INITIALIZING ELITE BOT SYSTEM');
        setTimeout(async () => {
            loading.stop();
            await bot.connect(answers.phoneNumber.trim());
        }, 2000);

        // Handle process termination
        process.on('SIGINT', () => {
            console.log('\n');
            bot.showBox('🛑 SHUTTING DOWN BOT SYSTEM... THANK YOU!', 'yellow');
            bot.cleanup();
            process.exit(0);
        });

    } catch (error) {
        console.error(chalk.red('❌ FATAL ERROR:'), error.message);
        process.exit(1);
    }
}

// Jalankan aplikasi
if (require.main === module) {
    main().catch(console.error);
}