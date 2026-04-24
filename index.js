// index.js
const { Client, GatewayIntentBits } = require('discord.js');
const messages = require('./messages.js');
const db = require('./database.js'); // 👈 Wakes up the database!

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.once('ready', () => {
    console.log('🤖 Mecha-Puffin Test Engine is ONLINE!');
});

client.on('messageCreate', message => {
    if (message.author.bot) return;

    // A test command to see the randomizer in action
    if (message.content === '!roastmonk') {
        // The bot fetches a random roast from messages.js
        const randomRoast = messages.getRandom(messages.monkRoasts);
        message.reply(randomRoast);
    }
});

client.login(process.env.DISCORD_TOKEN);
