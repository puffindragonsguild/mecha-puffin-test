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
    // Command to view the roster
    if (message.content === '!roster') {
        // 1. Fetch ALL sign-ups from the database
        const signups = db.prepare('SELECT character_name, vocation, boss_choice FROM signups').all();

        // 2. Check if the database is empty
        if (signups.length === 0) {
            return message.reply("📭 **The roster is empty!** No one has braved the gates yet.");
        }

        // 3. Build a sleek Discord Embed
        const rosterEmbed = {
            title: "📜 Official Raid Roster",
            description: "The Queen's chosen warriors:",
            color: 0x0099ff, // A nice Puffin-blue color
            fields: [],
            footer: { text: `Total Puffins ready for battle: ${signups.length}` }
        };

        // 4. Group the players by which boss they selected
        const bosses = ['LLK', 'HOD', 'BOTH', 'FERU'];
        
        bosses.forEach(boss => {
            // Filter the database results for this specific boss
            const players = signups.filter(p => p.boss_choice === boss);
            
            if (players.length > 0) {
                // Format their names into a nice bulleted list
                const playerList = players.map(p => `• **${p.character_name}** (${p.vocation})`).join('\n');
                
                // Add this group to the Embed box
                rosterEmbed.fields.push({
                    name: `🚨 ${boss} TEAM`,
                    value: playerList,
                    inline: false // Keeps each boss on its own row
                });
            }
        });

        // 5. Send the masterpiece to the channel
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

        // Add inputs to the modal (each input needs its own ActionRow)
        modal.addComponents(
            new ActionRowBuilder().addComponents(charNameInput),
            new ActionRowBuilder().addComponents(vocInput)
        );

        // Show the form to the user
        await interaction.showModal(modal);
    }

    // --- IF SOMEONE SUBMITS THE POPUP FORM ---
    if (interaction.isModalSubmit()) {
        // Extract their answers
        const charName = interaction.fields.getTextInputValue('charName');
        const vocation = interaction.fields.getTextInputValue('vocation').toUpperCase();
        
        // Figure out which boss they chose based on the Modal ID we set earlier
        const bossChoice = interaction.customId.replace('modal_signup_', '').toUpperCase();

        // Check for Monk trolls
        if (vocation === 'MONK') {
            const roast = messages.getRandom(messages.monkRoasts);
            return interaction.reply({ content: roast }); // Publicly roast them!
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
