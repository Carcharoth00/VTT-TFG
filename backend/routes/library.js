const express = require('express');
const Library = require('../models/Library');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.use(verifyToken);

router.get('/:gameId', async (req, res) => {
  try {
    const items = await Library.getByGame(req.params.gameId);
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la biblioteca' });
  }
});

router.post('/:gameId', async (req, res) => {
  try {
    const { name, image } = req.body;
    const item = await Library.create(req.params.gameId, name, image);
    res.status(201).json({ item });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar imagen' });
  }
});

router.delete('/:gameId/:id', async (req, res) => {
  try {
    const deleted = await Library.delete(req.params.id, req.params.gameId);
    if (!deleted) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

module.exports = router;