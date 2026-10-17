const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db, getActiveSuspension, removeSuspension } = require('../db/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unsuspend')
    .setDescription('指定したユーザーの匿名チャット利用停止を解除します')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('解除するユーザー')
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    cmdname: 'unsuspend', // This is the command name used in BotSetup.js for loading commands logs. Not used by Discord.js for command registration.

  async execute(interaction) {

    const targetUser = interaction.options.getUser('user');
    const guildId = interaction.guildId;

    if (!targetUser || !guildId) {
      await interaction.reply({ content: 'ユーザーまたはサーバー情報が取得できませんでした。', ephemeral: true });
      return;
    }

    const suspension = getActiveSuspension(db, guildId, targetUser.id);
    if (!suspension) {
      await interaction.reply({ content: `<@${targetUser.id}> は現在利用停止されていません。`, ephemeral: true });
      return;
    }

    removeSuspension(db, guildId, targetUser.id);

    await interaction.reply({
      content: `<@${targetUser.id}> の匿名チャット利用停止を解除しました。`,
      ephemeral: true,
    });
  },
};