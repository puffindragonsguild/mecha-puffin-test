// index.js
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const messages = require('./messages.js');
const db = require('./database.js'); 

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.once('ready', () => {
    console.log('🤖 Mecha-Puffin Test Engine is ONLINE!');
});

client.on('messageCreate', message => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Your custom hail command!
    if (message.content === '!hail') {
        const randomHail = messages.getRandom(messages.leaderHype);
        message.reply(randomHail);    
    }

    // The monk roast test
    if (message.content === '!roastmonk') {
        const randomRoast = messages.getRandom(messages.monkRoasts);
        message.reply(randomRoast);
    }

    // NEW: The command to spawn the sign-up buttons
    if (message.content === '!openraid') {
        // 1. Build the individual buttons
        const llkButton = new ButtonBuilder()
            .setCustomId('signup_llk')
            .setLabel('Sign Up: LLK')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚔️');

        const hodButton = new ButtonBuilder()
            .setCustomId('signup_hod')
            .setLabel('Sign Up: HoD')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🛡️');

        const bothButton = new ButtonBuilder()
            .setCustomId('signup_both')
            .setLabel('Sign Up: Both')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔥');

        // 2. Pack them into a row
        const row = new ActionRowBuilder()
            .addComponents(llkButton, hodButton, bothButton);

        // 3. Send the message with the buttons attached
        message.channel.send({ 
            content: '🚨 **NEW RAID POSTED** 🚨\nThe Mecha-Puffin is accepting sign-ups. Click a button below!', 
            components: [row] 
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
