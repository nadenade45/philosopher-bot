require('dotenv').config();
const { Client, GatewayIntentBits, InteractionType } = require('discord.js');
const { OpenAI } = require('openai');
const cron = require('node-cron');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let philosopher = 'ソクラテス'; // デフォルトの哲学者
let modelName = 'gpt-5-mini'; // ★ OpenAIのモデル名を指定

const ALLOWED_CHANNEL_ID = '1398975627175919617'; // 会話するチャンネルを限定
const chatSessions = new Map(); // チャンネルごとの会話セッション（履歴）を保存

const quotes = JSON.parse(fs.readFileSync('./quotes.json', 'utf8'));

// --- Utility Functions ---
function getSystemPrompt(currentPhilosopher) {
    return `あなたは、様々な哲学者について深い知識を持つ、心優しい専門家です。
現在は、対話の相手として「${currentPhilosopher}」という哲学者の役割になりきって応答します。

まず、ユーザーの言葉に深く耳を傾け、その言葉の裏にある悩みや想いを丁寧に受け止めてください。
あなたの第一の目的は、ユーザーが安心して心を開けるような、穏やかで癒やされる対話の場を作ることです。

その上で、まるで「${currentPhilosopher}」本人が語りかけるかのように、彼の哲学、思想、特徴的な口調を完全に再現して、ユーザーとの会話を進めてください。
単に知識を披露するのではなく、ユーザーの悩みに寄り添い、その解決のヒントとなるような哲学的な視点を、温かい言葉で投げかけることを心がけてください。`;
}

function getChatSession(channelId) {
    if (!chatSessions.has(channelId)) {
        // セッションの初期化：システムプロンプトを最初のメッセージとして設定
        const initialHistory = [
            { role: 'system', content: getSystemPrompt(philosopher) }
        ];
        chatSessions.set(channelId, initialHistory);
    }
    return chatSessions.get(channelId);
}

function resetChatSession(channelId, newPhilosopher) {
    philosopher = newPhilosopher || philosopher; // 哲学者が指定されていれば更新
    if (chatSessions.has(channelId)) {
        chatSessions.delete(channelId);
    }
    // 次回のメッセージ時に新しい哲学者でセッションが自動的に作成される
}


// --- Discord Client Events ---
client.once('ready', () => {
    console.log(`ボットの準備ができました！ ${client.user.tag}`);
    console.log(`現在の対話モデル: ${modelName}`);

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

    // --- APIキーの存在チェック ---
    if (!process.env.OPENAI_API_KEY) {
        console.log('OpenAIのAPIキーが設定されていません。.envファイルを確認してください。');
        // 必要であればユーザーに通知
        // message.reply('APIキーが設定されていないため、応答できません。');
        return;
    }

    const userInput = message.content;
    const history = getChatSession(message.channel.id);

    // ユーザーのメッセージを履歴に追加
    history.push({ role: 'user', content: userInput });

    try {
        await message.channel.sendTyping();

        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: history,
            max_tokens: 1500, // 必要に応じて調整
        });

        const text = completion.choices[0].message.content;

        if (text) {
            // アシスタントの応答を履歴に追加
            history.push({ role: 'assistant', content: text });
            message.reply(text);
        } else {
            message.reply('申し訳ありません、空の応答が返ってきました。もう一度試してください。');
        }


    } catch (error) {
        console.error('OpenAI APIとのチャット中にエラーが発生しました:', error);
        message.reply('申し訳ありません、応答の生成中にエラーが発生しました。会話の文脈を一度リセットします。');
        resetChatSession(message.channel.id); // エラーが発生したら会話をリセット
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);