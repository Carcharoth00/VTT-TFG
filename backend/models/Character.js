const { pool } = require('../config/database');

class Character {

  // Obtener todas las fichas de una partida
  static async getByGame(gameId) {
    const [rows] = await pool.execute(
      'SELECT * FROM characters WHERE game_id = ?',
      [gameId]
    );
    return rows.map(r => ({
      ...r,
      stats: r.stats ? JSON.parse(r.stats) : null,
      skills: r.skills ? JSON.parse(r.skills) : null
    }));
  }

  // Obtener fichas de un usuario en una partida
  static async getByUserAndGame(userId, gameId) {
    const [rows] = await pool.execute(
      'SELECT * FROM characters WHERE user_id = ? AND game_id = ?',
      [userId, gameId]
    );
    return rows.map(r => ({
      ...r,
      stats: r.stats ? JSON.parse(r.stats) : null,
      skills: r.skills ? JSON.parse(r.skills) : null
    }));
  }

  // Obtener ficha por ID
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM characters WHERE id = ?',
      [id]
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      stats: rows[0].stats ? JSON.parse(rows[0].stats) : null,
      skills: rows[0].skills ? JSON.parse(rows[0].skills) : null
    };
  }

  // Crear ficha
  static async create(data) {
    const { user_id, game_id, name, hp = 10, max_hp = 10, ac = 10, stats = null, skills = null, notes = null } = data;

    const [result] = await pool.execute(
      'INSERT INTO characters (user_id, game_id, name, hp, max_hp, ac, stats, skills, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, game_id, name, hp, max_hp, ac, JSON.stringify(stats), JSON.stringify(skills), notes]
    );

    return { id: result.insertId, user_id, game_id, name, hp, max_hp, ac, stats, skills, notes };
  }

  // Actualizar ficha
  static async update(id, data) {
    const { name, hp, max_hp, ac, stats, skills, notes } = data;

    await pool.execute(
      'UPDATE characters SET name = ?, hp = ?, max_hp = ?, ac = ?, stats = ?, skills = ?, notes = ? WHERE id = ?',
      [name, hp, max_hp, ac, JSON.stringify(stats), JSON.stringify(skills), notes, id]
    );

    return this.findById(id);
  }

  // Eliminar ficha
  static async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM characters WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Character;