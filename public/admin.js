document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('authToken')
  const userRole = localStorage.getItem('userRole')
  const usersTableBody = document.getElementById('users-table-body')

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
                `
        usersTableBody.appendChild(row)
      })

    } catch (error) {
      console.error('Erro:', error)
      usersTableBody.innerHTML = `<tr><td colspan="3">Não foi possível carregar os usuários.</td></tr>`
    }
  }

  const updateUserRole = async (userId, newRole) => {
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
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

  loadUsers()
})
