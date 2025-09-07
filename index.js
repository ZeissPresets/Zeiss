const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const menu = require('./menu');
const path = require('path');
const fs = require('fs');

function loadOrCreateConfig() {
    const configPath = path.join(__dirname, 'config.json');
    
    if (fs.existsSync(configPath)) {
        try {
            const configData = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            return { adminNumber: null };
        }
    } else {
        const defaultConfig = { adminNumber: null };
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
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
        
        readline.question('Masukkan nomor WhatsApp admin: ', (number) => {
            if (!number.includes('@s.whatsapp.net')) {
                number = number + '@s.whatsapp.net';
            }
            
            config.adminNumber = number;
            saveConfig(config);
            
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
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.ubuntu('Chrome')
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            if (config.adminNumber) {
                const text = "Bot WhatsApp Admin telah aktif! Ketik .menu untuk melihat daftar perintah.";
                sock.sendMessage(config.adminNumber, { text: text });
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (m.type === 'notify') {
            const messageText = message.message?.conversation || 
                               message.message?.extendedTextMessage?.text || 
                               message.message?.buttonsResponseMessage?.selectedButtonId ||
                               '';
            const sender = message.key.remoteJid;
            
            const isAdmin = sender === config.adminNumber;
            
            await menu.handleCommand(sock, sender, messageText, isAdmin);
        }
    });
}

connectToWhatsApp();