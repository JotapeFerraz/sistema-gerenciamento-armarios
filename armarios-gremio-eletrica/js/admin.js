import { auth, API_BASE_URL } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

async function adminFetch(path) {
    const user = auth.currentUser;
    if (!user) throw new Error('Autenticação necessária.');
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error?.message || 'Falha ao comunicar com o servidor.');
        error.status = response.status;
        throw error;
    }
    return data;
}

document.getElementById('btn-voltar').addEventListener('click', () => {
    window.location.href = 'reserva.html';
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    try {
        await carregarPainelAdmin();
    } catch (error) {
        if (error.status === 403) {
            alert("Acesso restrito: apenas a diretoria tem acesso a esta página.");
            window.location.href = "reserva.html";
            return;
        }
        document.getElementById("tabela-corpo").textContent = "Erro ao carregar os dados.";
    }
});

function td(text) {
    const cell = document.createElement('td');
    cell.textContent = text ?? '-';
    return cell;
}

function mostrarAluno(usuario) {
    document.getElementById("detalhe-nome").textContent = usuario.nome || "Não informado";
    document.getElementById("detalhe-matricula").textContent = usuario.matricula || "Não informada";
    document.getElementById("detalhe-cpf").textContent = usuario.cpf || "Não informado";
    document.getElementById("detalhe-telefone").textContent = usuario.telefone || "Não informado";
    document.getElementById("detalhe-email").textContent = usuario.email || "Não informado";
    document.getElementById("modal-aluno").classList.remove("hidden");
}

async function carregarPainelAdmin() {
    const tbody = document.getElementById("tabela-corpo");
    const { armarios } = await adminFetch('/api/admin/armarios');
    tbody.textContent = "";

    if (armarios.length === 0) {
        const row = document.createElement('tr');
        const empty = td('Nenhum armário alugado no momento.');
        empty.colSpan = 5;
        empty.style.textAlign = 'center';
        row.appendChild(empty);
        tbody.appendChild(row);
        return;
    }

    for (const armario of armarios) {
        const row = document.createElement('tr');
        const locker = td(armario.numero);
        locker.style.fontWeight = 'bold';

        const student = td(armario.usuario.nome || 'Dados indisponíveis');
        if (armario.usuario.nome) {
            student.style.color = '#0056b3';
            student.style.cursor = 'pointer';
            student.style.textDecoration = 'underline';
            student.title = 'Ver ficha completa';
            student.addEventListener('click', () => mostrarAluno(armario.usuario));
        }

        const start = armario.dataPagamento ? new Date(armario.dataPagamento).toLocaleDateString('pt-BR') : '-';
        const expiration = armario.dataExpiracao ? new Date(armario.dataExpiracao).toLocaleDateString('pt-BR') : '-';
        const status = td('Ativo');
        status.style.color = 'green';
        status.style.fontWeight = 'bold';
        row.append(locker, student, td(start), td(expiration), status);
        tbody.appendChild(row);
    }
}

document.getElementById("fechar-modal-aluno").addEventListener("click", () => {
    document.getElementById("modal-aluno").classList.add("hidden");
});
