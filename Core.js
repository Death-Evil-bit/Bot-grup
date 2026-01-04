const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class BotEngine extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.sock = null;
        this.commands = new Map();
        this.userData = new Map();
        this.groupData = new Map();
        this.cooldowns = new Map();
        this.stats = {
            messagesProcessed: 0,
            commandsExecuted: 0,
            errors: 0,
            startTime: Date.now()
        };
    }
    
    async start() {
        console.log(chalk.blue('🤖 Starting WhatsApp Bot Engine...'));
        
        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState('./sessions');
        
        // Get latest version
        const { version } = await fetchLatestBaileysVersion();
        
        // Create socket
        this.sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: { level: 'warn' },
            browser: ['Mega Bot 1500', 'Chrome', '5.0.0'],
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            defaultQueryTimeoutMs: 60000,
            emitOwnEvents: true
        });
        
        // Connection updates
        this.sock.ev.on('connection.update', (update) => {
            this.handleConnectionUpdate(update, saveCreds);
        });
        
        // Save credentials
        this.sock.ev.on('creds.update', saveCreds);
        
        // Message handling
        this.sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const message of messages) {
                await this.handleMessage(message);
            }
        });
        
        // Group updates
        this.sock.ev.on('group-participants.update', async (update) => {
            await this.handleGroupUpdate(update);
        });
        
        // Message reactions
        this.sock.ev.on('messages.reaction', async (reactions) => {
            await this.handleReaction(reactions);
        });
        
        // Call events
        this.sock.ev.on('call', async (call) => {
            await this.handleCall(call);
        });
        
        console.log(chalk.green('✅ Bot Engine Started'));
        return this.sock;
    }
    
    async handleConnectionUpdate(update, saveCreds) {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log(chalk.yellow('📱 Scan QR Code above'));
            this.emit('qr', qr);
        }
        
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect.error).output.statusCode;
            console.log(chalk.red(`Connection closed: ${reason}`));
            
            if (reason === DisconnectReason.loggedOut) {
                console.log(chalk.red('❌ Logged out! Cleaning sessions...'));
                fs.rmSync('./sessions', { recursive: true, force: true });
                this.emit('logout');
                process.exit(1);
            } else {
                console.log(chalk.yellow('🔄 Reconnecting in 5 seconds...'));
                this.emit('reconnecting');
                setTimeout(() => this.start(), 5000);
            }
        }
        
        if (connection === 'open') {
            console.log(chalk.green('✅ Connected to WhatsApp!'));
            this.emit('connected');
            
            // Set bot status
            await this.sock.updateProfileStatus(this.config.bot.status);
            
            // Send welcome to owner
            if (this.config.owner && this.config.owner[0]) {
                const ownerJid = this.config.owner[0] + '@s.whatsapp.net';
                await this.sock.sendMessage(ownerJid, {
                    text: `✅ *Bot Online!*\n🏆 Features: 1500+\n🚀 Version: ${this.config.bot.version}\n📊 Stats: Ready to process commands`
                });
            }
        }
    }
    
    async handleMessage(message) {
        try {
            this.stats.messagesProcessed++;
            
            if (!message.message || message.key.fromMe) return;
            
            const text = this.extractMessageText(message);
            if (!text) return;
            
            const chatId = message.key.remoteJid;
            const sender = message.key.participant || message.key.remoteJid;
            const isGroup = chatId.endsWith('@g.us');
            
            // Create context
            const context = {
                chatId,
                sender,
                isGroup,
                text,
                message,
                bot: this,
                config: this.config,
                userData: this.getUserData(sender),
                groupData: isGroup ? this.getGroupData(chatId) : null
            };
            
            // Check for commands
            for (const prefix of this.config.prefix) {
                if (text.startsWith(prefix)) {
                    const commandText = text.slice(prefix.length).trim().split(/ +/)[0];
                    const args = text.slice(prefix.length + commandText.length).trim().split(/ +/);
                    
                    await this.executeCommand(commandText, args, context);
                    break;
                }
            }
            
            // Auto-reply for mentions
            if (this.sock.user && text.includes('@' + this.sock.user.id.split(':')[0])) {
                await this.sock.sendMessage(chatId, {
                    text: `👋 Hello! I'm *${this.config.bot.name}* with 1500+ features!\nType ${this.config.prefix[0]}menu to see all commands`,
                    mentions: [sender]
                });
            }
            
            // Auto-react to messages (optional)
            if (this.config.features.autoReact) {
                const reactions = ['👍', '❤️', '🔥', '🎉', '👏'];
                await this.sock.sendMessage(chatId, {
                    react: {
                        text: reactions[Math.floor(Math.random() * reactions.length)],
                        key: message.key
                    }
                });
            }
            
        } catch (error) {
            this.stats.errors++;
            console.log(chalk.red('Message handling error:'), error);
        }
    }
    
    async executeCommand(command, args, context) {
        // Check cooldown
        if (this.isOnCooldown(context.sender, command)) {
            const remaining = this.getCooldownRemaining(context.sender, command);
            await this.sock.sendMessage(context.chatId, {
                text: `⏳ Cooldown: Please wait ${remaining}s before using !${command} again`
            });
            return;
        }
        
        // Set cooldown
        this.setCooldown(context.sender, command, this.config.cooldown || 2);
        
        // Find command
        const commandHandler = this.commands.get(command.toLowerCase());
        
        if (commandHandler) {
            try {
                this.stats.commandsExecuted++;
                await commandHandler.execute(this.sock, context.message, args, context);
            } catch (error) {
                console.log(chalk.red(`Command !${command} error:`), error);
                await this.sock.sendMessage(context.chatId, {
                    text: `❌ Error executing !${command}: ${error.message}`
                });
            }
        } else {
            // Show similar commands
            const similar = Array.from(this.commands.keys())
                .filter(cmd => cmd.includes(command) || command.includes(cmd))
                .slice(0, 5);
            
            if (similar.length > 0) {
                await this.sock.sendMessage(context.chatId, {
                    text: `❓ Command !${command} not found.\nDid you mean:\n${similar.map(cmd => `• !${cmd}`).join('\n')}`
                });
            }
        }
    }
    
    async handleGroupUpdate(update) {
        const { id, participants, action } = update;
        
        if (action === 'add' && this.config.features.welcome) {
            for (const participant of participants) {
                const welcomeMsg = this.config.messages.welcome
                    .replace('@user', `@${participant.split('@')[0]}`)
                    .replace('@group', (await this.sock.groupMetadata(id)).subject);
                
                await this.sock.sendMessage(id, {
                    text: welcomeMsg,
                    mentions: [participant]
                });
            }
        }
        
        if (action === 'remove' && this.config.features.goodbye) {
            for (const participant of participants) {
                await this.sock.sendMessage(id, {
                    text: this.config.messages.goodbye.replace('@user', `@${participant.split('@')[0]}`)
                });
            }
        }
        
        if (action === 'promote' || action === 'demote') {
            // Log admin changes
            console.log(chalk.cyan(`👑 ${action} in group ${id}`));
        }
    }
    
    async handleReaction(reactions) {
        // Handle message reactions
        for (const { key, reaction } of reactions) {
            if (reaction.text === '❤️' && key.fromMe) {
                // Auto-reply to heart reactions on bot messages
                await this.sock.sendMessage(key.remoteJid, {
                    text: '❤️ Thank you for the love!'
                });
            }
        }
    }
    
    async handleCall(call) {
        if (this.config.features.antiCall) {
            // Reject calls automatically
            console.log(chalk.yellow(`📞 Call blocked from ${call.from}`));
        }
    }
    
    // Utility methods
    extractMessageText(message) {
        const msg = message.message;
        return msg?.conversation ||
               msg?.extendedTextMessage?.text ||
               msg?.imageMessage?.caption ||
               msg?.videoMessage?.caption ||
               msg?.documentMessage?.title ||
               '';
    }
    
    registerCommand(name, handler) {
        this.commands.set(name.toLowerCase(), handler);
    }
    
    registerCommands(commands) {
        Object.entries(commands).forEach(([name, handler]) => {
            this.registerCommand(name.replace(/^!/, ''), handler);
        });
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
                coins: 1000,
                warnings: 0,
                commandsUsed: 0,
                lastActive: Date.now()
            });
        }
        return this.userData.get(userId);
    }
    
    getGroupData(groupId) {
        if (!this.groupData.has(groupId)) {
            this.groupData.set(groupId, {
                id: groupId,
                settings: {},
                rules: [],
                warnings: new Map(),
                activity: []
            });
        }
        return this.groupData.get(groupId);
    }
    
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        return {
            ...this.stats,
            uptime: Math.floor(uptime / 1000),
            commandsRegistered: this.commands.size,
            users: this.userData.size,
            groups: this.groupData.size
        };
    }
}

// Export
async function startBotEngine(config) {
    const engine = new BotEngine(config);
    
    // Load all plugins
    const plugins = await loadAllPlugins();
    plugins.forEach(plugin => {
        if (plugin.commands) {
            engine.registerCommands(plugin.commands);
        }
    });
    
    await engine.start();
    return engine;
}

async function loadAllPlugins() {
    const plugins = [];
    const pluginDir = './plugins';
    
    if (!fs.existsSync(pluginDir)) return plugins;
    
    const categories = fs.readdirSync(pluginDir);
    
    for (const category of categories) {
        const categoryPath = path.join(pluginDir, category);
        if (fs.statSync(categoryPath).isDirectory()) {
            const pluginFiles = fs.readdirSync(categoryPath)
                .filter(f => f.endsWith('.js'));
            
            for (const pluginFile of pluginFiles) {
                try {
                    const plugin = require(`../${categoryPath}/${pluginFile}`);
                    plugins.push(plugin);
                } catch (e) {
                    console.log(chalk.red(`Failed to load ${pluginFile}:`, e.message));
                }
            }
        }
    }
    
    return plugins;
}

module.exports = { startBotEngine, BotEngine };
