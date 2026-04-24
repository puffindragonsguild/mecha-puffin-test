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
        // ORDER BY id ASC ensures perfect first-come, first-served fairness!
        const signups = db.prepare('SELECT character_name, vocation, boss_choice FROM signups ORDER BY id ASC').all();

        if (signups.length === 0) {
            return message.reply("📭 **The roster is empty!** No one has braved the gates yet.");
        }

        const rosterEmbed = {
            title: "📜 Official Raid Roster",
            description: "The Queen's chosen warriors:",
            color: 0x0099ff,
            fields: []
        };

        // ⚙️ THE OVER-SUBSCRIPTION LIMIT ⚙️
        const maxPlayers = 15; // You can change this if your raids have a different cap!

        // 1. Filter players into their specific teams
        const llkPlayers = signups.filter(p => p.boss_choice === 'LLK' || p.boss_choice === 'BOTH');
        const hodPlayers = signups.filter(p => p.boss_choice === 'HOD' || p.boss_choice === 'BOTH');
        const feruPlayers = signups.filter(p => p.boss_choice === 'FERU');

        // 2. A neat little helper to build Main Teams and Reserves automatically
        const addTeamToEmbed = (teamName, emoji, players) => {
            if (players.length > 0) {
                // Slice the list: 0 to maxPlayers is Main, everything after is Reserves
                const mainTeam = players.slice(0, maxPlayers);
                const reserves = players.slice(maxPlayers);

                // Build the Main Team block
                const mainList = mainTeam.map(p => `• **${p.character_name}** (${p.vocation})`).join('\n');
                rosterEmbed.fields.push({ name: `${emoji} ${teamName} TEAM (${mainTeam.length}/${maxPlayers})`, value: mainList, inline: false });

                // If there are reserves, build a separate Reserve block right underneath it
                if (reserves.length > 0) {
                    const reserveList = reserves.map(p => `• **${p.character_name}** (${p.vocation})`).join('\n');
                    rosterEmbed.fields.push({ name: `⏳ ${teamName} RESERVES (${reserves.length})`, value: reserveList, inline: false });
                }
            }
        };

        // 3. Assemble the masterpiece
        addTeamToEmbed('LLK', '⚔️', llkPlayers);
        addTeamToEmbed('HoD', '🛡️', hodPlayers);
        addTeamToEmbed('FERUMBRAS', '🧙‍♂️', feruPlayers);

        message.channel.send({ embeds: [rosterEmbed] });
    }
});

// ---------------------------------------------------------
// 2. LISTENING FOR BUTTON CLICKS & FORMS
// ---------------------------------------------------------
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

        // ⏱️ Tell Discord to "hold on" while we check the API
        await interaction.deferReply(); 

        try {
            // 🌐 CALLING THE TIBIA SERVERS
            const response = await fetch(`https://api.tibiadata.com/v4/character/${encodeURIComponent(rawName)}`);
            const data = await response.json();

            // 🛑 GHOST CHECK: Does the character exist?
            if (!data.character || !data.character.character || data.character.character.name === "") {
                return interaction.editReply(`❌ **Access Denied:** The character **${rawName}** does not exist. The Gatekeeper refuses you!`);
            }

            const charName = data.character.character.name; 
            const vocation = data.character.character.vocation.toUpperCase();

            // 🛑 ROOKGAARD CHECK: Are they still on the tutorial island?
            if (vocation === 'NONE') {
                return interaction.editReply(`❌ **Access Denied:** **${charName}** is still on Rookgaard! The Mecha-Puffin only accepts mainlanders. Go see the Oracle!`);
            }

            // 💾 SAVE TO SQLITE DATABASE
            const stmt = db.prepare('INSERT INTO signups (discord_user_id, character_name, vocation, boss_choice, message_to_queen) VALUES (?, ?, ?, ?, ?)');
            stmt.run(interaction.user.id, charName, vocation, bossChoice, queenMessage);

            let replyText = "";
            
            // 🤡 THE MONK ROAST (Restored!)
            if (vocation === 'MONK' || vocation === 'EXALTED MONK') {
                const roast = messages.getRandom(messages.monkRoasts);
                replyText = `${roast}\n*But fine, you are on the list...* ✅ **${charName}** (${vocation}) [Signed up for: ${bossChoice}]`;
            } else {
                // Standard Hype Announcement
                const hype = messages.getRandom(messages.standardHype);
                replyText = `✅ **${charName}** (${vocation}) ${hype} [Signed up for: ${bossChoice}]`;
            }

            if (queenMessage.trim() !== "") {
                replyText += `\n👑 **Message to the Queen:**\n> *"${queenMessage}"*`;
            }

            // Send the final official announcement
            await interaction.editReply({ content: replyText });

        } catch (error) {
            console.error("API Error:", error);
            await interaction.editReply("⚠️ **System Failure:** The Mecha-Puffin couldn't reach the Tibia servers. They might be under maintenance!");
        }
    }
}); // <--- This was the culprit! The missing closing brackets.

// Ensure this is still the absolute LAST line of your file!
client.login(process.env.DISCORD_TOKEN);
