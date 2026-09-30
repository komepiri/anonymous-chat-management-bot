const { db, getMessageByDiscordMessageId } = require('../db/db');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

function buildReportModal(targetMessage) {
  const modal = new ModalBuilder()
    .setCustomId(`report-modal:${targetMessage.id}`)
    .setTitle('匿名投稿を通報');

  const reasonInput = new TextInputBuilder()
    .setCustomId('report-reason')
    .setLabel('通報理由')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  return modal;
}

module.exports = {
  data: {
    name: '匿名投稿を通報',
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
      await interaction.reply({ content: '指定されたメッセージは匿名投稿ではありません。', ephemeral: true });
      return;
    }

    await interaction.showModal(buildReportModal(targetMessage));
  },
};