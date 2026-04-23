const { Client, GatewayIntentBits } = require('discord.js');

// Give the bot permission to read guilds and messages
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// When the bot successfully boots up, log it to the console
client.once('ready', () => {
    console.log('🤖 Mecha-Puffin Test Engine is ONLINE!');
});

// Listen for messages in the Discord server
client.on('messageCreate', message => {
    // Ignore messages sent by other bots (including itself)
    if (message.author.bot) return;

    // The test command
    if (message.content === '!test') {
        message.reply('⚙️ Initialization successful! Mecha-Puffin is alive and awaiting orders!');
    }
});

// Log into Discord using the secret token
client.login(process.env.DISCORD_TOKEN);
