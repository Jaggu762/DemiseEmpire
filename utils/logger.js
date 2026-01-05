const fs = require('fs');
const path = require('path');
const colors = require('colors');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../data/logs');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getLogFilePath() {
        const date = new Date();
        const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        return path.join(this.logDir, `${dateString}.log`);
    }

    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }

    logToFile(message) {
        const logFile = this.getLogFilePath();
        fs.appendFileSync(logFile, message + '\n', 'utf8');
    }

    info(message) {
        const formatted = this.formatMessage('INFO', message);
        console.log(colors.blue(formatted));
        this.logToFile(formatted);
    }

    success(message) {
        const formatted = this.formatMessage('SUCCESS', message);
        console.log(colors.green(formatted));
        this.logToFile(formatted);
    }

    warn(message) {
        const formatted = this.formatMessage('WARN', message);
        console.log(colors.yellow(formatted));
        this.logToFile(formatted);
    }

    error(message) {
        const formatted = this.formatMessage('ERROR', message);
        console.log(colors.red(formatted));
        this.logToFile(formatted);
    }

    debug(message) {
        const formatted = this.formatMessage('DEBUG', message);
        console.log(colors.gray(formatted));
        this.logToFile(formatted);
    }

    command(user, command, guild) {
        const message = `Command executed: ${command} by ${user} in ${guild}`;
        const formatted = this.formatMessage('COMMAND', message);
        console.log(colors.cyan(formatted));
        this.logToFile(formatted);
    }

    event(eventName, details = '') {
        const message = `Event: ${eventName} ${details}`;
        const formatted = this.formatMessage('EVENT', message);
        console.log(colors.magenta(formatted));
        this.logToFile(formatted);
    }

    database(action, details = '') {
        const message = `Database ${action}: ${details}`;
        const formatted = this.formatMessage('DATABASE', message);
        console.log(colors.cyan(formatted));
        this.logToFile(formatted);
    }

    music(action, details = '') {
        const message = `Music ${action}: ${details}`;
        const formatted = this.formatMessage('MUSIC', message);
        console.log(colors.rainbow(formatted));
        this.logToFile(formatted);
    }

    ai(action, details = '') {
        const message = `AI ${action}: ${details}`;
        const formatted = this.formatMessage('AI', message);
        console.log(colors.yellow(formatted));
        this.logToFile(formatted);
    }

    moderation(action, user, moderator, reason = '') {
        const message = `Moderation: ${action} | User: ${user} | Moderator: ${moderator} | Reason: ${reason}`;
        const formatted = this.formatMessage('MODERATION', message);
        console.log(colors.red(formatted));
        this.logToFile(formatted);
    }
}

module.exports = new Logger();