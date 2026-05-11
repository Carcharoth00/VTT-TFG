const express = require('express');
const Game = require('../models/Game');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas de games requieren estar autenticado
router.use(verifyToken);

// POST /api/games — Crear partida
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'El nombre de la partida es obligatorio' });
    }

    const game = await Game.create({
      name: name.trim(),
      description: description || null,
      owner_id: req.user.id
    });

    res.status(201).json({ message: 'Partida creada', game });
  } catch (error) {
    console.error('Error creando partida:', error);
    res.status(500).json({ error: 'Error al crear la partida' });
  }
});

// GET /api/games — Listar mis partidas
router.get('/', async (req, res) => {
  try {
    const games = await Game.findByUser(req.user.id);
    res.json({ games });
  } catch (error) {
    console.error('Error listando partidas:', error);
    res.status(500).json({ error: 'Error al obtener las partidas' });
  }
});

// GET /api/games/:id — Detalle de una partida
router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({ error: 'Partida no encontrada' });
    }

    const membership = await Game.isMember(game.id, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'No eres miembro de esta partida' });
    }

    const members = await Game.getMembers(game.id);
    res.json({ game, members, role: membership.role_in_game });
  } catch (error) {
    console.error('Error obteniendo partida:', error);
    res.status(500).json({ error: 'Error al obtener la partida' });
  }
});

// POST /api/games/join — Unirse con código de invitación
router.post('/join', async (req, res) => {
  try {
    const { invite_code } = req.body;

    if (!invite_code) {
      return res.status(400).json({ error: 'Código de invitación obligatorio' });
    }

    const game = await Game.findByInviteCode(invite_code);
    if (!game) {
      return res.status(404).json({ error: 'Código de invitación inválido' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'La partida no está activa' });
    }

    await Game.addMember(game.id, req.user.id, 'player');
    res.json({ message: 'Te has unido a la partida', game });
  } catch (error) {
    if (error.message.includes('ya es miembro')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Error uniéndose:', error);
    res.status(500).json({ error: 'Error al unirse a la partida' });
  }
});

// DELETE /api/games/:id — Eliminar partida
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Game.delete(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(403).json({ error: 'No puedes eliminar esta partida' });
    }
    res.json({ message: 'Partida eliminada' });
  } catch (error) {
    console.error('Error eliminando partida:', error);
    res.status(500).json({ error: 'Error al eliminar la partida' });
  }
});

router.get('/code/:code', async (req, res) => {
  try {
    const game = await Game.findByInviteCode(req.params.code);
    if (!game) return res.status(404).json({ error: 'Partida no encontrada' });
    const membership = await Game.isMember(game.id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No eres miembro' });
    res.json({ game });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;