/**
 * Discord Bot Setting
 */
require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials, Events } = require('discord.js');
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const fs = require('node:fs');
const path = require('node:path');

// 디스코드 설정
const client = new Client({
    intents: [
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});
  
client.commands = new Collection();

// command 로드
const foldersPath = path.join(__dirname, 'app', 'commands');
const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(foldersPath, file);
    const commands = require(filePath);
    commands.forEach(command => {
        client.commands.set(command.name, command);
    });
}
console.log(client.commands.map(c => c.name).join(', ') + ' 명령어가 로드됨.')

// event 로드
const eventsPath = path.join(__dirname, 'app', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, async(...args) => {
			try {
				await event.execute(client, ...args);
			} catch (error) {
				console.error(`[${new Date().toISOString()}] Error:`, error);
			}
		})
	} else {
		client.on(event.name, async(...args) => {
			try {
				await event.execute(client, ...args);
			} catch (error) {
				console.error(`[${new Date().toISOString()}] Error:`, error);
			}
		})
	}
}
  
// Node 15+ 는 미처리 rejection 발생 시 프로세스를 종료시킨다.
// await 없이 호출된 전송(msg.reply 등)의 실패가 봇 전체를 죽이지 않도록 받아둔다.
process.on('unhandledRejection', (reason) => {
	console.error(`[${new Date().toISOString()}] UnhandledRejection:`, reason);
});
// uncaughtException은 상태가 이미 깨졌을 수 있다. 살려두면 pm2가 재시작할 기회를 잃고
// 망가진 채로 계속 도므로, 기록만 남기고 종료해 재시작에 맡긴다.
process.on('uncaughtException', (error) => {
	console.error(`[${new Date().toISOString()}] UncaughtException:`, error);
	process.exit(1);
});
client.on(Events.Error, (error) => {
	console.error(`[${new Date().toISOString()}] ClientError:`, error);
});

client.login(DISCORD_TOKEN);


  
  