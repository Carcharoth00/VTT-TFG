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
    // Migraciones: añadir columnas nuevas si no existen
    const migrations = [
      `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS image LONGTEXT DEFAULT NULL`,
      `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS name VARCHAR(50) DEFAULT NULL`,
      `ALTER TABLE characters ADD COLUMN IF NOT EXISTS avatar LONGTEXT DEFAULT NULL`,
      `ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS verified TINYINT(1) DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(100) DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS verified TINYINT(1) DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(100) DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(100) DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires DATETIME DEFAULT NULL`,
      `ALTER TABLE users MODIFY COLUMN avatar LONGTEXT DEFAULT NULL`,
      `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS locked TINYINT(1) DEFAULT 0`,
      `ALTER TABLE tokens ADD COLUMN IF NOT EXISTS conditions JSON DEFAULT NULL`,
      `CREATE TABLE IF NOT EXISTS game_library (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    image LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  )`
    ];

    for (const migration of migrations) {
      try {
        await pool.execute(migration);
      } catch (error) {
        // Ignorar errores (columna ya existe, etc.)
      }
    }

    console.log('Migraciones aplicadas correctamente');

    console.log('Base de datos inicializada correctamente');
  } catch (error) {
    console.error('Error inicializando base de datos:', error.message);
  }
}

module.exports = { initDatabase };