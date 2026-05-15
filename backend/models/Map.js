const { pool } = require('../config/database');

class Map {

  // Obtener mapas de una partida
  static async getByGame(gameId) {
    const [rows] = await pool.execute(
      'SELECT id, game_id, name, grid_cols, grid_rows, grid_size, is_active, created_at FROM maps WHERE game_id = ?',
      [gameId]
    );
    return rows;
  }

  // Obtener mapa activo de una partida
  static async getActive(gameId) {
    const [rows] = await pool.execute(
      'SELECT * FROM maps WHERE game_id = ? AND is_active = TRUE LIMIT 1',
      [gameId]
    );
    if (!rows[0]) return null;
    return rows[0];
  }

  // Crear mapa
  static async create(data) {
    const { game_id, name, image_data, grid_cols = 20, grid_rows = 15, grid_size = 50 } = data;

    const [result] = await pool.execute(
      'INSERT INTO maps (game_id, name, image_data, grid_cols, grid_rows, grid_size, is_active) VALUES (?, ?, ?, ?, ?, ?, FALSE)',
      [game_id, name, image_data, grid_cols, grid_rows, grid_size]
    );

    return { id: result.insertId, game_id, name, grid_cols, grid_rows, grid_size, is_active: false };
  }

  // Activar mapa (desactiva los demás)
  static async setActive(mapId, gameId) {
    await pool.execute(
      'UPDATE maps SET is_active = FALSE WHERE game_id = ?',
      [gameId]
    );
    await pool.execute(
      'UPDATE maps SET is_active = TRUE WHERE id = ?',
      [mapId]
    );
  }

  // Obtener imagen de un mapa
  static async getImage(mapId) {
    const [rows] = await pool.execute(
      'SELECT image_data FROM maps WHERE id = ?',
      [mapId]
    );
    return rows[0]?.image_data || null;
  }

  // Eliminar mapa
  static async delete(mapId, gameId) {
    const [result] = await pool.execute(
      'DELETE FROM maps WHERE id = ? AND game_id = ?',
      [mapId, gameId]
    );
    return result.affectedRows > 0;
  }

  // Persistencia de configuración de cuadrícula
  static async updateGridConfig(mapId, cols, rows, size) {
    await pool.execute(
      'UPDATE maps SET grid_cols = ?, grid_rows = ?, grid_size = ? WHERE id = ?',
      [cols, rows, size, mapId]
    );
  }
}

module.exports = Map;