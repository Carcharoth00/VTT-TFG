const { pool } = require('../config/database');

class Token {

  // Obtener todos los tokens de una partida en un mapa concreto
  static async getByGame(gameId) {
    const [rows] = await pool.execute(
      'SELECT * FROM tokens WHERE game_id = ?',
      [gameId]
    );
    return rows;
  }

  // Crear token
  static async create(tokenData) {
    const { game_id, map_id = null, x, y, color, label, image = null, name = null, character_id = null } = tokenData;
    const [result] = await pool.execute(
      'INSERT INTO tokens (game_id, map_id, x, y, color, label, image, name, character_id, locked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [game_id, map_id, x, y, color, label, image, name, character_id, false]
    );
    return { id: result.insertId, game_id, map_id, x, y, color, label, image, name, character_id, locked: false };
  }

  // Actualizar posición
  static async updatePosition(tokenId, x, y) {
    await pool.execute(
      'UPDATE tokens SET x = ?, y = ? WHERE id = ?',
      [x, y, tokenId]
    );
  }

  // Eliminar token
  static async delete(tokenId) {
    await pool.execute(
      'DELETE FROM tokens WHERE id = ?',
      [tokenId]
    );
  }

  //Bloquear el token
  static async toggleLock(tokenId, locked) {
    await pool.execute(
      'UPDATE tokens SET locked = ? WHERE id = ?',
      [locked ? 1 : 0, tokenId]
    );
  }

  //Condiciones del token
  static async updateConditions(tokenId, conditions) {
    await pool.execute(
      'UPDATE tokens SET conditions = ? WHERE id = ?',
      [JSON.stringify(conditions), tokenId]
    );
  }

}

module.exports = Token;