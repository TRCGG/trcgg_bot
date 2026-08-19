/**
 * Discord Bot Setting
 */
require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials, Events } = require('discord.js');
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const fs = require('node:fs');
const path = require('node:path');

// 스위퍼 filter는 true를 반환한 항목을 **지운다**. 봇 자신이 지워지면 members.me가
// null이 되고 discordUtils.canSend가 항상 false가 되어 전송이 조용히 전부 막히므로,
// 자신은 남기고 자신을 식별할 수 없는 동안(로그인 전)에는 아무것도 지우지 않는다.
const sweepAllButSelf = () => (entry) => {
    const self = entry.client.user;
    return Boolean(self) && entry.id !== self.id;
};

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
    // discord.js 기본 스위퍼는 스레드만 청소한다. 메시지는 채널당 200개 상한만 있어
    // 비활성 채널의 캐시가 영원히 남고, 멤버·유저는 상한조차 없다.
    sweepers: {
        messages: { interval: 300, lifetime: 900 },
        guildMembers: { interval: 3600, filter: sweepAllButSelf },
        users: { interval: 3600, filter: sweepAllButSelf },
    },
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


  
  