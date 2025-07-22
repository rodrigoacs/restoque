document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha no login');
        }

        // ALTERADO: Pega o token E o role da resposta
        const { token, role } = await response.json();
        
        // Armazena o token, o nome de usuário E o role no localStorage
        localStorage.setItem('authToken', token);
        localStorage.setItem('username', username);
        localStorage.setItem('userRole', role); // Armazena a função

        // Redireciona para a página principal
        window.location.href = 'index.html';

    } catch (error) {
        errorMessage.textContent = error.message;
    }
});