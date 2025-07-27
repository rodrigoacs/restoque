document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('authToken')
  const currentUser = localStorage.getItem('username')
  const userRole = localStorage.getItem('userRole')

  if (!token) {
    window.location.href = 'login.html'
    return
  }

  const tableBody = document.getElementById('stock-table-body')
  const tableHead = document.querySelector('.stock-table thead')
  const searchInput = document.getElementById('search-input')

  const modal = document.getElementById('edit-modal')
  const modalTitle = document.getElementById('modal-title')
  const productForm = document.getElementById('product-form')
  const productIdInput = document.getElementById('product-id')
  const productNameInput = document.getElementById('product-name')
  const productQuantityInput = document.getElementById('product-quantity')
  const productUnitInput = document.getElementById('product-unit')
  const closeButton = document.querySelector('.close-button')
  const cancelButton = document.querySelector('.cancel-button')

  function buildPageHeader() {
    const headerActions = document.createElement('div')
    headerActions.className = 'header-actions'

    if (userRole === 'administrador') {
      const adminButton = document.createElement('a')
      adminButton.textContent = 'Gerenciar Usuários'
      adminButton.href = 'admin.html'
      adminButton.className = 'btn btn-secondary'
      headerActions.appendChild(adminButton)
    }

    if (userRole === 'administrador') {
      const addProductButton = document.createElement('button')
      addProductButton.textContent = 'Novo Produto'
      addProductButton.className = 'btn btn-success'
      addProductButton.onclick = () => openModalForCreate()
      headerActions.appendChild(addProductButton)
    }

    const logoutButton = document.createElement('button')
    logoutButton.textContent = `Sair (${currentUser})`
    logoutButton.className = 'btn btn-danger'
    logoutButton.onclick = () => {
      localStorage.clear()
      window.location.href = 'login.html'
    }
    headerActions.appendChild(logoutButton)

    document.body.insertBefore(headerActions, document.querySelector('.container'))
  }

  function buildTableHeader() {
    const isAdmin = userRole === 'administrador'
    tableHead.innerHTML = `
            <tr>
                <th>#</th>
                <th>Produto</th>
                <th>Estoque</th>
                <th>Unidade</th>
                ${isAdmin ? `<th>Última Alteração</th><th>Usuário</th>` : ''}
                <th>Ações</th>
            </tr>
        `
  }

  async function loadProducts() {
    try {
      const response = await fetch('http://localhost:3000/api/products', { headers: { 'Authorization': `Bearer ${token}` } })
      if (!response.ok) throw new Error('Falha ao carregar produtos.')
      const products = await response.json()

      tableBody.innerHTML = ''

      products.forEach(product => {
        const row = document.createElement('tr')
        const isAdmin = userRole === 'administrador'
        const formattedQuantity = Number(product.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

        const adminActions = isAdmin ? `<button class="btn btn-danger delete-button" data-id="${product.id}" data-name="${product.name}">Deletar</button>` : ''

        row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.name}</td>
                    <td>${formattedQuantity}</td>
                    <td>${product.unit}</td>
                    ${isAdmin ? `
                        <td>${product.last_modified_at ? new Date(product.last_modified_at).toLocaleString('pt-BR') : 'N/A'}</td>
                        <td>${product.last_modified_by || 'N/A'}</td>
                    ` : ''}
                    <td class="actions-cell" style="display: flex; gap: 5px;">
                        <button class="btn btn-primary edit-button">Editar</button>
                        ${adminActions}
                    </td>
                `
        row.querySelector('.edit-button').dataset.product = JSON.stringify(product)
        tableBody.appendChild(row)
      })
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      const colspan = userRole === 'administrador' ? 6 : 4
      tableBody.innerHTML = `<tr><td colspan="${colspan}">Falha ao carregar dados. Verifique o back-end.</td></tr>`
    }
  }

  async function handleDelete(productId, productName) {
    if (!confirm(`Tem certeza que deseja deletar o produto "${productName}"? Esta ação não pode ser desfeita.`)) return

    try {
      const response = await fetch(`http://localhost:3000/api/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Falha ao deletar o produto.')
      loadProducts()
    } catch (error) {
      console.error('Erro ao deletar produto:', error)
      alert('Não foi possível deletar o produto.')
    }
  }

  function openModalForCreate() {
    productForm.reset()
    modalTitle.textContent = 'Adicionar Novo Produto'
    productIdInput.value = ''
    productNameInput.disabled = false
    productUnitInput.disabled = false
    modal.classList.remove('hidden')
    productNameInput.focus()
  }

  function openModalForEdit(product) {
    productForm.reset()
    modalTitle.textContent = `Editar ${product.name}`
    productIdInput.value = product.id
    productNameInput.value = product.name
    productQuantityInput.value = product.quantity
    productUnitInput.value = product.unit

    if (userRole !== 'administrador') {
      productNameInput.disabled = true
      productUnitInput.disabled = true
    } else {
      productNameInput.disabled = false
      productUnitInput.disabled = false
    }
    modal.classList.remove('hidden')
    productQuantityInput.focus()
  }

  function closeModal() {
    modal.classList.add('hidden')
  }

  productForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const id = productIdInput.value
    const isUpdating = !!id

    const body = {
      name: productNameInput.value,
      quantity: productQuantityInput.value.replace(',', '.'),
      unit: productUnitInput.value
    }

    const url = isUpdating ? `http://localhost:3000/api/products/${id}` : 'http://localhost:3000/api/products'
    const method = isUpdating ? 'PUT' : 'POST'

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      })
      if (response.status === 401 || response.status === 403) {
        alert('Sua sessão expirou ou é inválida. Por favor, faça login novamente.')
        localStorage.clear()
        window.location.href = 'login.html'
        return
      }
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Falha ao ${isUpdating ? 'atualizar' : 'criar'} produto.`)
      }
      closeModal()
      loadProducts()
    } catch (error) {
      console.error('Erro no formulário:', error)
      alert(error.message)
    }
  })

  tableBody.addEventListener('click', (event) => {
    const button = event.target.closest('button')
    if (!button) return

    if (button.classList.contains('edit-button')) {
      const productData = JSON.parse(button.dataset.product)
      openModalForEdit(productData)
    }
    if (button.classList.contains('delete-button')) {
      handleDelete(button.dataset.id, button.dataset.name)
    }
  })

  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase()
    const rows = tableBody.querySelectorAll('tr')
    rows.forEach((row) => {
      const productName = row.cells[1].textContent.toLowerCase()
      if (productName.includes(searchTerm)) {
        row.style.display = ''
      } else {
        row.style.display = 'none'
      }
    })
  })

  closeButton.addEventListener('click', closeModal)
  cancelButton.addEventListener('click', closeModal)
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal()
  })

  buildPageHeader()
  buildTableHeader()
  loadProducts()
})