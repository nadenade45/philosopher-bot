require('dotenv').config();
const { Client, GatewayIntentBits, InteractionType } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cron = require('node-cron'); // Add cron import here
const fs = require('fs'); // Add fs import here

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let philosopher = 'ソクラテス'; // デフォルトの哲学者
const ALLOWED_CHANNEL_ID = '1398975627175919617'; // 会話するチャンネルを限定

const quotes = JSON.parse(fs.readFileSync('./quotes.json', 'utf8')); // Move quotes loading here

client.once('ready', () => {
    console.log(`ボットの準備ができました！ ${client.user.tag}`);

    // 毎日午前9時に名言を投稿
    cron.schedule('0 9 * * *', () => {
        const channelId = process.env.QUOTE_CHANNEL_ID;
        if (channelId) {
            const channel = client.channels.cache.get(channelId);
            if (channel) {
                const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                channel.send(`今日の哲学者からの名言：\n\n**${randomQuote.philosopher}**\n**「${randomQuote.quote}」**\n（解説：${randomQuote.explanation}）`);
            } else {
                console.error(`指定されたチャンネルIDが見つかりません: ${channelId}`);
            }
        } else {
            console.error('QUOTE_CHANNEL_IDが設定されていません。');
        }
    }, {
        timezone: "Asia/Tokyo" // 日本時間で設定
    });

    // 毎日午後9時に名言を投稿
    cron.schedule('0 21 * * *', () => {
        const channelId = process.env.QUOTE_CHANNEL_ID;
        if (channelId) {
            const channel = client.channels.cache.get(channelId);
            if (channel) {
                const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                channel.send(`今日の哲学者からの名言：\n\n**${randomQuote.philosopher}**\n**「${randomQuote.quote}」**\n（解説：${randomQuote.explanation}）`);
            } else {
                console.error(`指定されたチャンネルIDが見つかりません: ${channelId}`);
            }
        } else {
            console.error('QUOTE_CHANNEL_IDが設定されていません。');
        }
    }, {
        timezone: "Asia/Tokyo" // 日本時間で設定
    });
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
    const prompt = `
あなたは哲学者「${philosopher}」の知恵を借りて応答する、思索のパートナーです。
ユーザーの言葉をまず受け入れ、共感を示してください。
その上で、ユーザーの発言内容に関連する「${philosopher}」の哲学的な視点や、象徴的な引用句を交えながら、穏やかに対話を深めるような応答を生成してください。

決してユーザーを詰問したり、言葉尻を捉えて論破しようとしないでください。
あなたの目的は、ユーザーとの対話を通じて、新しい気づきや思索のきっかけを共に探求することです。

ユーザーのメッセージ: "${userInput}"
`;

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

client.login(process.env.DISCORD_BOT_TOKEN);