

require('dotenv').config();
const { Client, GatewayIntentBits, InteractionType } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cron = require('node-cron');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let philosopher = 'ソクラテス'; // デフォルトの哲学者
const ALLOWED_CHANNEL_ID = '1398975627175919617'; // 会話するチャンネルを限定
const chatSessions = new Map(); // チャンネルごとの会話セッションを保存

const quotes = JSON.parse(fs.readFileSync('./quotes.json', 'utf8'));

// --- Utility Functions ---
function getSystemPrompt(currentPhilosopher) {
    return `あなたは哲学者「${currentPhilosopher}」の知恵を借りて応答する、思索のパートナーです。
ユーザーの言葉をまず受け入れ、共感を示してください。
その上で、ユーザーの発言内容に関連する「${currentPhilosopher}」の哲学的な視点や、象徴的な引用句を交えながら、穏やかに対話を深めるような応答を生成してください。
決してユーザーを詰問したり、言葉尻を捉えて論破しようとしないでください。
あなたの目的は、ユーザーとの対話を通じて、新しい気づきや思索のきっかけを共に探求することです。`;
}

function getChatSession(channelId) {
    if (!chatSessions.has(channelId)) {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: getSystemPrompt(philosopher),
        });
        const chat = model.startChat({
            history: [],
            generationConfig: {
                maxOutputTokens: 1000,
            },
        });
        chatSessions.set(channelId, chat);
    }
    return chatSessions.get(channelId);
}

function resetChatSession(channelId, newPhilosopher) {
    philosopher = newPhilosopher || philosopher; // 哲学者が指定されていれば更新
    if (chatSessions.has(channelId)) {
        chatSessions.delete(channelId);
    }
    // 新しいセッションをすぐに作成する必要はない。次回メッセージ時に作成される。
}


// --- Discord Client Events ---
client.once('ready', () => {
    console.log(`ボットの準備ができました！ ${client.user.tag}`);

    // 定期実行タスク（変更なし）
    cron.schedule('0 9 * * *', () => {
        const channelId = process.env.QUOTE_CHANNEL_ID;
        if (channelId) {
            const channel = client.channels.cache.get(channelId);
            if (channel) {
                const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                channel.send(`今日の哲学者からの名言：\n\n**${randomQuote.philosopher}**\n**「${randomQuote.quote}」**\n（解説：${randomQuote.explanation}）`);
            }
        }
    }, { timezone: "Asia/Tokyo" });

    cron.schedule('0 21 * * *', () => {
        const channelId = process.env.QUOTE_CHANNEL_ID;
        if (channelId) {
            const channel = client.channels.cache.get(channelId);
            if (channel) {
                const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                channel.send(`今日の哲学者からの名言：\n\n**${randomQuote.philosopher}**\n**「${randomQuote.quote}」**\n（解説：${randomQuote.explanation}）`);
            }
        }
    }, { timezone: "Asia/Tokyo" });
});

client.on('interactionCreate', async interaction => {
    if (interaction.type !== InteractionType.ApplicationCommand) return;

    const { commandName, options, channelId } = interaction;

    if (commandName === '哲学者設定') {
        const newPhilosopher = options.getString('name');
        resetChatSession(channelId, newPhilosopher); // 哲学者を変更し、会話履歴をリセット
        await interaction.reply(`対話する哲学者を「${newPhilosopher}」に設定し、会話の文脈をリセットしました。`);
    }

    if (commandName === 'reset_chat') {
        resetChatSession(channelId);
        await interaction.reply('会話の文脈をリセットしました。新しい対話を開始できます。');
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || message.channel.id !== ALLOWED_CHANNEL_ID || message.content.startsWith('/')) {
        return;
    }

    // --- ここからデバッグコード ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
        console.log(`API Key Loaded. Starts with: ${apiKey.substring(0, 4)}, Ends with: ${apiKey.slice(-4)}`);
    } else {
        console.log('API Key is NOT loaded.');
    }
    // --- ここまでデバッグコード ---

    const userInput = message.content;
    const chat = getChatSession(message.channel.id);

    try {
        await message.channel.sendTyping();

        const result = await chat.sendMessage(userInput);
        const response = await result.response;
        const text = response.text();

        message.reply(text);

    } catch (error) {
        console.error('Gemini APIとのチャット中にエラーが発生しました:', error);
        message.reply('申し訳ありません、応答の生成中にエラーが発生しました。会話の文脈を一度リセットします。');
        resetChatSession(message.channel.id); // エラーが発生したら会話をリセット
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
