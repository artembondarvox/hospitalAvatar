require('dotenv').config()

const { Telegraf, Markup } = require('telegraf')
const auth = require('./auth.js');
const {Avatar} = require('./grpcClient.js');


async function main() {
	let activeSessions = new Map()
	let lastMessages = new Map()

	const apiKey = process.env.API_KEY
	const accountId = process.env.ACCOUNT_ID
	const avatarId = process.env.AVATAR_ID
	let avatar = new Avatar(apiKey, accountId, avatarId)
	await avatar.login()

	async function handleTelegramUserMessage(ctx, chatId, text) {
		if (!activeSessions.has(chatId)) {
			// spwan a new session
			console.time('avatar.createSession')
			const newSessionId = await avatar.createSession({voice: false})
			console.timeEnd('avatar.createSession')
			if (newSessionId) {
				activeSessions.set(chatId, newSessionId)
				setTimeout(() => {
					// drop it after 20 minutes of conversation
					activeSessions.delete(chatId)
					if (lastMessages.get(chatId) != 'end') {
						ctx.telegram.sendMessage(chatId, 'Я на обед 🍺, напишите снова, если я вам понадоблюсь', Markup.removeKeyboard())
						lastMessages.set(chatId, 'end')
					}
				}, 60 * 60 * 1000)
			}
		}
		let sessionId = activeSessions.get(chatId)
		console.time('avatar.sendMessage')
		const response = await avatar.sendMessage(text, sessionId)
		console.timeEnd('avatar.sendMessage')
		if (response === null) {
			console.log(`Avatar is failed`)
			ctx.telegram.sendMessage(chatId, '🚧 Одну секунду, мне нужно перезагрузиться 🚧', Markup.removeKeyboard())
			lastMessages.set(chatId, 'failed')
			activeSessions.delete(chatId)
			return
		}
		let {utterance, isFinal, customData} = response
		if (utterance) {
			console.log(`Send avatar message ${utterance} chat: ${chatId} data: ${customData}`)
			if (customData.image) {
				ctx.replyWithPhoto({ url: customData.image })
			}
			lastMessages.set(chatId, utterance)
			if (customData.buttons) {
				let buttons = []
				for (const btnDescriptor of customData.buttons) {
					buttons.push(Markup.button.text(btnDescriptor))
				}
				ctx.telegram.sendMessage(chatId, utterance, Markup.keyboard(buttons))
			} else {
				ctx.telegram.sendMessage(chatId, utterance, Markup.removeKeyboard())
			}
		}
		if (isFinal || customData.isFinal) {
			console.log(`Avatar is finished`)
			activeSessions.delete(chatId)
		}
	}

	async function closeAllChats(bot, reason) {
		bot.stop(reason)
		for (const sessionId of activeSessions.values()) {
			await avatar.terminateSession(sessionId)
		}
	}
	
	const bot = new Telegraf(process.env.BOT_TOKEN)
	bot.command('start', async (ctx) => {
		await handleTelegramUserMessage(ctx, ctx.chat.id.toString(), '/start')
	})
	
	bot.on('text', async (ctx) => {
	  await handleTelegramUserMessage(ctx, ctx.message.chat.id.toString(), ctx.message.text)
	})
	
	console.log('Started!')
	process.once('SIGINT', async () => {await closeAllChats(bot, 'SIGINT')})
	process.once('SIGTERM', async () => {await closeAllChats(bot, 'SIGTERM')})
	await bot.launch()
}


main()
