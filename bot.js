/**
 * Discord Bot Setting
 */
require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials} = require('discord.js');
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const fs = require('node:fs');
const path = require('node:path');

// 디스코드 설정
const client = new Client({
    intents: [
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});
  
client.commands = new Collection();

// command 로드
const commandsPath  = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath ).filter(file => file.endsWith('.js'));
console.log("로드된 파일들:", commandFiles);
for (const file of commandFiles) {
	const filePath = path.join(commandsPath , file);
    const commands = require(filePath);
    commands.forEach(command => {
        client.commands.set(command.name, command);
    });
}
console.log(client.commands.map(c => c.name).join(', ') + ' 명령어가 로드됨.')

// event 로드
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(client, ...args));
	} else {
		client.on(event.name, (...args) => event.execute(client, ...args));
	}
}
  
client.login(DISCORD_TOKEN);


  
  