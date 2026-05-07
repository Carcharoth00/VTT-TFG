const mysql = require('mysql2');
require('dotenv').config();

// Pool de conexiones 
const pool = mysql.createPool({
  host: process.env.DB_HOST,        
  user: process.env.DB_USER,        
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME,    
  port: process.env.DB_PORT,        
  waitForConnections: true,
  connectionLimit: 10,               
  queueLimit: 0
});

// Convertir a promesas para usar async/await (más moderno)
const promisePool = pool.promise();

// Función para verificar la conexión
const testConnection = async () => {
   console.log('DB Config:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });
  try {
    const [rows] = await promisePool.query('SELECT 1');
    console.log('✅ Conectado a MySQL correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error.message);
    return false;
  }
};

module.exports = {
  pool: promisePool,
  testConnection
};