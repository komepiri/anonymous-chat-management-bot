const { Client, GatewayIntentBits } = require('discord.js');
const { config } = require('dotenv');
const path = require('path');
const { loadCommands, registerSlashCommands, refreshAnonymousButtons } = require('./utils/botSetup');
const { handleInteraction } = require('./utils/interactionHandler');

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

loadCommands(client, path.join(__dirname, 'commands'));

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await registerSlashCommands(client);
  await refreshAnonymousButtons(client);
});

client.on('interactionCreate', async (interaction) => {
  await handleInteraction(client, interaction);
});

client.login(process.env.DISCORD_TOKEN);
