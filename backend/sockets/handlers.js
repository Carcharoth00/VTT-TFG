const Token = require('../models/Token');
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
      users: new Map() // socketId -> { username, userId }
    });
  }
  return rooms.get(roomId);
}

function getRoomUsers(room) {
  return Array.from(room.users.values()).map(u => ({
    username: u.username,
    userId: u.userId
  }));
}

function setupSocketHandlers(io) {

  io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);

    // Un usuario entra a una sala
    socket.on('join-room', async ({ roomId, username, userId }) => {
      console.log('join-room:', roomId, username, userId);
      socket.join(roomId);
      const room = getOrCreateRoom(roomId);
      room.users.set(socket.id, { username, userId });

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
            label: token.label
          });
          room.tokens.push(savedToken);
          // Emitir el token con el ID real de la BD
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
    socket.on('send-message', ({ roomId, message }) => {
      // Emitir a TODOS en la sala, incluido el que envía
      io.to(roomId).emit('chat-message', message);
    });

    // Tirada de dados
    socket.on('roll-dice', ({ roomId, message }) => {
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
  });
}

module.exports = { setupSocketHandlers };