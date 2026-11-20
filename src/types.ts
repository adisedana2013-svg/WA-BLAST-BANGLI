export interface TaxPayer {
  nopol: string;
  nama: string;
  jatuh_tempo: string;
  no_wa: string;
  status: 'pending' | 'sent';
  sent_at: string;
  timestamp: string;
}

export type TabType = 'dashboard' | 'perangkat' | 'data' | 'blast' | 'template' | 'laporan' | 'statistik' | 'sinkronisasi';

export interface WaDeviceInfo {
  id: string;
  phone: string;
  name: string;
  platform: string;
  connectedAt: string;
}

export type WaConnectionPhase = 'disconnected' | 'connecting' | 'qr' | 'connected' | 'error';

export interface WaDeviceStatus {
  status: WaConnectionPhase;
  qrDataUrl: string | null;
  qrUpdatedAt: number | null;
  device: WaDeviceInfo | null;
  lastError: string | null;
  serverlessUnconfigured?: boolean;
}

export interface AppBackup {
  version: string;
  date: string;
  data: TaxPayer[];
  template: string;
}
