const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { readFile, writeFile, existsSync } = require('fs');
const { promisify } = require('util');
const path = require('path');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const commandHandler = require('./command');

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

// Fungsi untuk menampilkan log dengan timestamp dan warna
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    debug: chalk.magenta
  };
  console.log(colors[type](`[${timestamp}] ${message}`));
}

async function initializeBot() {
  try {
    const configFile = path.join(__dirname, 'config.json');
    let config = {};

    // Handle config file
    if (existsSync(configFile)) {
      try {
        const data = await readFileAsync(configFile, 'utf8');
        config = JSON.parse(data);
        log('Config file loaded successfully', 'success');
      } catch (error) {
        log('Error reading config file: ' + error.message, 'error');
      }
    }

    if (!config.phoneNumber) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      config.phoneNumber = await new Promise(resolve => {
        readline.question('Enter your WhatsApp number (with country code): ', resolve);
      });
      readline.close();

      await writeFileAsync(configFile, JSON.stringify(config, null, 2));
      log('Config file created successfully', 'success');
    }

    // Gunakan useMultiFileAuthState sebagai ganti useSingleFileAuthState
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false, // Kita akan handle QR sendiri
      logger: {
        level: 'silent'
      }
    });

    // Handle QR code
    sock.ev.on('connection.update', async (update) => {
      const { connection, qr, isNewLogin, lastDisconnect } = update;

      if (qr) {
        console.log('\n');
        log('Scan QR code below:', 'warning');
        qrcode.generate(qr, { small: true });
        console.log('\n');
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        log('Connection closed. ' + (shouldReconnect ? 'Reconnecting...' : 'Please restart bot.'), 'error');
        
        if (shouldReconnect) {
          initializeBot();
        }
      } else if (connection === 'open') {
        log('WhatsApp connected successfully!', 'success');
        log(`Logged in as: ${config.phoneNumber}`, 'info');
      }
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const text = msg.message.conversation || 
                  msg.message.extendedTextMessage?.text || 
                  msg.message.buttonsResponseMessage?.selectedDisplayText || '';
      
      const sender = msg.key.remoteJid;
      const name = msg.pushName || 'Unknown';

      // Log pesan masuk
      log(`Message from ${name} (${sender}): ${text}`, 'debug');

      // Handle commands
      if (text.startsWith('.') && sender) {
        try {
          await commandHandler(sock, sender, text, name);
          log(`Command executed: ${text} by ${name}`, 'info');
        } catch (error) {
          log(`Error executing command: ${error.message}`, 'error');
          await sock.sendMessage(sender, { 
            text: `❌ Error: ${error.message}` 
          });
        }
      }
    });

    // Tampilkan status bot
    log('Bot started successfully', 'success');
    log('Waiting for messages...', 'info');

  } catch (error) {
    log(`Initialization error: ${error.message}`, 'error');
    process.exit(1);
  }
}

initializeBot();