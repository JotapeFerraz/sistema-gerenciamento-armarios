// Importações do Firebase e da nossa configuração
import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==== LÓGICA DE VISUALIZAR SENHA ====
const toggleSenhaBtns = document.querySelectorAll('.btn-toggle-senha');

toggleSenhaBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const inputTarget = document.getElementById(btn.getAttribute('data-target'));
        
        if (inputTarget.type === 'password') {
            inputTarget.type = 'text';
            btn.textContent = '🙈'; // Muda o ícone
        } else {
            inputTarget.type = 'password';
            btn.textContent = '👁️';
        }
    });
});

// ==== LÓGICA DA INTERFACE (Troca de Abas) ====
const tabLogin = document.getElementById('tab-login');
const tabCadastro = document.getElementById('tab-cadastro');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');

tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabCadastro.classList.remove('active');
    formLogin.classList.remove('hidden');
    formCadastro.classList.add('hidden');
});

tabCadastro.addEventListener('click', () => {
    tabCadastro.classList.add('active');
    tabLogin.classList.remove('active');
    formCadastro.classList.remove('hidden');
    formLogin.classList.add('hidden');
});

// ==== MÁSCARAS DE ENTRADA ====
const inputCpf = document.getElementById('cad-cpf');
const inputTelefone = document.getElementById('cad-telefone');

inputCpf.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    e.target.value = value;
});

inputTelefone.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
    value = value.replace(/(\d{5})(\d)/, '$1-$2');
    e.target.value = value;
});

// ==== CRIAÇÃO DE CONTA E SALVAMENTO DE DADOS ====
formCadastro.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('cad-nome').value;
    const matricula = document.getElementById('cad-matricula').value;
    const cpf = inputCpf.value;
    const telefone = inputTelefone.value;
    const email = document.getElementById('cad-email').value;
    const senha = document.getElementById('cad-senha').value;
    const confirmaSenha = document.getElementById('cad-confirma-senha').value;

    const regexCpf = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    const regexTelefone = /^\(\d{2}\) \d{4,5}-\d{4}$/;

    if (!regexCpf.test(cpf)) return alert("Formato de CPF inválido.");
    if (!regexTelefone.test(telefone)) return alert("Formato de telefone inválido.");
    if (senha !== confirmaSenha) {
        return alert("As senhas não coincidem. Por favor, verifique e tente novamente.");
    }

    try {
        // 1. Cria o usuário no Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        // 2. Salva os dados complementares no Firestore na coleção "usuarios"
        await setDoc(doc(db, "usuarios", user.uid), {
            nome: nome,
            matricula: matricula,
            cpf: cpf,
            telefone: telefone,
            email: email,
            admin: false,
            dataCadastro: new Date()
        });

        alert("Conta criada com sucesso!");
        window.location.href = "reserva.html"; // Redireciona para o mapa de armários

    } catch (error) {
        console.error("Erro ao cadastrar:", error);
        if (error.code === 'auth/email-already-in-use') {
            alert("Este e-mail já está cadastrado.");
        } else {
            alert("Erro ao criar conta. Tente novamente.");
        }
    }
});

// ==== SISTEMA DE LOGIN ====
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        window.location.href = "reserva.html"; // Redireciona após login
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        alert("E-mail ou senha incorretos.");
    }
});