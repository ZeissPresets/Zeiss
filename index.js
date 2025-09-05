const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, delay } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const readline = require('readline');
const { handleCommand } = require('./zeiss');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let sock = null;
let config = {};

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

function loadConfig() {
    try {
        if (fs.existsSync('config.json')) {
            const data = fs.readFileSync('config.json', 'utf8');
            config = JSON.parse(data);
            return true;
        }
    } catch (error) {
        console.log('Error loading config:', error.message);
    }
    return false;
}

function saveConfig() {
    try {
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.log('Error saving config:', error.message);
        return false;
    }
}

function validatePhoneNumber(phone) {
    return phone.startsWith('+') && phone.length >= 10;
}

function isAdmin(sender) {
    if (!config.adminNumber) return false;
    
    const cleanAdmin = config.adminNumber.replace('+', '').replace(/\D/g, '');
    const cleanSender = sender.replace('+', '').replace(/\D/g, '');
    
    return cleanSender.endsWith(cleanAdmin) || cleanAdmin.endsWith(cleanSender);
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.macOS('Desktop'),
        markOnlineOnConnect: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
                console.log('Connection closed. Reconnecting...');
                await delay(3000);
                connectToWhatsApp();
            } else {
                console.log('Connection closed. You are logged out.');
            }
        } else if (connection === 'open') {
            console.log('\n╔══════════════════════════════════════════╗');
            console.log('║          CONNECTED SUCCESSFULLY!          ║');
            console.log('╚══════════════════════════════════════════╝\n');
            console.log('WhatsApp bot is now connected and ready.');
            console.log('Admin number:', config.adminNumber);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.message) return;
        
        const sender = message.key.remoteJid;
        
        if (!isAdmin(sender)) {
            console.log('Message from non-admin ignored:', sender);
            return;
        }
        
        const messageType = Object.keys(message.message)[0];
        const text = message.message.conversation || 
                    message.message.extendedTextMessage?.text || '';
        
        const pushName = message.pushName || 'Unknown';
        
        console.log(`Received message from admin ${pushName}: ${text}`);
        
        if (text.startsWith('.') || text.startsWith('!')) {
            await handleCommand(sock, sender, text, pushName);
        }
    });
}

function displayWelcome() {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║        WHATSAPP BOT WITH BAILEYS         ║');
    console.log('║               ADMIN PROTECTION           ║');
    console.log('╚══════════════════════════════════════════╝\n');
}

async function setupAdmin() {
    if (loadConfig() && config.adminNumber) {
        console.log('Admin number found:', config.adminNumber);
        return true;
    }
    
    console.log('No admin configuration found.');
    
    let adminNumber = await askQuestion('Enter admin WhatsApp number (with country code, e.g., +628123456789): ');
    
    while (!validatePhoneNumber(adminNumber)) {
        console.log('Invalid phone number format. Please include country code (e.g., +628123456789)');
        adminNumber = await askQuestion('Enter admin WhatsApp number: ');
    }
    
    config.adminNumber = adminNumber;
    
    if (saveConfig()) {
        console.log('Admin number saved successfully.');
        return true;
    } else {
        console.log('Failed to save admin number.');
        return false;
    }
}

async function main() {
    displayWelcome();
    
    try {
        const setupSuccess = await setupAdmin();
        if (!setupSuccess) {
            console.log('Setup failed. Exiting...');
            rl.close();
            process.exit(1);
        }
        
        console.log('\nInitializing WhatsApp connection...');
        console.log('Generating QR code for authentication...\n');
        
        await connectToWhatsApp();
    } catch (error) {
        console.error('Failed to initialize:', error);
        rl.close();
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    console.log('Shutting down...');
    if (sock) {
        await sock.logout();
    }
    rl.close();
    process.exit(0);
});

main().catch(console.error);