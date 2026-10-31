import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Car, Wallet, Bike, Store, ShieldCheck, Smartphone, ClipboardCheck } from 'lucide-react';

const Step = ({number,title,description,icon:Icon}:{number:string;title:string;description:string;icon:React.ElementType}) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-black">{number}</span>
      <Icon className="h-6 w-6 text-emerald-700" aria-hidden="true" />
    </div>
    <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
  </article>
);

export const HowItWorksPage: React.FC = () => (
  <main className="vaicar-info-page min-h-screen bg-[#FAF9F6] text-slate-900">
    <section className="relative overflow-hidden border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8 lg:py-20">
        <div>
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800">VaiCar • São Sebastião - SP</span>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Como funciona o VaiCar</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">Mobilidade local, com etapas simples para passageiros, motoristas, entregadores e empresas da nossa cidade.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/como-funciona/passageiro" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">Sou Passageiro <ArrowRight className="h-4 w-4"/></Link>
            <Link to="/como-funciona/motorista" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-800 hover:bg-slate-50">Quero ser motorista</Link>
          </div>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-7 sm:p-9">
          <div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-emerald-700"/><h2 className="text-xl font-bold text-slate-900">Uma experiência local</h2></div>
          <p className="mt-4 text-sm leading-relaxed text-slate-700">O VaiCar conecta pessoas e serviços em São Sebastião. Consulte as opções disponíveis no aplicativo e acompanhe as orientações de cada serviço.</p>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto mb-9 max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Para quem usa o VaiCar</p>
        <h2 className="mt-3 text-3xl font-black text-slate-950">Como funciona cada serviço</h2>
        <p className="mt-3 text-slate-600">Veja o caminho de cada perfil e acesse a página com os detalhes.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Step number="01" title="Informe a partida" description="Abra a área de passageiro, informe onde você está e escolha o destino da viagem." icon={MapPin}/>
        <Step number="02" title="Consulte as opções" description="Confira as informações apresentadas no aplicativo antes de solicitar a corrida." icon={Car}/>
        <Step number="03" title="Combine e viaje" description="Siga as instruções do app para acompanhar sua solicitação e concluir a viagem." icon={Wallet}/>
      </div>
    </section>

    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
        <article className="rounded-2xl border border-slate-200 p-6">
          <Car className="h-8 w-8 text-emerald-700"/><h3 className="mt-4 text-xl font-bold">Passageiros</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Entenda como solicitar uma corrida e usar o serviço como passageiro.</p>
          <Link className="mt-5 inline-flex items-center gap-2 font-bold text-emerald-800" to="/como-funciona/passageiro">Ver como funciona <ArrowRight className="h-4 w-4"/></Link>
        </article>
        <article className="rounded-2xl border border-slate-200 p-6">
          <Bike className="h-8 w-8 text-emerald-700"/><h3 className="mt-4 text-xl font-bold">Motoristas e entregadores</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Consulte requisitos, cadastro e informações para trabalhar com a plataforma.</p>
          <div className="mt-5 flex flex-col items-start gap-2">
            <Link className="inline-flex items-center gap-2 font-bold text-emerald-800" to="/como-funciona/motorista">Motoristas <ArrowRight className="h-4 w-4"/></Link>
            <Link className="inline-flex items-center gap-2 font-bold text-emerald-800" to="/como-funciona/entregador">Entregadores <ArrowRight className="h-4 w-4"/></Link>
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 p-6">
          <Store className="h-8 w-8 text-emerald-700"/><h3 className="mt-4 text-xl font-bold">Empresas e comércio</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Conheça as possibilidades de parceria para hotéis, pousadas, restaurantes e comércio local.</p>
          <Link className="mt-5 inline-flex items-center gap-2 font-bold text-emerald-800" to="/parcerias">Conhecer parcerias <ArrowRight className="h-4 w-4"/></Link>
        </article>
      </div>
    </section>

    <section className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
      <ClipboardCheck className="mx-auto h-8 w-8 text-emerald-700"/>
      <h2 className="mt-4 text-2xl font-black text-slate-950">Pronto para começar?</h2>
      <p className="mt-2 text-slate-600">Escolha seu perfil e veja as informações específicas para usar ou participar do VaiCar.</p>
      <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white hover:bg-emerald-800">Voltar à página inicial <ArrowRight className="h-4 w-4"/></Link>
    </section>
  </main>
);
