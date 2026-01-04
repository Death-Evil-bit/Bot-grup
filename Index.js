require('dotenv').config();
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════════╗
║               🤖 WHATSAPP MEGA BOT 1500+                        ║
║               Complete Edition v5.0.0                           ║
║               Total Features: 1500+ Ready                       ║
╚══════════════════════════════════════════════════════════════════╝
`));

// Create all directories
const directories = [
    'sessions',
    'media/images',
    'media/videos', 
    'media/audio',
    'media/stickers',
    'logs',
    'temp',
    'backups',
    'data',
    'plugins/admin',
    'plugins/games',
    'plugins/ai',
    'plugins/media',
    'plugins/tools',
    'plugins/fun',
    'plugins/economy',
    'plugins/nsfw',
    'core',
    'libs',
    'database',
    'web/dashboard',
    'web/api',
    'assets/images',
    'assets/sounds',
    'configs'
];

directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(chalk.gray(`Created: ${dir}`));
    }
});

// Check if plugins exist, if not generate them
if (!fs.existsSync('plugins/admin/moderation.js')) {
    console.log(chalk.yellow('⚠️ Plugins not found. Generating 1500+ features...'));
    require('./generate-all.js');
}

// Load configuration
const config = require('./config.js');

// Import bot engine
const { BotEngine } = require('./core/bot-engine.js');
const { PluginLoader } = require('./core/plugin-loader.js');
const { Database } = require('./core/database.js');

class MegaBot1500 {
    constructor() {
        this.config = config;
        this.stats = {
            startTime: Date.now(),
            commandsLoaded: 0,
            pluginsLoaded: 0,
            users: 0,
            groups: 0
        };
        
        this.engine = null;
        this.pluginLoader = new PluginLoader();
        this.database = new Database();
    }
    
    async initialize() {
        console.log(chalk.blue('🚀 Initializing Mega Bot 1500+...'));
        
        // Load database
        await this.database.connect();
        console.log(chalk.green('✅ Database connected'));
        
        // Load all plugins
        const plugins = await this.pluginLoader.loadAll();
        this.stats.pluginsLoaded = plugins.length;
        
        // Count total commands
        this.stats.commandsLoaded = plugins.reduce((total, plugin) => 
            total + Object.keys(plugin.commands || {}).length, 0
        );
        
        console.log(chalk.green(`✅ Loaded ${this.stats.pluginsLoaded} plugins`));
        console.log(chalk.green(`✅ Loaded ${this.stats.commandsLoaded} commands`));
        
        // Initialize bot engine
        this.engine = new BotEngine(this.config);
        
        // Register all commands
        plugins.forEach(plugin => {
            if (plugin.commands) {
                this.engine.registerCommands(plugin.commands);
            }
        });
        
        // Start bot
        await this.engine.start();
        
        // Start web dashboard if enabled
        if (this.config.web.enabled) {
            require('./web/server.js').start(this.config.web.port);
            console.log(chalk.green(`🌐 Web dashboard: http://localhost:${this.config.web.port}`));
        }
        
        // Start auto-backup
        if (this.config.backup.enabled) {
            this.startAutoBackup();
        }
        
        this.printWelcomeMessage();
    }
    
    printWelcomeMessage() {
        console.log(chalk.cyan('\n' + '═'.repeat(60)));
        console.log(chalk.green.bold('🎉 MEGA BOT 1500+ STARTED SUCCESSFULLY!'));
        console.log(chalk.cyan('═'.repeat(60)));
        console.log(chalk.yellow('📊 Statistics:'));
        console.log(chalk.white(`   Commands: ${this.stats.commandsLoaded}`));
        console.log(chalk.white(`   Plugins: ${this.stats.pluginsLoaded}`));
        console.log(chalk.white(`   Categories: 8`));
        console.log(chalk.white(`   Version: ${this.config.bot.version}`));
        console.log(chalk.cyan('═'.repeat(60)));
        console.log(chalk.green('📱 Scan the QR code above with WhatsApp'));
        console.log(chalk.green('💬 Type !menu to see all 1500+ commands'));
        console.log(chalk.cyan('═'.repeat(60)));
    }
    
    startAutoBackup() {
        const cron = require('node-cron');
        
        cron.schedule('0 */6 * * *', () => {
            console.log(chalk.blue('💾 Running auto-backup...'));
            
            const backupDir = `./backups/backup-${Date.now()}`;
            fs.mkdirSync(backupDir, { recursive: true });
            
            // Copy important files
            ['sessions', 'data', 'config.js', '.env'].forEach(item => {
                if (fs.existsSync(item)) {
                    const stats = fs.statSync(item);
                    if (stats.isDirectory()) {
                        execSync(`cp -r ${item} ${backupDir}/`);
                    } else {
                        fs.copyFileSync(item, `${backupDir}/${item}`);
                    }
                }
            });
            
            console.log(chalk.green(`✅ Backup saved: ${backupDir}`));
            
            // Clean old backups (keep last 7)
            const backups = fs.readdirSync('./backups')
                .filter(f => f.startsWith('backup-'))
                .sort()
                .reverse();
            
            if (backups.length > 7) {
                backups.slice(7).forEach(oldBackup => {
                    fs.rmSync(`./backups/${oldBackup}`, { recursive: true });
                });
            }
        });
        
        console.log(chalk.green('✅ Auto-backup scheduled every 6 hours'));
    }
    
    async shutdown() {
        console.log(chalk.yellow('\n🔴 Shutting down Mega Bot...'));
        
        if (this.engine) {
            await this.engine.stop();
        }
        
        await this.database.disconnect();
        
        console.log(chalk.green('✅ Bot shutdown complete'));
        process.exit(0);
    }
}

// Handle process events
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Received SIGINT'));
    bot.shutdown();
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n🛑 Received SIGTERM'));
    bot.shutdown();
});

process.on('uncaughtException', (error) => {
    console.log(chalk.red('💥 Uncaught Exception:'), error);
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log(chalk.red('⚠️ Unhandled Rejection at:', promise, 'reason:', reason));
});

// Start the bot
const bot = new MegaBot1500();

async function main() {
    try {
        await bot.initialize();
    } catch (error) {
        console.log(chalk.red('❌ Failed to start bot:'), error);
        process.exit(1);
    }
}

// Run
main();
