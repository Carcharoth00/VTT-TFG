const Token = require('../models/Token');
const ChatMessage = require('../models/ChatMessage');
// Estado en memoria de las salas activas
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      tokens: [],
      gridConfig: { size: 50, columns: 20, rows: 15 },
      backgroundImage: null,
      zoomLevel: 1,
      chatMessages: [],
      users: new Map() // socketId -> { username, userId, role }
    });
  }
  return rooms.get(roomId);
}

function getRoomUsers(room) {
  return Array.from(room.users.values()).map(u => ({
    username: u.username,
    userId: u.userId,
    role: u.role
  }));
}

function setupSocketHandlers(io) {

  io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);

    // Un usuario entra a una sala
    socket.on('join-room', async ({ roomId, username, userId }) => {
      socket.join(roomId);
      const room = getOrCreateRoom(roomId);

      // Cargar mensajes de BD
      try {
        const messages = await ChatMessage.getByGame(roomId);
        room.chatMessages = messages.map(m => ({
          id: m.id.toString(),
          userId: m.user_id.toString(),
          username: m.username || 'Usuario',
          message: m.message,
          timestamp: m.created_at,
          type: m.type,
          diceRoll: m.dice_data ? (typeof m.dice_data === 'string' ? JSON.parse(m.dice_data) : m.dice_data) : null
        }));
      } catch (e) {
        console.error('Error cargando mensajes:', e);
        room.chatMessages = [];
      }

      // Obtener rol del usuario en la partida
      let role = 'player';
      try {
        const [rows] = await require('../config/database').pool.execute(
          'SELECT role_in_game FROM game_members WHERE game_id = ? AND user_id = ?',
          [roomId, userId]
        );
        if (rows.length > 0) role = rows[0].role_in_game;
      } catch (e) { }

      room.users.set(socket.id, { username, userId, role });

      if (room.tokens.length === 0 && userId) {
        console.log('Cargando tokens de BD para partida:', roomId);
        try {
          room.tokens = await Token.getByGame(roomId);
          console.log('Tokens cargados:', room.tokens.length);
        } catch (error) {
          console.error('Error cargando tokens:', error);
        }
      } else {
        console.log('Tokens ya en memoria:', room.tokens.length);
      }

      socket.emit('room-state', {
        tokens: room.tokens,
        gridConfig: room.gridConfig,
        backgroundImage: room.backgroundImage,
        zoomLevel: room.zoomLevel,
        chatMessages: room.chatMessages
      });

      socket.to(roomId).emit('system-message', {
        message: `${username} se ha unido a la sala`
      });
      io.to(roomId).emit('users-updated', getRoomUsers(room));
    });

    // Mover un token
    socket.on('move-token', async ({ roomId, tokenId, x, y }) => {
      const room = rooms.get(roomId);
      if (room) {
        const token = room.tokens.find(t => t.id === tokenId);
        if (token) {
          token.x = x;
          token.y = y;
          try {
            await Token.updatePosition(tokenId, x, y);
          } catch (error) {
            console.error('Error actualizando posición:', error);
          }
        }
        socket.to(roomId).emit('token-moved', { id: tokenId, x, y });
      }
    });

    // Añadir un token
    socket.on('add-token', async ({ roomId, token }) => {
      const room = rooms.get(roomId);
      if (room) {
        try {
          const savedToken = await Token.create({
            game_id: roomId,
            x: token.x,
            y: token.y,
            color: token.color,
            label: token.label,
            image: token.image || null,
            name: token.name || null,
            character_id: token.character_id || null
          });
          room.tokens.push(savedToken);
          io.to(roomId).emit('token-added', savedToken);
        } catch (error) {
          console.error('Error guardando token:', error);
        }
      }
    });

    // Eliminar un token
    socket.on('remove-token', async ({ roomId, tokenId }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.tokens = room.tokens.filter(t => t.id !== tokenId);
        try {
          await Token.delete(tokenId);
        } catch (error) {
          console.error('Error eliminando token:', error);
        }
        socket.to(roomId).emit('token-removed', tokenId);
      }
    });

    // Mensaje de chat
    socket.on('send-message', async ({ roomId, message }) => {
      const room = rooms.get(roomId);
      const user = room?.users.get(socket.id);
      if (user) {
        try {
          await ChatMessage.create(roomId, user.userId, message.message, 'message');
        } catch (e) { console.error('Error guardando mensaje:', e); }
      }
      io.to(roomId).emit('chat-message', message);
    });

    // Tirada de dados
    socket.on('roll-dice', async ({ roomId, message }) => {
      const room = rooms.get(roomId);
      const user = room?.users.get(socket.id);
      if (user) {
        try {
          await ChatMessage.create(roomId, user.userId, message.message, 'dice', message.diceRoll);
        } catch (e) { console.error('Error guardando tirada:', e); }
      }
      io.to(roomId).emit('dice-rolled', message);
    });

    // Desconexión
    socket.on('disconnect', () => {
      for (const [roomId, room] of rooms.entries()) {
        const user = room.users.get(socket.id);
        if (user) {
          room.users.delete(socket.id);
          io.to(roomId).emit('system-message', {
            message: `${user.username} se ha desconectado`
          });
          if (room.users.size === 0) {
            rooms.delete(roomId);
          } else {
            io.to(roomId).emit('users-updated', getRoomUsers(room));
          }
        }
      }
      console.log(`Socket desconectado: ${socket.id}`);
    });

    socket.on('toggle-lock', async ({ roomId, tokenId, locked }) => {
      const room = rooms.get(roomId);
      if (room) {
        const token = room.tokens.find(t => t.id === tokenId);
        if (token) {
          token.locked = locked;
          try {
            await Token.toggleLock(tokenId, locked);
          } catch (error) {
            console.error('Error bloqueando token:', error);
          }
        }
        io.to(roomId).emit('token-locked', { tokenId, locked });
      }
    });
  });


}

module.exports = { setupSocketHandlers };