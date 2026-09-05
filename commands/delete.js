const { db, deleteMessageRecord, getMessageByDiscordMessageId } = require('../db/db');
const { deleteAnonymousPostMessage } = require('../utils/WebHookManager');

module.exports = {
  data: {
    name: '匿名投稿を削除',
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
      await interaction.reply({ content: '自分の投稿だけ削除できます。', ephemeral: true });
      return;
    }

    try {
      await deleteAnonymousPostMessage(interaction.client, {
        guildId,
        channelId: record.channel_id,
        messageId: targetMessage.id,
      });
      deleteMessageRecord(db, { guildId, messageId: targetMessage.id });
      await interaction.reply({ content: '匿名投稿を削除しました。', ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '匿名投稿の削除に失敗しました。', ephemeral: true });
    }
  },
};
