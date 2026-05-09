const { pool } = require('../config/database');

class Note {

  static async getByUserAndGame(userId, gameId) {
    const [rows] = await pool.execute(
      'SELECT id, title, created_at, updated_at FROM notes WHERE user_id = ? AND game_id = ? ORDER BY updated_at DESC',
      [userId, gameId]
    );
    return rows;
  }

  static async findById(id, userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM notes WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return rows[0] || null;
  }

  static async create(userId, gameId, title, content) {
    const [result] = await pool.execute(
      'INSERT INTO notes (user_id, game_id, title, content) VALUES (?, ?, ?, ?)',
      [userId, gameId, title || 'Sin título', content || '']
    );
    return { id: result.insertId, user_id: userId, game_id: gameId, title, content };
  }

  static async update(id, userId, title, content) {
    await pool.execute(
      'UPDATE notes SET title = ?, content = ? WHERE id = ? AND user_id = ?',
      [title, content, id, userId]
    );
    return this.findById(id, userId);
  }

  static async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM notes WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Note;