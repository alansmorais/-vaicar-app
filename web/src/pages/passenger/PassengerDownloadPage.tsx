import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  Copy,
  Check,
  MapPin,
  HelpCircle,
  FileCode2,
  Calendar,
  Layers,
  Zap,
} from 'lucide-react';

export const PassengerDownloadPage: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const apkInfo = {
    appName: 'VAICAR PASSAGEIRO',
    tagline: 'Aplicativo Oficial para Android',
    version: '1.0.0',
    build: 1,
    generated: '2026-10-08 19:21:36 UTC',
    packageName: 'com.vaicar.passenger',
    sizeFormatted: '16.8 MB',
    sizeBytes: '16.826.125 bytes',
    sha256: '15191069932046F5F2E0702914B6BC10FE2485AF9638EBA106538C0CB9B202F2',
    downloadUrl: '/downloads/vaicar-passenger.apk',
    minAndroid: 'Android 7.0+ (Nougat ou superior)',
    targetAndroid: 'Android 14 (API 34)',
  };

  const copyHash = () => {
    navigator.clipboard.writeText(apkInfo.sha256);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/download/driver"
              className="text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors"
            >
              Baixar App Motorista →
            </Link>
            <Link
              to="/passenger"
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Portal Web →
            </Link>
          </div>
        </div>

        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8 text-center shadow-2xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* App Icon */}
          <div className="relative mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-5">
            <MapPin className="w-10 h-10 text-white" />
            <div className="absolute -bottom-1 -right-1 bg-slate-950 rounded-full p-1">
              <div className="bg-emerald-400 w-3 h-3 rounded-full animate-ping" />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
            {apkInfo.appName}
          </h1>
          <p className="mt-2 text-base sm:text-lg text-emerald-400 font-medium">
            {apkInfo.tagline}
          </p>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1">
            Aplicativo oficial 100% nativo para passageiros VaiCar em São Sebastião e Litoral Norte.
          </p>

          {/* Primary Action Button */}
          <div className="mt-7">
            <a
              href={apkInfo.downloadUrl}
              download="vaicar-passenger.apk"
              className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-black text-base shadow-xl shadow-emerald-500/25 transition-all duration-150"
            >
              <Download className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              DOWNLOAD APK PASSAGEIRO
            </a>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Instalação direta para Android ({apkInfo.sizeFormatted})</span>
            </div>
          </div>
        </div>

        {/* Technical Specs Card */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <FileCode2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Especificações do Pacote Android
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-slate-500">Pacote (Package Name)</span>
              <p className="font-mono text-slate-200">{apkInfo.packageName}</p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500">Versão / Build</span>
              <p className="font-mono text-slate-200">{apkInfo.version} (Build {apkInfo.build})</p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500">Compatibilidade</span>
              <p className="text-slate-200">{apkInfo.minAndroid}</p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500">Tamanho Exato</span>
              <p className="font-mono text-slate-200">{apkInfo.sizeBytes}</p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500">Target SDK</span>
              <p className="text-slate-200">{apkInfo.targetAndroid}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <span className="text-slate-500 text-xs block">Hash Criptográfico SHA-256 (Integridade)</span>
            <div className="flex items-center gap-2">
              <code className="text-[11px] font-mono bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300 break-all select-all flex-1">
                {apkInfo.sha256}
              </code>
              <button
                type="button"
                onClick={copyHash}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
                title="Copiar Hash SHA-256"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>

        {/* Step-by-Step Installation Instructions */}

        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Como Instalar no Celular
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                1
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Baixe o arquivo APK</h3>
                <p className="text-xs text-slate-400">
                  Clique no botão verde acima direto pelo navegador Chrome do seu celular ou tablet Android.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                2
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Permita a instalação</h3>
                <p className="text-xs text-slate-400">
                  Se o Android exibir "O arquivo pode ser nocivo", toque em <strong>"Fazer o download mesmo assim"</strong>. O APK é seguro e assinado digitalmente pelo VaiCar.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                3
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Abra e autorize fontes desconhecidas</h3>
                <p className="text-xs text-slate-400">
                  Toque na notificação de download concluído ou abra Downloads no celular. Se solicitado, ative <strong>"Permitir desta fonte"</strong> nas configurações de segurança do aparelho.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                4
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Instale e faça login</h3>
                <p className="text-xs text-slate-400">
                  Toque em <strong>Instalar</strong>. Abra o app VaiCar Passageiro, permita o acesso ao GPS do aparelho e aproveite viagens seguras e rápidas!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Support Notice */}
        <div className="text-center space-y-2 text-xs text-slate-500 pt-4">
          <p>VaiCar Mobilidade Urbana • São Sebastião - SP</p>
          <p className="text-slate-600">
            Dúvidas na instalação? Contate o suporte da plataforma em{' '}
            <a href="mailto:contato@vaicar.app" className="text-emerald-500 hover:underline">
              contato@vaicar.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
