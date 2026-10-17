const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db, getActiveSuspension, setSuspension } = require('../db/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suspend')
        .setDescription('指定したユーザーを匿名チャット利用停止にします。')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('停止させるユーザー')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const guildId = interaction.guildId;

        if (!targetUser || !guildId) {
            await interaction.reply({ content: 'ユーザーまたはサーバー情報が取得できませんでした。', ephemeral: true });
            return;
        }
        
        const existingSuspension = getActiveSuspension(db, guildId, targetUser.id);
        if (existingSuspension) {
            await interaction.reply({ content: `<@${targetUser.id}> はすでに利用停止されています。`, ephemeral: true });
            return;
        }

        setSuspension(db, guildId, targetUser.id);

        await interaction.reply({
            content: `<@${targetUser.id}> を匿名チャット利用停止にしました。\n解除するには /unsuspend コマンドを使用してください。`,
            ephemeral: true,
        });
    }
};
