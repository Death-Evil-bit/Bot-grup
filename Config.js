module.exports = {
    // Bot Identity
    bot: {
        name: "🤖 Mega Bot Pro 1500+",
        status: "Powered by 1500+ Features | Type !menu",
        version: "5.0.0",
        author: "Mega Bot Team",
        website: "https://github.com/mega-bot-1500"
    },
    
    // Command Prefix
    prefix: ["!", ".", "/", "#", ">", "$", "-", "+", "=", "@"],
    
    // Bot Owner(s)
    owner: ["6281234567890"], // CHANGE THIS TO YOUR NUMBER
    
    // Bot Admins (can use admin commands)
    admins: ["6281234567890", "6289876543210"],
    
    // Features Configuration
    features: {
        // Group Features
        autoWelcome: true,
        autoGoodbye: true,
        autoPromoteAdmin: false,
        
        // Security Features
        antiSpam: true,
        antiLink: true,
        antiVirtex: true,
        antiCall: true,
        antiDelete: true,
        
        // Automation
        autoSticker: true,
        autoReply: true,
        autoDownload: false,
        autoTranslate: false,
        
        // Game Systems
        gameEnabled: true,
        economyEnabled: true,
        levelingEnabled: true,
        
        // AI Features
        aiEnabled: true,
        nsfwEnabled: false,
        
        // Media Processing
        mediaProcessing: true,
        autoBackup: true
    },
    
    // API Keys (Add your own)
    apis: {
        openai: process.env.OPENAI_KEY || "",
        gemini: process.env.GEMINI_KEY || "",
        unsplash: process.env.UNSPLASH_KEY || "",
        youtube: process.env.YOUTUBE_KEY || "",
        weather: process.env.WEATHER_KEY || "",
        news: process.env.NEWS_KEY || "",
        translate: process.env.TRANSLATE_KEY || ""
    },
    
    // Database Configuration
    database: {
        type: "mongodb", // mongodb, mysql, postgres, sqlite, json
        url: process.env.MONGODB_URI || "mongodb://localhost:27017/whatsapp-mega-bot",
        redis: process.env.REDIS_URL || "redis://localhost:6379",
        backupInterval: 6, // hours
        keepBackups: 7 // days
    },
    
    // Limits and Restrictions
    limits: {
        // Size Limits
        downloadSize: 100, // MB
        stickerSize: 5, // MB
        videoSize: 50, // MB
        
        // Rate Limits
        commandCooldown: 2, // seconds
        spamThreshold: 5, // messages in 5 seconds
        maxWarnings: 3,
        
        // User Limits
        maxCommandsPerMinute: 30,
        maxGroupsPerUser: 10
    },
    
    // Messages and Responses
    messages: {
        welcome: "🎉 Welcome @user to @group!\n📌 Type !menu for 1500+ commands\n📜 Rules: !rules",
        goodbye: "👋 Goodbye @user!",
        rules: `📜 *GROUP RULES*
1. No spam or flooding
2. No NSFW content
3. Respect all members
4. No personal attacks
5. No advertising without permission
6. Use appropriate language
7. Follow admin instructions`,
        
        errors: {
            cooldown: "⏳ Please wait @time seconds before using this command again",
            banned: "🚫 You are banned from using commands",
            adminOnly: "⚠️ This command is for admins only",
            groupOnly: "⚠️ This command works in groups only",
            ownerOnly: "🔒 This command is for bot owner only",
            nsfwDisabled: "🔞 NSFW commands are disabled in this group"
        }
    },
    
    // Game System Configuration
    games: {
        rpg: {
            maxLevel: 100,
            expMultiplier: 1.5,
            dropRate: 0.3
        },
        economy: {
            startingBalance: 1000,
            dailyReward: 100,
            workReward: 50,
            taxRate: 0.1
        }
    },
    
    // Web Dashboard
    web: {
        enabled: true,
        port: process.env.PORT || 3000,
        password: process.env.WEB_PASSWORD || "admin123",
        sessionSecret: process.env.SESSION_SECRET || "mega-bot-secret-1500",
        features: {
            dashboard: true,
            logs: true,
            statistics: true,
            remoteControl: true
        }
    },
    
    // Logging Configuration
    logging: {
        level: "info", // error, warn, info, debug
        file: "./logs/bot.log",
        maxSize: "10m",
        maxFiles: "7d"
    },
    
    // Auto-moderation Rules
    autoMod: {
        bannedWords: ["hate", "racist", "attack", "kill"],
        bannedLinks: ["malware.com", "spam.site"],
        maxCaps: 0.7, // 70% caps allowed
        maxEmojis: 10
    },
    
    // Plugin Configuration
    plugins: {
        autoUpdate: true,
        allowCustom: true,
        disabledPlugins: []
    },
    
    // Performance Settings
    performance: {
        maxMemory: "512MB",
        gcInterval: 300, // seconds
        cacheTTL: 3600, // seconds
        workerCount: 4
    }
};
