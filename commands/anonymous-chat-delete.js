const { PermissionFlagsBits } = require('discord.js');
const { db, getBotMessageId, deleteMessagesForChannel } = require('../db/db');

module.exports = {
  data: {
    name: 'delete',
    description: 'このチャンネルの匿名チャット設定を削除します',
  },
  async execute(interaction) {
    const guild = interaction.guild;
    const channel = interaction.channel;

    if (!guild || !channel) {
      await interaction.reply({ content: 'このコマンドはサーバー内で実行してください。', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'このコマンドはサーバー管理者のみ実行できます。', ephemeral: true });
      return;
    }

    const botMessageId = getBotMessageId(db, guild.id);
    if (botMessageId) {
      try {
        const existingMessage = await channel.messages.fetch(botMessageId);
        await existingMessage.delete();
      } catch (error) {
        // エラー処理めんどくさいからしないよ
      }
    }

    deleteMessagesForChannel(db, { guildId: guild.id, channelId: channel.id });
    db.prepare('DELETE FROM message_counts WHERE guild_id = ?').run(guild.id);
    db.prepare('DELETE FROM webhooks WHERE guild_id = ?').run(guild.id);

    await interaction.reply({ content: 'このチャンネルの匿名チャット設定を削除しました。', ephemeral: true });
  },
};
