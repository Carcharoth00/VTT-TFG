const express = require('express');
const Character = require('../models/Character');
const Game = require('../models/Game');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

// GET /api/characters/:gameId — Fichas de una partida
router.get('/:gameId', async (req, res) => {
  try {
    const membership = await Game.isMember(req.params.gameId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'No eres miembro de esta partida' });
    }

    const characters = await Character.getByGame(req.params.gameId);
    res.json({ characters });
  } catch (error) {
    console.error('Error obteniendo fichas:', error);
    res.status(500).json({ error: 'Error al obtener las fichas' });
  }
});

// GET /api/characters/:gameId/mine — Mis fichas en una partida
router.get('/:gameId/mine', async (req, res) => {
  try {
    const membership = await Game.isMember(req.params.gameId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'No eres miembro de esta partida' });
    }

    const characters = await Character.getByUserAndGame(req.user.id, req.params.gameId);
    res.json({ characters });
  } catch (error) {
    console.error('Error obteniendo fichas:', error);
    res.status(500).json({ error: 'Error al obtener tus fichas' });
  }
});

// POST /api/characters/:gameId — Crear ficha
router.post('/:gameId', async (req, res) => {
  try {
    const membership = await Game.isMember(req.params.gameId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'No eres miembro de esta partida' });
    }

    const { name, hp, max_hp, ac, stats, skills, notes } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const character = await Character.create({
      user_id: req.user.id,
      game_id: req.params.gameId,
      name: name.trim(),
      hp, max_hp, ac, stats, skills, notes
    });

    res.status(201).json({ message: 'Ficha creada', character });
  } catch (error) {
    console.error('Error creando ficha:', error);
    res.status(500).json({ error: 'Error al crear la ficha' });
  }
});

// PUT /api/characters/:id — Actualizar ficha
router.put('/:id', async (req, res) => {
  try {
    const character = await Character.findById(req.params.id);
    if (!character) {
      return res.status(404).json({ error: 'Ficha no encontrada' });
    }

    if (character.user_id !== req.user.id) {
      return res.status(403).json({ error: 'No puedes editar esta ficha' });
    }

    const updated = await Character.update(req.params.id, req.body);
    res.json({ message: 'Ficha actualizada', character: updated });
  } catch (error) {
    console.error('Error actualizando ficha:', error);
    res.status(500).json({ error: 'Error al actualizar la ficha' });
  }
});

// DELETE /api/characters/:id — Eliminar ficha
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Character.delete(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(403).json({ error: 'No puedes eliminar esta ficha' });
    }
    res.json({ message: 'Ficha eliminada' });
  } catch (error) {
    console.error('Error eliminando ficha:', error);
    res.status(500).json({ error: 'Error al eliminar la ficha' });
  }
});

module.exports = router;