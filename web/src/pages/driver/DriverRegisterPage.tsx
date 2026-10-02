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
      setError('Informe um WhatsApp brasileiro válido com DDD (ex: 12 99123-4567).');
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
    if (!cnhNumber || !isValidCNH(cnhNumber)) {
      setError('Informe o número da CNH com 11 dígitos.');
      return;
    }
    if (!brand.trim() || !model.trim() || !color.trim() || !plate.trim()) {
      setError('Preencha todos os dados do veículo.');
      return;
    }
    if (!isValidPlate(plate)) {
      setError('Informe uma placa de veículo válida (Mercosul ou Tradicional).');
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

      // 3. Register Driver in backend
      await authApi.registerDriver({
        uid: fbUser.uid,
        name: name.trim(),
        cpf: cpf.trim(),
        birthDate,
        whatsapp: whatsapp.trim(),
        email: email.trim().toLowerCase(),
        photoUrl: finalPhotoUrl,
        professionalCategory,
        cnhNumber: cnhNumber.trim(),
        vehicle: {
          brand: brand.trim(),
          model: model.trim(),
          year: parseInt(year, 10),
          color: color.trim(),
          plate: plate.trim().toUpperCase(),
        },
        operatingZones: selectedZones,
      });

      // 4. Set session
      await devLogin(fbUser.uid, email.trim(), 'driver', name.trim());

      setSuccess('Cadastro enviado! Sua conta está em análise pela equipe administrativa.');
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
          <h2 className="text-2xl font-black text-white">Cadastro de Motorista Parceiro</h2>
          <p className="text-xs text-slate-400">
            Dirija em São Sebastião com <strong className="text-emerald-400">taxa zero sobre suas corridas</strong>.
          </p>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp com DDD *</label>
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(12) 99123-4567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
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
              3. Habilitação Profissional
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Número da CNH (11 dígitos) *</label>
                <input
                  type="text"
                  required
                  value={cnhNumber}
                  onChange={(e) => setCnhNumber(e.target.value)}
                  placeholder="12345678901"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Categoria Profissional</label>
                <select
                  value={professionalCategory}
                  onChange={(e) => setProfessionalCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="Motorista com EAR / Autônomo">Motorista com EAR / Autônomo</option>
                  <option value="Taxista Convencional Credenciado">Taxista Convencional Credenciado</option>
                  <option value="Motorista Particular de Turismo">Motorista Particular de Turismo</option>
                </select>
              </div>
            </div>
          </div>

          {/* 5. VEÍCULO */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block pb-1 border-b border-slate-800">
              4. Dados do Veículo
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Marca *</label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ex: Chevrolet"
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
                  placeholder="Ex: Onix Plus"
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
                  placeholder="Ex: Prata"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Placa (Mercosul ou Tradicional) *</label>
              <input
                type="text"
                required
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="ABC1D23"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
              />
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
          Já é motorista cadastrado?{' '}
          <Link to="/driver/login" className="text-emerald-400 font-semibold hover:underline">
            Acessar Painel do Motorista
          </Link>
        </div>
      </div>
    </div>
  );
};
