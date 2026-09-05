const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, MessageFlags, EmbedBuilder } = require('discord.js');
const dbModule = require('../db/db');

async function ensureWebhook(client, guildId, channelId) {
  const existing = dbModule.getWebhook(dbModule.db, guildId);
  if (existing) {
    return existing;
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error('匿名投稿先チャンネルが見つかりません');
  }

  const webhook = await channel.createWebhook({ name: 'anonymous-chat-bot' });
  dbModule.upsertWebhook(dbModule.db, {
    guildId,
    channelId,
    webhookId: webhook.id,
    webhookToken: webhook.token,
  });

  return dbModule.getWebhook(dbModule.db, guildId);
}

async function refreshAnonymousButtonMessage(client, { guildId, channelId }) {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased) {
    throw new Error('匿名投稿先チャンネルが見つかりません');
  }

  const existingMessageId = dbModule.getBotMessageId(dbModule.db, guildId);
  if (existingMessageId) {
    try {
      const oldMessage = await channel.messages.fetch(existingMessageId);
      await oldMessage.delete();
    } catch (error) {
      // ignore stale or missing message
    }
  }

  const { row } = buildAnonymousButtonMessage();
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('匿名チャット')
    .setDescription('気軽に匿名でメッセージを送信できます。\n詳しい使い方については「詳細を見る」からご確認ください。');

  const message = await channel.send({ embeds: [embed], components: [row], flags: MessageFlags.SuppressNotifications });
  dbModule.setBotMessageId(dbModule.db, guildId, message.id);

  return message;
}

function getRandomDiscordAvatarUrl() {
  const index = Math.floor(Math.random() * 6);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

async function sendAnonymousPost(client, { guildId, channelId, senderId, content }) {
  const suspension = dbModule.getActiveSuspension(dbModule.db, guildId, senderId);
  if (suspension) {
    const error = new Error('SUSPENDED');
    error.code = 'SUSPENDED';
    error.suspension = suspension;
    throw error;
  }

  const webhook = await ensureWebhook(client, guildId, channelId);
  const guildNumber = dbModule.reserveGuildNumber(dbModule.db, guildId);
  const displayName = `匿名 #${guildNumber}`;
  const avatarURL = getRandomDiscordAvatarUrl();
  const transformedContent = transformReplyReferences(guildId, content, guildNumber);

  const webhookClient = new (require('discord.js').WebhookClient)({ id: webhook.webhook_id, token: webhook.webhook_token });

  try {
    const sentMessage = await webhookClient.send({
      content: transformedContent,
      username: displayName,
      avatarURL,
    });

    const messageId = sentMessage?.id || `anonymous-${guildId}-${guildNumber}`;

    dbModule.createMessageRecord(dbModule.db, {
      senderId,
      guildId,
      channelId,
      messageId,
      guildNumber,
      content: transformedContent,
    });

    await refreshAnonymousButtonMessage(client, { guildId, channelId });

    return { guildNumber, messageId };
  } catch (error) {
    dbModule.rollbackGuildNumber(dbModule.db, guildId);
    throw error;
  }
}

async function editAnonymousPostMessage(client, { guildId, channelId, messageId, content }) {
  const webhook = await ensureWebhook(client, guildId, channelId);
  const webhookClient = new (require('discord.js').WebhookClient)({ id: webhook.webhook_id, token: webhook.webhook_token });
  return webhookClient.editMessage(messageId, { content });
}

async function deleteAnonymousPostMessage(client, { guildId, channelId, messageId }) {
  const webhook = await ensureWebhook(client, guildId, channelId);
  const webhookClient = new (require('discord.js').WebhookClient)({ id: webhook.webhook_id, token: webhook.webhook_token });
  return webhookClient.deleteMessage(messageId);
}

function transformReplyReferences(guildId, content, currentGuildNumber) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  return content.replace(/>>([0-9]+)/g, (match, number) => {
    const targetNumber = Number(number);
    if (!Number.isInteger(targetNumber) || targetNumber < 1) {
      return match;
    }

    const target = dbModule.getMessageByGuildNumber(dbModule.db, guildId, targetNumber);
    if (!target || target.guild_number === currentGuildNumber) {
      return match;
    }

    return `[${match}](https://discord.com/channels/${guildId}/${target.channel_id}/${target.message_id})`;
  });
}

function buildAnonymousButtonMessage() {
  const postButton = new ButtonBuilder()
    .setCustomId('anonymous-post')
    .setLabel('匿名投稿')
    .setStyle(ButtonStyle.Primary);

  const infoButton = new ButtonBuilder()
    .setCustomId('anonymous-info')
    .setLabel('詳細を見る')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(postButton, infoButton);
  return { row };
}

function buildPostModal() {
  const input = new TextInputBuilder()
    .setCustomId('anonymous-content')
    .setLabel('投稿内容')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(200)
    .setRequired(true);

  const modal = new ModalBuilder()
    .setCustomId('anonymous-post-modal')
    .setTitle('匿名投稿');

  const actionRow = new ActionRowBuilder().addComponents(input);
  modal.addComponents(actionRow);
  return modal;
}

async function deleteWebhook(client, guildId) {
  const webhookData = dbModule.getWebhook(dbModule.db, guildId);
  if (!webhookData) return;

  try {
    const webhook = await client.fetchWebhook(webhookData.webhook_id, webhookData.webhook_token);
    await webhook.delete();
  } catch (error) {
    console.warn(`Webhook Delete Skip: ${error.message}`);
  }
}

module.exports = {
  ensureWebhook,
  sendAnonymousPost,
  editAnonymousPostMessage,
  deleteAnonymousPostMessage,
  refreshAnonymousButtonMessage,
  buildAnonymousButtonMessage,
  buildPostModal,
  deleteWebhook,
};
