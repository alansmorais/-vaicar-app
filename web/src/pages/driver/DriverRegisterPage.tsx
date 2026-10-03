import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { authApi } from '../../api/auth.js';
import { storageApi } from '../../api/storage.js';
import { processImageFile } from '../../utils/imageUtils.js';
import { zones } from '../../../../shared/src/tokens.js';
import {
  isValidEmail,
  isValidWhatsApp,
  isValidCPF,
  isValidCNH,
  isValidPlate,
  isAdult,
} from '../../../../shared/src/validation.js';
import {
  Car,
  Bike,
  Package,
  User,
  Phone,
  Mail,
  Camera,
  Shield,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  MapPin,
} from 'lucide-react';

export const DriverRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { registerEmailPassword, devLogin } = useAuth();

  // Activity Mode & Vehicle Type
  const [activityMode, setActivityMode] = useState<'driver' | 'delivery'>('driver');
  const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle' | 'van' | 'bicycle'>('car');

  // Partnership Subscription Plan
  const [subscriptionPlan, setSubscriptionPlan] = useState<'monthly_100' | 'weekly_percent_10'>('monthly_100');

  // Personal
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');

  // Contact
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Photo
  const [photoData, setPhotoData] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string>('');

  // Professional
  const [professionalCategory, setProfessionalCategory] = useState('Motorista com EAR / Autônomo');
  const [cnhNumber, setCnhNumber] = useState('');

  // Criminal Record (Obligatory)
  const [criminalRecordData, setCriminalRecordData] = useState<string>('');
  const [criminalRecordFileName, setCriminalRecordFileName] = useState<string>('');

  // Vehicle
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('2022');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');

  // Operating Zones
  const [selectedZones, setSelectedZones] = useState<string[]>([
    'Centro & Porto Grande',
    'Maresias & Paúba',
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSelectActivity = (mode: 'driver' | 'delivery', vType?: 'car' | 'motorcycle' | 'van' | 'bicycle') => {
    setActivityMode(mode);
    const targetType = vType || (mode === 'delivery' ? 'motorcycle' : 'car');
    setVehicleType(targetType);
    if (targetType === 'bicycle') {
      setProfessionalCategory('Entregador / Ciclista (Bike e Encomendas)');
      if (!brand || brand === 'Chevrolet' || brand === 'Honda') setBrand('Caloi');
      if (!model || model === 'Onix' || model === 'CG 160 Fan') setModel('Aro 29');
      setPlate('BIKE');
    } else if (targetType === 'motorcycle') {
      setProfessionalCategory('Entregador / Motoboy (Delivery e Encomendas)');
      if (!brand || brand === 'Chevrolet' || brand === 'Caloi') setBrand('Honda');
      if (!model || model === 'Onix' || model === 'Aro 29') setModel('CG 160 Fan');
      if (plate === 'BIKE') setPlate('');
    } else {
      setProfessionalCategory('Motorista com EAR / Autônomo');
      if (brand === 'Honda' || brand === 'Caloi') setBrand('');
      if (model === 'CG 160 Fan' || model === 'Aro 29') setModel('');
      if (plate === 'BIKE') setPlate('');
    }
  };

  const toggleZone = (zone: string) => {
    setSelectedZones((prev) =>
      prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const normalizedDataUrl = await processImageFile(file);
      setPhotoData(normalizedDataUrl);
      setPhotoPreview(normalizedDataUrl);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar foto. Selecione JPG, PNG ou WebP.');
    }
  };

  const handleCriminalRecordUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const normalized = await processImageFile(file);
      setCriminalRecordData(normalized);
      setCriminalRecordFileName(file.name);
    } catch (err: any) {
      setError(err?.message || 'Falha ao processar arquivo de antecedentes criminais.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim() || name.trim().length < 3) {
      setError('Informe seu nome completo.');
      return;
    }
    if (!cpf || !isValidCPF(cpf)) {
      setError('Informe um CPF válido com 11 dígitos.');
      return;
    }
    if (!birthDate || !isAdult(birthDate)) {
      setError('Data de nascimento inválida. O motorista parceiro deve ser maior de 18 anos.');
      return;
    }
    if (!whatsapp || !isValidWhatsApp(whatsapp)) {
      setError('Informe um WhatsApp ou telefone internacional válido (ex: +55 12 99123-4567 ou +1 415 555-0199).');
      return;
    }
    if (!email || !isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (!password || password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (!photoData) {
      setError('Sua foto de identificação/selfie é obrigatória.');
      return;
    }
    const isBicycle = vehicleType === 'bicycle';
    if (!isBicycle) {
      if (!cnhNumber || !isValidCNH(cnhNumber)) {
        setError('Informe o número da CNH com 11 dígitos.');
        return;
      }
      if (!isValidPlate(plate)) {
        setError('Informe uma placa de veículo válida (Mercosul ou Tradicional).');
        return;
      }
    }
    if (!brand.trim() || !model.trim() || !color.trim()) {
      setError('Preencha os dados do veículo/bicicleta.');
      return;
    }
    if (!criminalRecordData) {
      setError('O Atestado de Antecedentes Criminais é obrigatório para cadastro de parceiro.');
      return;
    }
    if (selectedZones.length === 0) {
      setError('Selecione ao menos uma região de atuação em São Sebastião.');
      return;
    }

    setLoading(true);

    try {
      // 1. Create Firebase Auth user
      const fbUser = await registerEmailPassword(email.trim(), password);

      // 2. Upload photo
      let finalPhotoUrl = photoData;
      try {
        const uploadRes = await storageApi.uploadImage(photoData, 'drivers', fbUser.uid);
        finalPhotoUrl = uploadRes.url;
      } catch (uploadErr) {
        console.warn('Storage upload note:', uploadErr);
      }

      // 3. Upload criminal record
      let finalCriminalUrl = criminalRecordData;
      if (criminalRecordData) {
        try {
          const uploadRec = await storageApi.uploadImage(criminalRecordData, 'drivers', `${fbUser.uid}_antecedentes`);
          finalCriminalUrl = uploadRec.url;
        } catch (uploadErr) {
          console.warn('Criminal record upload note:', uploadErr);
        }
      }

      // 4. Register Driver in backend
      await authApi.registerDriver({
        uid: fbUser.uid,
        name: name.trim(),
        cpf: cpf.trim(),
        birthDate,
        whatsapp: whatsapp.trim(),
        email: email.trim().toLowerCase(),
        photoUrl: finalPhotoUrl,
        professionalCategory,
        cnhNumber: isBicycle ? (cnhNumber || 'ISENTO_BIKE') : cnhNumber.trim(),
        criminalRecordUrl: finalCriminalUrl,
        subscriptionPlan,
        vehicle: {
          type: vehicleType,
          brand: brand.trim(),
          model: model.trim(),
          year: parseInt(year, 10) || 2023,
          color: color.trim(),
          plate: isBicycle ? 'BIKE' : plate.trim().toUpperCase(),
        },
        operatingZones: selectedZones,
      });

      // 5. Set session
      await devLogin(fbUser.uid, email.trim(), 'driver', name.trim());

      setSuccess('Cadastro enviado com sucesso! Seus dados estão em análise pela equipe administrativa.');
      setTimeout(() => {
        navigate('/driver');
      }, 1500);
    } catch (err: any) {
      console.error('Driver register error:', err);
      const msg = err.message || '';
      if (msg.includes('identitytoolkit') || msg.includes('are-blocked')) {
        setError('Serviço de autenticação temporariamente indisponível. Tente novamente.');
      } else {
        setError(msg || 'Falha ao realizar cadastro de motorista.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block">
            <img src="/vaicar_logo.png" alt="VaiCar" className="h-10 mx-auto rounded object-contain" />
          </Link>
          <h2 className="text-2xl font-black text-white">
            {vehicleType === 'bicycle'
              ? 'Cadastro de Entregador (Bike / Ciclista)'
              : activityMode === 'delivery'
              ? 'Cadastro de Entregador / Motoboy (Moto)'
              : 'Cadastro de Motorista Parceiro (Carro / Van)'}
          </h2>
          <p className="text-xs text-slate-400">
            Trabalhe com autonomia em São Sebastião. Pagamento 100% direto entre passageiro/cliente e você.
          </p>
        </div>

        {/* Modalidade: Carro, Moto ou Bike */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => handleSelectActivity('driver', 'car')}
            className={`py-2.5 px-2 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 font-bold text-xs transition-all ${
              activityMode === 'driver' && vehicleType !== 'bicycle'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Motorista (Carro)</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectActivity('delivery', 'motorcycle')}
            className={`py-2.5 px-2 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 font-bold text-xs transition-all ${
              activityMode === 'delivery' && vehicleType === 'motorcycle'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>Entregador (Moto)</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectActivity('delivery', 'bicycle')}
            className={`py-2.5 px-2 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 font-bold text-xs transition-all ${
              vehicleType === 'bicycle'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>Entregador (Bike)</span>
          </button>
        </div>

        {/* Escolha do Plano de Parceria */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
              Escolha seu Modelo de Parceria
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Você escolhe como pagar</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSubscriptionPlan('monthly_100')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                subscriptionPlan === 'monthly_100'
                  ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold text-sm text-white">Mensalidade Fixa</span>
                <span className="text-xs font-black text-emerald-400">R$ 100/mês</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Corridas e entregas ilimitadas. 100% dos ganhos ficam com você, sem comissão por corrida.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSubscriptionPlan('weekly_percent_10')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                subscriptionPlan === 'weekly_percent_10'
                  ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold text-sm text-white">10% por Corrida</span>
                <span className="text-xs font-black text-emerald-400">Acerto Semanal</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Pague apenas 10% do que produzir na semana. Ideal para quem roda esporadicamente.
              </p>
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-amber-300/90 flex items-start gap-2">
            <span className="text-sm">💵</span>
            <span>
              <strong>Pagamento Direto:</strong> O passageiro/cliente paga diretamente a você via Pix ou dinheiro. A plataforma não retém nem intermedia os valores das viagens.
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/60 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-600/60 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. PHOTO */}
          <div className="flex flex-col items-center space-y-2 pb-2">
            <div className="relative group">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Selfie"
                  className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500 shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-950 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 group-hover:border-emerald-500 transition-colors">
                  <Camera className="w-7 h-7 mb-1" />
                  <span className="text-[10px] font-semibold">Sua Foto</span>
                </div>
              )}
              <input
                id="driver-photo-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <label
              htmlFor="driver-photo-upload"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
            >
              {photoPreview ? 'Alterar Foto de Identificação' : 'Adicionar Foto / Selfie Obrigatória *'}
            </label>
          </div>

          {/* 2. DADOS PESSOAIS */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block pb-1 border-b border-slate-800">
              1. Dados Pessoais
            </span>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Carlos Eduardo de Oliveira"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">CPF (11 dígitos) *</label>
                <input
                  type="text"
                  required
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Data de Nascimento *</label>
                <input
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 3. CONTATO & ACESSO */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block pb-1 border-b border-slate-800">
              2. Contato e Acesso
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  WhatsApp / Telefone Internacional *
                </label>
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex: +55 (12) 99123-4567 ou +1 415 555-0199"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Aceita números do Brasil (+55) ou internacionais (E.164). Já é passageiro? Use o mesmo e-mail e WhatsApp!
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="motorista@gmail.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Senha de Acesso ao Painel *</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 4. DADOS PROFISSIONAIS & CNH */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block pb-1 border-b border-slate-800">
              3. Habilitação & Antecedentes Criminais
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {vehicleType === 'bicycle' ? 'Documento (RG ou CPF) *' : 'Número da CNH (11 dígitos) *'}
                </label>
                <input
                  type="text"
                  required
                  value={vehicleType === 'bicycle' ? (cnhNumber || 'ISENTO_BIKE') : cnhNumber}
                  onChange={(e) => setCnhNumber(e.target.value)}
                  placeholder={vehicleType === 'bicycle' ? 'Informe seu RG ou CPF' : '12345678901'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                {vehicleType === 'bicycle' && (
                  <span className="text-[10px] text-emerald-400 mt-0.5 block">
                    ✓ CNH dispensada para entregadores de bicicleta.
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Categoria Profissional</label>
                <select
                  value={professionalCategory}
                  onChange={(e) => setProfessionalCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="Motorista com EAR / Autônomo">Motorista com EAR / Autônomo</option>
                  <option value="Entregador / Motoboy (Delivery e Encomendas)">Entregador / Motoboy (Delivery e Encomendas)</option>
                  <option value="Entregador / Ciclista (Bicicleta / Bike)">Entregador / Ciclista (Bicicleta / Bike)</option>
                  <option value="Taxista Convencional Credenciado">Taxista Convencional Credenciado</option>
                  <option value="Motorista Particular de Turismo">Motorista Particular de Turismo</option>
                </select>
              </div>
            </div>

            {/* Atestado de Antecedentes Criminais (Obrigatório) */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" /> Atestado de Antecedentes Criminais *
                </span>
                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700">
                  Obrigatório
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Exigido para todos os motoristas e entregadores parceiros para garantir a máxima segurança dos passageiros e comerciantes de São Sebastião.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <label
                  htmlFor="driver-record-upload"
                  className="w-full sm:w-auto text-center py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  {criminalRecordFileName ? `✓ Anexado: ${criminalRecordFileName}` : 'Anexar Certidão de Antecedentes (Foto ou PDF) *'}
                </label>
                <input
                  id="driver-record-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleCriminalRecordUpload}
                  className="hidden"
                />
                <a
                  href="https://www.policiacivil.sp.gov.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-400 hover:underline"
                >
                  Emitir grátis online na Polícia Civil ↗
                </a>
              </div>
            </div>
          </div>

          {/* 5. VEÍCULO */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block pb-1 border-b border-slate-800">
              4. Dados do Veículo ou Bicicleta
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Veículo *</label>
                <select
                  value={vehicleType}
                  onChange={(e) => {
                    const newType = e.target.value as 'car' | 'motorcycle' | 'van' | 'bicycle';
                    setVehicleType(newType);
                    if (newType === 'bicycle') {
                      setActivityMode('delivery');
                      setProfessionalCategory('Entregador / Ciclista (Bicicleta / Bike)');
                      if (!brand || brand === 'Chevrolet' || brand === 'Honda') setBrand('Caloi');
                      if (!model || model === 'Onix' || model === 'CG 160 Fan') setModel('Aro 29');
                      setPlate('BIKE');
                    } else if (newType === 'motorcycle') {
                      setActivityMode('delivery');
                      setProfessionalCategory('Entregador / Motoboy (Delivery e Encomendas)');
                      if (!brand || brand === 'Chevrolet' || brand === 'Caloi') setBrand('Honda');
                      if (!model || model === 'Onix' || model === 'Aro 29') setModel('CG 160 Fan');
                      if (plate === 'BIKE') setPlate('');
                    } else if (newType === 'car') {
                      setActivityMode('driver');
                      setProfessionalCategory('Motorista com EAR / Autônomo');
                      if (brand === 'Honda' || brand === 'Caloi') setBrand('');
                      if (model === 'CG 160 Fan' || model === 'Aro 29') setModel('');
                      if (plate === 'BIKE') setPlate('');
                    } else if (newType === 'van') {
                      setActivityMode('driver');
                      setProfessionalCategory('Motorista Particular de Turismo');
                      if (plate === 'BIKE') setPlate('');
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="car">🚗 Carro / Automóvel (Passageiros)</option>
                  <option value="motorcycle">🛵 Moto / Motocicleta (Delivery / Motoboy)</option>
                  <option value="bicycle">🚲 Bicicleta / Bike (Delivery / Ciclista)</option>
                  <option value="van">🚐 Van / Utilitário / Turismo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {vehicleType === 'bicycle' ? 'Placa do Veículo' : 'Placa (Mercosul ou Tradicional) *'}
                </label>
                <input
                  type="text"
                  required={vehicleType !== 'bicycle'}
                  disabled={vehicleType === 'bicycle'}
                  value={vehicleType === 'bicycle' ? 'BIKE (ISENTO)' : plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder={vehicleType === 'bicycle' ? 'Isento de Placa' : 'ABC1D23'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500 disabled:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Marca *</label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder={
                    vehicleType === 'bicycle'
                      ? 'Ex: Caloi, Sense, Oggi'
                      : vehicleType === 'motorcycle'
                      ? 'Ex: Honda, Yamaha'
                      : 'Ex: Chevrolet, VW'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Modelo *</label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={
                    vehicleType === 'bicycle'
                      ? 'Ex: Aro 29, Mountain Bike'
                      : vehicleType === 'motorcycle'
                      ? 'Ex: CG 160, Fazer 250'
                      : 'Ex: Onix, HB20'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ano *</label>
                <input
                  type="number"
                  required
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Cor *</label>
                <input
                  type="text"
                  required
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Ex: Preta, Prata"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 6. ZONAS DE ATUAÇÃO */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block pb-1 border-b border-slate-800">
              5. Regiões de Atuação em São Sebastião *
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {zones.map((zone) => {
                const isChecked = selectedZones.includes(zone);
                return (
                  <button
                    key={zone}
                    type="button"
                    onClick={() => toggleZone(zone)}
                    className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                      isChecked
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{zone}</span>
                    {isChecked && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legal Compliance Notice */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            Ao submeter o cadastro, você declara que as informações são verídicas e concorda expressamente com os{' '}
            <Link to="/terms" target="_blank" className="text-emerald-400 underline hover:text-emerald-300">
              Termos de Uso
            </Link>{' '}
            (incluindo a ausência de vínculo empregatício e isenção de responsabilidade da plataforma nos termos da Lei 13.640/2018) e com a{' '}
            <Link to="/privacy" target="_blank" className="text-emerald-400 underline hover:text-emerald-300">
              Política de Privacidade (LGPD)
            </Link>.
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/50 transition-all hover:scale-[1.01]"
          >
            {loading ? 'Processando envio...' : 'Submeter Cadastro para Aprovação'}{' '}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800 text-xs text-slate-400">
          Já é motorista ou entregador cadastrado?{' '}
          <Link to="/driver/login" className="text-emerald-400 font-semibold hover:underline">
            Acessar Painel do Motorista & Entregador
          </Link>
        </div>
      </div>
    </div>
  );
};
