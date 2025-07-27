require('dotenv').config();
const { REST, Routes } = require('discord.js');

const commands = [
    {
        name: '哲学者設定',
        description: '対話する哲学者を設定します。',
        options: [
            {
                name: 'name',
                type: 3, // STRING
                description: '哲学者の名前',
                required: true,
            },
        ],
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('スラッシュコマンドの登録を開始します...');

        await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
            { body: commands },
        );

        console.log('スラッシュコマンドの登録が正常に完了しました。');
    } catch (error) {
        console.error(error);
    }
})();
