// Estado en memoria de las salas activas
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      tokens: [],
      users: new Map() // socketId -> { username, userId }
    });
  }
  return rooms.get(roomId);
}

function setupSocketHandlers(io) {

  io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.id}`);

    // Un usuario entra a una sala
    socket.on('join-room', ({ roomId, username, userId }) => {
      socket.join(roomId);
      const room = getOrCreateRoom(roomId);
      room.users.set(socket.id, { username, userId });

      // Enviar el estado actual solo al que se acaba de unir
      socket.emit('room-state', { tokens: room.tokens });

      // Notificar a los demás que alguien entró
      socket.to(roomId).emit('system-message', {
        message: `${username} se ha unido a la sala`
      });

      console.log(`${username} se unió a sala ${roomId}`);
    });

    // Mover un token
    socket.on('move-token', ({ roomId, tokenId, x, y }) => {
      const room = rooms.get(roomId);
      if (room) {
        const token = room.tokens.find(t => t.id === tokenId);
        if (token) {
          token.x = x;
          token.y = y;
        }
        // Emitir a los demás (no al que lo movió)
        socket.to(roomId).emit('token-moved', { id: tokenId, x, y });
      }
    });

    // Añadir un token
    socket.on('add-token', ({ roomId, token }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.tokens.push(token);
        socket.to(roomId).emit('token-added', token);
      }
    });

    // Eliminar un token
    socket.on('remove-token', ({ roomId, tokenId }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.tokens = room.tokens.filter(t => t.id !== tokenId);
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
          }
        }
      }
      console.log(`Socket desconectado: ${socket.id}`);
    });
  });
}

module.exports = { setupSocketHandlers };