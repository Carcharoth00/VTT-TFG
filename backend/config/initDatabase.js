const { pool } = require('./database');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../init.sql'), 'utf8');
    
    // Dividir por ; y ejecutar cada sentencia
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      await pool.execute(statement);
    }
    
    console.log('Base de datos inicializada correctamente');
  } catch (error) {
    console.error('Error inicializando base de datos:', error.message);
  }
}

module.exports = { initDatabase };