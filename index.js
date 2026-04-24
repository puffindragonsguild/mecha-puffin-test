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
        const allSignups = db.prepare('SELECT * FROM signups ORDER BY id ASC').all();
        if (allSignups.length === 0) return message.reply("📭 **The roster is empty!**");

        const rosterEmbed = { title: "📜 Official Raid Roster", color: 0x0099ff, fields: [] };
        const maxPlayers = 15;

        // ⏱️ CALCULATE 48-HOUR WINDOW
        // We check against the very first person who signed up for this batch
        const firstSignupTime = new Date(allSignups[0].created_at).getTime();
        const fortyEightHours = 48 * 60 * 60 * 1000;
        const windowExpired = (Date.now() - firstSignupTime) > fortyEightHours;

        const addSection = (name, emoji, key) => {
            const players = allSignups.filter(p => 
                p.boss_choice.includes(key) || (p.boss_choice.includes('BOTH') && (key === 'LLK' || key === 'HOD'))
            );

            if (players.length > 0) {
                // If window expired, everyone is treated the same. 
                // If not, we separate Public from Puffin.
                let mainList = [];
                let publicQueue = [];

                if (windowExpired) {
                    mainList = players;
                } else {
                    mainList = players.filter(p => !p.boss_choice.startsWith('PUBLIC_'));
                    publicQueue = players.filter(p => p.boss_choice.startsWith('PUBLIC_'));
                }

                // 1. Main Team & Reserves
                const mainTeam = mainList.slice(0, maxPlayers);
                const mainReserves = mainList.slice(maxPlayers);

                const mainText = mainTeam.map(p => `• **${p.character_name}** [Lvl ${p.level}] (${p.vocation})`).join('\n');
                rosterEmbed.fields.push({ name: `${emoji} ${name} TEAM (${mainTeam.length}/${maxPlayers})`, value: mainText || "Empty", inline: false });

                if (mainReserves.length > 0) {
                    const resText = mainReserves.map(p => `• **${p.character_name}** [Lvl ${p.level}] (${p.vocation})`).join('\n');
                    rosterEmbed.fields.push({ name: `⏳ ${name} PUFFIN RESERVES`, value: resText, inline: false });
                }

                // 2. Separate Public Queue (Only if window hasn't expired)
                if (publicQueue.length > 0 && !windowExpired) {
                    const publicText = publicQueue.map(p => `• **${p.character_name}** [Lvl ${p.level}] (${p.vocation})`).join('\n');
                    rosterEmbed.fields.push({ name: `📢 ${name} PUBLIC QUEUE (Waitlisted)`, value: publicText, inline: false });
                }
            }
        };

        addSection('LLK', '⚔️', 'LLK');
        addSection('HoD', '🛡️', 'HOD');
        addSection('FERUMBRAS', '🧙‍♂️', 'FERU');

        // Add a footer showing when the public queue opens up
        const timeLeft = Math.max(0, (fortyEightHours - (Date.now() - firstSignupTime)) / (1000 * 60 * 60));
        rosterEmbed.footer = { 
            text: windowExpired ? "✅ Public queue is now merged." : `🕒 Public queue merges in ${timeLeft.toFixed(1)} hours.` 
        };

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
            const response = await fetch(`https://api.tibiadata.com/v4/character/${encodeURIComponent(rawName)}`);
            const data = await response.json();

            if (!data.character || !data.character.character || data.character.character.name === "") {
                return interaction.editReply(`❌ **Access Denied:** Character **${rawName}** not found.`);
            }

            const char = data.character.character;
            const charName = char.name; 
            const rawVocation = char.vocation.toUpperCase();
            const charLevel = char.level;
            const guildName = char.guild ? char.guild.name : null;

            if (rawVocation === 'NONE') return interaction.editReply(`❌ **Access Denied:** Rookgaardian detected.`);

            // 🏷️ THE GATEKEEPER LOGIC
            const manualWhitelist = db.prepare('SELECT char_name FROM whitelist WHERE char_name = ?').get(charName);
            
            // ADJUST THIS: Change 'Puffins' to your exact Guild Name on Tibia
            const isPuffin = (guildName === "Puffin Dragons") || manualWhitelist;
            
            let finalChoice = bossChoice;
            let note = "";

            // If not a guildie/whitelisted, mark as PUBLIC (unless they chose Reserve Only)
            if (!isPuffin && bossChoice !== 'RESERVE') {
                finalChoice = `PUBLIC_${bossChoice}`;
                note = `\n*(Note: You are in the public queue behind guild members for the first 48h)*`;
            }

            // Vocation mapping
            let vocAbbr = rawVocation; let vocEmoji = '❓';
            if (rawVocation.includes('KNIGHT')) { vocAbbr = 'EK'; vocEmoji = '🛡️'; }
            else if (rawVocation.includes('DRUID')) { vocAbbr = 'ED'; vocEmoji = '❄️'; }
            else if (rawVocation.includes('SORCERER')) { vocAbbr = 'MS'; vocEmoji = '🔥'; }
            else if (rawVocation.includes('PALADIN')) { vocAbbr = 'RP'; vocEmoji = '🏹'; }
            else if (rawVocation.includes('MONK')) { vocAbbr = 'MK'; vocEmoji = '🥋'; }
            const formattedVoc = `${vocEmoji} ${vocAbbr}`;

            // 💾 THE SINGLE SAVE STATEMENT
            const stmt = db.prepare('INSERT INTO signups (discord_user_id, character_name, vocation, level, boss_choice, message_to_queen) VALUES (?, ?, ?, ?, ?, ?)');
            stmt.run(interaction.user.id, charName, formattedVoc, charLevel, finalChoice, queenMessage);

            let replyText = "";
            if (rawVocation.includes('MONK')) {
                replyText = `${messages.getRandom(messages.monkRoasts)}\n✅ **${charName}** [Lvl ${charLevel}] (${formattedVoc}) added to list!${note}`;
            } else {
                replyText = `✅ **${charName}** [Lvl ${charLevel}] (${formattedVoc}) ${messages.getRandom(messages.standardHype)}!${note}`;
            }

            if (queenMessage.trim() !== "") replyText += `\n👑 **Message to the Queen:**\n> *"${queenMessage}"*`;

            await interaction.editReply({ content: replyText });

        } catch (error) {
            console.error(error);
            await interaction.editReply("⚠️ **System Failure:** API issues.");
        }
    }
}); // <--- This was the culprit! The missing closing brackets.

// Ensure this is still the absolute LAST line of your file!
client.login(process.env.DISCORD_TOKEN);
