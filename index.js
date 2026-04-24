// index.js
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const messages = require('./messages.js');
const db = require('./database.js'); 

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// A simple switch to control if the bot accepts sign-ups
let gatesOpen = false;

client.once('ready', () => {
    console.log('🤖 Mecha-Puffin Test Engine is ONLINE!');
});

// ---------------------------------------------------------
// 1. LISTENING FOR CHAT COMMANDS
// ---------------------------------------------------------
client.on('messageCreate', message => {
    // NEW WIRETAP LINE: Print what the bot hears to the Railway logs
    console.log(`[LOG] I heard: "${message.content}" from ${message.author.username}`);

    if (message.author.bot) return;

    if (message.content === '!hail') {
        message.reply('HAIL FORTUNA FELIS! 👑');
    }

    // !whitelist add Name / !whitelist remove Name
    if (message.content.startsWith('!whitelist')) {
        const args = message.content.split(' ');
        const action = args[1]; // 'add' or 'remove'
        const name = args.slice(2).join(' ');

        if (action === 'add') {
            db.prepare('INSERT OR IGNORE INTO whitelist (char_name) VALUES (?)').run(name);
            message.reply(`✅ **${name}** added to the Puffin Whitelist.`);
        } else if (action === 'remove') {
            db.prepare('DELETE FROM whitelist WHERE char_name = ?').run(name);
            message.reply(`🗑️ **${name}** removed from the Whitelist.`);
        }
    }

    // Updated !open command with "Reserve Only" option
    if (message.content === '!open dt reserve') {
        gatesOpen = true;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('signup_reserve').setLabel('Sign Up: Reserve Only').setStyle(ButtonStyle.Secondary).setEmoji('⏳')
        );
        message.channel.send({ content: '⚠️ **RESERVE LIST ONLY** ⚠️\nThe core team is set. Click below to join the backup queue!', components: [row] });
    }
    // Command to CLOSE the gates
    if (message.content === '!close') {
        gatesOpen = false;
        message.reply('🛑 **The gates are now CLOSED.** The Mecha-Puffin is resting.');
    }

    // Command to OPEN Double Trouble (LLK & HoD)
    if (message.content === '!open dt') {
        gatesOpen = true;
        const llkBtn = new ButtonBuilder().setCustomId('signup_llk').setLabel('LLK').setStyle(ButtonStyle.Primary).setEmoji('⚔️');
        const hodBtn = new ButtonBuilder().setCustomId('signup_hod').setLabel('HoD').setStyle(ButtonStyle.Success).setEmoji('🛡️');
        const bothBtn = new ButtonBuilder().setCustomId('signup_both').setLabel('Both').setStyle(ButtonStyle.Danger).setEmoji('🔥');
        
        const row = new ActionRowBuilder().addComponents(llkBtn, hodBtn, bothBtn);
        message.channel.send({ content: '🚨 **DOUBLE TROUBLE POSTED** 🚨\nThe Gates are OPEN! Click below to sign up.', components: [row] });
    }

    // Command to OPEN Ferumbras
    if (message.content === '!open feru') {
        gatesOpen = true;
        const feruBtn = new ButtonBuilder().setCustomId('signup_feru').setLabel('Ferumbras').setStyle(ButtonStyle.Danger).setEmoji('🧙‍♂️');
        
        const row = new ActionRowBuilder().addComponents(feruBtn);
        message.channel.send({ content: '🚨 **FERUMBRAS RAID POSTED** 🚨\nThe Gates are OPEN! Click below to sign up.', components: [row] });
    }
    // Command to wipe the database for a new week
    if (message.content === '!clear') {
        // Delete all rows in the table
        db.prepare('DELETE FROM signups').run();
        message.reply('🧹 **The roster has been wiped clean!** The Mecha-Puffin is ready for a new week.');
    }
    // Command to view the roster
    if (message.content === '!roster') {
        // Grab the data, now explicitly asking for the 'level' column
        const signups = db.prepare('SELECT character_name, vocation, level, boss_choice FROM signups ORDER BY id ASC').all();

        if (signups.length === 0) {
            return message.reply("📭 **The roster is empty!** No one has braved the gates yet.");
        }

        const rosterEmbed = {
            title: "📜 Official Raid Roster",
            description: "The Queen's chosen warriors:",
            color: 0x0099ff,
            fields: []
        };

        const maxPlayers = 15; 

        const llkPlayers = signups.filter(p => p.boss_choice === 'LLK' || p.boss_choice === 'BOTH');
        const hodPlayers = signups.filter(p => p.boss_choice === 'HOD' || p.boss_choice === 'BOTH');
        const feruPlayers = signups.filter(p => p.boss_choice === 'FERU');

        const addTeamToEmbed = (teamName, teamEmoji, players) => {
            if (players.length > 0) {
                const mainTeam = players.slice(0, maxPlayers);
                const reserves = players.slice(maxPlayers);

                // Formats as: • CharacterName [Lvl 500] (🛡️ EK)
                const mainList = mainTeam.map(p => `• **${p.character_name}** [Lvl ${p.level}] (${p.vocation})`).join('\n');
                rosterEmbed.fields.push({ name: `${teamEmoji} ${teamName} TEAM (${mainTeam.length}/${maxPlayers})`, value: mainList, inline: false });

                if (reserves.length > 0) {
                    const reserveList = reserves.map(p => `• **${p.character_name}** [Lvl ${p.level}] (${p.vocation})`).join('\n');
                    rosterEmbed.fields.push({ name: `⏳ ${teamName} RESERVES (${reserves.length})`, value: reserveList, inline: false });
                }
            }
        };

        addTeamToEmbed('LLK', '⚔️', llkPlayers);
        addTeamToEmbed('HoD', '🛡️', hodPlayers);
        addTeamToEmbed('FERUMBRAS', '🧙‍♂️', feruPlayers);

        message.channel.send({ embeds: [rosterEmbed] });
    }
});

// ---------------------------------------------------------
// 2. LISTENING FOR BUTTON CLICKS & FORMS
// ---------------------------------------------------------
client.on('interactionCreate', async interaction => {
    
    // --- IF SOMEONE CLICKS A BUTTON ---
    if (interaction.isButton()) {
        if (!gatesOpen) {
            return interaction.reply({ content: messages.getRandom(messages.closedGates), ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`modal_${interaction.customId}`) 
            .setTitle('Mecha-Puffin Registration');

        const charNameInput = new TextInputBuilder()
            .setCustomId('charName')
            .setLabel("What is your exact character name?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const queenMessageInput = new TextInputBuilder()
            .setCustomId('queenMessage')
            .setLabel("Message for the Queen (Optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(charNameInput),
            new ActionRowBuilder().addComponents(queenMessageInput)
        );

        await interaction.showModal(modal);
    }

    // --- IF SOMEONE SUBMITS THE POPUP FORM ---
    if (interaction.isModalSubmit()) {
        const rawName = interaction.fields.getTextInputValue('charName');
        const queenMessage = interaction.fields.getTextInputValue('queenMessage') || "";
        const bossChoice = interaction.customId.replace('modal_signup_', '').toUpperCase();

        await interaction.deferReply(); 

        try {
            // 🌐 CALLING THE TIBIA SERVERS
            const response = await fetch(`https://api.tibiadata.com/v4/character/${encodeURIComponent(rawName)}`);
            const data = await response.json();

            if (!data.character || !data.character.character || data.character.character.name === "") {
                return interaction.editReply(`❌ **Access Denied:** The character **${rawName}** does not exist. The Gatekeeper refuses you!`);
            }

            const charName = data.character.character.name; 
            const rawVocation = data.character.character.vocation.toUpperCase();
            const charLevel = data.character.character.level; // 📈 NEW: Grab the level!

            if (rawVocation === 'NONE') {
                return interaction.editReply(`❌ **Access Denied:** **${charName}** is still on Rookgaard! The Mecha-Puffin only accepts mainlanders.`);
            }

            // 🎨 NEW: The Vocation Emoji Mapper
            let vocAbbr = rawVocation;
            let vocEmoji = '❓';
            
            if (rawVocation.includes('KNIGHT')) { vocAbbr = 'EK'; vocEmoji = '🛡️'; }
            else if (rawVocation.includes('DRUID')) { vocAbbr = 'ED'; vocEmoji = '❄️'; }
            else if (rawVocation.includes('SORCERER')) { vocAbbr = 'MS'; vocEmoji = '🔥'; }
            else if (rawVocation.includes('PALADIN')) { vocAbbr = 'RP'; vocEmoji = '🏹'; }
            else if (rawVocation.includes('MONK')) { vocAbbr = 'MK'; vocEmoji = '🥋'; }

            const formattedVoc = `${vocEmoji} ${vocAbbr}`; // Example: "🛡️ EK"

            // 💾 SAVE TO SQLITE DATABASE (Now with LEVEL!)
            const stmt = db.prepare('INSERT INTO signups (discord_user_id, character_name, vocation, level, boss_choice, message_to_queen) VALUES (?, ?, ?, ?, ?, ?)');
            stmt.run(interaction.user.id, charName, formattedVoc, charLevel, bossChoice, queenMessage);

            let replyText = "";
            
            if (rawVocation.includes('MONK')) {
                const roast = messages.getRandom(messages.monkRoasts);
                replyText = `${roast}\n*But fine, you are on the list...* ✅ **${charName}** [Lvl ${charLevel}] (${formattedVoc}) [Signed up for: ${bossChoice}]`;
            } else {
                const hype = messages.getRandom(messages.standardHype);
                replyText = `✅ **${charName}** [Lvl ${charLevel}] (${formattedVoc}) ${hype} [Signed up for: ${bossChoice}]`;
            }

            if (queenMessage.trim() !== "") {
                replyText += `\n👑 **Message to the Queen:**\n> *"${queenMessage}"*`;
            }

            await interaction.editReply({ content: replyText });

            // 🏷️ CHECK WHITELIST STATUS
            const isWhitelisted = db.prepare('SELECT char_name FROM whitelist WHERE char_name = ?').get(charName);
            
            // ⏰ TIME CHECK: Find when the !open message was sent (simplified for now)
            // If not whitelisted and button isn't "reserve", we tag them as 'PUBLIC'
            let finalChoice = bossChoice;
            if (!isWhitelisted && bossChoice !== 'RESERVE') {
                // For now, we'll mark them as PUBLIC so the roster can sort them later
                finalChoice = `PUBLIC_${bossChoice}`;
            }

            // 💾 SAVE TO DATABASE
            const stmt = db.prepare('INSERT INTO signups (discord_user_id, character_name, vocation, level, boss_choice, message_to_queen) VALUES (?, ?, ?, ?, ?, ?)');
            stmt.run(interaction.user.id, charName, formattedVoc, charLevel, finalChoice, queenMessage);

            let replyText = `✅ **${charName}** [Lvl ${charLevel}] (${formattedVoc}) has been logged!`;
            if (!isWhitelisted) replyText += `\n*(Note: Non-whitelisted players are queued behind Puffins for the first 48h)*`;

        } catch (error) {
            console.error("API Error:", error);
            await interaction.editReply("⚠️ **System Failure:** The Mecha-Puffin couldn't reach the Tibia servers.");
        }
    }
}); // <--- This was the culprit! The missing closing brackets.

// Ensure this is still the absolute LAST line of your file!
client.login(process.env.DISCORD_TOKEN);
