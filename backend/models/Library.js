const { pool } = require('../config/database');

class Library {
  static async getByGame(gameId) {
    const [rows] = await pool.execute(
      'SELECT id, name, image, created_at FROM game_library WHERE game_id = ? ORDER BY created_at DESC',
      [gameId]
    );
    return rows;
  }

  static async create(gameId, name, image) {
    const [result] = await pool.execute(
      'INSERT INTO game_library (game_id, name, image) VALUES (?, ?, ?)',
      [gameId, name, image]
    );
    return { id: result.insertId, game_id: gameId, name, image };
  }

  static async delete(id, gameId) {
    const [result] = await pool.execute(
      'DELETE FROM game_library WHERE id = ? AND game_id = ?',
      [id, gameId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Library;