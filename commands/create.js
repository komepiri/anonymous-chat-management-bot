const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../db/db');
const { buildAnonymousButtonMessage } = require('../utils/WebHookManager');

module.exports = {
  data: {
    name: 'create',
    description: '実行されたチャンネルに匿名チャットを作成します',
    cmdname: 'create', // This is the command name used in BotSetup.js for loading commands logs. Not used by Discord.js for command registration.
  },
  async execute(interaction) {
    const channel = interaction.channel;
    const guild = interaction.guild;

    if (!channel || !guild) {
      await interaction.reply({ content: 'このコマンドはサーバー内で実行してください。', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'このコマンドはサーバー管理者のみ実行できます。', ephemeral: true });
      return;
    }

    const { row } = buildAnonymousButtonMessage();
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('匿名チャット')
      .setDescription('気軽に匿名でメッセージを送信できます。\n詳しい使い方については「詳細を見る」からご確認ください。');

    const message = await channel.send({ embeds: [embed], components: [row] });

    db.prepare('INSERT INTO message_counts (guild_id, count, bot_message_id) VALUES (?, ?, ?) ON CONFLICT(guild_id) DO UPDATE SET bot_message_id = excluded.bot_message_id').run(guild.id, 0, message.id);
    await interaction.reply({ content: '匿名チャットの設定が完了しました。', ephemeral: true });
  },
};
