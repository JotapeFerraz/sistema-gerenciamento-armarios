import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. Verificação de Segurança (Porteiro do Painel)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Vai à base de dados confirmar se o utilizador logado é administrador
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            const userData = userDoc.data();
            
            if (userData && userData.isAdmin === true) {
                // Tem permissão! Carrega a tabela
                carregarPainelAdmin();
            } else {
                // Não é admin, redireciona para o mapa de armários
                alert("Acesso restrito: Apenas a diretoria tem acesso a esta página.");
                window.location.href = "reserva.html";
            }
        } catch (erro) {
            console.error("Erro ao verificar permissões:", erro);
            window.location.href = "reserva.html";
        }
    } else {
        // Se não estiver sequer logado, manda para o login
        window.location.href = "index.html";
    }
});

// 2. Lógica para carregar e desenhar a tabela
async function carregarPainelAdmin() {
    const tbody = document.getElementById("tabela-corpo");
    
    try {
        const querySnapshot = await getDocs(collection(db, "armarios"));
        tbody.innerHTML = ""; // Limpa a mensagem inicial

        const armarios = [];
        querySnapshot.forEach((docSnap) => armarios.push(docSnap.data()));

        // Ordenar armários alfabeticamente/numericamente
        armarios.sort((a, b) => a.numero.localeCompare(b.numero));

        let encontrouAlugados = false;

        for (const armario of armarios) {
            if (armario.status === 'alugado') {
                encontrouAlugados = true;
                let nomeAluno = "Dados indisponíveis";
                
                // Busca o nome do aluno usando o UID guardado no armário
                if (armario.locatarioUid) {
                    const docAluno = await getDoc(doc(db, "usuarios", armario.locatarioUid));
                    if (docAluno.exists()) {
                        nomeAluno = docAluno.data().nome;
                    }
                }

                const dataInicio = armario.dataPagamento ? new Date(armario.dataPagamento).toLocaleDateString('pt-BR') : '-';
                const dataFim = armario.dataExpiracao ? new Date(armario.dataExpiracao).toLocaleDateString('pt-BR') : '-';

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${armario.numero}</strong></td>
                    <td>${nomeAluno}</td>
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