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
    const { game_id, map_id = null, x, y, color, label, image = null, name = null } = tokenData;
    const [result] = await pool.execute(
      'INSERT INTO tokens (game_id, map_id, x, y, color, label, image, name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [game_id, map_id, x, y, color, label, image, name]
    );
    return { id: result.insertId, game_id, map_id, x, y, color, label, image, name };
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

  
}

module.exports = Token;