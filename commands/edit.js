const { db, getMessageByDiscordMessageId, updateMessageContent } = require('../db/db');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

function buildEditModal(targetMessage) {
  const modal = new ModalBuilder()
    .setCustomId(`edit-modal:${targetMessage.id}`)
    .setTitle('匿名投稿を編集');

  const contentInput = new TextInputBuilder()
    .setCustomId('edited-content')
    .setLabel('新しい内容')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(targetMessage.content || '');

  modal.addComponents(new ActionRowBuilder().addComponents(contentInput));
  return modal;
}

module.exports = {
  data: {
    name: '匿名投稿を編集',
    type: 3,
  },
  async execute(interaction) {
    const targetMessage = interaction.targetMessage;
    const guildId = interaction.guildId;

    if (!guildId || !targetMessage) {
      await interaction.reply({ content: '対象メッセージが見つかりません。', ephemeral: true });
      return;
    }

    const record = getMessageByDiscordMessageId(db, guildId, targetMessage.id);
    if (!record) {
      await interaction.reply({ content: 'そのメッセージは匿名投稿ではありません。', ephemeral: true });
      return;
    }

    if (record.sender_id !== interaction.user.id) {
      await interaction.reply({ content: '自分の投稿だけ編集できます。', ephemeral: true });
      return;
    }

    await interaction.showModal(buildEditModal(targetMessage));
  },
};
