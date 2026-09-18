import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==== 1. VERIFICAÇÃO DE SEGURANÇA (Autenticação) ====
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuário está logado. Buscar o nome dele para pôr no cabeçalho.
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            document.getElementById("user-name").textContent = userDoc.data().nome.split(" ")[0]; // Mostra só o primeiro nome
        }
        
        // Carrega o mapa de armários
        carregarMapaArmarios();
    } else {
        // Se alguém tentar acessar reserva.html sem logar, é chutado para a tela inicial
        window.location.href = "index.html";
    }
});

// ==== 2. BOTÃO DE SAIR ====
document.getElementById("btn-logout").addEventListener("click", () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});

// ==== 3. DESENHAR O MAPA ====
async function carregarMapaArmarios() {
    const gridCorredor = document.getElementById("grid-corredor");
    const gridBloco4 = document.getElementById("grid-bloco4");
    
    // Mostra que está carregando
    gridCorredor.innerHTML = "<p>Carregando armários...</p>";
    gridBloco4.innerHTML = "<p>Carregando armários...</p>";

    // Pede todos os 176 armários ao Firebase
    const querySnapshot = await getDocs(collection(db, "armarios"));
    const armarios = [];
    querySnapshot.forEach((doc) => armarios.push(doc.data()));

    // Ordena alfabeticamente/numericamente (B4-001 antes do B4-002)
    armarios.sort((a, b) => a.numero.localeCompare(b.numero));

    // Limpa a tela para desenhar
    gridCorredor.innerHTML = "";
    gridBloco4.innerHTML = "";

    // Para cada armário lido, cria o botão em HTML dinamicamente
    armarios.forEach(armario => {
        const divBox = document.createElement("div");
        
        // Atribui as classes CSS. O armario.status vindo do BD será "livre", aplicando a cor verde.
        divBox.classList.add("locker", armario.status); 
        
        // Mostra só o número na caixinha (Tira o "B4-" e o "C-")
        const labelNumero = armario.numero.split('-')[1];
        divBox.textContent = labelNumero;
        
        // Se estiver livre, permite clicar
        if (armario.status === "livre") {
            divBox.addEventListener("click", () => {
                // AQUI ENTRARÁ A FASE 4: O Modal de Checkout
                alert(`Você selecionou o armário ${armario.numero}.`);
            });
        }

        // Joga a caixinha na tela correta (Corredor ou Bloco 4)
        if (armario.numero.startsWith("C-")) {
            gridCorredor.appendChild(divBox);
        } else if (armario.numero.startsWith("B4-")) {
            gridBloco4.appendChild(divBox);
        }
    });
}