const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const { getAnonymousPostTargetChannel } = require('./channelSelection');
const { refreshAnonymousButtonMessage } = require('../utils/WebHookManager');

function loadCommands(client, commandsPath) {
  client.commands = new Collection();
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`[INFO] Loaded command: ${command.data.name}`);
    } else {
      console.log(`[WARN] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

async function registerSlashCommands(client) {
  const commands = Array.from(client.commands.values()).map((command) => {
    if (typeof command.data?.toJSON === 'function') {
      return command.data.toJSON();
    }
    return command.data;
  });

  if (!client.application?.commands) {
    return;
  }

  await client.application.commands.set(commands);
  console.log(`[INFO] Registered ${commands.length} slash commands.`);
}

async function refreshAnonymousButtons(client) {
  for (const guild of client.guilds.cache.values()) {
    const channel = getAnonymousPostTargetChannel(guild);
    if (!channel) continue;

    await refreshAnonymousButtonMessage(client, { guildId: guild.id, channelId: channel.id });
  }
}

module.exports = {
  loadCommands,
  registerSlashCommands,
  refreshAnonymousButtons,
};
