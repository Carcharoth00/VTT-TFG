const { pool } = require('../config/database');
const crypto = require('crypto');

class Game {

  // Generar código de invitación de 6 caracteres (ej: "A3F9B2")
  static generateInviteCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  // Crear una partida nueva
  static async create({ name, description, owner_id }) {
    const invite_code = this.generateInviteCode();

    const [result] = await pool.execute(
      'INSERT INTO games (name, description, invite_code, owner_id) VALUES (?, ?, ?, ?)',
      [name, description, invite_code, owner_id]
    );

    // El creador se añade automáticamente como GM
    await this.addMember(result.insertId, owner_id, 'gm');

    return { id: result.insertId, name, description, invite_code, owner_id };
  }

  // Buscar partida por ID
  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM games WHERE id = ?', [id]);
    return rows[0] || null;
  }

  // Buscar partida por código de invitación
  static async findByInviteCode(code) {
    const [rows] = await pool.execute(
      'SELECT * FROM games WHERE invite_code = ?',
      [code.toUpperCase()]
    );
    return rows[0] || null;
  }

  // Listar todas las partidas de un usuario
  static async findByUser(userId) {
    const [rows] = await pool.execute(`
      SELECT g.*, gm.role_in_game,
        (SELECT COUNT(*) FROM game_members WHERE game_id = g.id) as member_count
      FROM games g
      JOIN game_members gm ON g.id = gm.game_id
      WHERE gm.user_id = ?
      ORDER BY g.created_at DESC
    `, [userId]);
    return rows;
  }

  // Añadir un miembro a una partida
  static async addMember(gameId, userId, roleInGame = 'player') {
    try {
      await pool.execute(
        'INSERT INTO game_members (game_id, user_id, role_in_game) VALUES (?, ?, ?)',
        [gameId, userId, roleInGame]
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('El usuario ya es miembro de esta partida');
      }
      throw error;
    }
  }

  // Comprobar si un usuario es miembro de una partida
  static async isMember(gameId, userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM game_members WHERE game_id = ? AND user_id = ?',
      [gameId, userId]
    );
    return rows[0] || null;
  }

  // Obtener todos los miembros de una partida
  static async getMembers(gameId) {
    const [rows] = await pool.execute(`
      SELECT u.id, u.username, u.avatar, gm.role_in_game
      FROM game_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.game_id = ?
    `, [gameId]);
    return rows;
  }

  // Eliminar partida (solo el owner puede)
  static async delete(gameId, ownerId) {
    const [result] = await pool.execute(
      'DELETE FROM games WHERE id = ? AND owner_id = ?',
      [gameId, ownerId]
    );
    return result.affectedRows > 0;
  }

  // Actualizar el rol de un miembro en la partida (ej: player, gm)
  static async updateMemberRole(gameId, userId, role) {
    await pool.execute(
      'UPDATE game_members SET role_in_game = ? WHERE game_id = ? AND user_id = ?',
      [role, gameId, userId]
    );
  }
}

module.exports = Game;