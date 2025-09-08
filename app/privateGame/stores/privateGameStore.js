// privateGameId -> room
const rooms = new Map();
// userId -> privateGameId (동시 참여 방지용)
const userToRoom = new Map();

module.exports = {
  add(room) { rooms.set(room.id, room); return room; },
  get(id) { return rooms.get(id); },
  delete(id) {
    const room = rooms.get(id);
    if (room) {
      for (const p of room.participants) {
        if (userToRoom.get(p.userId) === room.id) userToRoom.delete(p.userId);
      }
      rooms.delete(id);
    }
  },
  joinable(userId) { return !userToRoom.has(userId); },
  markJoin(userId, roomId) { userToRoom.set(userId, roomId); },
  markLeave(userId) { if (userToRoom.get(userId)) userToRoom.delete(userId); },
  currentRoomOf(userId) { return userToRoom.get(userId) || null; },
  all() { return [...rooms.values()]; },
};
