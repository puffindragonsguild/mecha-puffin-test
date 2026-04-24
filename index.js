// index.js
const { 
    Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, 
    StringSelectMenuBuilder, MessageFlags 
} = require('discord.js');
const messages = require('./messages.js');
const db = require('./database.js'); 

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

let gatesOpen = false;
let hypeInterval; 

// ✅ FIX 1: Rename 'ready' to 'clientReady' per deprecation warning
client.once('clientReady', () => {
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

    const row = new ActionRowBuilder();
    const currentBosses = [...new Set(allSignups.map(s => s.boss_choice))];
    
    if (currentBosses.some(b => b.includes('LLK') || b.includes('HOD') || b.includes('BOTH'))) {
        row.addComponents(
            new ButtonBuilder().setCustomId('choice_LLK').setLabel('LLK').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
            new ButtonBuilder().setCustomId('choice_HOD').setLabel('HoD').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId('choice_BOTH').setLabel('Both').setStyle(ButtonStyle.Danger).setEmoji('🔥')
        );
    } else if (currentBosses.some(b => b.includes('FERU'))) {
        row.addComponents(new ButtonBuilder().setCustomId('choice_FERU').setLabel('Ferumbras').setStyle(ButtonStyle.Danger).setEmoji('🧙‍♂️'));
    }
    row.addComponents(new ButtonBuilder().setCustomId('dropout_btn').setLabel('Drop Out').setStyle(ButtonStyle.Secondary).setEmoji('🏃'));

    const addSection = (name, emoji, key) => {
        const players = allSignups.filter(p => 
            p.boss_choice.includes(key) || (p.boss_choice.includes('BOTH') && (key === 'LLK' || key === 'HOD'))
        );

        if (players.length > 0) {
            let mainList = windowExpired ? players.filter(p => p.boss_choice !== 'LAST_RESORT') : players.filter(p => !p.boss_choice.startsWith('PUBLIC_') && p.boss_choice !== 'LAST_RESORT');
            let publicQueue = windowExpired ? [] : players.filter(p => p.boss_choice.startsWith('PUBLIC_'));
            let lastResorts = players.filter(p => p.boss_choice === 'LAST_RESORT');

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

            if (lastResorts.length > 0) {
                const lastText = lastResorts.map(p => `• **${p.character_name}** [Lvl ${p.level}] (${p.vocation})`).join('\n');
                rosterEmbed.fields.push({ name: `🆘 ${name} LAST RESORT RESERVES`, value: lastText, inline: false });
            }
        }
    };

    addSection('LLK', '⚔️', 'LLK');
    addSection('HoD', '🛡️', 'HOD');
    addSection('FERUMBRAS', '🧙‍♂️', 'FERU');

    const timeLeft = Math.max(0, (fortyEightHours - (Date.now() - firstSignupTime)) / (1000 * 60 * 60));
    rosterEmbed.footer = { 
        text: (windowExpired ? "✅ Public queue merged." : `🕒 Public queue merges in ${timeLeft.toFixed(1)}h.`) + "\n❌ Type !dropout to flee"
    };

    return target.send({ embeds: [rosterEmbed], components: row.components.length > 0 ? [row] : [] });
}

// --- HYPE LOOP ---
const startHypeLoop = (message, raidType) => {
    if (hypeInterval) clearInterval(hypeInterval);
    hypeInterval = setInterval(() => {
        if (!gatesOpen) return clearInterval(hypeInterval);
        message.channel.send(`🔥 **THE RAID CONTINUES!** 🔥\nStill need Puffins for **${raidType}**!`);
        displayRoster(message.channel);
    }, 24 * 60 * 60 * 1000); 
};

// ---------------------------------------------------------
// 1. CHAT COMMANDS
// ---------------------------------------------------------
client.on('messageCreate', message => {
    if (message.author.bot) return;

    if (message.content === '!hail') message.reply('HAIL FORTUNA FELIS! 👑');
    if (message.content === '!roster') displayRoster(message.channel);
    if (message.content === '!clear') { db.prepare('DELETE FROM signups').run(); message.reply('🧹 Roster wiped.'); }
    if (message.content === '!close') { gatesOpen = false; if (hypeInterval) clearInterval(hypeInterval); message.reply('🛑 Gates Closed.'); }

    if (message.content === '!open dt') {
        gatesOpen = true;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('choice_LLK').setLabel('LLK').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
            new ButtonBuilder().setCustomId('choice_HOD').setLabel('HoD').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId('choice_BOTH').setLabel('Both').setStyle(ButtonStyle.Danger).setEmoji('🔥')
        );
        message.channel.send({ content: '🚨 **DOUBLE TROUBLE POSTED** 🚨', components: [row] });
        startHypeLoop(message, 'Double Trouble');
    }

    if (message.content === '!open feru') {
        gatesOpen = true;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('choice_FERU').setLabel('Ferumbras').setStyle(ButtonStyle.Danger).setEmoji('🧙‍♂️')
        );
        message.channel.send({ content: '🚨 **FERUMBRAS RAID POSTED** 🚨', components: [row] });
        startHypeLoop(message, 'Ferumbras');
    }

    if (message.content === '!open reserves') {
        gatesOpen = true;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('choice_LAST_RESORT').setLabel('Last Resort Reserve').setStyle(ButtonStyle.Secondary).setEmoji('🆘')
        );
        message.channel.send({ content: '⚠️ **LAST RESORT SIGNUPS OPEN** ⚠️\nOnly sign up here if you are purely helping fill gaps!', components: [row] });
    }

    if (message.content.startsWith('!dropout')) {
        const userId = message.author.id;
        const args = message.content.split(' ');
        const targetInput = args.slice(1).join(' ').toUpperCase();
        const userSignups = db.prepare('SELECT id, character_name, boss_choice FROM signups WHERE discord_user_id = ?').all(userId);
        if (userSignups.length === 0) return message.reply("Not on the list!");

        const signup = userSignups.find(s => targetInput.includes(s.character_name.toUpperCase()) || userSignups.length === 1);
        if (!signup) return message.reply("Character not found.");

        let finalMsg = "";
        if ((signup.boss_choice.includes('BOTH')) && (targetInput.includes('LLK') || targetInput.includes('HOD'))) {
            const part = targetInput.includes('LLK') ? 'LLK' : 'HOD';
            const remaining = part === 'LLK' ? 'HOD' : 'LLK';
            const newChoice = signup.boss_choice.includes('PUBLIC') ? `PUBLIC_${remaining}` : remaining;
            db.prepare('UPDATE signups SET boss_choice = ? WHERE id = ?').run(newChoice, signup.id);
            finalMsg = `🏃💨 **PARTIAL RETREAT:** **${signup.character_name}** dropped ${part}.`;
        } else {
            db.prepare('DELETE FROM signups WHERE id = ?').run(signup.id);
            finalMsg = `🏃💨 **ABANDONMENT:** **${signup.character_name}** fled!`;
        }
        message.channel.send(finalMsg);
        displayRoster(message.channel);
    }
});

// ---------------------------------------------------------
// 2. INTERACTIONS
// ---------------------------------------------------------
client.on('interactionCreate', async interaction => {
    
    if (interaction.isButton()) {
        // --- DROPOUT BUTTON ---
        if (interaction.customId === 'dropout_btn') {
            const userId = interaction.user.id;
            const userSignups = db.prepare('SELECT id, character_name, boss_choice FROM signups WHERE discord_user_id = ?').all(userId);
            if (userSignups.length === 0) return interaction.reply({ content: "Not on the list!", flags: MessageFlags.Ephemeral });
            
            const selectMenu = new StringSelectMenuBuilder().setCustomId('dropout_select').setPlaceholder('Select exit...');
            userSignups.forEach(s => {
                if (s.boss_choice.includes('BOTH')) {
                    selectMenu.addOptions(
                        { label: `${s.character_name} (Drop LLK)`, value: `drop_part_LLK_${s.id}` }, 
                        { label: `${s.character_name} (Drop HoD)`, value: `drop_part_HOD_${s.id}` }, 
                        { label: `${s.character_name} (Drop All)`, value: `drop_full_BOTH_${s.id}` }
                    );
                } else {
                    selectMenu.addOptions({ label: `${s.character_name} (${s.boss_choice.replace('PUBLIC_', '')})`, value: `drop_full_${s.boss_choice}_${s.id}` });
                }
            });
            return interaction.reply({ content: "Choose your exit:", components: [new ActionRowBuilder().addComponents(selectMenu)], flags: MessageFlags.Ephemeral });
        }

        // --- STEP 1: QUEUE CHOICE ---
        if (interaction.customId.startsWith('choice_')) {
            if (!gatesOpen) return interaction.reply({ content: messages.getRandom(messages.closedGates), flags: MessageFlags.Ephemeral });
            
            const boss = interaction.customId.replace('choice_', '');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`queue_MAIN_${boss}`).setLabel('Main Team').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
                new ButtonBuilder().setCustomId(`queue_LAST_RESORT_${boss}`).setLabel('Reserve Only').setStyle(ButtonStyle.Secondary).setEmoji('🆘')
            );

            return interaction.reply({ 
                content: `Signing up for **${boss}**. Choose your status:`, 
                components: [row], 
                flags: MessageFlags.Ephemeral 
            });
        }

        // --- STEP 2: MESSAGE CHOICE ---
        if (interaction.customId.startsWith('queue_')) {
            const [_, qType, boss] = interaction.customId.split('_');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`mode_manual_${qType}_${boss}`).setLabel('Manual Message').setStyle(ButtonStyle.Primary).setEmoji('✍️'),
                new ButtonBuilder().setCustomId(`mode_lazy_${qType}_${boss}`).setLabel('Lazy Option').setStyle(ButtonStyle.Secondary).setEmoji('😴')
            );
            
            // ✅ FIX: Use .update() instead of .reply() for ephemeral steps
            return interaction.update({ 
                content: `Selected Queue: **${qType}**. How will you address the Queen?`, 
                components: [row] 
            });
        }

        // --- STEP 3: MODAL ---
        if (interaction.customId.startsWith('mode_')) {
            const [_, mode, qType, boss] = interaction.customId.split('_');
            const modal = new ModalBuilder().setCustomId(`modal_${mode}_${qType}_${boss}`).setTitle(mode === 'lazy' ? 'Lazy Entry' : 'Manual Entry');
            
            const nameInput = new TextInputBuilder().setCustomId('charName').setLabel("Character Name").setStyle(TextInputStyle.Short).setRequired(true);
            const rows = [new ActionRowBuilder().addComponents(nameInput)];
            
            if (mode === 'manual') {
                const msgInput = new TextInputBuilder().setCustomId('queenMessage').setLabel("Your Message (REQUIRED)").setStyle(TextInputStyle.Paragraph).setRequired(false);
                rows.push(new ActionRowBuilder().addComponents(msgInput));
            }
            modal.addComponents(...rows);
            await interaction.showModal(modal);
        }
    }

    // --- B. DROPDOWN PROCESSOR ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'dropout_select') {
        const parts = interaction.values[0].split('_');
        const action = parts[1]; const type = parts[2]; const signupId = parts[parts.length - 1];
        const signup = db.prepare('SELECT * FROM signups WHERE id = ?').get(signupId);
        if (!signup) return interaction.update({ content: "Error: Not found.", components: [] });

        if (action === 'part') {
            const remain = type === 'LLK' ? 'HOD' : 'LLK';
            const choice = signup.boss_choice.includes('PUBLIC') ? `PUBLIC_${remain}` : remain;
            db.prepare('UPDATE signups SET boss_choice = ? WHERE id = ?').run(choice, signupId);
            interaction.channel.send(`🏃💨 **PARTIAL RETREAT:** **${signup.character_name}** dropped ${type}.`);
        } else {
            db.prepare('DELETE FROM signups WHERE id = ?').run(signupId);
            interaction.channel.send(`🏃💨 **ABANDONMENT:** **${signup.character_name}** fled.`);
        }
        await interaction.update({ content: "Processed.", components: [] });
        displayRoster(interaction.channel);
    }

    // --- C. FINAL SIGNUP ---
    if (interaction.isModalSubmit()) {
        const [_, mode, qType, bossChoice] = interaction.customId.split('_');
        const rawName = interaction.fields.getTextInputValue('charName');
        let queenMessage = "";

        if (mode === 'manual') {
            queenMessage = interaction.fields.getTextInputValue('queenMessage');
            if (!queenMessage || queenMessage.trim() === "") {
                return interaction.reply({ content: "❌ **REJECTED:** Message required for Manual mode.", flags: MessageFlags.Ephemeral });
            }
        } else {
            queenMessage = messages.getRandom(messages.lazyQueenMessages);
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const res = await fetch(`https://api.tibiadata.com/v4/character/${encodeURIComponent(rawName)}`);
            const data = await res.json();
            if (!data.character?.character?.name) return interaction.editReply(`❌ **${rawName}** not found.`);
            
            const char = data.character.character;
            const charName = char.name; const charLevel = char.level; const rawVoc = char.vocation.toUpperCase();
            if (rawVoc === 'NONE') return interaction.editReply(`❌ Rookgaardian detected.`);

            if (db.prepare('SELECT id FROM signups WHERE LOWER(character_name) = LOWER(?)').get(charName)) {
                return interaction.editReply(`❌ **${charName}** is already signed up.`);
            }

            const isPuffin = (char.guild?.name === "Puffin Dragons") || db.prepare('SELECT char_name FROM whitelist WHERE char_name = ?').get(charName);
            
            let finalChoice = (qType === 'LAST_RESORT') ? 'LAST_RESORT' : bossChoice;
            let note = "";
            
            if (!isPuffin && qType === 'MAIN') {
                finalChoice = `PUBLIC_${bossChoice}`;
                note = `\n*(Public queue: 48h wait)*`;
            }

            // Vocation Mapper
            let vocAbbr = rawVoc; let vocEmoji = '❓';
            if (rawVoc.includes('KNIGHT')) { vocAbbr = 'EK'; vocEmoji = '🛡️'; }
            else if (rawVoc.includes('DRUID')) { vocAbbr = 'ED'; vocEmoji = '❄️'; }
            else if (rawVoc.includes('SORCERER')) { vocAbbr = 'MS'; vocEmoji = '🔥'; }
            else if (rawVoc.includes('PALADIN')) { vocAbbr = 'RP'; vocEmoji = '🏹'; }
            else if (rawVoc.includes('MONK')) { vocAbbr = 'MK'; vocEmoji = '🥋'; }
            const formattedVoc = `${vocEmoji} ${vocAbbr}`;

            db.prepare('INSERT INTO signups (discord_user_id, character_name, vocation, level, boss_choice, message_to_queen) VALUES (?, ?, ?, ?, ?, ?)')
              .run(interaction.user.id, charName, formattedVoc, charLevel, finalChoice, queenMessage);

            let snark = mode === 'lazy' ? `😒 **${messages.getRandom(messages.lazySnark)}**\n` : "";
            let replyText = rawVoc.includes('MONK') ? `${snark}${messages.getRandom(messages.monkRoasts)}\n✅ <@${interaction.user.id}> added!` : `${snark}✅ <@${interaction.user.id}>, **${charName}** [Lvl ${charLevel}] ${messages.getRandom(messages.standardHype)}!`;
            replyText += `\n👑 **Address:** *"${queenMessage}"*${note}`;

            await interaction.editReply({ content: replyText });
            await displayRoster(interaction.channel);
        } catch (e) { console.error(e); await interaction.editReply("⚠️ API Error."); }
    }
});

client.login(process.env.DISCORD_TOKEN);
