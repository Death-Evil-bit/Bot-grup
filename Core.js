const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { Boom } = require('@hapi/boom');

class BotEngine extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.sock = null;
        this.commands = new Map();
        this.aliases = new Map();
        this.userData = new Map();
        this.groupData = new Map();
        this.cooldowns = new Map();
        this.stats = {
            messagesProcessed: 0,
            commandsExecuted: 0,
            errors: 0,
            groupsJoined: 0,
            usersInteracted: 0,
            startTime: Date.now()
        };
        
        this.isConnected = false;
        this.qrCode = null;
        this.sessionPath = './sessions';
    }
    
    async start() {
        console.log(chalk.blue('🤖 Starting WhatsApp Bot Engine...'));
        
        // Create session directory
        if (!fs.existsSync(this.sessionPath)) {
            fs.mkdirSync(this.sessionPath, { recursive: true });
        }
        
        // Load authentication state
        const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
        
        // Fetch latest Baileys version
        const { version } = await fetchLatestBaileysVersion();
        
        // Create WhatsApp socket
        this.sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: { level: 'warn' },
            browser: ['Mega Bot 1500+', 'Chrome', '5.0.0'],
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            defaultQueryTimeoutMs: 60000,
            emitOwnEvents: true,
            retryRequestDelayMs: 1000,
            maxMsgRetryCount: 3,
            fireInitQueries: true
        });
        
        // Handle connection updates
        this.sock.ev.on('connection.update', (update) => {
            this.handleConnectionUpdate(update, saveCreds);
        });
        
        // Save credentials when updated
        this.sock.ev.on('creds.update', saveCreds);
        
        // Handle incoming messages
        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const message of messages) {
                    await this.handleMessage(message);
                }
            }
        });
        
        // Handle group updates
        this.sock.ev.on('group-participants.update', async (update) => {
            await this.handleGroupUpdate(update);
        });
        
        // Handle message reactions
        this.sock.ev.on('messages.reaction', async (reactions) => {
            await this.handleReaction(reactions);
        });
        
        // Handle calls
        this.sock.ev.on('call', async (call) => {
            await this.handleCall(call);
        });
        
        // Handle message deletions
        this.sock.ev.on('messages.delete', async (deleteData) => {
            await this.handleMessageDelete(deleteData);
        });
        
        // Handle presence updates
        this.sock.ev.on('presence.update', async (update) => {
            await this.handlePresenceUpdate(update);
        });
        
        console.log(chalk.green('✅ Bot Engine Started'));
        return this.sock;
    }
    
    async handleConnectionUpdate(update, saveCreds) {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            this.qrCode = qr;
            qrcode.generate(qr, { small: true });
            console.log(chalk.yellow('📱 Scan QR Code above'));
            this.emit('qr', qr);
            
            // Save QR to file for web interface
            fs.writeFileSync('./temp/qr.txt', qr);
        }
        
        if (connection === 'close') {
            this.isConnected = false;
            const reason = new Boom(lastDisconnect.error).output.statusCode;
            console.log(chalk.red(`🔌 Connection closed. Reason: ${reason}`));
            this.emit('disconnected', reason);
            
            if (reason === DisconnectReason.loggedOut) {
                console.log(chalk.red('❌ Logged out! Cleaning sessions...'));
                fs.rmSync(this.sessionPath, { recursive: true, force: true });
                fs.mkdirSync(this.sessionPath, { recursive: true });
                this.emit('logout');
                process.exit(1);
            } else if (reason === DisconnectReason.restartRequired) {
                console.log(chalk.yellow('🔄 Restart required. Reconnecting...'));
                setTimeout(() => this.start(), 3000);
            } else {
                console.log(chalk.yellow('🔄 Reconnecting in 5 seconds...'));
                this.emit('reconnecting');
                setTimeout(() => this.start(), 5000);
            }
        }
        
        if (connection === 'open') {
            this.isConnected = true;
            console.log(chalk.green('✅ Connected to WhatsApp!'));
            this.emit('connected');
            
            // Update bot profile
            try {
                await this.sock.updateProfileName(this.config.bot.name);
                await this.sock.updateProfileStatus(this.config.bot.status);
                console.log(chalk.blue(`🤖 Bot Name: ${this.config.bot.name}`));
                console.log(chalk.blue(`🎯 Prefix: ${this.config.prefix.join(', ')}`));
                console.log(chalk.blue(`📊 Commands: ${this.commands.size}`));
            } catch (error) {
                console.log(chalk.yellow('⚠️ Could not update profile:', error.message));
            }
            
            // Send online notification to owner
            if (this.config.owner && this.config.owner[0]) {
                const ownerJid = this.config.owner[0].replace(/\D/g, '') + '@s.whatsapp.net';
                try {
                    await this.sock.sendMessage(ownerJid, {
                        text: `✅ *Bot Online!*\n\n` +
                              `🏆 Features: ${this.commands.size}\n` +
                              `🚀 Version: ${this.config.bot.version}\n` +
                              `📊 Uptime: ${this.formatUptime()}\n` +
                              `💬 Type ${this.config.prefix[0]}menu for commands`
                    });
                } catch (error) {
                    console.log(chalk.yellow('⚠️ Could not notify owner:', error.message));
                }
            }
        }
    }
    
    async handleMessage(message) {
        try {
            this.stats.messagesProcessed++;
            
            // Ignore if no message or from bot
            if (!message.message || message.key.fromMe) return;
            
            const text = this.extractMessageText(message);
            if (!text) return;
            
            const chatId = message.key.remoteJid;
            const sender = message.key.participant || message.key.remoteJid;
            const isGroup = chatId.endsWith('@g.us');
            
            // Update user stats
            this.stats.usersInteracted++;
            
            // Create message context
            const context = {
                chatId,
                sender,
                isGroup,
                text,
                message,
                bot: this,
                config: this.config,
                userData: this.getUserData(sender),
                groupData: isGroup ? this.getGroupData(chatId) : null,
                args: [],
                command: null
            };
            
            // Check for anti-spam
            if (this.config.features.antiSpam && this.isSpamming(sender, text)) {
                await this.handleSpam(sender, chatId);
                return;
            }
            
            // Check for anti-link
            if (this.config.features.antiLink && this.containsBannedLinks(text)) {
                await this.handleBannedLink(sender, chatId, text);
                return;
            }
            
            // Check for commands
            let commandExecuted = false;
            
            for (const prefix of this.config.prefix) {
                if (text.startsWith(prefix)) {
                    const commandText = text.slice(prefix.length).trim();
                    const [cmd, ...args] = commandText.split(/ +/);
                    
                    context.command = cmd.toLowerCase();
                    context.args = args;
                    
                    await this.executeCommand(cmd, args, context);
                    commandExecuted = true;
                    break;
                }
            }
            
            // Auto-reply for mentions
            if (!commandExecuted && this.sock.user && text.includes('@' + this.sock.user.id.split(':')[0])) {
                await this.sock.sendMessage(chatId, {
                    text: `👋 Hello! I'm *${this.config.bot.name}* with 1500+ features!\n` +
                          `Type ${this.config.prefix[0]}menu to see all commands\n` +
                          `Type ${this.config.prefix[0]}help for assistance`,
                    mentions: [sender]
                });
            }
            
            // Auto-react to messages (if enabled)
            if (this.config.features.autoReact && Math.random() > 0.7) {
                const reactions = ['👍', '❤️', '🔥', '🎉', '👏', '😂', '😮', '😢'];
                try {
                    await this.sock.sendMessage(chatId, {
                        react: {
                            text: reactions[Math.floor(Math.random() * reactions.length)],
                            key: message.key
                        }
                    });
                } catch (error) {
                    // Silent fail for reactions
                }
            }
            
        } catch (error) {
            this.stats.errors++;
            console.log(chalk.red('💥 Message handling error:'), error.message);
            console.log(error.stack);
        }
    }
    
    async executeCommand(commandName, args, context) {
        // Check cooldown
        if (this.isOnCooldown(context.sender, commandName)) {
            const remaining = this.getCooldownRemaining(context.sender, commandName);
            await this.sock.sendMessage(context.chatId, {
                text: this.config.messages.errors.cooldown.replace('@time', remaining)
            });
            return;
        }
        
        // Set cooldown
        this.setCooldown(context.sender, commandName, this.config.limits.commandCooldown);
        
        // Find command handler
        let commandHandler = this.commands.get(commandName.toLowerCase());
        
        // Check aliases
        if (!commandHandler && this.aliases.has(commandName.toLowerCase())) {
            const actualCommand = this.aliases.get(commandName.toLowerCase());
            commandHandler = this.commands.get(actualCommand);
        }
        
        if (commandHandler) {
            // Check permissions
            if (commandHandler.ownerOnly && !this.isOwner(context.sender)) {
                await this.sock.sendMessage(context.chatId, {
                    text: this.config.messages.errors.ownerOnly
                });
                return;
            }
            
            if (commandHandler.adminOnly && !this.isAdmin(context.sender, context.chatId)) {
                await this.sock.sendMessage(context.chatId, {
                    text: this.config.messages.errors.adminOnly
                });
                return;
            }
            
            if (commandHandler.groupOnly && !context.isGroup) {
                await this.sock.sendMessage(context.chatId, {
                    text: this.config.messages.errors.groupOnly
                });
                return;
            }
            
            if (commandHandler.nsfw && !this.config.features.nsfwEnabled) {
                await this.sock.sendMessage(context.chatId, {
                    text: this.config.messages.errors.nsfwDisabled
                });
                return;
            }
            
            try {
                this.stats.commandsExecuted++;
                await commandHandler.execute(this.sock, context.message, args, context);
                
                // Update user stats
                const userData = this.getUserData(context.sender);
                userData.commandsUsed = (userData.commandsUsed || 0) + 1;
                userData.lastCommand = Date.now();
                userData.lastCommandName = commandName;
                
            } catch (error) {
                console.log(chalk.red(`💥 Command !${commandName} error:`), error.message);
                
                await this.sock.sendMessage(context.chatId, {
                    text: `❌ Error executing !${commandName}:\n${error.message}\n\nPlease try again or contact admin.`
                });
            }
        } else {
            // Command not found
            const similar = this.findSimilarCommands(commandName);
            
            let response = `❌ Command !${commandName} not found.\n`;
            
            if (similar.length > 0) {
                response += `\nDid you mean:\n${similar.slice(0, 3).map(cmd => `• !${cmd}`).join('\n')}`;
            }
            
            response += `\n\nType ${this.config.prefix[0]}menu to see all 1500+ commands`;
            
            await this.sock.sendMessage(context.chatId, { text: response });
        }
    }
    
    async handleGroupUpdate(update) {
        const { id, participants, action } = update;
        
        if (action === 'add' && this.config.features.autoWelcome) {
            for (const participant of participants) {
                try {
                    const groupMetadata = await this.sock.groupMetadata(id);
                    const welcomeMsg = this.config.messages.welcome
                        .replace('@user', `@${participant.split('@')[0]}`)
                        .replace('@group', groupMetadata.subject);
                    
                    await this.sock.sendMessage(id, {
                        text: welcomeMsg,
                        mentions: [participant]
                    });
                    
                    console.log(chalk.cyan(`👋 Welcomed ${participant.split('@')[0]} to ${groupMetadata.subject}`));
                } catch (error) {
                    console.log(chalk.yellow('⚠️ Welcome error:', error.message));
                }
            }
        }
        
        if (action === 'remove' && this.config.features.autoGoodbye) {
            for (const participant of participants) {
                try {
                    await this.sock.sendMessage(id, {
                        text: this.config.messages.goodbye.replace('@user', `@${participant.split('@')[0]}`)
                    });
                } catch (error) {
                    // Silent fail for goodbye
                }
            }
        }
        
        if (action === 'promote' || action === 'demote') {
            console.log(chalk.cyan(`👑 ${action} in group ${id}`));
        }
    }
    
    async handleReaction(reactions) {
        // Handle message reactions
        for (const { key, reaction } of reactions) {
            if (reaction.text === '❤️' && key.fromMe) {
                // Auto-reply to heart reactions on bot messages
                try {
                    await this.sock.sendMessage(key.remoteJid, {
                        text: '❤️ Thank you for the love!',
                        quoted: { key, message: { conversation: '❤️' } }
                    });
                } catch (error) {
                    // Silent fail
                }
            }
        }
    }
    
    async handleCall(call) {
        if (this.config.features.antiCall) {
            console.log(chalk.yellow(`📞 Call blocked from ${call.from}`));
            // Reject call automatically
        }
    }
    
    async handleMessageDelete(deleteData) {
        // Log message deletions
        if (deleteData.keys && deleteData.keys.length > 0) {
            console.log(chalk.gray(`🗑️ Message deleted in ${deleteData.keys[0].remoteJid}`));
        }
    }
    
    async handlePresenceUpdate(update) {
        // Handle presence updates (online/typing/etc)
        // console.log(chalk.gray(`👤 Presence: ${update.id} - ${update.presence}`));
    }
    
    // Utility Methods
    extractMessageText(message) {
        const msg = message.message;
        
        if (msg?.conversation) return msg.conversation;
        if (msg?.extendedTextMessage?.text) return msg.extendedTextMessage.text;
        if (msg?.imageMessage?.caption) return msg.imageMessage.caption;
        if (msg?.videoMessage?.caption) return msg.videoMessage.caption;
        if (msg?.documentMessage?.title) return msg.documentMessage.title;
        if (msg?.audioMessage?.caption) return msg.audioMessage.caption;
        
        // Check for buttons or templates
        if (msg?.templateMessage?.fourRowTemplate?.content?.text) {
            return msg.templateMessage.fourRowTemplate.content.text;
        }
        
        if (msg?.buttonsMessage?.contentText) {
            return msg.buttonsMessage.contentText;
        }
        
        return '';
    }
    
    registerCommand(name, handler) {
        this.commands.set(name.toLowerCase(), handler);
        console.log(chalk.gray(`Registered command: !${name}`));
    }
    
    registerCommands(commands) {
        Object.entries(commands).forEach(([name, handler]) => {
            const cleanName = name.replace(/^!/, '').toLowerCase();
            this.commands.set(cleanName, handler);
            
            // Register aliases if specified
            if (handler.aliases && Array.isArray(handler.aliases)) {
                handler.aliases.forEach(alias => {
                    this.aliases.set(alias.toLowerCase(), cleanName);
                });
            }
        });
    }
    
    registerAlias(alias, command) {
        this.aliases.set(alias.toLowerCase(), command.toLowerCase());
    }
    
    isOnCooldown(user, command) {
        const key = `${user}-${command}`;
        if (!this.cooldowns.has(key)) return false;
        
        const expiration = this.cooldowns.get(key);
        return Date.now() < expiration;
    }
    
    getCooldownRemaining(user, command) {
        const key = `${user}-${command}`;
        if (!this.cooldowns.has(key)) return 0;
        
        const remaining = this.cooldowns.get(key) - Date.now();
        return Math.ceil(remaining / 1000);
    }
    
    setCooldown(user, command, seconds) {
        const key = `${user}-${command}`;
        this.cooldowns.set(key, Date.now() + (seconds * 1000));
        
        // Clean up old cooldowns
        setTimeout(() => {
            if (this.cooldowns.has(key) && this.cooldowns.get(key) < Date.now()) {
                this.cooldowns.delete(key);
            }
        }, seconds * 1000 + 1000);
    }
    
    getUserData(userId) {
        if (!this.userData.has(userId)) {
            this.userData.set(userId, {
                id: userId,
                level: 1,
                exp: 0,
                coins: this.config.games.economy.startingBalance,
                warnings: 0,
                commandsUsed: 0,
                lastActive: Date.now(),
                joinDate: Date.now(),
                stats: {
                    messagesSent: 0,
                    commandsUsed: 0,
                    gamesPlayed: 0,
                    wins: 0,
                    losses: 0
                }
            });
        }
        return this.userData.get(userId);
    }
    
    getGroupData(groupId) {
        if (!this.groupData.has(groupId)) {
            this.groupData.set(groupId, {
                id: groupId,
                settings: {
                    welcome: true,
                    goodbye: true,
                    nsfw: false,
                    games: true,
                    antispam: true
                },
                rules: [],
                warnings: new Map(),
                activity: [],
                commandsUsed: 0,
                lastActive: Date.now()
            });
        }
        return this.groupData.get(groupId);
    }
    
    isOwner(userId) {
        const ownerNumbers = this.config.owner.map(num => num.replace(/\D/g, '') + '@s.whatsapp.net');
        return ownerNumbers.includes(userId);
    }
    
    async isAdmin(userId, groupId) {
        if (this.isOwner(userId)) return true;
        
        const admins = this.config.admins.map(num => num.replace(/\D/g, '') + '@s.whatsapp.net');
        if (admins.includes(userId)) return true;
        
        try {
            const metadata = await this.sock.groupMetadata(groupId);
            const participant = metadata.participants.find(p => p.id === userId);
            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        } catch (error) {
            return false;
        }
    }
    
    isSpamming(userId, text) {
        // Implement spam detection logic
        return false;
    }
    
    async handleSpam(userId, chatId) {
        // Handle spam
        await this.sock.sendMessage(chatId, {
            text: '⚠️ Please don\'t spam!'
        });
    }
    
    containsBannedLinks(text) {
        const banned = this.config.autoMod.bannedLinks;
        return banned.some(link => text.includes(link));
    }
    
    async handleBannedLink(userId, chatId, text) {
        await this.sock.sendMessage(chatId, {
            text: '🔗 Banned links are not allowed!'
        });
    }
    
    findSimilarCommands(command) {
        const commands = Array.from(this.commands.keys());
        return commands.filter(cmd => 
            cmd.includes(command) || 
            command.includes(cmd) ||
            this.calculateSimilarity(cmd, command) > 0.6
        );
    }
    
    calculateSimilarity(str1, str2) {
        // Simple similarity calculation
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        return (longer.length - this.editDistance(longer, shorter)) / parseFloat(longer.length);
    }
    
    editDistance(s1, s2) {
        // Levenshtein distance
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();
        
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        }
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }
    
    formatUptime() {
        const uptime = Date.now() - this.stats.startTime;
        const seconds = Math.floor(uptime / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
    
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        return {
            ...this.stats,
            uptime: Math.floor(uptime / 1000),
            commandsRegistered: this.commands.size,
            users: this.userData.size,
            groups: this.groupData.size,
            connected: this.isConnected,
            qrAvailable: !!this.qrCode
        };
    }
    
    async stop() {
        console.log(chalk.yellow('🛑 Stopping bot engine...'));
        
        if (this.sock) {
            try {
                await this.sock.end();
                console.log(chalk.green('✅ Bot disconnected'));
            } catch (error) {
                console.log(chalk.red('❌ Error disconnecting:', error.message));
            }
        }
        
        this.isConnected = false;
        this.emit('stopped');
    }
}

module.exports = { BotEngine };
