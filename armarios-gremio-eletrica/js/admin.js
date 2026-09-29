import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. Verificação de Segurança (Porteiro do Painel)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            const userData = userDoc.data();
            
            if (userData && userData.isAdmin === true) {
                carregarPainelAdmin();
            } else {
                alert("Acesso restrito: Apenas a diretoria tem acesso a esta página.");
                window.location.href = "reserva.html";
            }
        } catch (erro) {
            console.error("Erro ao verificar permissões:", erro);
            window.location.href = "reserva.html";
        }
    } else {
        window.location.href = "index.html";
    }
});

// 2. Lógica para carregar e desenhar a tabela
async function carregarPainelAdmin() {
    const tbody = document.getElementById("tabela-corpo");
    
    try {
        const querySnapshot = await getDocs(collection(db, "armarios"));
        tbody.innerHTML = ""; 

        const armarios = [];
        querySnapshot.forEach((docSnap) => armarios.push(docSnap.data()));
        armarios.sort((a, b) => a.numero.localeCompare(b.numero));

        let encontrouAlugados = false;

        for (const armario of armarios) {
            if (armario.status === 'alugado') {
                encontrouAlugados = true;
                let nomeAluno = "Dados indisponíveis";
                
                if (armario.locatarioUid) {
                    const docAluno = await getDoc(doc(db, "usuarios", armario.locatarioUid));
                    if (docAluno.exists()) {
                        nomeAluno = docAluno.data().nome;
                    }
                }

                const dataInicio = armario.dataPagamento ? new Date(armario.dataPagamento).toLocaleDateString('pt-BR') : '-';
                const dataFim = armario.dataExpiracao ? new Date(armario.dataExpiracao).toLocaleDateString('pt-BR') : '-';

                // Transforma o nome num elemento clicável se tivermos o UID do locatário
                const tdNome = armario.locatarioUid && nomeAluno !== "Dados indisponíveis"
                    ? `<span onclick="abrirModalAluno('${armario.locatarioUid}')" style="color: #0056b3; cursor: pointer; text-decoration: underline;" title="Ver ficha completa">${nomeAluno}</span>`
                    : nomeAluno;

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${armario.numero}</strong></td>
                    <td>${tdNome}</td>
                    <td>${dataInicio}</td>
                    <td>${dataFim}</td>
                    <td style="color: green; font-weight: bold;">Ativo</td>
                `;
                tbody.appendChild(tr);
            }
        }

        if (!encontrouAlugados) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhum armário alugado no momento.</td></tr>`;
        }

    } catch (erro) {
        console.error("Erro ao carregar o painel:", erro);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Erro ao carregar os dados.</td></tr>`;
    }
}

// 3. Lógica do Modal de Detalhes do Aluno
const modalAluno = document.getElementById("modal-aluno");
const btnFecharModalAluno = document.getElementById("fechar-modal-aluno");

if (btnFecharModalAluno) {
    btnFecharModalAluno.addEventListener("click", () => {
        modalAluno.classList.add("hidden");
    });
}

// Como usamos módulos, expomos a função ao 'window' para o HTML conseguir ativá-la no clique
window.abrirModalAluno = async function(uid) {
    try {
        const userDoc = await getDoc(doc(db, "usuarios", uid));
        if (userDoc.exists()) {
            const dados = userDoc.data();
            
            // Preenche os campos do pop-up
            document.getElementById("detalhe-nome").textContent = dados.nome || "Não informado";
            document.getElementById("detalhe-matricula").textContent = dados.matricula || "Não informada";
            document.getElementById("detalhe-cpf").textContent = dados.cpf || "Não informado";
            document.getElementById("detalhe-telefone").textContent = dados.telefone || "Não informado";
            document.getElementById("detalhe-email").textContent = dados.email || "Não informado";
            
            // Exibe o pop-up
            modalAluno.classList.remove("hidden");
        } else {
            alert("A ficha deste aluno já não se encontra na base de dados.");
        }
    } catch (erro) {
        console.error("Erro ao buscar dados do aluno:", erro);
        alert("Ocorreu um erro ao tentar ler as informações.");
    }
};