const express = require('express');
const Map = require('../models/Map');
const Game = require('../models/Game');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

async function isGM(gameId, userId) {
  const [rows] = await require('../config/database').pool.execute(
    'SELECT role_in_game FROM game_members WHERE game_id = ? AND user_id = ?',
    [gameId, userId]
  );
  return rows.length > 0 && rows[0].role_in_game === 'gm';
}

// GET /api/maps/:gameId — Listar mapas de una partida
router.get('/:gameId', async (req, res) => {
  try {
    const membership = await Game.isMember(req.params.gameId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No eres miembro de esta partida' });
    const maps = await Map.getByGame(req.params.gameId);
    res.json({ maps });
  } catch (error) {
    console.error('Error obteniendo mapas:', error);
    res.status(500).json({ error: 'Error al obtener los mapas' });
  }
});

// GET /api/maps/:gameId/active — Obtener mapa activo
router.get('/:gameId/active', async (req, res) => {
  try {
    const membership = await Game.isMember(req.params.gameId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No eres miembro de esta partida' });
    const map = await Map.getActive(req.params.gameId);
    res.json({ map });
  } catch (error) {
    console.error('Error obteniendo mapa activo:', error);
    res.status(500).json({ error: 'Error al obtener el mapa activo' });
  }
});

// GET /api/maps/image/:mapId — Obtener imagen de un mapa
router.get('/image/:mapId', async (req, res) => {
  try {
    const image = await Map.getImage(req.params.mapId);
    if (!image) return res.status(404).json({ error: 'Imagen no encontrada' });
    res.json({ image });
  } catch (error) {
    console.error('Error obteniendo imagen:', error);
    res.status(500).json({ error: 'Error al obtener la imagen' });
  }
});

// POST /api/maps/:gameId — Subir mapa (solo GM)
router.post('/:gameId', async (req, res) => {
  try {
    const membership = await Game.isMember(req.params.gameId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No eres miembro de esta partida' });
    if (!await isGM(req.params.gameId, req.user.id)) return res.status(403).json({ error: 'Solo el GM puede subir mapas' });

    const { name, image_data, grid_cols, grid_rows, grid_size } = req.body;
    if (!image_data) return res.status(400).json({ error: 'La imagen es obligatoria' });

    const map = await Map.create({
      game_id: req.params.gameId,
      name: name || 'Mapa sin nombre',
      image_data,
      grid_cols,
      grid_rows,
      grid_size
    });

    res.status(201).json({ message: 'Mapa subido', map });
  } catch (error) {
    console.error('Error subiendo mapa:', error);
    res.status(500).json({ error: 'Error al subir el mapa' });
  }
});

// PUT /api/maps/:mapId/activate — Activar mapa (solo GM)
router.put('/:mapId/activate', async (req, res) => {
  try {
    const { gameId } = req.body;
    if (!gameId) return res.status(400).json({ error: 'gameId es obligatorio' });
    const membership = await Game.isMember(gameId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No eres miembro de esta partida' });
    if (!await isGM(gameId, req.user.id)) return res.status(403).json({ error: 'Solo el GM puede activar mapas' });

    await Map.setActive(req.params.mapId, gameId);
    res.json({ message: 'Mapa activado' });
  } catch (error) {
    console.error('Error activando mapa:', error);
    res.status(500).json({ error: 'Error al activar el mapa' });
  }
});

// DELETE /api/maps/:mapId — Eliminar mapa (solo GM)
router.delete('/:mapId', async (req, res) => {
  try {
    const { gameId } = req.body;
    if (!gameId) return res.status(400).json({ error: 'gameId es obligatorio' });
    if (!await isGM(gameId, req.user.id)) return res.status(403).json({ error: 'Solo el GM puede eliminar mapas' });

    const deleted = await Map.delete(req.params.mapId, gameId);
    if (!deleted) return res.status(404).json({ error: 'Mapa no encontrado' });
    res.json({ message: 'Mapa eliminado' });
  } catch (error) {
    console.error('Error eliminando mapa:', error);
    res.status(500).json({ error: 'Error al eliminar el mapa' });
  }
});

module.exports = router;