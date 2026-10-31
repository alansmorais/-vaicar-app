import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, Package, MapPin, ShieldCheck, Clock, ArrowRight, CheckCircle2, Send } from 'lucide-react';
import { deliveriesApi } from '../api/deliveries.js';

export const DeliveryInfoPage: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'courier_motorcycle' | 'courier_bicycle'>('courier_motorcycle');
  const [neighborhood, setNeighborhood] = useState('Centro');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setSuccess('');
    if (name.trim().length < 2 || phone.replace(/\\D/g, '').length < 10) {
      setError('Informe seu nome e um WhatsApp válido com DDD.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await deliveriesApi.joinWaitlist({
        name: name.trim(), phone: phone.trim(), email: email.trim() || undefined,
        role, neighborhood, notes: notes.trim() || undefined,
      });
      setSuccess(result.message || 'Seu interesse foi registrado na lista de espera VaiCar Entregas.');
      setName(''); setPhone(''); setEmail(''); setNotes('');
    } catch (e: any) {
      setError(e?.message || 'Não foi possível registrar seu interesse. Tente novamente.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="vaicar-info-page min-h-screen bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden py-14 sm:py-20 bg-white border-b border-slate-200">
        <div className="absolute inset-0">
          <img src="/images/sao-sebastiao/service-driver-road.jpg" alt="Paisagem de São Sebastião" className="w-full h-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/75" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-bold"><Bike className="w-4 h-4"/> VAICAR ENTREGAS • SÃO SEBASTIÃO</span>
          <h1 className="mt-5 max-w-3xl text-4xl sm:text-5xl font-black tracking-tight text-slate-900">Seja entregador parceiro na sua cidade.</h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-700">Conecte-se a oportunidades locais de entregas de moto e bicicleta em São Sebastião. Cadastre seu interesse e acompanhe a estruturação do serviço.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#lista-espera-entregador" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-white font-bold">Entrar na lista de espera <ArrowRight className="w-4 h-4"/></a>
            <Link to="/como-funciona/motorista" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800 font-bold">Conhecer vagas para motoristas</Link>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-5">
          <article className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm"><Bike className="w-8 h-8 text-emerald-700"/><h2 className="mt-4 font-bold text-lg">Moto ou bicicleta</h2><p className="mt-2 text-sm text-slate-600">Informe a modalidade em que deseja atuar e sua região de atendimento.</p></article>
          <article className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm"><MapPin className="w-8 h-8 text-emerald-700"/><h2 className="mt-4 font-bold text-lg">Atuação local</h2><p className="mt-2 text-sm text-slate-600">Foco nos bairros e estabelecimentos de São Sebastião e região.</p></article>
          <article className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm"><ShieldCheck className="w-8 h-8 text-emerald-700"/><h2 className="mt-4 font-bold text-lg">Cadastro de interesse</h2><p className="mt-2 text-sm text-slate-600">A equipe VaiCar poderá entrar em contato quando houver novidades sobre a operação.</p></article>
        </div>
      </section>

      <section id="lista-espera-entregador" className="py-12 sm:py-16 bg-emerald-50/60 border-y border-emerald-100">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-7"><span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Lista de espera</span><h2 className="mt-2 text-2xl sm:text-3xl font-black">Quero ser entregador VaiCar</h2><p className="mt-2 text-sm text-slate-600">Preencha seus dados para registrar seu interesse. O serviço está em fase de estruturação.</p></div>
          <form onSubmit={submit} className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-7 shadow-sm space-y-4">
            {success && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800"><CheckCircle2 className="inline w-4 h-4 mr-2"/>{success}</div>}
            {error && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{error}</div>}
            <div><label className="block text-sm font-semibold mb-1">Nome completo</label><input required value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-semibold mb-1">WhatsApp com DDD</label><input required value={phone} onChange={e=>setPhone(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" /></div>
              <div><label className="block text-sm font-semibold mb-1">E-mail (opcional)</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-semibold mb-1">Modalidade</label><select value={role} onChange={e=>setRole(e.target.value as any)} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"><option value="courier_motorcycle">Moto</option><option value="courier_bicycle">Bicicleta</option></select></div>
              <div><label className="block text-sm font-semibold mb-1">Bairro</label><input value={neighborhood} onChange={e=>setNeighborhood(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" /></div>
            </div>
            <div><label className="block text-sm font-semibold mb-1">Observações (opcional)</label><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" /></div>
            <button disabled={submitting} className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 px-5 py-3 text-white font-bold inline-flex items-center justify-center gap-2"><Send className="w-4 h-4"/>{submitting ? 'Enviando...' : 'Registrar meu interesse'}</button>
            <p className="text-xs text-slate-500 flex items-center gap-2"><Clock className="w-4 h-4"/>O cadastro registra interesse; não representa ativação imediata como entregador.</p>
          </form>
        </div>
      </section>
    </div>
  );
};

export default DeliveryInfoPage;
