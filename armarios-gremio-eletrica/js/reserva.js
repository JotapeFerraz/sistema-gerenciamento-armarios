// ==== IMPORTAÇÕES ====
import { auth, db, storage } from "./firebase.js"; // Adicionado storage
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js"; // Novas funções de Storage

// ==== VARIÁVEIS GLOBAIS ====
let armarioSelecionado = null;
let usuarioLogadoUid = null;

// ==== 1. VERIFICAÇÃO DE SEGURANÇA E DADOS DO USUÁRIO ====
onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogadoUid = user.uid; 
        
        // Busca os dados do utilizador no banco de dados
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Mostra só o primeiro nome no cabeçalho
            document.getElementById("user-name").textContent = userData.nome.split(" ")[0]; 
            
            // LÓGICA DE ADMIN: Revela o botão se for diretoria
            if (userData.isAdmin === true) {
                document.getElementById("btn-admin").style.display = "inline-block";
            }
        }
        
        // Carrega a grelha de armários
        carregarMapaArmarios();
        verificarMeuArmario(user.uid);
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

// ==== 3. DESENHAR O MAPA DE ARMÁRIOS E LIMPEZA AUTOMÁTICA ====
async function carregarMapaArmarios() {
    const gridCorredor = document.getElementById("grid-corredor");
    const gridBloco4 = document.getElementById("grid-bloco4");
    
    gridCorredor.innerHTML = "<p>Carregando armários...</p>";
    gridBloco4.innerHTML = "<p>Carregando armários...</p>";

    const querySnapshot = await getDocs(collection(db, "armarios"));
    const armarios = [];
    const hoje = new Date();

    for (const documento of querySnapshot.docs) {
        let armario = documento.data();

        // MÁGICA: Se estiver alugado, verifica se já passou da carência
        if (armario.status === 'alugado' && armario.dataExpiracao) {
            const vencimento = new Date(armario.dataExpiracao);
            const diasAtraso = Math.ceil((hoje.getTime() - vencimento.getTime()) / (1000 * 3600 * 24));
            
            // Se atrasou mais de 15 dias, liberta o armário na base de dados silenciosamente
            if (diasAtraso > 15) {
                await updateDoc(doc(db, "armarios", armario.numero), {
                    status: 'livre',
                    locatarioUid: null,
                    dataExpiracao: null,
                    dataPagamento: null,
                    pagamentoConfirmado: false
                });
                armario.status = 'livre'; // Atualiza localmente para o botão ficar verde já nesta tela
            }
        }
        armarios.push(armario);
    }

    armarios.sort((a, b) => a.numero.localeCompare(b.numero));
    gridCorredor.innerHTML = "";
    gridBloco4.innerHTML = "";

    armarios.forEach(armario => {
        const divBox = document.createElement("div");
        divBox.classList.add("locker", armario.status); 
        divBox.textContent = armario.numero.split('-')[1];
        
        if (armario.status === "livre") {
            divBox.addEventListener("click", () => abrirModalCheckout(armario.numero));
        }

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
    
    // Reseta o checkbox do termo de compromisso
    const checkboxTermo = document.getElementById("check-termo");
    checkboxTermo.checked = false;
    checkboxTermo.disabled = true;

    // Reseta a área de pagamento (esconde o QR code e restaura o botão original)
    document.getElementById("area-pagamento-pix").classList.add("hidden");
    const btnFinalizar = document.getElementById("btn-finalizar-reserva");
    btnFinalizar.style.display = "block";
    btnFinalizar.disabled = false;
    btnFinalizar.textContent = "Gerar Cobrança PIX";
    
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
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = "Gerando PIX...";

    // Usando a variável 'auth' que já foi importada no topo do seu arquivo
    const user = auth.currentUser; 
    
    if (!user) {
        alert("Erro: Você precisa estar logado.");
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = "Gerar Cobrança PIX";
        return;
    }

    try {
        // Usando as funções modulares 'getDoc' e 'doc' com a variável 'db'
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        const userData = userDoc.data();
        
        if (!userData || !userData.cpf) {
            alert("Erro: CPF não encontrado no seu cadastro.");
            btnFinalizar.disabled = false;
            btnFinalizar.textContent = "Gerar Cobrança PIX";
            return;
        }

        const planoSelecionado = document.querySelector('input[name="plano-locacao"]:checked');
        const valorPlano = Number(planoSelecionado.value);
        const mesesLocacao = Number(planoSelecionado.getAttribute('data-meses'));

        const payload = {
            armario: armarioSelecionado,
            usuarioUid: user.uid,
            email: user.email,
            nome: userData.nome,
            cpf: userData.cpf,
            valor: valorPlano,
            meses: mesesLocacao
        };

        const resposta = await fetch('https://backend-g3e.vercel.app/api/gerar-pix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const dadosPix = await resposta.json();

        if (dadosPix.error) {
            throw new Error(dadosPix.error);
        }

        document.getElementById("qr-code-img").src = `data:image/jpeg;base64,${dadosPix.qr_code_base64}`;
        document.getElementById("pix-codigo").value = dadosPix.qr_code;
        
        document.getElementById("area-pagamento-pix").classList.remove("hidden");
        btnFinalizar.style.display = "none"; 

        // A MÁGICA: Escutador em tempo real usando sintaxe modular
        const unsubscribe = onSnapshot(doc(db, 'armarios', armarioSelecionado), (documento) => {
            const dadosArmario = documento.data();
            if (dadosArmario && dadosArmario.status === 'alugado') {
                alert("Pagamento confirmado com sucesso! O armário é seu.");
                unsubscribe(); 
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
// ==== 7. PAINEL DO ALUNO: MEU ARMÁRIO ====
async function verificarMeuArmario(uid) {
    const q = query(collection(db, "armarios"), where("locatarioUid", "==", uid), where("status", "==", "alugado"));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
        const dados = snapshot.docs[0].data();
        const dataFim = new Date(dados.dataExpiracao);
        const hoje = new Date();
        
        // Calcula a diferença em dias
        const diffDias = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 3600 * 24));
        
        let statusTexto = "Ativa";
        let statusCor = "green";
        
        if (diffDias < 0 && diffDias >= -15) {
            statusTexto = `Vencida (Carência: faltam ${15 + diffDias} dias para perder a vaga)`;
            statusCor = "red";
        } else if (diffDias >= 0 && diffDias <= 15) {
            statusTexto = `Perto de vencer (faltam ${diffDias} dias)`;
            statusCor = "#b8860b"; // amarelo escuro
        }
        
        // Preenche o Modal
        document.getElementById("meu-armario-num").textContent = dados.numero;
        const elStatus = document.getElementById("meu-armario-status");
        elStatus.textContent = statusTexto;
        elStatus.style.color = statusCor;
        elStatus.style.fontWeight = "bold";
        
        document.getElementById("meu-armario-inicio").textContent = new Date(dados.dataPagamento).toLocaleDateString('pt-BR');
        document.getElementById("meu-armario-fim").textContent = dataFim.toLocaleDateString('pt-BR');
        
        // Exibe o botão no cabeçalho e configura os cliques
        const btnMeuArmario = document.getElementById("btn-meu-armario");
        btnMeuArmario.style.display = "inline-block";
        
        btnMeuArmario.addEventListener("click", () => {
            document.getElementById("modal-meu-armario").classList.remove("hidden");
        });
    }
}

// Fechar modal do Meu Armário
document.getElementById("fechar-meu-armario").addEventListener("click", () => {
    document.getElementById("modal-meu-armario").classList.add("hidden");
});

// Botão para reler o termo
document.getElementById("btn-reler-termo").addEventListener("click", () => {
    document.getElementById("modal-termo").classList.remove("hidden");
});