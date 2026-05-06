const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const { setupSocketHandlers } = require('./sockets/handlers');
const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const characterRoutes = require('./routes/characters');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// ========== MIDDLEWARES ==========

// 1. CORS - Permite que Angular (localhost:4200) hable con el backend (localhost:3001)
app.use(cors({
  origin: 'http://localhost:4200', // URL de tu Angular
  credentials: true
}));

// 2. JSON - Permite recibir datos en formato JSON
app.use(express.json());

// 3. URL Encoded - Permite recibir datos de formularios
app.use(express.urlencoded({ extended: true }));

// Rutas de autenticación
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/characters', characterRoutes);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

setupSocketHandlers(io);

// ========== RUTAS ==========

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Backend VTT funcionando correctamente',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/register, /api/auth/login'
    }
  });
});

// Ruta de health check (para verificar el estado del servidor)
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({
    status: 'ok',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// ========== MANEJO DE ERRORES ==========

// Si ninguna ruta coincide, devolver 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.path 
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ========== INICIAR SERVIDOR ==========

const startServer = async () => {
  try {
    // Verificar conexión a base de datos
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ No se pudo conectar a la base de datos');
      console.log('💡 Verifica que XAMPP MySQL esté corriendo');
      process.exit(1);
    }

    // Iniciar servidor
    server.listen(PORT, () => {
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log(`🚀 Servidor backend corriendo`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`🗄️  Base de datos: Conectada`);
      console.log(`🌍 Entorno: ${process.env.NODE_ENV}`);
      console.log('═══════════════════════════════════════');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
};

// Iniciar el servidor
startServer();

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('👋 Cerrando servidor...');
  process.exit(0);
});