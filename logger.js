import fs from 'fs-extra';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = './logs';
const LOG_FILE = `${LOG_DIR}/bot.log`;

// Ensure log directory exists
fs.ensureDirSync(LOG_DIR);

class Logger {
    constructor() {
        this.logFile = LOG_FILE;
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };

        // Write to file
        fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');

        // Also output to console with colors
        const coloredMessage = this.getColoredMessage(level, message);
        console.log(coloredMessage);

        if (data && level === 'error') {
            console.log(chalk.gray('Details:'), data);
        }
    }

    getColoredMessage(level, message) {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        switch (level) {
            case 'error':
                return chalk.red(`[${timestamp}] ❌ ERROR: ${message}`);
            case 'warn':
                return chalk.yellow(`[${timestamp}] ⚠️ WARN: ${message}`);
            case 'info':
                return chalk.blue(`[${timestamp}] ℹ️ INFO: ${message}`);
            case 'debug':
                return chalk.gray(`[${timestamp}] 🔍 DEBUG: ${message}`);
            case 'success':
                return chalk.green(`[${timestamp}] ✅ SUCCESS: ${message}`);
            default:
                return `[${timestamp}] ${message}`;
        }
    }

    error(message, error = null) {
        this.log('error', message, error);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }

    success(message, data = null) {
        this.log('success', message, data);
    }

    // Method to get recent logs
    getRecentLogs(limit = 50) {
        try {
            if (!fs.existsSync(this.logFile)) {
                return [];
            }

            const logs = fs.readFileSync(this.logFile, 'utf8')
                .split('\n')
                .filter(line => line.trim())
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return null;
                    }
                })
                .filter(log => log !== null)
                .slice(-limit);

            return logs;
        } catch (error) {
            this.error('Failed to read logs', error);
            return [];
        }
    }

    // Method to clear logs
    clearLogs() {
        if (fs.existsSync(this.logFile)) {
            fs.writeFileSync(this.logFile, '');
            this.info('Logs cleared');
        }
    }
}

export default new Logger();