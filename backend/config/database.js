const mysql = require('mysql2');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    }).promise();
  }
  return pool;
}

const testConnection = async () => {
  console.log('DB Config:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });
  try {
    const [rows] = await getPool().query('SELECT 1');
    console.log('Conectado a MySQL correctamente');
    return true;
  } catch (error) {
    console.error('Error conectando a MySQL:', error.message);
    return false;
  }
};

module.exports = {
  get pool() { return getPool(); },
  testConnection
};