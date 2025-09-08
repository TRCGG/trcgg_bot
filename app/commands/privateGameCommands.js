const { PrivateGame } = require('../privateGame/model/privateGame');
const store = require('../privateGame/stores/privateGameStore');
const { buildLobbyMessage } = require('../privateGame/embeds');
const { extractTierFromNameStrict } = require('../privateGame/utils/tierUtils');

// --- 테스트용 시드 유틸 ---
const SEED_NAMES = [
  '타카파하','GHI','가가가','아자차','라마나가',
  '크루시오','룰루랄라','JKL','DEF','강철아이언','라마바','ABC','XYZ'
];

function randomTier() {
  const heads = ["C", "GM", "M", "D", "E", "P", "G", "S", "B", "I", "U"];
  const h = heads[Math.floor(Math.random() * heads.length)];

  if (h === "U") return "U";
  const n =
    h === "C" || h === "GM" || h === "M"
      ? Math.floor(Math.random() * 2600) + 1
      : Math.floor(Math.random() * 4) + 1;
  return `${h}${n}`;
}
function seedParticipants(room, howMany, hostId, hostDisplayName) {
  const usedIds = new Set(room.participants.map(p => p.userId));
  usedIds.add(hostId); // 호스트 제외

  let nameIdx = 0;
  for (let i = 0; i < howMany; i++) {
    if (room.participants.length >= room.maxPlayers) break;

    // 유니크 userId 생성 (더미)
    const uid = `seed_${Date.now()}_${i}_${Math.random().toString(36).slice(2,8)}`;
    if (usedIds.has(uid)) { i--; continue; }
    usedIds.add(uid);

    // 이름 고르기 (호스트 닉과 충돌하면 접미사 붙임)
    let name = SEED_NAMES[nameIdx % SEED_NAMES.length];
    nameIdx++;
    if (name === hostDisplayName) name = `${name}_${i+1}`;

    room.participants.push({
      userId: uid,
      nameTag: name,
      tierStr: randomTier(),   // 유효한 티어 형식
      joinedAt: new Date(),
    });
  }
}

module.exports = [
  {
    name:"내전모집",
    description: "내전 게임을 위한 방을 만듭니다.",
    run: async (client, msg, args) => {
      const hostNameTag = msg.member?.displayName || msg.author.username;
      const hostTier = extractTierFromNameStrict(hostNameTag);

      const room = new PrivateGame({
        guildId: msg.guild.id,
        channelId: msg.channel.id,
        hostId: msg.author.id,
        hostNameTag: hostNameTag,
        maxPlayers: 10,
      });

      console.log(hostNameTag, hostTier);

      if (hostTier) {
        room.participants.push({
          userId: msg.author.id,
          nameTag: hostNameTag,
          tierStr: hostTier,
          joinedAt: new Date(),
        });
      }

      // ✅ 테스트용 더미 참가자 9명 주입(호스트 제외)
      const slots = Math.min(9, room.maxPlayers - room.participants.length);
      seedParticipants(room, slots, msg.author.id, hostNameTag);

      store.add(room);
      
      const payload = buildLobbyMessage(room);
      const sent = await msg.channel.send(payload);
      room.messageId = sent.id;
      console.log(room);
    }
  }
]