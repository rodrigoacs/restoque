const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')
const authenticateToken = require('./authMiddleware')
const path = require('path')

const app = express()
const port = 3000
const JWT_SECRET = 'sua-chave-secreta-super-dificil-de-adivinhar'

// Middlewares
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'public')))

// Configuração do Pool do PostgreSQL
const pool = new Pool({
  user: '',
  host: '',
  database: '',
  password: '',
  port: 5432,
})

const authorizeAdmin = (req, res, next) => {
  // Este middleware deve rodar DEPOIS do authenticateToken
  if (req.user.role !== 'administrador') {
    return res.status(403).json({ message: 'Acesso negado. Requer privilégios de administrador.' })
  }
  next()
}

// ===================================
// ROTAS DE API
// ===================================

// Rota de Registro
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' })
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, role',
      [username, hashedPassword]
    )
    res.status(201).json(newUser.rows[0])
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Usuário já existe.' })
    }
    console.error('Erro no registro:', error)
    res.status(500).json({ message: 'Erro interno no servidor' })
  }
})

// Rota de Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username])
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas.' })
    }
    const user = userResult.rows[0]
    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash)
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Credenciais inválidas.' })
    }
    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role
    }
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' })
    res.json({ token, role: user.role })
  } catch (error) {
    console.error('Erro no login:', error)
    res.status(500).json({ message: 'Erro interno no servidor' })
  }
})

// Rota para Buscar Produtos
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    let query
    if (req.user.role === 'administrador') {
      query = 'SELECT * FROM products ORDER BY name ASC'
    } else {
      query = 'SELECT id, name, quantity FROM products ORDER BY name ASC'
    }
    const result = await pool.query(query)
    res.json(result.rows)
  } catch (err) {
    console.error('Erro ao buscar produtos:', err)
    res.status(500).send('Erro no servidor')
  }
})

// Rota para Atualizar um Produto - VERIFIQUE ESTA LINHA
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params
  const { quantity } = req.body
  const userName = req.user.username

  if (quantity === undefined || quantity < 0) {
    return res.status(400).send('Quantidade inválida.')
  }
  try {
    const result = await pool.query(
      'UPDATE products SET quantity = $1, last_modified_by = $2, last_modified_at = NOW() WHERE id = $3 RETURNING *',
      [quantity, userName, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).send('Produto não encontrado.')
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('Erro ao atualizar produto:', err)
    res.status(500).send('Erro no servidor')
  }
})

// ===================================
// NOVAS ROTAS DE ADMINISTRAÇÃO
// ===================================

// Rota para BUSCAR todos os usuários (protegida para admins)
app.get('/api/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    // Seleciona colunas essenciais, NUNCA a senha
    const result = await pool.query('SELECT id, username, role FROM users ORDER BY username ASC')
    res.json(result.rows)
  } catch (err) {
    console.error('Erro ao buscar usuários:', err)
    res.status(500).send('Erro no servidor')
  }
})

// Rota para ATUALIZAR a função de um usuário (protegida para admins)
app.put('/api/users/:id/role', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params
  const { role } = req.body

  // Validação para garantir que a função seja válida
  if (role !== 'vendedor' && role !== 'administrador') {
    return res.status(400).json({ message: 'Função inválida.' })
  }

  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
      [role, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).send('Usuário não encontrado.')
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('Erro ao atualizar função do usuário:', err)
    res.status(500).send('Erro no servidor')
  }
})

// Inicia o servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${port}`)
})