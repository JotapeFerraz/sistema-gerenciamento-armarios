// ==== IMPORTAÇÕES ====
import { auth, db, storage } from "./firebase.js"; // Adicionado storage
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js"; // Adicionado updateDoc
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js"; // Novas funções de Storage

// ==== VARIÁVEIS GLOBAIS ====
let armarioSelecionado = null;
let usuarioLogadoUid = null;

// ==== 1. VERIFICAÇÃO DE SEGURANÇA E DADOS DO USUÁRIO ====
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogadoUid = user.uid; // Guarda o UID para usar no checkout depois
        
        // Busca o nome do usuário no banco de dados para o cabeçalho
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            // Mostra só o primeiro nome
            document.getElementById("user-name").textContent = userDoc.data().nome.split(" ")[0]; 
        }
        
        // Carrega a grelha de armários
        carregarMapaArmarios();
    } else {
        // Se não estiver logado, volta para a tela de login
        window.location.href = "index.html";
    }
});

// ==== 2. BOTÃO DE SAIR ====
document.getElementById("btn-logout").addEventListener("click", () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});

// ==== 3. DESENHAR O MAPA DE ARMÁRIOS ====
async function carregarMapaArmarios() {
    const gridCorredor = document.getElementById("grid-corredor");
    const gridBloco4 = document.getElementById("grid-bloco4");
    
    // Mensagem de carregamento
    gridCorredor.innerHTML = "<p>Carregando armários...</p>";
    gridBloco4.innerHTML = "<p>Carregando armários...</p>";

    // Puxa os dados do Firestore
    const querySnapshot = await getDocs(collection(db, "armarios"));
    const armarios = [];
    querySnapshot.forEach((doc) => armarios.push(doc.data()));

    // Ordena para que B4-001 venha antes de B4-002
    armarios.sort((a, b) => a.numero.localeCompare(b.numero));

    // Limpa as mensagens de carregamento
    gridCorredor.innerHTML = "";
    gridBloco4.innerHTML = "";

    // Desenha cada botão de armário
    armarios.forEach(armario => {
        const divBox = document.createElement("div");
        
        // Aplica as classes (ex: "locker livre" ou "locker pendente")
        divBox.classList.add("locker", armario.status); 
        
        // Mostra apenas o número final na caixinha
        divBox.textContent = armario.numero.split('-')[1];
        
        // Se estiver livre, permite clicar para abrir o checkout
        if (armario.status === "livre") {
            divBox.addEventListener("click", () => abrirModalCheckout(armario.numero));
        }

        // Separa nas áreas corretas
        if (armario.numero.startsWith("C-")) {
            gridCorredor.appendChild(divBox);
        } else if (armario.numero.startsWith("B4-")) {
            gridBloco4.appendChild(divBox);
        }
    });
}

// ==== 4. LÓGICA DO MODAL DE CHECKOUT ====
const modal = document.getElementById("modal-checkout");
const btnFecharModal = document.querySelector(".close-modal");

// Função para abrir o modal e preparar os dados
function abrirModalCheckout(numero) {
    armarioSelecionado = numero;
    document.getElementById("checkout-armario-num").textContent = numero;
    
    // Limpa uploads antigos caso o usuário tenha fechado e aberto de novo
    document.getElementById("upload-termo").value = "";
    document.getElementById("upload-comprovante").value = "";
    
    // Mostra o modal na tela
    modal.classList.remove("hidden");
}

// Fechar o modal no "X"
btnFecharModal.addEventListener("click", () => {
    modal.classList.add("hidden");
});

// Função de Copiar o Código PIX
document.getElementById("btn-copiar-pix").addEventListener("click", () => {
    const inputPix = document.getElementById("pix-codigo");
    
    // Seleciona o texto
    inputPix.select();
    inputPix.setSelectionRange(0, 99999); // Para funcionar bem em telemóveis/celulares
    
    // Copia para a área de transferência
    navigator.clipboard.writeText(inputPix.value);
    
    // Dá um feedback visual no botão
    const btn = document.getElementById("btn-copiar-pix");
    btn.textContent = "Copiado!";
    setTimeout(() => {
        btn.textContent = "Copiar PIX";
    }, 2000);
});

// ==== 5. FINALIZAR RESERVA E ENVIAR FICHEIROS ====
const btnFinalizar = document.getElementById("btn-finalizar-reserva");

btnFinalizar.addEventListener("click", async () => {
    const inputTermo = document.getElementById("upload-termo");
    const inputComprovante = document.getElementById("upload-comprovante");

    // 1. Validação simples: Confere se a pessoa anexou os dois arquivos
    if (inputTermo.files.length === 0 || inputComprovante.files.length === 0) {
        return alert("Por favor, anexe o Termo assinado e o Comprovante do PIX para concluir.");
    }

    // Muda o texto do botão para avisar que está enviando
    btnFinalizar.textContent = "Enviando arquivos... Aguarde.";
    btnFinalizar.disabled = true;

    try {
        const arquivoTermo = inputTermo.files[0];
        const arquivoComprovante = inputComprovante.files[0];

        // 2. Prepara o caminho no Firebase Storage (Cria pastas organizadas por número do armário)
        const termoRef = ref(storage, `termos/${armarioSelecionado}_${usuarioLogadoUid}_${arquivoTermo.name}`);
        const comprovanteRef = ref(storage, `comprovantes/${armarioSelecionado}_${usuarioLogadoUid}_${arquivoComprovante.name}`);

        // 3. Faz o upload real dos arquivos
        await uploadBytes(termoRef, arquivoTermo);
        await uploadBytes(comprovanteRef, arquivoComprovante);

        // 4. Pega os links públicos gerados para salvar no banco de dados
        const linkTermoGerado = await getDownloadURL(termoRef);
        const linkComprovanteGerado = await getDownloadURL(comprovanteRef);

        // 5. Atualiza o armário no Firestore
        const armarioRef = doc(db, "armarios", armarioSelecionado);
        await updateDoc(armarioRef, {
            status: "pendente",
            usuarioAlocado: usuarioLogadoUid,
            linkTermo: linkTermoGerado,
            linkComprovantePix: linkComprovanteGerado
        });

        // 6. Sucesso!
        alert(`Pré-reserva do armário ${armarioSelecionado} realizada com sucesso! Aguarde a aprovação do grêmio.`);
        
        // Fecha o modal e recarrega a grade (o armário vai ficar cinza agora)
        document.getElementById("modal-checkout").classList.add("hidden");
        carregarMapaArmarios();

    } catch (error) {
        console.error("Erro no upload: ", error);
        alert("Ocorreu um erro ao enviar sua reserva. Tente novamente.");
    } finally {
        // Devolve o botão ao estado normal
        btnFinalizar.textContent = "Concluir Pré-Reserva";
        btnFinalizar.disabled = false;
    }
});