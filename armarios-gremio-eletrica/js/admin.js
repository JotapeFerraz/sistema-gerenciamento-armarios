import { db } from "./firebase.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function carregarPainelAdmin() {
    const tbody = document.getElementById("tabela-corpo");
    
    try {
        const querySnapshot = await getDocs(collection(db, "armarios"));
        tbody.innerHTML = ""; // Limpa o "A carregar dados..."

        const armarios = [];
        querySnapshot.forEach((docSnap) => armarios.push(docSnap.data()));

        // Ordenar por número do armário
        armarios.sort((a, b) => a.numero.localeCompare(b.numero));

        for (const armario of armarios) {
            if (armario.status === 'alugado') {
                let nomeAluno = "Dados indisponíveis";
                
                // Busca o nome do aluno na coleção de usuários, se o UID existir
                if (armario.locatarioUid) {
                    const userDoc = await getDoc(doc(db, "usuarios", armario.locatarioUid));
                    if (userDoc.exists()) {
                        nomeAluno = userDoc.data().nome;
                    }
                }

                // Formatar datas para o padrão local
                const dataInicio = armario.dataPagamento ? new Date(armario.dataPagamento).toLocaleDateString('pt-BR') : '-';
                const dataFim = armario.dataExpiracao ? new Date(armario.dataExpiracao).toLocaleDateString('pt-BR') : '-';

                // Desenhar a linha na tabela
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

        if (tbody.innerHTML === "") {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhum armário alugado no momento.</td></tr>`;
        }

    } catch (erro) {
        console.error("Erro ao carregar o painel:", erro);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Erro ao carregar os dados. Verifique a consola.</td></tr>`;
    }
}

// Inicia a função assim que a página carrega
carregarPainelAdmin();