document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('authToken')
  const currentUser = localStorage.getItem('username')
  const userRole = localStorage.getItem('userRole')

  if (!token) {
    window.location.href = 'login.html'
    return
  }

  const modal = document.getElementById('edit-modal')
  const closeButton = document.querySelector('.close-button')
  const cancelButton = document.querySelector('.cancel-button')
  const editStockForm = document.getElementById('edit-stock-form')
  const modalProductName = document.getElementById('modal-product-name')
  const newStockInput = document.getElementById('new-stock-input')
  const tableBody = document.getElementById('stock-table-body')
  const searchInput = document.getElementById('search-input')
  const tableHead = document.querySelector('.stock-table thead')

  let currentProductId = null

  const headerActions = document.createElement('div')
  headerActions.className = 'header-actions'

  const logoutButton = document.createElement('button')
  logoutButton.textContent = `Sair (${currentUser} - ${userRole})`
  logoutButton.className = 'btn btn-danger'
  logoutButton.onclick = () => {
    localStorage.clear()
    window.location.href = 'login.html'
  }
  headerActions.appendChild(logoutButton)

  if (userRole === 'administrador') {
    const adminButton = document.createElement('a')
    adminButton.textContent = 'Gerenciar Usuários'
    adminButton.href = 'admin.html'
    adminButton.className = 'btn btn-secondary'
    headerActions.insertBefore(adminButton, logoutButton)
  }

  document.body.appendChild(headerActions)
  const buildTableHeader = () => {
    let headers = `
            <tr>
                <th>#</th>
                <th>Produto</th>
                <th>Estoque Atual</th>
                <th>Unidade</th>
        `
    if (userRole === 'administrador') {
      headers += `
                <th>Última Alteração</th>
                <th>Usuário</th>
            `
    }
    headers += `
                <th>Ações</th>
            </tr>
        `
    tableHead.innerHTML = headers
  }

  const loadProducts = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/products', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Falha ao carregar produtos.')

      const products = await response.json()
      tableBody.innerHTML = ''

      products.sort((a, b) => a.id - b.id)

      products.forEach((product) => {
        const row = document.createElement('tr')
        const formattedQuantity = Number(product.quantity).toLocaleString('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        })

        let rowHTML = `
                    <td>${product.id}</td>
                    <td>${product.name}</td>
                    <td>${formattedQuantity}</td>
                    <td>${product.unit || 'un.'}</td>
                `

        if (userRole === 'administrador') {
          const formattedDate = product.last_modified_at ? new Date(product.last_modified_at).toLocaleString('pt-BR') : 'N/A'
          const modifiedBy = product.last_modified_by || 'N/A'
          rowHTML += `
                        <td>${formattedDate}</td>
                        <td>${modifiedBy}</td>
                    `
        }

        rowHTML += `
                    <td><button class="btn btn-primary edit-button" data-id="${product.id}" data-name="${product.name}">Alterar</button></td>
                `
        row.innerHTML = rowHTML
        tableBody.appendChild(row)
      })
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      const colspan = userRole === 'administrador' ? 7 : 4
      tableBody.innerHTML = `<tr><td colspan="${colspan}">Falha ao carregar dados.</td></tr>`
    }
  }

  const openModal = (event) => {
    const button = event.target
    currentProductId = button.getAttribute('data-id')
    modalProductName.textContent = button.getAttribute('data-name')
    modal.classList.remove('hidden')
    newStockInput.focus()
  }

  const closeModal = () => {
    modal.classList.add('hidden')
    newStockInput.value = ''
    currentProductId = null
  }

  tableBody.addEventListener('click', (event) => {
    if (event.target.classList.contains('edit-button')) {
      openModal(event)
    }
  })

  editStockForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const newQuantity = newStockInput.value
    if (newQuantity === '' || !currentProductId) return
    try {
      const response = await fetch(`http://localhost:3000/api/products/${currentProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity: parseFloat(newQuantity.replace(',', '.')) }),
      })
      if (response.status === 401 || response.status === 403) {
        alert('Sua sessão expirou. Faça login novamente.')
        localStorage.clear()
        window.location.href = 'login.html'
        return
      }
      if (!response.ok) throw new Error('Falha ao atualizar o estoque.')
      closeModal()
      loadProducts()
    } catch (error) {
      console.error('Erro ao atualizar produto:', error)
      alert('Não foi possível atualizar o estoque.')
    }
  })

  closeButton.addEventListener('click', closeModal)
  cancelButton.addEventListener('click', closeModal)
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal()
  })

  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase()
    const rows = tableBody.querySelectorAll('tr')
    rows.forEach((row) => {
      const productName = row.cells[1].textContent.toLowerCase()
      const productId = row.cells[0].textContent.toLowerCase()
      if (productName.includes(searchTerm) || productId.includes(searchTerm)) {
        row.style.display = ''
      } else {
        row.style.display = 'none'
      }
    })
  })

  buildTableHeader()
  loadProducts()
})