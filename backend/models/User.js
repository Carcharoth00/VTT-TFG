const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {

  // ========== CREAR USUARIO ==========
  // Se usa en el registro
  static async create(userData) {
    const { username, email, password, avatar = null, role = 'player', verification_token = null } = userData;

    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const query = `
      INSERT INTO users (username, email, password, avatar, role, verification_token)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

      const [result] = await pool.execute(query, [
        username, email, hashedPassword, avatar, role, verification_token
      ]);

      return {
        id: result.insertId,
        username, email, avatar, role,
        created_at: new Date()
      };

    } catch (error) {
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

  static async findByVerificationToken(token) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE verification_token = ?',
      [token]
    );
    return rows[0] || null;
  }

  static async verify(id) {
    await pool.execute(
      'UPDATE users SET verified = 1, verification_token = NULL WHERE id = ?',
      [id]
    );
  }

  static async setResetToken(email, token, expires) {
    await pool.execute(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
      [token, expires, email]
    );
  }

  static async findByResetToken(token) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );
    return rows[0] || null;
  }

  static async resetPassword(id, hashedPassword) {
    await pool.execute(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hashedPassword, id]
    );
  }

  static async updateProfile(id, username, avatar) {
    await pool.execute(
      'UPDATE users SET username = ?, avatar = ? WHERE id = ?',
      [username, avatar, id]
    );
  }
}

module.exports = User;
"@ | Out-File -FilePath models/User.js -Encoding UTF8"