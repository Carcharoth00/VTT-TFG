const { pool } = require('../config/database');

const parseField = (field) => {
  if (!field) return null;
  if (typeof field === 'string') return JSON.parse(field);
  return field;
};

class Character {

  static async getByGame(gameId) {
    const [rows] = await pool.execute(
      'SELECT * FROM characters WHERE game_id = ?',
      [gameId]
    );
    return rows.map(r => ({
      ...r,
      stats: parseField(r.stats),
      skills: parseField(r.skills)
    }));
  }

  static async getByUserAndGame(userId, gameId) {
    const [rows] = await pool.execute(
      'SELECT * FROM characters WHERE user_id = ? AND game_id = ?',
      [userId, gameId]
    );
    return rows.map(r => ({
      ...r,
      stats: parseField(r.stats),
      skills: parseField(r.skills)
    }));
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM characters WHERE id = ?',
      [id]
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      stats: parseField(rows[0].stats),
      skills: parseField(rows[0].skills)
    };
  }

  static async create(data) {
    const { user_id, game_id, name, hp = 10, max_hp = 10, ac = 10, stats = null, skills = null, notes = null, avatar = null } = data;

    const [result] = await pool.execute(
      'INSERT INTO characters (user_id, game_id, name, hp, max_hp, ac, stats, skills, notes, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, game_id, name, hp, max_hp, ac, JSON.stringify(stats), JSON.stringify(skills), notes, avatar]
    );

    return { id: result.insertId, user_id, game_id, name, hp, max_hp, ac, stats, skills, notes, avatar };
  }

  static async update(id, data) {
    const { name, hp, max_hp, ac, stats, skills, notes, avatar } = data;

    await pool.execute(
      'UPDATE characters SET name = ?, hp = ?, max_hp = ?, ac = ?, stats = ?, skills = ?, notes = ?, avatar = ? WHERE id = ?',
      [
        name ?? null,
        hp ?? null,
        max_hp ?? null,
        ac ?? null,
        stats ? JSON.stringify(stats) : null,
        skills ? JSON.stringify(skills) : null,
        notes ?? null,
        avatar ?? null,
        id
      ]
    );

    return this.findById(id);
  }

  static async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM characters WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }

  static async updateHP(id, hp) {
    await pool.execute(
      'UPDATE characters SET hp = ? WHERE id = ?',
      [hp, id]
    );
  }
}

module.exports = Character;