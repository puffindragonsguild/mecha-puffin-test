// index.js
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const messages = require('./messages.js');
const db = require('./database.js'); 

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

let gatesOpen = false;
let hypeInterval; // Tracker for the 24-hour loop

client.once('ready', () => {
    console.log('🤖 Mecha-Puffin Test Engine is ONLINE!');
});

// --- REUSABLE ROSTER FUNCTION ---
async function displayRoster(target) {
    const allSignups = db.prepare('SELECT * FROM signups ORDER BY id ASC').all();
    if (allSignups.length === 0) return target.send("📭 **The roster is empty!**");

    const rosterEmbed = { title: "📜 Official Raid Roster", color: 0x0099ff, fields: [] };
    const maxPlayers = 15;
    const fortyEightHours = 48 * 60 * 60 * 1000;
    const firstSignupTime = new Date(allSignups[0].created_at || Date.now()).getTime();
    const windowExpired = (Date.now() - firstSignupTime) > fortyEightHours;

    const addSection = (name, emoji, key) => {
        const players = allSignups.filter(p => 
            p.boss_choice.includes(key) || (p.boss_choice.includes('BOTH') && (key === 'LLK' || key === 'HOD'))
        );

        if (players.length > 0) {
            let mainList = windowExpired ? players : players.filter(p => !p.boss_choice.startsWith('PUBLIC_'));
            let publicQueue = windowExpired ? [] : players.filter(p => p.boss_choice.startsWith('PUBLIC_'));

            const mainTeam = mainList.slice(0, maxPlayers);
            const mainReserves = mainList.slice(maxPlayers);

            const mainText = mainTeam.map(p => `• **${p.character_name}** [Lvl ${p.level}] (${p.vocation}) <@${p.discord_user_id}>`).join('\n');
            rosterEmbed.fields.push({ name: `${emoji} ${name} TEAM (${mainTeam.length}/${maxPlayers})`, value: mainText || "Empty", inline: false });

            if (mainReserves.length > 0) {
                const resText = mainReserves.map(p => `• **${p.character_name}** [Lvl ${p.level}] (${p.vocation})`).join('\n');
                rosterEmbed.fields.push({ name: `⏳ ${name} PUFFIN RESERVES`, value: resText, inline: false });
            }

            if (publicQueue.length > 0) {
                const publicText = publicQueue.map(p => `• **${p.character_name}** [Lvl ${p.level}] (${p.vocation})`).join('\n');
                rosterEmbed.fields.push({ name: `📢 ${name} PUBLIC QUEUE (Waitlisted)`, value: publicText, inline: false });
            }
        }
    };

    addSection('LLK', '⚔️', 'LLK');
    addSection('HoD', '🛡️', 'HOD');
    addSection('FERUMBRAS', '🧙‍♂️', 'FERU');

    const timeLeft = Math.max(0, (fortyEightHours - (Date.now() - firstSignupTime)) / (1000 * 60 * 60));
    rosterEmbed.footer = { 
        text: (windowExpired ? "✅ Public queue merged." : `🕒 Public queue merges in ${timeLeft.toFixed(1)}h.`) + "\n❌ Need to drop out? Type !dropout"
    };

    return target.send({ embeds: [rosterEmbed] });
}

// --- HYPE LOOP TRIGGER ---
const startHypeLoop = (message, raidType) => {
    if (hypeInterval) clearInterval(hypeInterval);
    hypeInterval = setInterval(() => {
        if (!gatesOpen) return clearInterval(hypeInterval);
        message.channel.send(`🔥 **THE RAID CONTINUES!** 🔥\nWe still need more Puffins for **${raidType}**!`);
        displayRoster(message.channel);
    }, 24 * 60 * 60 * 1000); 
};

// ---------------------------------------------------------
// 1. LISTENING FOR CHAT COMMANDS
// ---------------------------------------------------------
client.on('messageCreate', message => {
    if (message.author.bot) return;

    if (message.content === '!hail') message.reply('HAIL FORTUNA FELIS! 👑');

    if (message.content === '!roster') displayRoster(message.channel);

    if (message.content.startsWith('!dropout')) {
        const userId = message.author.id;
        const args = message.content.split(' ');
        const targetName = args.slice(1).join(' '); // Grab the name after !dropout

        const userSignups = db.prepare('SELECT character_name FROM signups WHERE discord_user_id = ?').all(userId);
        
        if (userSignups.length === 0) {
            return message.reply("You aren't on the list, Puffin!");
        }

        // If they didn't provide a name and have multiple signups
        if (!targetName && userSignups.length > 1) {
            const names = userSignups.map(s => `• **${s.character_name}**`).join('\n');
            return message.reply(`You have multiple characters signed up:\n${names}\nPlease type \`!dropout [Character Name]\` to specify which one is abandoning the Queen.`);
        }

        // Determine which character to delete
        const charToDelete = targetName || userSignups[0].character_name;

        const info = db.prepare('DELETE FROM signups WHERE discord_user_id = ? AND LOWER(character_name) = LOWER(?)').run(userId, charToDelete);
        
        if (info.changes > 0) {
            message.channel.send(`🏃💨 **ABANDONMENT:** **${charToDelete}** has fled the raid. Cowardice noted!`);
            displayRoster(message.channel);
        } else {
            message.reply(`I couldn't find a character named **${charToDelete}** under your ID.`);
        }
    }

    if (message.content === '!open dt') {
        gatesOpen = true;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('signup_llk').setLabel('LLK').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
            new ButtonBuilder().setCustomId('signup_hod').setLabel('HoD').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId('signup_both').setLabel('Both').setStyle(ButtonStyle.Danger).setEmoji('🔥')
        );
        message.channel.send({ content: '🚨 **DOUBLE TROUBLE POSTED** 🚨', components: [row] });
        startHypeLoop(message, 'Double Trouble');
    }

    if (message.content === '!open feru') {
        gatesOpen = true;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('signup_feru').setLabel('Ferumbras').setStyle(ButtonStyle.Danger).setEmoji('🧙‍♂️')
        );
        message.channel.send({ content: '🚨 **FERUMBRAS RAID POSTED** 🚨', components: [row] });
        startHypeLoop(message, 'Ferumbras');
    }

    if (message.content === '!open dt reserve') {
        gatesOpen = true;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('signup_reserve').setLabel('Sign Up: Reserve Only').setStyle(ButtonStyle.Secondary).setEmoji('⏳')
        );
        message.channel.send({ content: '⚠️ **RESERVE LIST ONLY** ⚠️', components: [row] });
    }

    if (message.content === '!close') {
        gatesOpen = false;
        if (hypeInterval) clearInterval(hypeInterval);
        message.reply('🛑 **The gates are now CLOSED.**');
    }

    if (message.content === '!clear') {
        db.prepare('DELETE FROM signups').run();
        message.reply('🧹 **Roster wiped clean!**');
    }

    if (message.content.startsWith('!whitelist')) {
        const args = message.content.split(' ');
        const action = args[1];
        const name = args.slice(2).join(' ');
        if (action === 'add') {
            db.prepare('INSERT OR IGNORE INTO whitelist (char_name) VALUES (?)').run(name);
            message.reply(`✅ **${name}** added to Whitelist.`);
        } else if (action === 'remove') {
            db.prepare('DELETE FROM whitelist WHERE char_name = ?').run(name);
            message.reply(`🗑️ **${name}** removed.`);
        }
    }
});

// ---------------------------------------------------------
// 2. LISTENING FOR BUTTON CLICKS & FORMS
// ---------------------------------------------------------
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (!gatesOpen) return interaction.reply({ content: messages.getRandom(messages.closedGates), ephemeral: true });

        const modal = new ModalBuilder().setCustomId(`modal_${interaction.customId}`).setTitle('Mecha-Puffin Registration');
        const charNameInput = new TextInputBuilder().setCustomId('charName').setLabel("Exact character name?").setStyle(TextInputStyle.Short).setRequired(true);
        const queenMessageInput = new TextInputBuilder().setCustomId('queenMessage').setLabel("Message for the Queen?").setStyle(TextInputStyle.Paragraph).setRequired(false);
        
        modal.addComponents(new ActionRowBuilder().addComponents(charNameInput), new ActionRowBuilder().addComponents(queenMessageInput));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
        const rawName = interaction.fields.getTextInputValue('charName');
        const queenMessage = interaction.fields.getTextInputValue('queenMessage') || "";
        const bossChoice = interaction.customId.replace('modal_signup_', '').toUpperCase();

        await interaction.deferReply(); 

        try {
            const response = await fetch(`https://api.tibiadata.com/v4/character/${encodeURIComponent(rawName)}`);
            const data = await response.json();

            if (!data.character?.character?.name) // ---------------------------------------------------------
// 2. LISTENING FOR BUTTON CLICKS & FORMS
// ---------------------------------------------------------
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (!gatesOpen) return interaction.reply({ content: messages.getRandom(messages.closedGates), ephemeral: true });

        const modal = new ModalBuilder().setCustomId(`modal_${interaction.customId}`).setTitle('Mecha-Puffin Registration');
        const charNameInput = new TextInputBuilder().setCustomId('charName').setLabel("Exact character name?").setStyle(TextInputStyle.Short).setRequired(true);
        const queenMessageInput = new TextInputBuilder().setCustomId('queenMessage').setLabel("Message for the Queen?").setStyle(TextInputStyle.Paragraph).setRequired(false);
        
        modal.addComponents(new ActionRowBuilder().addComponents(charNameInput), new ActionRowBuilder().addComponents(queenMessageInput));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
        const rawName = interaction.fields.getTextInputValue('charName');
        const queenMessage = interaction.fields.getTextInputValue('queenMessage') || "";
        const bossChoice = interaction.customId.replace('modal_signup_', '').toUpperCase();

        await interaction.deferReply(); 

        try {
            const response = await fetch(`https://api.tibiadata.com/v4/character/${encodeURIComponent(rawName)}`);
            const data = await response.json();

            if (!data.character?.character?.name) return interaction.editReply(`❌ Character **${rawName}** not found.`);

            const char = data.character.character;
            const charName = char.name; 
            const rawVocation = char.vocation.toUpperCase();
            const charLevel = char.level;
            const guildName = char.guild?.name || null;

            if (rawVocation === 'NONE') return interaction.editReply(`❌ Rookgaardian detected.`);

            // 🛡️ FAILSAFE: Check if character is already signed up
            const existing = db.prepare('SELECT id FROM signups WHERE LOWER(character_name) = LOWER(?)').get(charName);
            if (existing) {
                return interaction.editReply(`❌ **Error:** **${charName}** is already on the roster! Double-signing is forbidden.`);
            }

            // 🏷️ GATEKEEPER LOGIC
            const manualWhitelist = db.prepare('SELECT char_name FROM whitelist WHERE char_name = ?').get(charName);
            const isPuffin = (guildName === "Puffin Dragons") || manualWhitelist;
            
            let finalChoice = bossChoice;
            let note = "";
            if (!isPuffin && bossChoice !== 'RESERVE') {
                finalChoice = `PUBLIC_${bossChoice}`;
                note = `\n*(Note: You are in the public queue for 48h)*`;
            }

            // 🎨 VOCATION MAPPING
            let vocAbbr = rawVocation; let vocEmoji = '❓';
            if (rawVocation.includes('KNIGHT')) { vocAbbr = 'EK'; vocEmoji = '🛡️'; }
            else if (rawVocation.includes('DRUID')) { vocAbbr = 'ED'; vocEmoji = '❄️'; }
            else if (rawVocation.includes('SORCERER')) { vocAbbr = 'MS'; vocEmoji = '🔥'; }
            else if (rawVocation.includes('PALADIN')) { vocAbbr = 'RP'; vocEmoji = '🏹'; }
            else if (rawVocation.includes('MONK')) { vocAbbr = 'MK'; vocEmoji = '🥋'; }
            const formattedVoc = `${vocEmoji} ${vocAbbr}`;

            // 💾 SINGLE SAVE TO DATABASE
            db.prepare('INSERT INTO signups (discord_user_id, character_name, vocation, level, boss_choice, message_to_queen) VALUES (?, ?, ?, ?, ?, ?)')
              .run(interaction.user.id, charName, formattedVoc, charLevel, finalChoice, queenMessage);

            // 📣 COMPOSE REPLY
            let replyText = "";
            if (rawVocation.includes('MONK')) {
                replyText = `${messages.getRandom(messages.monkRoasts)}\n✅ <@${interaction.user.id}>, **${charName}** added!${note}`;
            } else {
                replyText = `✅ <@${interaction.user.id}>, **${charName}** [Lvl ${charLevel}] (${formattedVoc}) ${messages.getRandom(messages.standardHype)}!${note}`;
            }

            if (queenMessage.trim() !== "") replyText += `\n👑 **Message to the Queen:**\n> *"${queenMessage}"*`;

            await interaction.editReply({ content: replyText });
            
            // 📜 UPDATE ROSTER
            await displayRoster(interaction.channel);

        } catch (error) {
            console.error("Signup Error:", error);
            await interaction.editReply("⚠️ The Mecha-Puffin encountered an error reaching Tibia servers.");
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
