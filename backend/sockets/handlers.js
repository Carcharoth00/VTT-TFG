const Token = require('../models/Token');
const ChatMessage = require('../models/ChatMessage');
// Estado en memoria de las salas activas
const rooms = new Map();
const Character = require('../models/Character');

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      tokens: [],
      gridConfig: { size: 50, columns: 20, rows: 15 },
      backgroundImage: null,
      zoomLevel: 1,
      chatMessages: [],
      freeMovement: false,
      combatActive: false,
      initiativeOrder: [],
      currentTurn: 0,
      currentRound: 1,
      users: new Map()
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

      // Al cargar tokens, incluir ac de la ficha vinculada
      const tokensWithAC = await Promise.all(room.tokens.map(async t => {
        if (t.character_id && !t.ac) {
          try {
            const char = await Character.findById(t.character_id);
            if (char) t.ac = char.ac;
          } catch (e) { }
        }
        return t;
      }));
      room.tokens = tokensWithAC;

      socket.emit('room-state', {
        tokens: room.tokens,
        gridConfig: room.gridConfig,
        backgroundImage: room.backgroundImage,
        zoomLevel: room.zoomLevel,
        chatMessages: room.chatMessages,
        freeMovement: room.freeMovement || false,
        combatActive: room.combatActive || false,
        initiativeOrder: room.initiativeOrder || [],
        currentTurn: room.currentTurn || 0,
        currentRound: room.currentRound || 1
      });

      socket.on('toggle-free-movement', ({ roomId, freeMovement }) => {
        const room = rooms.get(roomId);
        if (room) {
          room.freeMovement = freeMovement;
          io.to(roomId).emit('free-movement-updated', freeMovement);
        }
      });

      socket.to(roomId).emit('system-message', {
        id: Date.now().toString(),
        username: 'Sistema',
        message: `${username} se ha unido a la sala`,
        timestamp: new Date(),
        type: 'system'
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
            character_id: token.character_id || null,
            hp: token.hp || null,
            max_hp: token.max_hp || null
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
            id: Date.now().toString(),
            username: 'Sistema',
            message: `${user.username} se ha desconectado`,
            timestamp: new Date(),
            type: 'system'
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

    socket.on('update-background', async ({ roomId, mapId }) => {
      const room = rooms.get(roomId);
      if (room) {
        if (mapId) {
          room.backgroundImage = mapId;
        } else {
          room.backgroundImage = null;
          // Desactivar mapa en BD
          try {
            await require('../config/database').pool.execute(
              'UPDATE maps SET is_active = 0 WHERE game_id = ?',
              [roomId]
            );
          } catch (e) {
            console.error('Error desactivando mapa:', e);
          }
        }
        io.to(roomId).emit('background-updated', mapId ? { mapId } : null);
      }
    });

    socket.on('update-grid', async ({ roomId, config }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.gridConfig = config;
        socket.to(roomId).emit('grid-updated', config);
        // Persistir en BD si hay mapa activo
        try {
          const [rows] = await require('../config/database').pool.execute(
            'SELECT id FROM maps WHERE game_id = ? AND is_active = 1',
            [roomId]
          );
          if (rows.length > 0) {
            await require('../models/Map').updateGridConfig(rows[0].id, config.columns, config.rows, config.size);
          }
        } catch (e) {
          console.error('Error guardando grid config:', e);
        }
      }
    });

    socket.on('update-zoom', ({ roomId, zoom }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.zoomLevel = zoom;
        socket.to(roomId).emit('zoom-updated', zoom);
      }
    });

    socket.on('update-conditions', async ({ roomId, tokenId, conditions }) => {
      const room = rooms.get(roomId);
      if (room) {
        const token = room.tokens.find(t => t.id === tokenId);
        if (token) {
          token.conditions = conditions;
          try {
            await Token.updateConditions(tokenId, conditions);
          } catch (error) {
            console.error('Error actualizando condiciones:', error);
          }
        }
        io.to(roomId).emit('token-conditions-updated', { tokenId, conditions });
      }
    });

    socket.on('start-combat', ({ roomId, initiativeOrder }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.combatActive = true;
        room.initiativeOrder = initiativeOrder;
        room.currentTurn = 0;
        room.currentRound = 1;
        io.to(roomId).emit('combat-updated', {
          combatActive: true,
          initiativeOrder: room.initiativeOrder,
          currentTurn: room.currentTurn
        });
      }
    });

    socket.on('end-combat', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.combatActive = false;
        room.initiativeOrder = [];
        room.currentTurn = 0;
        io.to(roomId).emit('combat-updated', {
          combatActive: false,
          initiativeOrder: [],
          currentTurn: 0
        });
      }
    });

    socket.on('next-turn', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.combatActive) {
        const wasLast = room.currentTurn === room.initiativeOrder.length - 1;
        room.currentTurn = (room.currentTurn + 1) % room.initiativeOrder.length;
        if (wasLast) room.currentRound++;
        io.to(roomId).emit('combat-updated', {
          combatActive: true,
          initiativeOrder: room.initiativeOrder,
          currentTurn: room.currentTurn,
          currentRound: room.currentRound
        });
      }
    });

    socket.on('prev-turn', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.combatActive) {
        const wasFirst = room.currentTurn === 0;
        room.currentTurn = (room.currentTurn - 1 + room.initiativeOrder.length) % room.initiativeOrder.length;
        if (wasFirst && room.currentRound > 1) room.currentRound--;
        io.to(roomId).emit('combat-updated', {
          combatActive: true,
          initiativeOrder: room.initiativeOrder,
          currentTurn: room.currentTurn,
          currentRound: room.currentRound
        });
      }
    });

    socket.on('update-initiative-order', ({ roomId, initiativeOrder }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.initiativeOrder = initiativeOrder;
        io.to(roomId).emit('combat-updated', {
          combatActive: room.combatActive,
          initiativeOrder: room.initiativeOrder,
          currentTurn: room.currentTurn
        });
      }
    });

    socket.on('set-current-turn', ({ roomId, currentTurn }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.currentTurn = currentTurn;
        io.to(roomId).emit('combat-updated', {
          combatActive: room.combatActive,
          initiativeOrder: room.initiativeOrder,
          currentTurn: room.currentTurn,
          currentRound: room.currentRound
        });
      }
    });

    socket.on('update-token-hp', async ({ roomId, tokenId, hp }) => {
      const room = rooms.get(roomId);
      if (room) {
        const token = room.tokens.find(t => t.id === tokenId);
        if (token) {
          token.hp = hp;
          try {
            await Token.updateHP(tokenId, hp);
            // Si el token está vinculado a un personaje, actualizar también la ficha
            if (token.character_id) {
              await require('../models/Character').updateHP(token.character_id, hp);
            }
          } catch (error) {
            console.error('Error actualizando HP:', error);
          }
        }
        io.to(roomId).emit('token-hp-updated', { tokenId, hp });
      }
    });

    socket.on('ping', ({ roomId, x, y }) => {
      io.to(roomId).emit('ping', { x, y });
    });

  });

}

module.exports = { setupSocketHandlers };