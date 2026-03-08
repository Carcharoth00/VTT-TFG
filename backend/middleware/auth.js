const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verificar token JWT
const verifyToken = async (req, res, next) => {
  try {
    // 1. Obtener el token del header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No autorizado',
        message: 'Token no proporcionado' 
      });
    }
    
    // 2. Extraer el token (quitar "Bearer ")
    const token = authHeader.split(' ')[1];
    
    // 3. Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 4. Buscar el usuario en la base de datos
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'No autorizado',
        message: 'Usuario no encontrado' 
      });
    }
    
    // 5. Añadir el usuario a la request para usar en otras rutas
    req.user = user;
    
    // 6. Continuar con la siguiente función
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'No autorizado',
        message: 'Token inválido' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'No autorizado',
        message: 'Token expirado' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Error del servidor',
      message: error.message 
    });
  }
};

// Verificar que el usuario sea Game Master
const verifyGM = (req, res, next) => {
  if (req.user.role !== 'gm') {
    return res.status(403).json({ 
      error: 'Acceso denegado',
      message: 'Solo los Game Masters pueden acceder a esta ruta' 
    });
  }
  next();
};

module.exports = {
  verifyToken,
  verifyGM
};
"@ | Out-File -FilePath middleware/auth.js -Encoding UTF8"