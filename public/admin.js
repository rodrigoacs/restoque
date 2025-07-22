document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('authToken')
  const userRole = localStorage.getItem('userRole')
  const usersTableBody = document.getElementById('users-table-body')

  // Proteção de Front-end: se não for admin, volta para a página inicial
  if (userRole !== 'administrador') {
    alert('Acesso negado. Você não é um administrador.')
    window.location.href = 'index.html'
    return
  }

  // Função para carregar e exibir os usuários
  const loadUsers = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        throw new Error('Falha ao carregar usuários.')
      }

      const users = await response.json()
      usersTableBody.innerHTML = '' // Limpa a tabela

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

  // Função para atualizar a função de um usuário
  const updateUserRole = async (userId, newRole) => {
    try {
      const response = await fetch(`http://localhost:3000/api/users/${userId}/role`, {
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

      // Recarrega a lista para mostrar a alteração
      loadUsers()

    } catch (error) {
      console.error('Erro ao atualizar:', error)
      alert('Não foi possível atualizar a função do usuário.')
    }
  }

  // Adiciona um listener na tabela para pegar mudanças nos <select>
  usersTableBody.addEventListener('change', (event) => {
    if (event.target.classList.contains('role-select')) {
      const userId = event.target.dataset.userid
      const newRole = event.target.value
      if (confirm(`Tem certeza que deseja alterar a função deste usuário para ${newRole}?`)) {
        updateUserRole(userId, newRole)
      } else {
        // Se o usuário cancelar, recarrega a lista para reverter a mudança no select
        loadUsers()
      }
    }
  })

  // Carrega os usuários ao iniciar a página
  loadUsers()
})