import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  UtensilsCrossed,
  Hotel,
  Bike,
  Megaphone,
  CheckCircle2,
  ArrowRight,
  Send,
  MessageCircle,
  AlertCircle,
  Clock,
  MapPin,
  Percent,
} from 'lucide-react';
import { deliveriesApi } from '../api/deliveries.js';
import { isValidEmail, isValidWhatsApp } from '../../../shared/src/validation.js';

export const BusinessPartnershipsPage: React.FC = () => {
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [neighborhood, setNeighborhood] = useState('Centro');
  const [businessType, setBusinessType] = useState('Restaurante / Bar / Gastronomia');
  const [primaryInterest, setPrimaryInterest] = useState('Entregas Rápidas de Moto/Bike');
  const [notes, setNotes] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{ id?: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessData(null);

    if (!businessName.trim() || businessName.trim().length < 2) {
      setError('Por favor, informe o nome do seu estabelecimento ou empresa.');
      return;
    }

    if (!contactName.trim() || contactName.trim().length < 2) {
      setError('Por favor, informe o nome do responsável pelo contato.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Por favor, informe um WhatsApp ou telefone válido com DDD (mínimo 10 dígitos).');
      return;
    }

    if (email.trim() && !isValidEmail(email.trim())) {
      setError('O e-mail informado não é válido. Verifique e tente novamente.');
      return;
    }

    if (!consentAccepted) {
      setError('É necessário concordar em receber o contato da equipe VaiCar para prosseguir.');
      return;
    }

    setSubmitting(true);

    try {
      const combinedNotes = [
        `Responsável: ${contactName.trim()}`,
        `Tipo de Negócio: ${businessType}`,
        `Interesse Principal: ${primaryInterest}`,
        notes.trim() ? `Observações: ${notes.trim()}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const res = await deliveriesApi.joinWaitlist({
        name: `${businessName.trim()} (${contactName.trim()})`,
        phone: phone.trim(),
        email: email.trim().toLowerCase() || undefined,
        role: 'merchant',
        neighborhood,
        vehicleDetails: businessType,
        notes: combinedNotes,
      });

      setSuccessData({
        id: res.data?.id,
        message:
          res.message ||
          'Proposta de parceria registrada com sucesso! Nossa equipe entrará em contato em breve.',
      });

      // Reset form
      setBusinessName('');
      setContactName('');
      setPhone('');
      setEmail('');
      setNotes('');
      setConsentAccepted(false);
    } catch (err: any) {
      console.error('Erro ao enviar cadastro de parceria:', err);
      setError(
        err.message ||
          'Falha ao registrar interesse no momento. Tente novamente ou entre em contato pelo WhatsApp.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Centralized sub-header notification */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 py-2.5 px-4 text-center">
        <p className="text-xs sm:text-sm font-medium text-slate-300 max-w-4xl mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
          <span>
            Parcerias comerciais em São Sebastião: <strong className="text-emerald-400">Atendimento local direto</strong> • Sem taxas predatórias
          </span>
        </p>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:py-20 border-b border-slate-900 bg-slate-950">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/sao-sebastiao/centro-historico.jpg"
            alt="Centro Histórico e comércio de São Sebastião"
            className="w-full h-full object-cover object-center opacity-20 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/80" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold backdrop-blur-sm">
              <Store className="w-3.5 h-3.5" />
              <span>VaiCar Empresas & Negócios Locais</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Logística e Visibilidade para o <span className="text-emerald-400">Comércio Caiçara</span>.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Conectamos restaurantes, pousadas, quiosques e comércios de São Sebastião a uma rede de condutores e entregadores parceiros locais. Economia transparente, sem repasses abusivos de 25% a 30% para multinacionais distantes.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#formulario-parceria"
                className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/60 transition-all flex items-center gap-2"
              >
                <span>Cadastrar Estabelecimento</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="https://chat.whatsapp.com/IkPEGc6SjNE8f1NIOHUCV3"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Conversar no WhatsApp</span>
              </a>
            </div>

            {/* Quick stats pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 max-w-xl">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="block text-lg font-black text-emerald-400">0%</span>
                <span className="text-[11px] text-slate-400">Cobrança antecipada</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="block text-lg font-black text-emerald-400">100%</span>
                <span className="text-[11px] text-slate-400">Foco em São Sebastião</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 col-span-2 sm:col-span-1">
                <span className="block text-lg font-black text-emerald-400">Moto & Bike</span>
                <span className="text-[11px] text-slate-400">Modalidades integradas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Commercial Offerings Cards */}
      <section className="py-16 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30">
              Oportunidades Reais
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Como o VaiCar apoia seu negócio no Litoral Norte
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Soluções pensadas para a realidade geográfica e sazonal de São Sebastião.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1: Delivery para Restaurantes */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 hover:border-emerald-500/50 transition-all shadow-xl">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-500/30">
                    Restaurantes & Gastronomia
                  </span>
                  <h3 className="text-lg font-bold text-white">Entregas de Moto e Bike</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Livre-se das comissões escorchantes dos aplicativos tradicionais. Estamos estruturando uma lista de espera de entregadores locais verificados para atender pizzarias, hamburguerias, marmitarias e farmácias com rapidez na SP-055 e bairros planos.
                </p>
                <ul className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Entregadores locais com checagem de antecedentes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Atendimento prioritário na Costa Sul e Centro</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Contato direto e flexibilidade na operação</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Fase de estruturação e lista de espera
                </span>
              </div>
            </div>

            {/* Pillar 2: Pousadas e Hotéis */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 hover:border-emerald-500/50 transition-all shadow-xl">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Hotel className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    Pousadas & Hospedagem
                  </span>
                  <h3 className="text-lg font-bold text-white">Mobilidade para seus Hóspedes</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ofereça transporte seguro aos seus hóspedes na chegada da balsa, rodoviária ou passeios noturnos. Pousadas parceiras recebem códigos promocionais com R$ 5 de desconto na primeira corrida para novos hóspedes.
                </p>
                <ul className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Código de indicação personalizado para hóspedes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Corridas de carro ativas em toda a cidade</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Material informativo digital para recepção</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Disponível imediatamente
                </span>
              </div>
            </div>

            {/* Pillar 3: Publicidade e Comércio Local */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 hover:border-emerald-500/50 transition-all shadow-xl">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-950/80 border border-sky-500/40 flex items-center justify-center text-sky-400">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-500/30">
                    Comércio & Serviços
                  </span>
                  <h3 className="text-lg font-bold text-white">Divulgação & Pontos de Interesse</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Posicione sua loja, quiosque, escola de surf ou marina como destino recomendado no ecossistema VaiCar. Conecte-se com quem busca atrativos gastronômicos e turísticos autênticos em São Sebastião.
                </p>
                <ul className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Inclusão no simulador de destinos e rotas populares</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Acesso a passageiros e turistas em circulação</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Projetos comerciais sob medida para alta temporada</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <span className="text-[11px] font-medium text-sky-400 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5" /> Alinhamento personalizado
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LEAD CAPTURE FORM SECTION */}
      <section id="formulario-parceria" className="py-16 bg-slate-900/60 border-b border-slate-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="text-center max-w-xl mx-auto space-y-2 mb-8">
              <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Formulário de Cadastro
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Cadastre seu Estabelecimento
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Preencha os dados abaixo. Nossa equipe entrará em contato via WhatsApp para apresentar as opções e integrar sua empresa.
              </p>
            </div>

            {successData && (
              <div className="p-4 mb-6 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs sm:text-sm space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-white">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{successData.message}</span>
                </div>
                {successData.id && (
                  <p className="text-[11px] text-emerald-300 font-mono">
                    Protocolo de registro: {successData.id}
                  </p>
                )}
                <p className="text-[11px] text-slate-300 pt-1">
                  Salvamos suas preferências. Um representante da VaiCar entrará em contato pelo WhatsApp informado.
                </p>
              </div>
            )}

            {error && (
              <div className="p-4 mb-6 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nome do Estabelecimento */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome do Estabelecimento / Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Ex: Pizzaria Ilha Bela, Pousada Maresias"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Nome do Responsável */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome do Responsável / Contato *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ex: Carlos Silva (Gerente)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* WhatsApp com DDD */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    WhatsApp Comercial com DDD *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(12) 99999-9999"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* E-mail de Contato */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    E-mail Corporativo (Opcional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@seuestabelecimento.com.br"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bairro em São Sebastião */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Bairro / Região em São Sebastião *
                  </label>
                  <select
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Centro">Centro Histórico & Porto Grande</option>
                    <option value="Maresias">Praia de Maresias</option>
                    <option value="Juquehy">Praia de Juquehy</option>
                    <option value="Boiçucanga">Praia de Boiçucanga</option>
                    <option value="Camburi">Camburi & Camburizinho</option>
                    <option value="Barra do Sahy">Barra do Sahy & Baleia</option>
                    <option value="Toque-Toque">Toque-Toque (Grande / Pequeno)</option>
                    <option value="Paúba">Paúba & Santiago</option>
                    <option value="Boracéia">Praia de Boracéia</option>
                    <option value="São Francisco">São Francisco / Balsa</option>
                    <option value="Enseada">Enseada & Canto do Mar</option>
                    <option value="Outro">Outro bairro de São Sebastião</option>
                  </select>
                </div>

                {/* Tipo de Estabelecimento */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Ramo de Atuação *
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Restaurante / Bar / Gastronomia">Restaurante / Bar / Gastronomia</option>
                    <option value="Pizzaria / Hamburgueria / Delivery">Pizzaria / Hamburgueria / Delivery</option>
                    <option value="Pousada / Hotel / Hostel">Pousada / Hotel / Hostel</option>
                    <option value="Imobiliária / Aluguel Temporada">Imobiliária / Aluguel Temporada</option>
                    <option value="Farmácia / Drogaria">Farmácia / Drogaria</option>
                    <option value="Comércio Varejista / Loja">Comércio Varejista / Loja</option>
                    <option value="Serviços Turísticos / Passeios">Serviços Turísticos / Passeios</option>
                    <option value="Outro">Outro Ramo</option>
                  </select>
                </div>
              </div>

              {/* Interesse Principal */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Principal Interesse de Parceria *
                </label>
                <select
                  value={primaryInterest}
                  onChange={(e) => setPrimaryInterest(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Entregas Rápidas de Moto/Bike">
                    Entregas Rápidas de Moto/Bike (Lista de Espera)
                  </option>
                  <option value="Parceria de Mobilidade para Hóspedes/Clientes">
                    Parceria de Mobilidade para Hóspedes/Clientes (Código de Desconto)
                  </option>
                  <option value="Divulgação & Publicidade Local">
                    Divulgação & Publicidade Local no App
                  </option>
                  <option value="Todas as Soluções Acima">Todas as Soluções Acima</option>
                </select>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mensagem ou Observações (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Conte um pouco sobre sua demanda: volume de entregas estimado, horários de pico, ou parcerias desejadas..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Consentimento */}
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-800 text-emerald-600 focus:ring-emerald-500 bg-slate-950"
                />
                <label htmlFor="consent" className="text-[11px] text-slate-400 cursor-pointer leading-tight">
                  Autorizo o contato da equipe VaiCar pelo WhatsApp ou e-mail para apresentação de propostas comerciais e operacionais de acordo com a{' '}
                  <Link to="/privacy" target="_blank" className="text-emerald-400 underline hover:text-emerald-300">
                    Política de Privacidade
                  </Link>.
                </label>
              </div>

              {/* Submit CTA */}
              <div className="pt-2 text-center sm:text-right">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
                >
                  {submitting ? (
                    'Enviando Proposta...'
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Enviar Cadastro de Parceria
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500">
              🔒 <strong>Transparência Garantida:</strong> O envio desta manifestação de interesse não gera cobrança, mensalidade ou ativação contratual automática.
            </div>
          </div>
        </div>
      </section>

      {/* Community & FAQ Link */}
      <section className="py-12 bg-slate-950 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <h3 className="text-lg font-bold text-white">Dúvidas sobre o funcionamento das parcerias?</h3>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            Nossa equipe técnica e comercial está disponível para esclarecer como integramos estabelecimentos em São Sebastião.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/terms"
              className="text-xs text-emerald-400 hover:underline px-3 py-1.5 rounded-lg border border-emerald-500/20"
            >
              Termos de Uso & Legislação →
            </Link>
            <Link
              to="/#faq"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
            >
              Ver Perguntas Frequentes →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
