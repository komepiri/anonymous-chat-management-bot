const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function ensureReportChannel(guild) {
  const existing = guild.channels.cache.find((channel) => channel.name === 'anonymous-reports' && channel.type === ChannelType.GuildText);
  if (existing) {
    return existing;
  }

  const everyoneRole = guild.roles.everyone;
  return guild.channels.create({
    name: 'anonymous-reports',
    type: ChannelType.GuildText,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
      {
        id: guild.ownerId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
    ],
  });
}

async function sendReportEmbed(guild, report) {
  const channel = await ensureReportChannel(guild);
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('匿名投稿通報')
    .setDescription('匿名投稿に対する通報が届きました。')
    .addFields(
      { name: '投稿者', value: `<@${report.senderId}>`, inline: true },
      { name: '投稿番号', value: String(report.guildNumber), inline: true },
      { name: '投稿日時', value: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }), inline: true },
      { name: '通報理由', value: report.reason || '未記入', inline: false },
      { name: '内容', value: report.content || '未記入', inline: false },
      { name: '通報者', value: `<@${report.reporterId}>`, inline: true },
    );

  const banButton = new ButtonBuilder()
    .setCustomId(`report-ban:${report.senderId}:${report.messageId}`)
    .setLabel('サーバーBAN')
    .setStyle(ButtonStyle.Danger);

  const timeoutButton = new ButtonBuilder()
    .setCustomId(`report-timeout:${report.senderId}:${report.messageId}`)
    .setLabel('タイムアウト')
    .setStyle(ButtonStyle.Secondary);

  const suspendButton = new ButtonBuilder()
    .setCustomId(`report-suspend:${report.senderId}:${report.messageId}`)
    .setLabel('匿名チャット利用停止')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(banButton, timeoutButton, suspendButton);

  await channel.send({ embeds: [embed], components: [row] });
}

module.exports = {
  ensureReportChannel,
  sendReportEmbed,
};
