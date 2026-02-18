'use client';
// ─────────────────────────────────────────────────────────
// app/dashboard/whatsapp/page.js
// Conectar WhatsApp via QR Code, status, desconectar
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { whatsappApi } from '@/lib/api';

export default function WhatsAppPage() {
  const [status,  setStatus]  = useState(null);
  const [qr,      setQr]      = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef(null);

  async function loadStatus() {
    try {
      const s = await whatsappApi.status();
      setStatus(s);
    } catch (_) {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadStatus();
    const iv = setInterval(loadStatus, 10_000);
    return () => clearInterval(iv);
  }, []);

  async function connect() {
    setLoading(true);
    setQr(null);
    try {
      const res = await whatsappApi.connect();
      if (res.status === 'connected') {
        loadStatus(); return;
      }
      setQr(res.qrcode);
      startCountdown();
    } catch (_) {}
    finally { setLoading(false); }
  }

  async function disconnect() {
    if (!confirm('Desconectar o WhatsApp?')) return;
    setLoading(true);
    await whatsappApi.disconnect().catch(() => {});
    setQr(null);
    clearInterval(timerRef.current);
    loadStatus();
  }

  function startCountdown() {
    clearInterval(timerRef.current);
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          setQr(null); // QR expirou
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  const isConnected = status?.status === 'connected';

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">WhatsApp</h1>
        <p className="text-slate-400 text-sm mt-0.5">Conecte seu número para disparar campanhas</p>
      </div>

      {/* Status card */}
      <div className={`rounded-xl border p-5 ${isConnected ? 'bg-[#00e5a0]/05 border-[#00e5a0]/30' : 'bg-[#0f1319] border-[#1e2733]'}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-[#00e5a0] animate-pulse-dot' : 'bg-slate-600'}`} />
          <span className={`font-semibold text-sm ${isConnected ? 'text-[#00e5a0]' : 'text-slate-400'}`}>
            {loading ? 'Verificando...' : isConnected ? 'Conectado' : status?.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
          </span>
        </div>

        {isConnected && (
          <div className="space-y-2 mb-4">
            {status.profileName && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Perfil</span>
                <span className="font-medium">{status.profileName}</span>
              </div>
            )}
            {status.phone && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Número</span>
                <span className="font-mono font-medium">+{status.phone}</span>
              </div>
            )}
            {status.connectedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Conectado em</span>
                <span className="text-slate-300 text-xs">
                  {new Date(status.connectedAt).toLocaleString('pt-BR')}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {!isConnected && (
            <button onClick={connect} disabled={loading}
              className="flex-1 py-2.5 bg-[#00e5a0] hover:bg-[#00ffb3] text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              {loading ? '⏳ Aguarde...' : '📱 Conectar via QR Code'}
            </button>
          )}
          {isConnected && (
            <button onClick={disconnect} disabled={loading}
              className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-semibold rounded-lg transition-colors">
              Desconectar
            </button>
          )}
        </div>
      </div>

      {/* QR Code */}
      {qr && !isConnected && (
        <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-6 text-center">
          <h3 className="font-semibold text-sm mb-4">Escaneie o QR Code</h3>
          <div className="inline-block bg-white p-3 rounded-xl mb-4">
            <img src={qr} alt="QR Code WhatsApp" className="w-44 h-44 object-contain" />
          </div>
          <p className="text-xs text-slate-500 mb-2">
            Expira em <span className="font-mono font-bold text-amber-400">{countdown}s</span>
          </p>
          <div className="text-xs text-slate-500 space-y-1">
            <p>1. Abra o WhatsApp no celular</p>
            <p>2. Toque em <strong className="text-slate-300">Dispositivos vinculados</strong></p>
            <p>3. Toque em <strong className="text-slate-300">Vincular dispositivo</strong></p>
            <p>4. Aponte a câmera para o QR Code acima</p>
          </div>
          <button onClick={connect} className="mt-4 text-xs text-[#00e5a0] hover:underline">
            🔄 Gerar novo QR
          </button>
        </div>
      )}

      {/* Aviso */}
      <div className="bg-amber-500/05 border border-amber-500/20 rounded-xl p-4">
        <p className="text-xs text-amber-300/80">
          <strong>⚠️ Importante:</strong> Use um número dedicado para disparos. Evite usar seu número pessoal principal. Respeite os limites de envio para reduzir o risco de banimento.
        </p>
      </div>
    </div>
  );
}
