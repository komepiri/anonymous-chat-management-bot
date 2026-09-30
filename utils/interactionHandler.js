const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { db, updateMessageContent, getMessageByDiscordMessageId, setSuspension, getActiveSuspension } = require('../db/db');
const { sendReportEmbed } = require('./reportChannel');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

const TIMEOUT_DURATION_OPTIONS = [
  { label: '10分', value: '10m' },
  { label: '1時間', value: '1h' },
  { label: '6時間', value: '6h' },
  { label: '12時間', value: '12h' },
  { label: '1日', value: '1d' },
  { label: '3日', value: '3d' },
  { label: '7日', value: '7d' },
  { label: '28日(上限)', value: '28d' },
];

const SUSPEND_DURATION_OPTIONS = [
  { label: '1日', value: '1d' },
  { label: '3日', value: '3d' },
  { label: '7日', value: '7d' },
  { label: '30日', value: '30d' },
  { label: '永久', value: 'permanent' },
];

async function handleInteraction(client, interaction) {
  if (interaction.isButton() && interaction.customId === 'anonymous-post') {
    const suspension = getActiveSuspension(db, interaction.guildId, interaction.user.id);
    if (suspension) {
      const untilText = suspension.expires_at
        ? `<t:${Math.floor(suspension.expires_at / 1000)}:f> まで`
        : '無期限で';
      await interaction.reply({
        content: `現在、匿名チャットの利用を${untilText}停止されています。\n理由: ${suspension.reason ?? '未記入'}`,
        ephemeral: true,
      });
      return;
    }

    const { buildPostModal } = require('../utils/WebHookManager');
    await interaction.showModal(buildPostModal());
    return;
  }

  if (interaction.isButton() && interaction.customId === 'anonymous-info') {
    const select = new StringSelectMenuBuilder()
      .setCustomId('anonymous-info-select')
      .setPlaceholder('知りたい項目を選んでください')
      .addOptions([
        { label: '使い方', value: 'usage', emoji: '📝' },
        { label: 'ルール', value: 'rules', emoji: '📜' },
        { label: '通報システム', value: 'report', emoji: '🚨' },
        { label: '処罰について', value: 'punishment', emoji: '⚖️' },
        { label: '免責事項', value: 'disclaimer', emoji: '📋' },
      ]);

    const row = new ActionRowBuilder().addComponents(select);
    await interaction.reply({ content: '詳細情報', components: [row], ephemeral: true });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'anonymous-info-select') {
    const INFO_EMBEDS = {
      rules: new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('📜 ルール')
        .setDescription('匿名チャットを利用する際は以下のルールを必ず守ってください。違反した場合はタイムアウト・匿名停止・サーバーBANの対象となります。')
        .addFields(
          { name: '1. Discordの利用規約・ガイドラインの遵守', value: 'Discordの利用規約およびコミュニティガイドラインを遵守してください。', inline: false },
          { name: '2. サーバールールの遵守', value: '導入されているサーバーのルールを遵守してください。', inline: false },
          { name: '3. 特定個人への誹謗中傷の禁止', value: '特定の個人に対する誹謗中傷等は禁止です。ただし対象者本人が同意している場合、またはサーバー全体・コミュニティ全般に向けた批判等発言はこの限りではありません。', inline: false },
        ),
      usage: new EmbedBuilder()        .setColor(0x5865f2)
        .setTitle('📝 使い方')
        .setDescription('「匿名投稿」ボタンを押してフォームに内容を入力すると、自分の名前を出さずにメッセージの送信ができます。')
        .addFields(
          { name: 'レスアンカー', value: '投稿内に `>>番号` と書くと、その番号の匿名投稿へ飛べるリンクになります。', inline: false },
          { name: '投稿の編集/削除', value: '自分の投稿を編集、削除したい場合は、対象の投稿を右クリック(長押し) →「アプリ」→「匿名投稿を編集/削除」からできます。', inline: false },
        ),
      report: new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🚨 通報システム')
        .setDescription('不適切な投稿を見つけた場合、通報することができます。')
        .addFields(
          { name: '通報方法', value: '対象の投稿を右クリック(長押し) →「アプリ」→「通報」から通報できます。', inline: false },
          { name: '通報後の流れ', value: '通報内容はサーバー管理者に共有されます。管理者が確認のうえ、必要に応じて対処します。', inline: false },
          { name: '注意', value: '虚偽の通報や嫌がらせ目的の通報は、通報者自身が処罰対象となる場合があります。', inline: false },
        ),
      punishment: new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('⚖️ 処罰について')
        .setDescription('不適切な投稿を行ったユーザーには、管理者の判断で処罰が下される場合があります。')
        .addFields(
          { name: 'タイムアウト', value: 'Discordのタイムアウト機能を使い、一定期間サーバー内での発言を制限します。', inline: false },
          { name: '匿名チャット利用停止', value: '匿名チャットの投稿機能を一定期間または無期限で停止します。停止中はボタンを押しても投稿できません。', inline: false },
          { name: 'サーバーBAN', value: 'そのままです。サーバーからBANされます。', inline: false },
        ),
      disclaimer: new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle('📋 免責事項')
        .setDescription('このBotおよび匿名チャット機能の利用にあたり、以下の点をご了承ください。')
        .addFields(
          { name: '投稿内容の責任', value: 'Bot運営者は、投稿内容の真偽・正確性・第三者への影響について一切の責任を負いません。投稿は利用者ご自身の責任で行ってください。', inline: false },
          { name: '匿名性について', value: 'ユーザー間では匿名ですが、投稿者の情報はサーバー管理者が確認できる状態で記録されています。完全な匿名性は保証されません。', inline: false },
          { name: 'サービスの変更・停止', value: 'Bot運営者は予告なくサービスの内容変更・停止を行う場合があります。', inline: false },
        ),
    };

    const embed = INFO_EMBEDS[interaction.values[0]];
    if (!embed) {
      await interaction.update({ content: '項目が見つかりませんでした。', components: [] });
      return;
    }

    await interaction.update({ content: '詳細情報', embeds: [embed], components: [interaction.message.components[0]] });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('report-duration-select:')) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'この操作はサーバー管理者のみ実行できます。', ephemeral: true });
      return;
    }

    const [, action, targetUserId, targetMessageId] = interaction.customId.split(':');
    const durationValue = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`report-action:${action}:${targetUserId}:${targetMessageId}:${durationValue}`)
      .setTitle('処分理由を入力');

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('処分理由')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('理由を入力してください');

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('report-')) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'この操作はサーバー管理者のみ実行できます。', ephemeral: true });
      return;
    }

    const [prefix, targetUserId, targetMessageId] = interaction.customId.split(':');
    const action = prefix.replace('report-', '');

    if (action === 'ban') {
      const modal = new ModalBuilder()
        .setCustomId(`report-action:${action}:${targetUserId}:${targetMessageId}`)
        .setTitle('処分理由を入力');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('処分理由')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('理由を入力してください');

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
      return;
    }

    if (action === 'timeout' || action === 'suspend') {
      const options = action === 'timeout' ? TIMEOUT_DURATION_OPTIONS : SUSPEND_DURATION_OPTIONS;
      const placeholder = action === 'timeout' ? 'タイムアウトの期間を選択' : '匿名チャット利用停止期間を選択';

      const select = new StringSelectMenuBuilder()
        .setCustomId(`report-duration-select:${action}:${targetUserId}:${targetMessageId}`)
        .setPlaceholder(placeholder)
        .addOptions(options);

      const durationRow = new ActionRowBuilder().addComponents(select);

      await interaction.reply({ content: '期間を選択してください。', components: [durationRow], ephemeral: true });
      return;
    }
    await interaction.reply({ content: 'もへもへ', ephemeral: true });
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('report-action:')) {
    const parts = interaction.customId.split(':');
    const [, action, targetUserId, targetMessageId, durationText] = parts;
    const reasonText = interaction.fields.getTextInputValue('reason');

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply('この操作はサーバー管理者のみ実行できます。');
      return;
    }

    const guild = interaction.guild;
    const member = guild?.members.cache.get(targetUserId);
    const durationValue = (durationText || '').trim();

    if (!guild || !member) {
      await interaction.editReply('対象メンバーを特定できませんでした。');
      return;
    }

    if (action === 'ban') {
      await member.ban({ reason: reasonText || '匿名投稿通報に基づく処分' });
      await interaction.editReply('サーバーBANを適用しました。');
      return;
    }

    if (action === 'timeout') {
      const requestedMs = parseDurationToMs(durationValue);
      if (requestedMs <= 0) {
        await interaction.editReply('期間の指定が不正です。');
        return;
      }

      const effectiveMs = Math.min(requestedMs, MAX_TIMEOUT_MS);
      await member.timeout(effectiveMs, reasonText || '匿名投稿通報に基づく処分');
      const cappedNote = requestedMs > MAX_TIMEOUT_MS ? '(Discordの上限である28日に調整されました)' : '';
      await interaction.editReply(`タイムアウトを${formatDuration(effectiveMs)}適用しました。${cappedNote}`);
      return;
    }

    if (action === 'suspend') {
      const isPermanent = durationValue === 'permanent';
      const suspendMs = isPermanent ? 0 : parseDurationToMs(durationValue);

      if (!isPermanent && suspendMs <= 0) {
        await interaction.editReply('期間の指定が不正です。');
        return;
      }

      const expiresAt = isPermanent ? null : Date.now() + suspendMs;
      setSuspension(db, {
        guildId: guild.id,
        userId: targetUserId,
        expiresAt,
        reason: reasonText || '匿名投稿通報に基づく処分',
      });

      const effectiveText = isPermanent ? '永久に' : `期間 ${formatDuration(suspendMs)} で`;
      await interaction.editReply(`匿名チャット利用停止を${effectiveText}適用しました。`);
      return;
    }

    await interaction.editReply('未対応の処分です。');
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'anonymous-post-modal') {
    const content = interaction.fields.getTextInputValue('anonymous-content');
    const { sendAnonymousPost } = require('../utils/WebHookManager');
    await interaction.deferReply({ ephemeral: true });
    try {
      await sendAnonymousPost(client, {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        senderId: interaction.user.id,
        content,
      });
      await interaction.editReply('匿名投稿を送信しました。');
    } catch (error) {
      if (error.code === 'SUSPENDED') {
        const { expires_at: expiresAt } = error.suspension;
        const untilText = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:f> まで` : '無期限で';
        await interaction.editReply(`現在、匿名投稿の利用を${untilText}停止されています。`);
        return;
      }
      console.error(error);
      await interaction.editReply('匿名投稿の送信に失敗しました。少し待ってからもう一度お試しください。');
    }
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('edit-modal:')) {
    const messageId = interaction.customId.split(':')[1];
    const content = interaction.fields.getTextInputValue('edited-content');

    await interaction.deferReply({ ephemeral: true });
    const record = getMessageByDiscordMessageId(db, interaction.guildId, messageId);
    if (!record) {
      await interaction.editReply('対象の匿名投稿が見つかりません。');
      return;
    }

    if (record.sender_id !== interaction.user.id) {
      await interaction.editReply('自分で投稿したもののみ編集できます。');
      return;
    }

    const { editAnonymousPostMessage } = require('../utils/WebHookManager');
    await editAnonymousPostMessage(client, { guildId: interaction.guildId, channelId: record.channel_id, messageId, content });
    updateMessageContent(db, { guildId: interaction.guildId, messageId, content });
    await interaction.editReply('匿名投稿を編集しました。');
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('report-modal:')) {
    const messageId = interaction.customId.split(':')[1];
    const reason = interaction.fields.getTextInputValue('report-reason');

    await interaction.deferReply({ ephemeral: true });
    const record = getMessageByDiscordMessageId(db, interaction.guildId, messageId);
    if (!record) {
      await interaction.editReply('対象の匿名投稿が見つかりません。');
      return;
    }

    const guild = interaction.guild;
    if (guild) {
      await sendReportEmbed(guild, {
        reporterId: interaction.user.id,
        senderId: record.sender_id,
        guildNumber: record.guild_number,
        messageId,
        reason,
        content: record.content,
      });
    }

    await interaction.editReply('通報を受け付けました。サーバー管理者に通知されます。');
    return;
  }

  if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand() || interaction.isUserContextMenuCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'コマンドの実行中にエラーが発生しました。少し待ってからもう一度お試しください。', ephemeral: true });
    }
  }
}

function parseDurationToMs(value) {
  if (!value) {
    return 0;
  }

  const match = value.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return 0;
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit === 's') return amount * 1000;
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  if (unit === 'd') return amount * 24 * 60 * 60 * 1000;
  return 0;
}

function formatDuration(ms) {
  if (ms >= 24 * 60 * 60 * 1000) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    return `${days}日`;
  }
  if (ms >= 60 * 60 * 1000) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    return `${hours}時間`;
  }
  if (ms >= 60 * 1000) {
    const minutes = Math.floor(ms / (60 * 1000));
    return `${minutes}分`;
  }
  return `${Math.floor(ms / 1000)}秒`;
}

module.exports = {
  handleInteraction,
};
