const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// ========== REGISTRO ==========
// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, avatar, role } = req.body;
    
    // 1. Validaciones básicas
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Datos incompletos',
        message: 'Username, email y password son obligatorios' 
      });
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Email inválido',
        message: 'Proporciona un email válido' 
      });
    }
    
    // Validar longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Contraseña débil',
        message: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }
    
    // 2. Verificar si el usuario ya existe
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ 
        error: 'Usuario ya existe',
        message: 'El email ya está registrado' 
      });
    }
    
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ 
        error: 'Usuario ya existe',
        message: 'El nombre de usuario ya está en uso' 
      });
    }
    
    // 3. Crear el usuario
    const newUser = await User.create({
      username,
      email,
      password,
      avatar,
      role: role || 'player'
    });
    
    // 4. Generar token JWT
    const token = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    // 5. Responder con el usuario y token
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: newUser,
      token
    });
    
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      message: error.message 
    });
  }
});

// ========== LOGIN ==========
// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 1. Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Datos incompletos',
        message: 'Email y password son obligatorios' 
      });
    }
    
    // 2. Buscar usuario por email
    const user = await User.findByEmail(email);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos' 
      });
    }
    
    // 3. Verificar contraseña
    const isValidPassword = await User.comparePassword(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos' 
      });
    }
    
    // 4. Generar token JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    // 5. Responder con usuario (sin password) y token
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Login exitoso',
      user: userWithoutPassword,
      token
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      message: error.message 
    });
  }
});

// ========== OBTENER PERFIL ==========
// GET /api/auth/me
// Ruta protegida - requiere token
router.get('/me', verifyToken, async (req, res) => {
  try {
    // req.user ya está disponible gracias al middleware
    res.json({
      user: req.user
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error del servidor',
      message: error.message 
    });
  }
});

// ========== VERIFICAR TOKEN ==========
// POST /api/auth/verify
router.post('/verify', verifyToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});

module.exports = router;
"@ | Out-File -FilePath routes/auth.js -Encoding UTF8"