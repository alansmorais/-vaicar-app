import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { authApi } from '../../api/auth.js';
import { storageApi } from '../../api/storage.js';
import { isValidEmail, isValidWhatsApp } from '../../../../shared/src/validation.js';
import { User, Phone, Mail, Camera, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export const PassengerRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { registerEmailPassword, devLogin } = useAuth();

  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [photoData, setPhotoData] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Formato inválido. Selecione um arquivo de imagem (JPG, PNG ou WebP).');
      return;
    }
    if (file.type === 'image/svg+xml') {
      setError('Arquivos SVG não são permitidos por segurança.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPhotoData(result);
      setPhotoPreview(result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation matching backend strict rules
    if (!name.trim() || name.trim().length < 2) {
      setError('Informe seu nome completo.');
      return;
    }
    if (!whatsapp.trim() || !isValidWhatsApp(whatsapp)) {
      setError('Informe um número de WhatsApp brasileiro válido com DDD (ex: 12 99123-4567).');
      return;
    }
    if (!email.trim() || !isValidEmail(email)) {
      setError('Informe um endereço de e-mail válido (ex: seu.nome@gmail.com).');
      return;
    }
    if (!password || password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (!photoData) {
      setError('A foto de perfil é obrigatória para segurança de todos os usuários.');
      return;
    }
    if (!termsAccepted) {
      setError('É obrigatório aceitar os termos de uso e privacidade da plataforma.');
      return;
    }

    setLoading(true);

    try {
      // 1. Create Firebase Auth user
      const fbUser = await registerEmailPassword(email.trim(), password);

      // 2. Upload photo via API
      let finalPhotoUrl = photoData;
      try {
        const uploadRes = await storageApi.uploadImage(photoData, 'users', fbUser.uid);
        finalPhotoUrl = uploadRes.url;
      } catch (uploadErr) {
        console.warn('Storage upload note:', uploadErr);
        // If upload endpoint returns local path or fails, proceed with data url
      }

      // 3. Register passenger profile in Firestore via authoritative API
      const res = await authApi.registerPassenger({
        uid: fbUser.uid,
        name: name.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim().toLowerCase(),
        photoUrl: finalPhotoUrl,
        termsAccepted: true,
      });

      // 4. Authenticate session
      await devLogin(fbUser.uid, email.trim(), 'passenger', name.trim());

      setSuccess('Cadastro concluído com sucesso! Redirecionando...');
      setTimeout(() => {
        navigate('/passenger');
      }, 1200);
    } catch (err: any) {
      console.error('Registration error:', err);
      const msg = err.message || '';
      if (msg.includes('identitytoolkit') || msg.includes('are-blocked')) {
        setError('Serviço de autenticação temporariamente indisponível. Tente novamente.');
      } else {
        setError(msg || 'Falha ao processar o cadastro. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block">
            <img src="/vaicar_logo.png" alt="VaiCar" className="h-10 mx-auto rounded object-contain" />
          </Link>
          <h2 className="text-2xl font-black text-white">Criar Conta de Passageiro</h2>
          <p className="text-xs text-slate-400">
            Cadastre-se para pedir corridas seguras em São Sebastião e Litoral Norte.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Upload Area */}
          <div className="flex flex-col items-center space-y-2 pb-2">
            <div className="relative group">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Prévia"
                  className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500 shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-950 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 group-hover:border-emerald-500 transition-colors">
                  <Camera className="w-7 h-7 mb-1" />
                  <span className="text-[10px] font-semibold">Sua Foto</span>
                </div>
              )}
              <label
                htmlFor="photo-upload"
                className="absolute inset-0 rounded-full cursor-pointer opacity-0"
              >
                Upload
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <label
              htmlFor="photo-upload"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
            >
              {photoPreview ? 'Alterar Foto de Perfil' : 'Adicionar Foto Obrigatória'}
            </label>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo *</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Ana Carolina Silva"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp Brasileiro *</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="tel"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Ex: (12) 99123-4567"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail Real *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: ana.silva@gmail.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Senha de Acesso *</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Terms checkbox */}
          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 rounded border-slate-800 text-emerald-600 focus:ring-emerald-500 bg-slate-950"
            />
            <label htmlFor="terms" className="text-[11px] text-slate-400 cursor-pointer leading-tight">
              Concordo com os Termos de Uso e Política de Privacidade do VaiCar São Sebastião.
            </label>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
          >
            {loading ? 'Cadastrando...' : 'Finalizar Cadastro'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800 text-xs text-slate-400">
          Já possui conta?{' '}
          <Link to="/passenger/login" className="text-emerald-400 font-semibold hover:underline">
            Faça login aqui
          </Link>
        </div>
      </div>
    </div>
  );
};
