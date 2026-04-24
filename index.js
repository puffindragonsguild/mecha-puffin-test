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
client.on('interactionCreate', async interaction => {
    
    // --- IF SOMEONE CLICKS A BUTTON ---
    if (interaction.isButton()) {
        // Check if the gates are closed first!
        if (!gatesOpen) {
            // "ephemeral: true" means ONLY the person who clicked sees this message
            return interaction.reply({ content: messages.getRandom(messages.closedGates), ephemeral: true });
        }

        // Build the Popup Form (Modal)
        const modal = new ModalBuilder()
            .setCustomId(`modal_${interaction.customId}`) // We pass the button ID (e.g., signup_llk) into the modal ID
            .setTitle('Mecha-Puffin Registration');

        // Create the Text Input for Character Name
        const charNameInput = new TextInputBuilder()
            .setCustomId('charName')
            .setLabel("What is your character's name?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Create the Text Input for Vocation
        const vocInput = new TextInputBuilder()
            .setCustomId('vocation')
            .setLabel("What is your vocation? (EK, ED, MS, RP)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // NEW: Create the Text Input for the Message
        const queenMessageInput = new TextInputBuilder()
            .setCustomId('queenMessage')
            .setLabel("Message for the Queen (Optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        // Add all THREE inputs to the modal 
        modal.addComponents(
            new ActionRowBuilder().addComponents(charNameInput),
            new ActionRowBuilder().addComponents(vocInput),
            new ActionRowBuilder().addComponents(queenMessageInput) // Added!
        );

        // Show the form to the user
        await interaction.showModal(modal);
    }

    // --- IF SOMEONE SUBMITS THE POPUP FORM ---
    if (interaction.isModalSubmit()) {
       // Extract their answers
        const charName = interaction.fields.getTextInputValue('charName');
        const vocation = interaction.fields.getTextInputValue('vocation').toUpperCase();
        
        // Grab the optional message (if they left it blank, save it as an empty string)
        const queenMessage = interaction.fields.getTextInputValue('queenMessage') || "";
        
        const bossChoice = interaction.customId.replace('modal_signup_', '').toUpperCase();

        // 💾 SAVE TO SQLITE DATABASE WITH THE NEW MESSAGE 💾
        const stmt = db.prepare('INSERT INTO signups (discord_user_id, character_name, vocation, boss_choice, message_to_queen) VALUES (?, ?, ?, ?, ?)');
        stmt.run(interaction.user.id, charName, vocation, bossChoice, queenMessage);

        // Figure out what the bot should say
        let replyText = "";
        
        if (vocation === 'MONK') {
            // They are a Monk! Give them the roast, but confirm they are on the list.
            const roast = messages.getRandom(messages.monkRoasts);
            replyText = `${roast}\n*But fine, you are on the list...* ✅ **${charName}** [Signed up for: ${bossChoice}]`;
        } else {
            // Standard Hype Announcement
            const hype = messages.getRandom(messages.standardHype);
            replyText = `✅ **${charName}** (${vocation}) ${hype} [Signed up for: ${bossChoice}]`;
        }

        // Send the final message to the channel
        await interaction.reply({ content: replyText });
        }

        // 💾 SAVE TO SQLITE DATABASE 💾
        const stmt = db.prepare('INSERT INTO signups (discord_user_id, character_name, vocation, boss_choice) VALUES (?, ?, ?, ?)');
        stmt.run(interaction.user.id, charName, vocation, bossChoice);

        // Announce their successful sign-up to the channel!
        const hype = messages.getRandom(messages.standardHype);
        await interaction.reply(`✅ **${charName}** (${vocation}) ${hype} [Signed up for: ${bossChoice}]`);
    }
});
client.login(process.env.DISCORD_TOKEN);
