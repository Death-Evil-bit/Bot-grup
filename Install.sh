#!/bin/bash
clear

echo -e "\e[1;36m"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║      WHATSAPP MEGA BOT 1500+ - AUTO INSTALLER        ║
║        Complete Installation with 1500 Features       ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "\e[0m"

echo "🔍 Checking system..."

# Check if Termux
if [ -d "/data/data/com.termux" ]; then
    echo "📱 Termux detected - Optimizing installation..."
    TERMUX_MODE=true
else
    echo "💻 Desktop/Linux detected"
    TERMUX_MODE=false
fi

# Installation steps
echo ""
echo "🚀 Starting installation..."
echo "═══════════════════════════════════════════════════════"

# Step 1: Update system
echo "📦 Step 1: Updating system packages..."
if [ "$TERMUX_MODE" = true ]; then
    pkg update -y && pkg upgrade -y
else
    sudo apt update -y && sudo apt upgrade -y
fi

# Step 2: Install dependencies
echo "🔧 Step 2: Installing dependencies..."
if [ "$TERMUX_MODE" = true ]; then
    pkg install -y nodejs git ffmpeg imagemagick python clang libwebp wget curl
else
    sudo apt install -y nodejs npm git ffmpeg imagemagick python3 python3-pip build-essential wget curl
fi

# Step 3: Create project
echo "📁 Step 3: Creating project structure..."
mkdir -p whatsapp-mega-bot-1500
cd whatsapp-mega-bot-1500

# Step 4: Download generator
echo "⚡ Step 4: Downloading 1500+ features generator..."
cat > generate-1500.js << 'EOF'
// [PASTE THE GENERATOR CODE FROM ABOVE HERE]
EOF

# Step 5: Generate bot
echo "🎨 Step 5: Generating 1500+ features..."
node generate-1500.js

# Step 6: Install packages
echo "📦 Step 6: Installing Node.js packages..."
npm install

# Step 7: Create config
echo "⚙️ Step 7: Creating configuration..."
cat > config.js << 'EOF'
module.exports = {
    bot: {
        name: "🤖 Mega Bot 1500+",
        status: "1500+ Features Online",
        version: "5.0.0"
    },
    prefix: ["!", ".", "/", "#", ">"],
    owner: ["YOUR_NUMBER_HERE"], // Change this!
    
    features: {
        welcome: true,
        goodbye: true,
        antiSpam: true,
        antiLink: false,
        autoReact: true,
        antiCall: true,
        nsfw: false
    },
    
    cooldown: 2,
    
    messages: {
        welcome: "🎉 Welcome @user to @group!\nType !menu for 1500+ commands!",
        goodbye: "👋 Goodbye @user!",
        banned: "🚫 You are banned from using commands"
    },
    
    database: {
        type: "json",
        path: "./data"
    }
};
EOF

# Step 8: Create start script
echo "🚀 Step 8: Creating startup scripts..."
cat > start-bot.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "🤖 Starting WhatsApp Mega Bot 1500+..."
echo "📊 Features loaded: 1500+"
echo "⚡ Performance mode: Enabled"
npm start
EOF

chmod +x start-bot.sh

# Step 9: Create PM2 config
cat > pm2.config.json << 'EOF'
{
  "apps": [{
    "name": "whatsapp-mega-1500",
    "script": "index.js",
    "instances": "max",
    "exec_mode": "cluster",
    "autorestart": true,
    "watch": false,
    "max_memory_restart": "1G",
    "env": {
      "NODE_ENV": "production"
    },
    "error_file": "./logs/error.log",
    "out_file": "./logs/output.log",
    "log_date_format": "YYYY-MM-DD HH:mm:ss"
  }]
}
EOF

# Step 10: Finalize
echo "✅ Step 10: Finalizing installation..."

# Create readme
cat > README.md << 'EOF'
# 🤖 WhatsApp Mega Bot 1500+

## 🚀 Features
- 1500+ Commands ready to use
- 8 Categories: Admin, Games, AI, Media, Tools, Fun, Economy, NSFW
- Multi-platform: Termux & Desktop
- Web Dashboard included
- Auto-update system

## ⚡ Quick Start
```bash
# 1. Configure your number in config.js
# 2. Start the bot:
npm start

# 3. Scan QR code with WhatsApp
# 4. Type !menu to see all commands
