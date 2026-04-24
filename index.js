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

    // --- CREATE BUTTONS FOR THE ROSTER MESSAGE ---
    const row = new ActionRowBuilder();
    // Check which bosses are represented in the current batch to show relevant buttons
    const currentBosses = [...new Set(allSignups.map(s => s.boss_choice))];
    
    if (currentBosses.some(b => b.includes('LLK') || b.includes('HOD') || b.includes('BOTH'))) {
        row.addComponents(
            new ButtonBuilder().setCustomId('signup_llk').setLabel('LLK').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
            new ButtonBuilder().setCustomId('signup_hod').setLabel('HoD').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId('signup_both').setLabel('Both').setStyle(ButtonStyle.Danger).setEmoji('🔥')
        );
    } else if (currentBosses.some(b => b.includes('FERU'))) {
        row.addComponents(new ButtonBuilder().setCustomId('signup_feru').setLabel('Ferumbras').setStyle(ButtonStyle.Danger).setEmoji('🧙‍♂️'));
    }
    // Add a universal Drop Out button for convenience
    row.addComponents(new ButtonBuilder().setCustomId('dropout_btn').setLabel('Drop Out').setStyle(ButtonStyle.Secondary).setEmoji('🏃'));

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
        text: (windowExpired ? "✅ Public queue merged." : `🕒 Public queue merges in ${timeLeft.toFixed(1)}h.`) + "\n❌ Need to drop out? Use the button or type !dropout"
    };

    // Send the embed with the buttons attached
    return target.send({ embeds: [rosterEmbed], components: row.components.length > 0 ? [row] : [] });
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
        const targetInput = args.slice(1).join(' ').toUpperCase(); // e.g., "LLK" or "HOD"

        const userSignups = db.prepare('SELECT id, character_name, boss_choice FROM signups WHERE discord_user_id = ?').all(userId);
        
        if (userSignups.length === 0) return message.reply("You aren't on the list, Puffin!");

        // If they have multiple characters and didn't specify WHICH character
        if (userSignups.length > 1 && !targetInput.includes(' ')) {
            const list = userSignups.map(s => `• **${s.character_name}** (${s.boss_choice})`).join('\n');
            return message.reply(`You have multiple characters. Use \`!dropout [Character Name] [Boss]\`:\n${list}`);
        }

        // Find the specific record
        const signup = userSignups.find(s => targetInput.includes(s.character_name.toUpperCase()) || userSignups.length === 1);
        
        if (!signup) return message.reply("I couldn't find that character under your name.");

        let finalMsg = "";
        const choice = signup.boss_choice;

        // --- THE BOTH-SPLITTING LOGIC ---
        if (choice === 'BOTH' || choice.startsWith('PUBLIC_BOTH')) {
            if (targetInput.includes('LLK')) {
                const newChoice = choice.includes('PUBLIC') ? 'PUBLIC_HOD' : 'HOD';
                db.prepare('UPDATE signups SET boss_choice = ? WHERE id = ?').run(newChoice, signup.id);
                finalMsg = `🏃💨 **PARTIAL RETREAT:** **${signup.character_name}** dropped LLK but is still in for HoD!`;
            } else if (targetInput.includes('HOD')) {
                const newChoice = choice.includes('PUBLIC') ? 'PUBLIC_LLK' : 'LLK';
                db.prepare('UPDATE signups SET boss_choice = ? WHERE id = ?').run(newChoice, signup.id);
                finalMsg = `🏃💨 **PARTIAL RETREAT:** **${signup.character_name}** dropped HoD but is still in for LLK!`;
            } else {
                return message.reply("You are signed up for **BOTH**. Please type `!dropout [Name] LLK` or `!dropout [Name] HOD` to drop just one.");
            }
        } else {
            // Standard full dropout
            db.prepare('DELETE FROM signups WHERE id = ?').run(signup.id);
            finalMsg = `🏃💨 **ABANDONMENT:** **${signup.character_name}** has fled the raid entirely!`;
        }

        message.channel.send(finalMsg);
        displayRoster(message.channel);
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
// ---------------------------------------------------------
// 2. LISTENING FOR INTERACTIONS
// ---------------------------------------------------------
client.on('interactionCreate', async interaction => {
    
    // --- A. BUTTON HANDLER ---
    if (interaction.isButton()) {
        if (interaction.customId === 'dropout_btn') {
            const userId = interaction.user.id;
            const userSignups = db.prepare('SELECT id, character_name, boss_choice FROM signups WHERE discord_user_id = ?').all(userId);

            if (userSignups.length === 0) return interaction.reply({ content: "You aren't on the list, Puffin!", ephemeral: true });

            // Create a sleek Dropdown Menu
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('dropout_select')
                .setPlaceholder('Select which commitment to abandon...');

            userSignups.forEach(s => {
                if (s.boss_choice.includes('BOTH')) {
                    selectMenu.addOptions(
                        { label: `${s.character_name} (Drop LLK Only)`, value: `drop_part_LLK_${s.id}` },
                        { label: `${s.character_name} (Drop HoD Only)`, value: `drop_part_HOD_${s.id}` },
                        { label: `${s.character_name} (Drop Both Entirely)`, value: `drop_full_BOTH_${s.id}` }
                    );
                } else {
                    const boss = s.boss_choice.replace('PUBLIC_', '');
                    selectMenu.addOptions({ label: `${s.character_name} (${boss})`, value: `drop_full_${boss}_${s.id}` });
                }
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ content: "Cowardice noted. Choose your exit:", components: [row], ephemeral: true });
        }

        // Standard Sign-up Button logic
        if (!gatesOpen) return interaction.reply({ content: messages.getRandom(messages.closedGates), ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`modal_${interaction.customId}`).setTitle('Mecha-Puffin Registration');
        const nameInput = new TextInputBuilder().setCustomId('charName').setLabel("Exact character name?").setStyle(TextInputStyle.Short).setRequired(true);
        const msgInput = new TextInputBuilder().setCustomId('queenMessage').setLabel("Message for the Queen?").setStyle(TextInputStyle.Paragraph).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(msgInput));
        await interaction.showModal(modal);
    }

    // --- B. DROPDOWN PROCESSOR (The New Brain) ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'dropout_select') {
        const parts = interaction.values[0].split('_'); 
        const action = parts[1]; // 'part' or 'full'
        const type = parts[2];   // 'LLK', 'HOD', or 'BOTH'
        const signupId = parts[3];

        const signup = db.prepare('SELECT * FROM signups WHERE id = ?').get(signupId);
        if (!signup) return interaction.update({ content: "Error: Record not found.", components: [] });

        let finalMsg = "";

        if (action === 'part') {
            // Downgrade "BOTH" to just the remaining boss
            const newChoice = signup.boss_choice.includes('PUBLIC') ? `PUBLIC_${type === 'LLK' ? 'HOD' : 'LLK'}` : (type === 'LLK' ? 'HOD' : 'LLK');
            db.prepare('UPDATE signups SET boss_choice = ? WHERE id = ?').run(newChoice, signupId);
            finalMsg = `🏃💨 **PARTIAL RETREAT:** **${signup.character_name}** dropped ${type} but is still in for the other!`;
        } else {
            // Full deletion
            db.prepare('DELETE FROM signups WHERE id = ?').run(signupId);
            finalMsg = `🏃💨 **ABANDONMENT:** **${signup.character_name}** has fled the raid entirely!`;
        }

        await interaction.update({ content: "Retreat processed. You are now dismissed.", components: [] });
        interaction.channel.send(finalMsg);
        displayRoster(interaction.channel);
    }

    // --- C. MODAL SUBMISSION (Sign-up Processor) ---
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
            const charLevel = char.level;
            const rawVocation = char.vocation.toUpperCase();
            const guildName = char.guild?.name || null;

            if (rawVocation === 'NONE') return interaction.editReply(`❌ Rookgaardian detected.`);

            const existing = db.prepare('SELECT id FROM signups WHERE LOWER(character_name) = LOWER(?)').get(charName);
            if (existing) return interaction.editReply(`❌ **Error:** **${charName}** is already on the roster!`);

            const manualWhitelist = db.prepare('SELECT char_name FROM whitelist WHERE char_name = ?').get(charName);
            const isPuffin = (guildName === "Puffin Dragons") || manualWhitelist;
            
            let finalChoice = bossChoice;
            let note = "";
            if (!isPuffin && bossChoice !== 'RESERVE') {
                finalChoice = `PUBLIC_${bossChoice}`;
                note = `\n*(Note: You are in the public queue for 48h)*`;
            }

            let vocAbbr = rawVocation; let vocEmoji = '❓';
            if (rawVocation.includes('KNIGHT')) { vocAbbr = 'EK'; vocEmoji = '🛡️'; }
            else if (rawVocation.includes('DRUID')) { vocAbbr = 'ED'; vocEmoji = '❄️'; }
            else if (rawVocation.includes('SORCERER')) { vocAbbr = 'MS'; vocEmoji = '🔥'; }
            else if (rawVocation.includes('PALADIN')) { vocAbbr = 'RP'; vocEmoji = '🏹'; }
            else if (rawVocation.includes('MONK')) { vocAbbr = 'MK'; vocEmoji = '🥋'; }
            const formattedVoc = `${vocEmoji} ${vocAbbr}`;

            db.prepare('INSERT INTO signups (discord_user_id, character_name, vocation, level, boss_choice, message_to_queen) VALUES (?, ?, ?, ?, ?, ?)')
              .run(interaction.user.id, charName, formattedVoc, charLevel, finalChoice, queenMessage);

            let replyText = rawVocation.includes('MONK') ? `${messages.getRandom(messages.monkRoasts)}\n✅ <@${interaction.user.id}>, **${charName}** added!${note}` : `✅ <@${interaction.user.id}>, **${charName}** [Lvl ${charLevel}] (${formattedVoc}) ${messages.getRandom(messages.standardHype)}!${note}`;
            if (queenMessage.trim() !== "") replyText += `\n👑 **Message to the Queen:**\n> *"${queenMessage}"*`;

            await interaction.editReply({ content: replyText });
            await displayRoster(interaction.channel);

        } catch (error) {
            console.error(error);
            await interaction.editReply("⚠️ The Mecha-Puffin encountered an API error.");
        }
    }
});

// Final Login
client.login(process.env.DISCORD_TOKEN);
