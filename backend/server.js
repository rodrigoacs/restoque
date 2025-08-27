const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')
const authenticateToken = require('./authMiddleware')
const path = require('path')
const http = require('http')
const { WebSocketServer } = require('ws')
const url = require('url')

const app = express()
const port = 3020
const JWT_SECRET = process.env.JWT_SECRET

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

const broadcast = (data) => {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(data))
    }
  })
}

wss.on('connection', (ws, req) => {
  const token = url.parse(req.url, true).query.token

  if (!token) {
    console.log('Tentativa de conexão WebSocket sem token. Conexão rejeitada.')
    ws.terminate()
    return
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('Tentativa de conexão WebSocket com token inválido. Conexão rejeitada.')
      ws.terminate()
      return
    }

    ws.user = decoded
    console.log(`Cliente '${ws.user.username}' (role: ${ws.user.role}) conectado via WebSocket.`)

    ws.on('close', () => {
      console.log(`Cliente '${ws.user.username}' desconectado.`)
    })

    ws.on('error', (error) => {
      console.error(`Erro no WebSocket do cliente '${ws.user.username}':`, error)
    })
  })
})

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})

const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 'administrador') {
    return res.status(403).json({ message: 'Acesso negado. Requer privilégios de administrador.' })
  }
  next()
}

app.get('/ping', (req, res) => {
  console.log('pong')
  res.status(200).send('pong')
})

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

app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    let query
    if (req.user.role === 'administrador') {
      query = 'SELECT * FROM products WHERE active = true ORDER BY id asc'
    } else {
      query = 'SELECT id, name, quantity, unit FROM products WHERE active = true ORDER BY id ASC'
    }
    const result = await pool.query(query)
    res.json(result.rows)
  } catch (err) {
    console.error('Erro ao buscar produtos:', err)
    res.status(500).send('Erro no servidor')
  }
})

app.post('/api/products', authenticateToken, authorizeAdmin, async (req, res) => {
  const { name, quantity, unit } = req.body
  if (!name || quantity === undefined || !unit) {
    return res.status(400).json({ message: 'Nome, quantidade e unidade são obrigatórios.' })
  }
  try {
    const newProduct = await pool.query(
      'INSERT INTO products (name, quantity, unit, last_modified_by, last_modified_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [name, parseFloat(quantity), unit, req.user.username]
    )
    broadcast({ event: 'product_update' })
    res.status(201).json(newProduct.rows[0])
  } catch (err) { console.error(err); res.status(500).send('Erro no servidor') }
})

app.patch('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params
  const { name, quantity, unit } = req.body
  const userName = req.user.username
  const userRole = req.user.role

  try {
    let query, params
    if (userRole === 'administrador') {
      if (!name || quantity === undefined || !unit) {
        return res.status(400).json({ message: 'Nome, quantidade e unidade são obrigatórios.' })
      }
      query = 'UPDATE products SET name = $1, quantity = $2, unit = $3, last_modified_by = $4, last_modified_at = NOW() WHERE id = $5 RETURNING *'
      params = [name, parseFloat(quantity), unit, userName, id]
    } else {
      if (quantity === undefined) {
        return res.status(400).json({ message: 'Quantidade é obrigatória.' })
      }
      query = 'UPDATE products SET quantity = $1, last_modified_by = $2, last_modified_at = NOW() WHERE id = $3 RETURNING *'
      params = [parseFloat(quantity), userName, id]
    }

    const result = await pool.query(query, params)
    if (result.rows.length === 0) return res.status(404).send('Produto não encontrado.')

    broadcast({ event: 'product_update' })
    res.json(result.rows[0])
  } catch (err) { console.error(err); res.status(500).send('Erro no servidor') }
})

app.delete('/api/products/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query('UPDATE products SET active=false WHERE id= $1 RETURNING *', [id])
    if (result.rows.length === 0) {
      return res.status(404).send('Produto não encontrado.')
    }

    broadcast({ event: 'product_update' })
    res.status(200).json({ message: 'Produto deletado com sucesso.', product: result.rows[0] })
  } catch (err) { console.error(err); res.status(500).send('Erro no servidor') }
})

app.get('/api/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role FROM users ORDER BY username ASC')
    res.json(result.rows)
  } catch (err) {
    console.error('Erro ao buscar usuários:', err)
    res.status(500).send('Erro no servidor')
  }
})

app.patch('/api/users/:id/role', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params
  const { role } = req.body

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


server.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${port}`)
})
