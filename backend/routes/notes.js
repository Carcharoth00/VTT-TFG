const express = require('express');
const Note = require('../models/Note');
const Game = require('../models/Game');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

// GET /api/notes/:gameId — Listar notas del usuario en una partida
router.get('/:gameId', async (req, res) => {
  try {
    const membership = await Game.isMember(req.params.gameId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'No eres miembro de esta partida' });
    }

    const notes = await Note.getByUserAndGame(req.user.id, req.params.gameId);
    res.json({ notes });
  } catch (error) {
    console.error('Error obteniendo notas:', error);
    res.status(500).json({ error: 'Error al obtener las notas' });
  }
});

// GET /api/notes/:gameId/:id — Obtener nota completa
router.get('/:gameId/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id, req.user.id);
    if (!note) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }
    res.json({ note });
  } catch (error) {
    console.error('Error obteniendo nota:', error);
    res.status(500).json({ error: 'Error al obtener la nota' });
  }
});

// POST /api/notes/:gameId — Crear nota
router.post('/:gameId', async (req, res) => {
  try {
    const membership = await Game.isMember(req.params.gameId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'No eres miembro de esta partida' });
    }

    const { title, content } = req.body;
    const note = await Note.create(req.user.id, req.params.gameId, title, content);
    res.status(201).json({ message: 'Nota creada', note });
  } catch (error) {
    console.error('Error creando nota:', error);
    res.status(500).json({ error: 'Error al crear la nota' });
  }
});

// PUT /api/notes/:id — Actualizar nota
router.put('/:id', async (req, res) => {
  try {
    const { title, content } = req.body;
    const note = await Note.update(req.params.id, req.user.id, title, content);
    if (!note) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }
    res.json({ message: 'Nota actualizada', note });
  } catch (error) {
    console.error('Error actualizando nota:', error);
    res.status(500).json({ error: 'Error al actualizar la nota' });
  }
});

// DELETE /api/notes/:id — Eliminar nota
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Note.delete(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }
    res.json({ message: 'Nota eliminada' });
  } catch (error) {
    console.error('Error eliminando nota:', error);
    res.status(500).json({ error: 'Error al eliminar la nota' });
  }
});

module.exports = router;