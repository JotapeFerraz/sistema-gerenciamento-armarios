import { auth, db, API_BASE_URL } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let armarioSelecionado = null;
let operacaoSelecionada = 'reserve';
let pollPagamento = null;

async function apiFetch(path, options = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('authentication_required');
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
            Authorization: `Bearer ${token}`
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error?.message || 'Falha ao comunicar com o servidor.');
        error.status = response.status;
        error.code = data.error?.code;
        throw error;
    }
    return data;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    try {
        const [userDoc, tokenResult] = await Promise.all([
            getDoc(doc(db, "usuarios", user.uid)),
            user.getIdTokenResult()
        ]);
        if (userDoc.exists()) {
            const nome = String(userDoc.data().nome || 'Estudante').trim();
            document.getElementById("user-name").textContent = nome.split(/\s+/)[0];
        }
        if (tokenResult.claims.role === 'admin' || tokenResult.claims.admin === true) {
            document.getElementById("btn-admin").style.display = "inline-block";
        }
        await Promise.all([carregarMapaArmarios(), verificarMeuArmario()]);
    } catch (_error) {
        alert("Não foi possível carregar seus dados. Tente novamente.");
    }
});

document.getElementById("btn-admin").addEventListener("click", () => {
    window.location.href = "admin.html";
});

document.getElementById("btn-logout").addEventListener("click", async () => {
    if (pollPagamento) clearInterval(pollPagamento);
    await signOut(auth);
    window.location.href = "index.html";
});

async function carregarMapaArmarios() {
    const gridCorredor = document.getElementById("grid-corredor");
    const gridBloco4 = document.getElementById("grid-bloco4");
    gridCorredor.textContent = "Carregando armários...";
    gridBloco4.textContent = "Carregando armários...";

    try {
        const { armarios } = await apiFetch('/api/armarios');
        gridCorredor.textContent = "";
        gridBloco4.textContent = "";
        armarios.forEach((armario) => {
            const divBox = document.createElement("div");
            const livre = armario.status === 'livre';
            divBox.classList.add("locker", livre ? 'livre' : 'alugado');
            divBox.textContent = armario.numero.split('-').at(-1);
            if (livre) divBox.addEventListener("click", () => abrirModalCheckout(armario.numero, 'reserve'));
            if (armario.numero.startsWith("C-")) gridCorredor.appendChild(divBox);
            if (armario.numero.startsWith("B4-")) gridBloco4.appendChild(divBox);
        });
    } catch (_error) {
        gridCorredor.textContent = "Erro ao carregar armários.";
        gridBloco4.textContent = "Erro ao carregar armários.";
    }
}

const modal = document.getElementById("modal-checkout");
const checkboxTermo = document.getElementById("check-termo");
const btnFinalizar = document.getElementById("btn-finalizar-reserva");

function abrirModalCheckout(numero, operacao) {
    armarioSelecionado = numero;
    operacaoSelecionada = operacao;
    document.getElementById("checkout-armario-num").textContent = numero;
    checkboxTermo.checked = false;
    checkboxTermo.disabled = true;
    document.getElementById("area-pagamento-pix").classList.add("hidden");
    btnFinalizar.style.display = "block";
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = operacao === 'renew' ? "Gerar PIX de Renovação" : "Gerar Cobrança PIX";
    modal.classList.remove("hidden");
}

function fecharCheckout() {
    modal.classList.add("hidden");
    checkboxTermo.checked = false;
    checkboxTermo.disabled = true;
}

document.querySelector(".close-modal").addEventListener("click", fecharCheckout);

document.getElementById("btn-copiar-pix").addEventListener("click", async () => {
    const inputPix = document.getElementById("pix-codigo");
    try {
        await navigator.clipboard.writeText(inputPix.value);
        const button = document.getElementById("btn-copiar-pix");
        button.textContent = "Copiado!";
        setTimeout(() => { button.textContent = "Copiar PIX"; }, 2000);
    } catch (_error) {
        inputPix.select();
        alert("Selecione e copie o código PIX manualmente.");
    }
});

const modalTermo = document.getElementById("modal-termo");
document.getElementById("btn-ler-termo").addEventListener("click", () => modalTermo.classList.remove("hidden"));
document.querySelector(".close-termo").addEventListener("click", () => modalTermo.classList.add("hidden"));
document.getElementById("btn-concordar-termo").addEventListener("click", () => {
    modalTermo.classList.add("hidden");
    checkboxTermo.disabled = false;
    checkboxTermo.checked = true;
    btnFinalizar.disabled = false;
});
checkboxTermo.addEventListener("change", () => {
    btnFinalizar.disabled = !checkboxTermo.checked;
});

function iniciarAcompanhamentoPagamento(attemptId) {
    if (pollPagamento) clearInterval(pollPagamento);
    let tentativas = 0;
    pollPagamento = setInterval(async () => {
        tentativas += 1;
        try {
            const { attempt } = await apiFetch(`/api/payment-attempts/${encodeURIComponent(attemptId)}`);
            if (attempt.status === 'processed') {
                clearInterval(pollPagamento);
                pollPagamento = null;
                alert("Pagamento confirmado com sucesso!");
                fecharCheckout();
                await Promise.all([carregarMapaArmarios(), verificarMeuArmario()]);
            } else if (['paid_conflict', 'rejected_validation'].includes(attempt.status)) {
                clearInterval(pollPagamento);
                pollPagamento = null;
                alert("O pagamento exige análise da diretoria. Nenhuma reserva foi alterada automaticamente.");
            } else if (tentativas >= 180) {
                clearInterval(pollPagamento);
                pollPagamento = null;
            }
        } catch (_error) {
            if (tentativas >= 180) {
                clearInterval(pollPagamento);
                pollPagamento = null;
            }
        }
    }, 5000);
}

btnFinalizar.addEventListener("click", async () => {
    if (!checkboxTermo.checked || !armarioSelecionado) return;
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = "Gerando PIX...";

    try {
        const planoSelecionado = document.querySelector('input[name="plano-locacao"]:checked');
        const endpoint = operacaoSelecionada === 'renew' ? '/api/renovar-pix' : '/api/gerar-pix';
        const dadosPix = await apiFetch(endpoint, {
            method: 'POST',
            body: JSON.stringify({
                armarioId: armarioSelecionado,
                planId: planoSelecionado.value
            })
        });
        document.getElementById("qr-code-img").src = `data:image/png;base64,${dadosPix.qr_code_base64}`;
        document.getElementById("pix-codigo").value = dadosPix.qr_code;
        document.getElementById("area-pagamento-pix").classList.remove("hidden");
        btnFinalizar.style.display = "none";
        iniciarAcompanhamentoPagamento(dadosPix.attempt_id);
    } catch (error) {
        alert(error.message || "Erro ao gerar o pagamento. Tente novamente.");
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = operacaoSelecionada === 'renew' ? "Gerar PIX de Renovação" : "Gerar Cobrança PIX";
    }
});

async function verificarMeuArmario() {
    const { armario } = await apiFetch('/api/me/armario');
    const btnMeuArmario = document.getElementById("btn-meu-armario");
    if (!armario) {
        btnMeuArmario.style.display = "none";
        return;
    }

    const dataFim = new Date(armario.dataExpiracao);
    const dataInicio = new Date(armario.dataPagamento);
    const diffDias = Math.ceil((dataFim.getTime() - Date.now()) / (1000 * 3600 * 24));
    let statusTexto = "Ativa";
    let statusCor = "green";
    const podeRenovar = diffDias >= -15 && diffDias <= 15;
    if (diffDias < 0 && diffDias >= -15) {
        statusTexto = `Vencida (carência: ${Math.max(0, 15 + diffDias)} dias restantes)`;
        statusCor = "red";
    } else if (diffDias >= 0 && diffDias <= 15) {
        statusTexto = `Perto de vencer (faltam ${diffDias} dias)`;
        statusCor = "#b8860b";
    }

    document.getElementById("meu-armario-num").textContent = armario.numero;
    const status = document.getElementById("meu-armario-status");
    status.textContent = statusTexto;
    status.style.color = statusCor;
    status.style.fontWeight = "bold";
    document.getElementById("meu-armario-inicio").textContent = Number.isNaN(dataInicio.getTime()) ? '-' : dataInicio.toLocaleDateString('pt-BR');
    document.getElementById("meu-armario-fim").textContent = Number.isNaN(dataFim.getTime()) ? '-' : dataFim.toLocaleDateString('pt-BR');

    const btnRenovar = document.getElementById("btn-renovar-assinatura");
    btnRenovar.style.display = podeRenovar ? "block" : "none";
    btnRenovar.onclick = podeRenovar ? () => {
        document.getElementById("modal-meu-armario").classList.add("hidden");
        abrirModalCheckout(armario.numero, 'renew');
    } : null;
    btnMeuArmario.style.display = "inline-block";
    btnMeuArmario.onclick = () => document.getElementById("modal-meu-armario").classList.remove("hidden");
}

document.getElementById("fechar-meu-armario").addEventListener("click", () => {
    document.getElementById("modal-meu-armario").classList.add("hidden");
});
document.getElementById("btn-reler-termo").addEventListener("click", () => modalTermo.classList.remove("hidden"));
