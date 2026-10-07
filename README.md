Sistema de Gestão de Armários - G3E

O Sistema de Gestão de Armários foi desenvolvido para automatizar e modernizar o aluguel de escaninhos físicos do Grêmio dos Estudantes de Engenharia Elétrica da UFMG (G3E). A plataforma elimina processos manuais, permitindo que os estudantes visualizem a disponibilidade, reservem e paguem pelos seus armários de forma 100% digital e segura.

- Principais Funcionalidades
  - Autenticação Segura: Login integrado e protegido via contas Google.

  - Mapa Interativo em Tempo Real: Interface visual que indica o status de cada armário (Livre, Pendente ou Ocupado) de acordo com o corredor ou bloco.

  - Checkout Automatizado via PIX: Integração direta com a API do Mercado Pago, gerando QR Code dinâmico e código "Copia e Cola" para pagamento instantâneo.

  - Baixa Automática (Webhooks): Assim que o banco aprova o PIX, o back-end recebe a notificação, atualiza o status do armário no banco de dados e consolida a posse do aluno sem intervenção humana.

  - Painel Administrativo: Área restrita para a diretoria gerenciar ocupações, visualizar métricas de uso e resolver pendências. Acesso blindado por Custom Claims atribuídos diretamente no servidor, impedindo manipulações no front-end.

- Stack Tecnológica: 
O projeto adota uma arquitetura modular, dividida entre uma interface leve e um servidor robusto estruturado em serverless functions.

  - Front-end (Interface)

  - HTML5, CSS3 & Vanilla JavaScript: Construção estática e performática sem dependência de frameworks pesados.

  - Hospedagem: Vercel (com políticas estritas de Content Security Policy (CSP) via vercel.json).

  - Back-end (Servidor & API)

  - Node.js: Lógica de negócios e rotas de API hospedadas na Vercel.

  - Firebase Firestore: Banco de dados NoSQL em nuvem com regras de segurança rigorosas (firestore.rules) para proteger dados sensíveis e impedir leitura/escrita não autorizada.

  - Firebase Authentication (v11.11.1): Gestão de utilizadores e emissão de tokens de sessão.

  - API Mercado Pago: Geração de transações financeiras e escuta ativa de pagamentos via Webhooks.

- Arquitetura e Fluxo de Dados

O aluno entra na plataforma web e autentica-se.

O front-end consulta o Firestore para renderizar o estado atual de todos os armários.

Ao selecionar um armário, o pedido é processado pelo back-end, que cria uma reserva temporária e solicita um pagamento à API do Mercado Pago.

O utilizador realiza o pagamento via PIX.

O Mercado Pago dispara um Webhook imediato para o back-end confirmando o recebimento.

O sistema valida a assinatura de segurança da transação, cruza a informação com o banco de dados e altera definitivamente o status do armário para "Ocupado", vinculando-o ao estudante.

- Segurança e Configuração Local

Para replicar o ambiente ou realizar manutenções, o sistema exige a configuração obrigatória de variáveis de ambiente (.env) e políticas de CORS que limitam o acesso à API exclusivamente ao domínio do front-end.

  - Variáveis Necessárias (Vercel):

      - Credenciais Firebase: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

      - Integração Mercado Pago: MERCADO_PAGO_ACCESS_TOKEN, MERCADO_PAGO_WEBHOOK_SECRET

      - Segurança de API: FRONTEND_ORIGINS

      - (Opcional) Notificações: EMAIL_USER, EMAIL_PASS, CRON_SECRET

Desenvolvido por João Pedro Ferraz para o ecossistema da Engenharia Elétrica da UFMG.
