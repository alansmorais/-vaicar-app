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
  Car,
  HelpCircle,
  FileCode2,
  Calendar,
  Layers,
  Zap,
} from 'lucide-react';

export const DriverDownloadPage: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const apkInfo = {
    appName: 'VAICAR DRIVER',
    tagline: 'Download latest Android APK',
    version: '1.0.0',
    build: 1,
    generated: '2026-10-08 05:47:19 UTC',
    packageName: 'com.vaicar.driver',
    sizeFormatted: '18.2 MB',
    sizeBytes: '18.181.773 bytes',
    sha256: 'C0C8B5AD33907BF78C61512566ECE712AE68A2F68DF2B68085F2F037BEC37814',
    downloadUrl: '/downloads/vaicar-driver.apk',
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
          <Link
            to="/driver/login"
            className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Portal Web do Motorista →
          </Link>
        </div>

        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8 text-center shadow-2xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* App Icon */}
          <div className="relative mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-5">
            <Car className="w-10 h-10 text-white" />
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
            Aplicativo oficial para condutores parceiros VaiCar em São Sebastião e Litoral Norte.
          </p>

          {/* Primary Action Button */}
          <div className="mt-7">
            <a
              href={apkInfo.downloadUrl}
              download="vaicar-driver.apk"
              className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-black text-base shadow-xl shadow-emerald-500/25 transition-all duration-150"
            >
              <Download className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              DOWNLOAD APK
            </a>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Instalação direta para Android ({apkInfo.sizeFormatted})</span>
            </div>
          </div>
        </div>

        {/* Technical Metadata */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Informações Técnicas do Pacote
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block mb-0.5">Versão do App</span>
              <span className="font-semibold text-white text-sm">v{apkInfo.version}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block mb-0.5">Número da Build</span>
              <span className="font-semibold text-white text-sm">Build #{apkInfo.build}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block mb-0.5">Identificador de Pacote</span>
              <span className="font-mono text-emerald-300 font-semibold">{apkInfo.packageName}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block mb-0.5">Tamanho do Arquivo</span>
              <span className="font-semibold text-white">{apkInfo.sizeFormatted} ({apkInfo.sizeBytes})</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 sm:col-span-2">
              <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Gerado em</span>
              </div>
              <span className="font-medium text-slate-200">{apkInfo.generated}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 sm:col-span-2">
              <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                <span>Compatibilidade do Sistema</span>
              </div>
              <span className="text-slate-300">
                {apkInfo.minAndroid} • Alvo: {apkInfo.targetAndroid}
              </span>
            </div>
          </div>

          {/* SHA-256 Checksum Card */}
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
                Checksum SHA-256 (Integridade)
              </span>
              <button
                type="button"
                onClick={copyHash}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 font-mono text-[11px] text-slate-300 break-all select-all">
              {apkInfo.sha256}
            </div>
          </div>
        </div>

        {/* Step-by-Step Installation Guide */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            Como Instalar no seu Android
          </h2>

          <ol className="space-y-3.5 text-xs sm:text-sm text-slate-300">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                1
              </span>
              <div>
                <strong className="text-white">Baixar o APK:</strong> Toque no botão verde{' '}
                <span className="text-emerald-400 font-semibold">[ DOWNLOAD APK ]</span> acima. O download do arquivo{' '}
                <code className="bg-slate-800 px-1 py-0.5 rounded text-emerald-300">vaicar-driver.apk</code> será iniciado.
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                2
              </span>
              <div>
                <strong className="text-white">Permitir Instalação:</strong> Ao abrir o arquivo, se o Android ou o Chrome exibir a mensagem &quot;Para sua segurança, seu smartphone não tem permissão para instalar apps desconhecidos desta fonte&quot;, toque em{' '}
                <strong>Configurações</strong> e ative <strong>Permitir desta fonte</strong>.
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                3
              </span>
              <div>
                <strong className="text-white">Concluir e Conectar:</strong> Toque em <strong>Instalar</strong>. Após concluído, toque em <strong>Abrir</strong> e entre com suas credenciais de motorista parceiro.
              </div>
            </li>
          </ol>

          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2.5">
            <Zap className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              O app se conecta automaticamente aos serviços de produção da VaiCar em{' '}
              <strong className="text-white">https://vaicar.app/api/v1</strong> com despacho de corridas em tempo real.
            </span>
          </div>
        </div>

        {/* Security & Authenticity Note */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <p>Assinado e distribuído oficialmente por VaiCar Mobilidade Urbana • São Sebastião - SP</p>
          <p>Em conformidade com a Lei Federal nº 13.640/2018</p>
        </div>
      </div>
    </div>
  );
};

export default DriverDownloadPage;
