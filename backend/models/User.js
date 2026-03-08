const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  
  // ========== CREAR USUARIO ==========
  // Se usa en el registro
  static async create(userData) {
    const { username, email, password, avatar = null, role = 'player' } = userData;
    
    try {
      // 1. Hashear (encriptar) la contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // 2. Insertar en la base de datos
      const query = `
        INSERT INTO users (username, email, password, avatar, role)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const [result] = await pool.execute(query, [
        username,
        email,
        hashedPassword,
        avatar,
        role
      ]);
      
      // 3. Retornar el usuario creado (sin la contraseña)
      return {
        id: result.insertId,
        username,
        email,
        avatar,
        role,
        created_at: new Date()
      };
      
    } catch (error) {
      // Si el email o username ya existe, MySQL lanzará error
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('El email o nombre de usuario ya está registrado');
      }
      throw error;
    }
  }
  
  // ========== BUSCAR POR EMAIL ==========
  // Se usa en el login
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = ?';
    const [rows] = await pool.execute(query, [email]);
    
    return rows[0] || null;
  }
  
  // ========== BUSCAR POR ID ==========
  // Se usa para verificar tokens
  static async findById(id) {
    const query = 'SELECT id, username, email, avatar, role, created_at FROM users WHERE id = ?';
    const [rows] = await pool.execute(query, [id]);
    
    return rows[0] || null;
  }
  
  // ========== VERIFICAR CONTRASEÑA ==========
  // Compara la contraseña ingresada con la hasheada
  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
  
  // ========== BUSCAR POR USERNAME ==========
  static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = ?';
    const [rows] = await pool.execute(query, [username]);
    
    return rows[0] || null;
  }
}

module.exports = User;
"@ | Out-File -FilePath models/User.js -Encoding UTF8"