const { pool } = require('../config/database');

class ChatMessage {
  static async getByGame(gameId, limit = 50) {
    const [rows] = await pool.execute(
      `SELECT cm.*, u.username 
     FROM chat_messages cm 
     JOIN users u ON cm.user_id = u.id 
     WHERE cm.game_id = ? 
     ORDER BY cm.created_at ASC 
     LIMIT ${parseInt(limit)}`,
      [gameId]
    );
    return rows;
  }

  static async create(gameId, userId, message, type = 'message', diceData = null) {
    const [result] = await pool.execute(
      'INSERT INTO chat_messages (game_id, user_id, message, type, dice_data) VALUES (?, ?, ?, ?, ?)',
      [gameId, userId, message, type, diceData ? JSON.stringify(diceData) : null]
    );
    return result.insertId;
  }
}

module.exports = ChatMessage;