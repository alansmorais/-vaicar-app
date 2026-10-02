# VaiCar — Plataforma Web Oficial (São Sebastião & Litoral Norte SP)

> **Marketplace de mobilidade urbana 100% regional** conectando passageiros e motoristas parceiros com taxa zero sobre corridas em São Sebastião, Ilhabela e Litoral Norte de São Paulo.

[![Status](https://img.shields.io/badge/Status-Online%20no%20Cloud%20Run-success?style=for-the-badge&logo=googlecloud)](https://vaicar-app-770203144889.southamerica-east1.run.app)
[![Acessar](https://img.shields.io/badge/Acessar%20Plataforma-vaicar--app-blue?style=for-the-badge&logo=googlechrome)](https://vaicar-app-770203144889.southamerica-east1.run.app)

🔗 **Link Oficial no Ar:** [https://vaicar-app-770203144889.southamerica-east1.run.app](https://vaicar-app-770203144889.southamerica-east1.run.app)

---

## 🚀 Visão Geral do Produto

O VaiCar foi concebido e implementado do zero como uma plataforma web de alta confiabilidade, segura e em tempo real. O sistema conta com três módulos operacionais independentes:

1. **Passageiro (`/passenger`):**
   - Solicitação de viagens com cálculo de tarifa em tempo real (São Sebastião / Litoral Norte).
   - Geolocalização de partida e destino (busca rápida ou seleção de praias e pontos turísticos).
   - Acompanhamento do motorista no mapa com radar visual e tempo estimado.
   - Cronômetro visual da tolerância de embarque (4 minutos de cortesia regulamentar).
   - Emissão de recibo digital detalhado e avaliação por estrelas (1 a 5).

2. **Motorista Parceiro (`/driver`):**
   - Cadastro detalhado com validação estrita (CPF com dígitos verificadores, CNH com 11 dígitos, dados do veículo e CRLV).
   - **Gating de Segurança:** Bloqueio mandatório contra ficar online antes de aprovação documental pela administração.
   - Painel de disponibilidade com botão *Online / Offline*.
   - Máquina de estados de viagem: `REQUESTED` ➔ `DRIVER_ARRIVING` ➔ `ARRIVED` (com contador de 4 minutos) ➔ `IN_PROGRESS` ➔ `COMPLETED`.
   - Transparência total com **0% de comissão** sobre o valor da corrida.

3. **Painel Administrativo (`/admin`):**
   - Central de controle com métricas de negócios em tempo real (Total de Corridas, Concluídas, Motoristas Online, Pendentes de Análise, Passageiros, Volume Bruto R$).
   - Gestão de motoristas: Aprovar, Recusar (com justificativa) ou Suspender contas.
   - Gestão de passageiros e histórico auditável de corridas.
   - Simulador e configurador da tabela de tarifas oficial (Tarifa Base, Km, Minuto, Tarifa Mínima).
   - Central de auditoria de e-mails transacionais (boas-vindas, aprovação, recibos).

---

## 🛠️ Arquitetura Técnica

```
├── shared/                 # Contratos e tipos compartilhados
│   ├── src/tokens.ts       # Design tokens, cores oficiais (#16A34A) e municípios
│   ├── src/types.ts        # Interfaces de domínio (User, Driver, Ride, Receipt)
│   ├── src/errors.ts       # Códigos de erro padronizados (AppError)
│   └── src/validation.ts   # Validadores puros (CPF, CNH, WhatsApp DDD, Placa Mercosul)
├── api/                    # Backend Node.js / Express / TypeScript (/api/v1/*)
│   ├── src/config/         # Carregamento de variáveis de ambiente
│   ├── src/middleware/     # Request ID, autenticação de sessão, autorização por papel
│   ├── src/services/       # Firebase Admin, Firestore, Local Memory Fallback, Nodemailer
│   └── src/routes/         # Rotas de Auth, Passageiros, Motoristas, Corridas, Admin, Recibos
├── web/                    # Frontend React 19 / TypeScript / Vite / Tailwind CSS
│   ├── src/components/     # Navbar, Footer, MapDisplay, WaitingTimer, ReceiptModal
│   ├── src/context/        # AuthContext com persistência e sincronização de perfis
│   ├── src/api/            # Camada de clientes tipados para consumo de /api/v1/*
│   └── src/pages/          # Páginas de Passageiro, Motorista, Administrador e Home
└── tests/                  # Suítes de testes automatizados
    ├── api.test.ts         # 21 testes unitários e de integração (Vitest)
    └── browser-test.ts     # 8 fluxos end-to-end reais no Google Chrome (Puppeteer)
```

---

## 🧪 Suíte de Testes Automatizados

### 1. Testes de API & Regras de Negócio (Vitest)
Executa 21 testes unitários e de integração cobrindo validação de CPF/CNH, bloqueio de motoristas não aprovados, cálculo de tarifas e máquina de estados:
```bash
npm test
```
*Resultado: 21 testes aprovados (100%).*

### 2. Testes de Navegador Real E2E (Google Chrome + Puppeteer)
Abre o Chrome real em modo headless e executa ponta a ponta todas as interações humanas com captura de telas em `tests/screenshots/`:
```bash
npm run test:browser
```
Cobre os 8 cenários obrigatórios:
1. `01 - Homepage`: Carregamento da marca e rotas.
2. `02 - Admin Login & KPI`: Autenticação e visualização de métricas e tabelas.
3. `03 - Passenger Register`: Validação de campos e formatos.
4. `04 - Passenger Dashboard`: Seleção de destinos e simulação de tarifas.
5. `05 - Driver Register`: Validação documental e formulário completo.
6. `06 - Driver Online`: Ativação do status online de motorista aprovado.
7. `07 - End-to-End Ride`: Solicitação ➔ Aceite ➔ Chegada com cronômetro de 4 minutos ➔ Início ➔ Conclusão com Recibo e Avaliação 5 estrelas.
8. `08 - Admin Sync`: Verificação em tempo real da corrida concluída no painel administrativo.

---

## 📦 Como Executar Localmente

### 1. Instalação de Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o modelo `.env.example` para `.env`:
```bash
cp .env.example .env
```

### 3. Build da Aplicação
```bash
npm run build
```

### 4. Iniciar o Servidor Completo
```bash
npm start
```
Acesse `http://localhost:5001`.
