document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault()

    const username = document.getElementById('username').value
    const password = document.getElementById('password').value
    const errorMessage = document.getElementById('error-message')

    try {
        const response = await fetch('http://localhost:3020/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'Falha no login')
        }

        const { token, role } = await response.json()

        localStorage.setItem('authToken', token)
        localStorage.setItem('username', username)
        localStorage.setItem('userRole', role)

        window.location.href = 'index.html'
    } catch (error) {
        errorMessage.textContent = error.message
    }
})
