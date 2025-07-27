require('dotenv').config();
const { Client, GatewayIntentBits, InteractionType } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let philosopher = 'ソクラテス'; // デフォルトの哲学者
const ALLOWED_CHANNEL_ID = '1398975627175919617'; // 会話するチャンネルを限定

client.once('ready', () => {
    console.log(`ボットの準備ができました！ ${client.user.tag}`);
});

// スラッシュコマンドの処理
client.on('interactionCreate', async interaction => {
    if (interaction.type !== InteractionType.ApplicationCommand) return;

    const { commandName, options } = interaction;

    if (commandName === '哲学者設定') {
        const newPhilosopher = options.getString('name');
        philosopher = newPhilosopher;
        await interaction.reply(`対話する哲学者を「${philosopher}」に設定しました。`);
    }
});

// 通常メッセージの処理 (対話)
client.on('messageCreate', async message => {
    if (message.author.bot) return; // ボット自身のメッセージは無視
    if (message.channel.id !== ALLOWED_CHANNEL_ID) return; // 特定のチャンネルのみで反応

    // スラッシュコマンドの入力は無視する
    if (message.content.startsWith('/')) return; 

    const userInput = message.content;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
    const prompt = `あなたは「${philosopher}」です。以下のユーザーからのメッセージに対して、あなたの哲学的な思想や特徴的な文体を強く反映させて、日本語で応答してください.\n\nユーザーのメッセージ: "${userInput}"`;

    try {
        await message.channel.sendTyping(); // 「入力中...」と表示

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        message.reply(text);

    } catch (error) {
        console.error('Gemini APIからの応答生成中にエラーが発生しました:', error);
        message.reply('申し訳ありません、応答の生成中にエラーが発生しました。');
    }
});

client.login(process.env.DISCORD_TOKEN);