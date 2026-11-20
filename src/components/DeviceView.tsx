import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Send,
  ShieldCheck,
  Wifi,
  WifiOff,
  ArrowRight,
  Clock
} from 'lucide-react';
import { WaDeviceStatus } from '../types.ts';

interface DeviceViewProps {
  deviceStatus: WaDeviceStatus;
  onRefreshStatus: () => Promise<void>;
  onConnect: (fresh?: boolean) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
  sendingMethod: 'wa_web' | 'cloud_api' | 'device';
  onSelectDeviceMethod: () => void;
  onOpenBlast?: () => void;
  isAdmin: boolean;
}

export const DeviceView: React.FC<DeviceViewProps> = ({
  deviceStatus,
  onRefreshStatus,
  onConnect,
  onDisconnect,
  onNotify,
  sendingMethod,
  onSelectDeviceMethod,
  onOpenBlast,
  isAdmin
}) => {
  const [actionLoading, setActionLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState(
    'Uji coba koneksi WhatsApp Perangkat Tertaut — SAMSAT Kabupaten Bangli.'
  );
  const [sendingTest, setSendingTest] = useState(false);
  const [qrAgeSeconds, setQrAgeSeconds] = useState(0);

  // Track QR age in seconds for visual clarity while scanning
  useEffect(() => {
    if (deviceStatus.status !== 'qr' || !deviceStatus.qrUpdatedAt) {
      setQrAgeSeconds(0);
      return;
    }
    const updateAge = () => {
      const diff = Math.max(0, Math.floor((Date.now() - (deviceStatus.qrUpdatedAt || Date.now())) / 1000));
      setQrAgeSeconds(diff);
    };
    updateAge();
    const timer = setInterval(updateAge, 1000);
    return () => clearInterval(timer);
  }, [deviceStatus.status, deviceStatus.qrUpdatedAt]);

  const handleConnectClick = async (fresh = false) => {
    setActionLoading(true);
    try {
      await onConnect(fresh);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnectClick = async () => {
    setActionLoading(true);
    try {
      await onDisconnect();
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPhone = testPhone.trim() || deviceStatus.device?.phone || '';
    if (!targetPhone) {
      onNotify('Masukkan nomor WhatsApp tujuan uji coba', 'warn');
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch('/api/wa-device/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: targetPhone, message: testMessage })
      });
      const data = await res.json();
      if (data.success) {
        onNotify(`Pesan uji coba berhasil dikirim ke ${data.to}`, 'success');
      } else {
        onNotify(data.error || 'Gagal mengirim pesan uji coba', 'error');
      }
    } catch (err: any) {
      onNotify(err?.message || 'Gagal menghubungi server perangkat', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const formatConnectedTime = (iso?: string) => {
    if (!iso) return '-';
    try {
      const dt = new Date(iso);
      if (isNaN(dt.getTime())) return iso;
      return (
        dt.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }) +
        ' · ' +
        dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
        ' WITA'
      );
    } catch {
      return iso;
    }
  };

  const isConnected = deviceStatus.status === 'connected';
  const isQrReady = deviceStatus.status === 'qr' && !!deviceStatus.qrDataUrl;
  const isConnecting = deviceStatus.status === 'connecting';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Status Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isQrReady || isConnecting
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            {isConnected ? (
              <Wifi className="w-6 h-6" />
            ) : isQrReady ? (
              <QrCode className="w-6 h-6" />
            ) : (
              <Smartphone className="w-6 h-6" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Tautkan Perangkat WhatsApp
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
              <span
                className={`font-semibold inline-flex items-center gap-1.5 ${
                  isConnected
                    ? 'text-emerald-700'
                    : isQrReady || isConnecting
                    ? 'text-blue-700'
                    : 'text-slate-600'
                }`}
              >
                {isConnected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Terhubung ke WhatsApp
                  </>
                ) : isQrReady ? (
                  <>
                    <QrCode className="w-3.5 h-3.5" />
                    Menunggu Pemindaian Barcode
                  </>
                ) : isConnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Memuat Sesi Barcode...
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5" />
                    Perangkat Belum Terhubung
                  </>
                )}
              </span>
              {isConnected && deviceStatus.device && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-slate-700 font-medium">
                    +{deviceStatus.device.phone}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{deviceStatus.device.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onRefreshStatus()}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Segarkan Status</span>
          </button>

          {isConnected && (
            <button
              type="button"
              onClick={handleDisconnectClick}
              disabled={actionLoading}
              className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Putuskan Perangkat</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: QR Code Scanner or Connected Device Panel */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8">
          {deviceStatus.lastError && !isConnected && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Informasi Koneksi</p>
                <p className="text-rose-700 leading-relaxed">{deviceStatus.lastError}</p>
              </div>
            </div>
          )}

          {isConnected && deviceStatus.device ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Sesi Aktif di Server Aplikasi
                  </p>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    {deviceStatus.device.name}
                  </h3>
                  <p className="text-sm font-mono tabular-nums text-slate-600 mt-0.5">
                    +{deviceStatus.device.phone}
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs text-slate-500 space-y-1">
                  <p className="font-medium text-slate-700">{deviceStatus.device.platform}</p>
                  <p className="font-mono tabular-nums">
                    Terhubung: {formatConnectedTime(deviceStatus.device.connectedAt)}
                  </p>
                </div>
              </div>

              {/* Active Method Notice */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Jalur Pengiriman WhatsApp Dalam Aplikasi
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {sendingMethod === 'device'
                      ? 'Aktif — Pengiriman di menu Kirim Pesan otomatis mengirim melalui perangkat tertaut ini tanpa membuka tab baru.'
                      : 'Saat ini metode pengiriman masih disetel ke mode lain. Aktifkan mode Perangkat Tertaut agar blast berjalan otomatis.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {sendingMethod !== 'device' ? (
                    <button
                      type="button"
                      onClick={onSelectDeviceMethod}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      Aktifkan Jalur Ini
                    </button>
                  ) : (
                    isAdmin &&
                    onOpenBlast && (
                      <button
                        type="button"
                        onClick={onOpenBlast}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <span>Buka Kirim Pesan</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Test Send Form */}
              <form
                onSubmit={handleSendTest}
                className="pt-6 border-t border-slate-100 space-y-4"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Uji Coba Kirim Pesan</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pastikan perangkat yang tertaut dapat mengirim pesan langsung ke nomor tujuan.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Nomor Tujuan (WhatsApp)
                    </label>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder={deviceStatus.device.phone || '6281234567890'}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm font-mono tabular-nums text-slate-800 outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Pesan Uji Coba
                    </label>
                    <input
                      type="text"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sendingTest}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    {sendingTest ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{sendingTest ? 'Mengirim...' : 'Kirim Pesan Uji Coba'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center py-4">
              {/* QR Frame Container (Fixed 264x264 to prevent layout shift) */}
              <div className="w-[264px] h-[264px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-4 mb-6">
                {isQrReady && deviceStatus.qrDataUrl ? (
                  <img
                    src={deviceStatus.qrDataUrl}
                    alt="Barcode QR WhatsApp"
                    className="w-full h-full object-contain rounded-lg bg-white"
                  />
                ) : isConnecting || actionLoading ? (
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="text-xs font-medium">Menyiapkan Barcode QR...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400 px-4">
                    <QrCode className="w-16 h-16 stroke-[1.5] text-slate-300" />
                    <span className="text-xs font-medium text-slate-500 leading-relaxed">
                      Klik tombol di bawah untuk memunculkan Barcode QR WhatsApp
                    </span>
                  </div>
                )}
              </div>

              {isQrReady ? (
                <div className="space-y-4 w-full max-w-sm">
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-600 font-medium">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      Pindai sekarang melalui WhatsApp di HP Anda ·{' '}
                      <span className="font-mono tabular-nums">{qrAgeSeconds}d</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleConnectClick(true)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                      <span>Muat Ulang Barcode</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectClick}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      Batalkan
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConnectClick(false)}
                  disabled={isConnecting || actionLoading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0"
                >
                  {isConnecting || actionLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4" />
                  )}
                  <span>
                    {isConnecting || actionLoading
                      ? 'Menghubungkan...'
                      : 'Tampilkan Barcode QR WhatsApp'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Step-by-step Instructions */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Cara Menghubungkan WhatsApp
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Gunakan fitur Perangkat Tertaut resmi di ponsel Anda agar aplikasi dapat mengirim
              pengingat pajak langsung dari dalam sistem.
            </p>
          </div>

          <ol className="space-y-4 text-sm text-slate-700 border-t border-slate-100 pt-5">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-mono tabular-nums text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <p className="font-semibold text-slate-900">Buka WhatsApp di HP Anda</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Pastikan ponsel terhubung ke internet selama proses penautan awal.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-mono tabular-nums text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <p className="font-semibold text-slate-900">Pilih Menu Perangkat Tertaut</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Di Android ketuk ikon titik tiga (⋮) lalu pilih <strong>Perangkat tertaut</strong>.
                  Di iPhone buka <strong>Pengaturan</strong> lalu pilih{' '}
                  <strong>Perangkat Tertaut</strong>.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-mono tabular-nums text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <p className="font-semibold text-slate-900">Ketuk Tautkan Perangkat & Scan Barcode</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Arahkan kamera HP ke kode QR yang tampil di layar ini hingga status berubah menjadi{' '}
                  <strong>Terhubung ke WhatsApp</strong>.
                </p>
              </div>
            </li>
          </ol>

          <div className="pt-5 border-t border-slate-100 text-xs text-slate-500 leading-relaxed space-y-2">
            <p className="font-semibold text-slate-700">Catatan Operasional</p>
            <p>
              Setelah tertaut, status koneksi tersimpan di server aplikasi dan dapat langsung
              dipilih sebagai jalur pengiriman otomatis di menu <strong>Format Pesan</strong> maupun{' '}
              <strong>Kirim Pesan</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
