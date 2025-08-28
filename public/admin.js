document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('authToken')
  const userRole = localStorage.getItem('userRole')
  const usersTableBody = document.getElementById('users-table-body')
  const createUserForm = document.getElementById('create-user-form')

  if (userRole !== 'administrador') {
    alert('Acesso negado. Você não é um administrador.')
    window.location.href = 'index.html'
    return
  }

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        throw new Error('Falha ao carregar usuários.')
      }

      const users = await response.json()
      usersTableBody.innerHTML = ''

      users.forEach(user => {
        const row = document.createElement('tr')
        row.innerHTML = `
          <td>${user.username}</td>
          <td>${user.role}</td>
          <td>
            <select class="role-select" data-userid="${user.id}">
              <option value="vendedor" ${user.role === 'vendedor' ? 'selected' : ''}>Vendedor</option>
              <option value="administrador" ${user.role === 'administrador' ? 'selected' : ''}>Administrador</option>
            </select>
          </td>
          <td>
            <button class="btn btn-danger delete-user" data-userid="${user.id}" data-username="${user.username}">Excluir</button>
            <button class="btn btn-secondary edit-user" data-userid="${user.id}">Alterar Senha</button>
          </td>
        `
        usersTableBody.appendChild(row)
      })

    } catch (error) {
      console.error('Erro:', error)
      usersTableBody.innerHTML = `<tr><td colspan="4">Não foi possível carregar os usuários.</td></tr>`
    }
  }

  const updateUserRole = async (userId, newRole) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      })

      if (!response.ok) {
        throw new Error('Falha ao atualizar a função.')
      }

      loadUsers()

    } catch (error) {
      console.error('Erro ao atualizar:', error)
      alert('Não foi possível atualizar a função do usuário.')
    }
  }

  const deleteUser = async (userId, username) => {
    if (confirm(`Tem certeza que deseja excluir o usuário ${username}?`)) {
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          throw new Error('Falha ao excluir o usuário.')
        }

        loadUsers()
      } catch (error) {
        console.error('Erro ao excluir:', error)
        alert('Não foi possível excluir o usuário.')
      }
    }
  }

  const editUserPassword = async (userId) => {
    const newPassword = prompt("Digite a nova senha:")
    if (newPassword) {
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ password: newPassword })
        })

        if (!response.ok) {
          throw new Error('Falha ao atualizar a senha.')
        }

        alert('Senha atualizada com sucesso!')
      } catch (error) {
        console.error('Erro ao atualizar senha:', error)
        alert('Não foi possível atualizar a senha do usuário.')
      }
    }
  }


  usersTableBody.addEventListener('change', (event) => {
    if (event.target.classList.contains('role-select')) {
      const userId = event.target.dataset.userid
      const newRole = event.target.value
      if (confirm(`Tem certeza que deseja alterar a função deste usuário para ${newRole}?`)) {
        updateUserRole(userId, newRole)
      } else {
        loadUsers()
      }
    }
  })

  usersTableBody.addEventListener('click', (event) => {
    if (event.target.classList.contains('delete-user')) {
      const userId = event.target.dataset.userid
      const username = event.target.dataset.username
      deleteUser(userId, username)
    }
    if (event.target.classList.contains('edit-user')) {
      const userId = event.target.dataset.userid
      editUserPassword(userId)
    }
  })


  createUserForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const username = document.getElementById('new-username').value
    const password = document.getElementById('new-password').value

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, password })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Falha ao criar usuário.')
      }

      createUserForm.reset()
      loadUsers()

    } catch (error) {
      console.error('Erro ao criar usuário:', error)
      alert(error.message)
    }
  })

  loadUsers()
})