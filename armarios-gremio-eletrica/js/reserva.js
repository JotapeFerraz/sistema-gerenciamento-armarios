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
    
    // Limpa o upload do PIX caso o usuário tenha fechado e aberto de novo
    document.getElementById("upload-comprovante").value = "";
    
    // Reseta o checkbox do termo de compromisso
    const checkboxTermo = document.getElementById("check-termo");
    checkboxTermo.checked = false;
    checkboxTermo.disabled = true;
    
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

// ==== 5. LÓGICA DO NOVO TERMO DE COMPROMISSO ====
const modalTermo = document.getElementById("modal-termo");
const btnLerTermo = document.getElementById("btn-ler-termo");
const btnFecharTermo = document.querySelector(".close-termo");
const btnConcordarTermo = document.getElementById("btn-concordar-termo");
const checkboxTermo = document.getElementById("check-termo");

btnLerTermo.addEventListener("click", () => {
    modalTermo.classList.remove("hidden");
});

// Fechar no "X" sem aceitar
btnFecharTermo.addEventListener("click", () => {
    modalTermo.classList.add("hidden");
});

// Botão "Li e aceito" dentro do texto
btnConcordarTermo.addEventListener("click", () => {
    modalTermo.classList.add("hidden");
    checkboxTermo.disabled = false; // Destrava a caixa
    checkboxTermo.checked = true;   // Marca automaticamente
});

// Sempre que abrir o checkout de um armário, bloqueia o termo novamente
const modalCheckout = document.getElementById("modal-checkout");
document.querySelector(".close-modal").addEventListener("click", () => {
    modalCheckout.classList.add("hidden");
    checkboxTermo.checked = false;
    checkboxTermo.disabled = true;
});

// ==== 6. FINALIZAR RESERVA E ENVIAR PIX ====
const btnFinalizar = document.getElementById("btn-finalizar-reserva");

btnFinalizar.addEventListener("click", async () => {
    // 1. Bloqueia o botão para evitar múltiplos cliques
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = "Gerando PIX...";

    const user = firebase.auth().currentUser;
    if (!user) {
        alert("Erro: Você precisa estar logado.");
        return;
    }

    try {
        const db = firebase.firestore();
        
        // 2. Busca os dados reais do aluno no banco de dados
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
        const userData = userDoc.data();
        
        if (!userData || !userData.cpf) {
            alert("Erro: CPF não encontrado no seu cadastro.");
            btnFinalizar.disabled = false;
            btnFinalizar.textContent = "Gerar Cobrança PIX";
            return;
        }

        // 3. Verifica a opção de plano escolhida
        const planoSelecionado = document.querySelector('input[name="plano-locacao"]:checked');
        const valorPlano = Number(planoSelecionado.value);
        const mesesLocacao = Number(planoSelecionado.getAttribute('data-meses'));

        // 4. Monta o pacote de dados para o servidor
        const payload = {
            armario: armarioSelecionado,
            usuarioUid: user.uid,
            email: user.email,
            nome: userData.nome,
            cpf: userData.cpf,
            valor: valorPlano,
            meses: mesesLocacao
        };

        // 5. Chama a sua API no Vercel
        const resposta = await fetch('https://backend-g3e-chnt5nvuz-g3-e1.vercel.app/api/gerar-pix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const dadosPix = await resposta.json();

        if (dadosPix.error) {
            throw new Error(dadosPix.error);
        }

        // 6. Exibe o QR Code na tela e esconde o botão original
        document.getElementById("qr-code-img").src = `data:image/jpeg;base64,${dadosPix.qr_code_base64}`;
        document.getElementById("pix-codigo").value = dadosPix.qr_code;
        
        document.getElementById("area-pagamento-pix").classList.remove("hidden");
        btnFinalizar.style.display = "none"; 

        // 7. A MÁGICA: Escuta o Firebase em tempo real
        // Fica observando o documento deste armário. Quando o Webhook da Vercel
        // mudar o status para 'alugado', o site reage instantaneamente.
        const unsubscribe = db.collection('armarios').doc(armarioSelecionado).onSnapshot((doc) => {
            const dadosArmario = doc.data();
            if (dadosArmario && dadosArmario.status === 'alugado') {
                alert("Pagamento confirmado com sucesso! O armário é seu.");
                unsubscribe(); // Para de escutar o banco
                
                // Fecha o modal (ajuste para o nome da sua função que esconde o modal)
                document.getElementById("modal-checkout").classList.add("hidden");
            }
        });

    } catch (erro) {
        console.error("Erro na requisição:", erro);
        alert("Erro ao conectar com o servidor de pagamento. Tente novamente.");
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = "Gerar Cobrança PIX";
    }
});
// Função para o botão "Copiar PIX"
document.getElementById("btn-copiar-pix").addEventListener("click", () => {
    const codigoCopiaCola = document.getElementById("pix-codigo");
    codigoCopiaCola.select();
    codigoCopiaCola.setSelectionRange(0, 99999); // Para dispositivos móveis
    navigator.clipboard.writeText(codigoCopiaCola.value);
    
    const btnCopiar = document.getElementById("btn-copiar-pix");
    btnCopiar.textContent = "Copiado!";
    setTimeout(() => { btnCopiar.textContent = "Copiar PIX"; }, 2000);
});