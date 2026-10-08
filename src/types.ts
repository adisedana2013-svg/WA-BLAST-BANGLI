export interface TaxPayer {
  nopol: string;
  nama: string;
  jatuh_tempo: string;
  no_wa: string;
  status: 'pending' | 'sent';
  sent_at: string;
  timestamp: string;
}

export type TabType = 'dashboard' | 'data' | 'blast' | 'template' | 'laporan' | 'statistik' | 'sinkronisasi';

export interface AppBackup {
  version: string;
  date: string;
  data: TaxPayer[];
  template: string;
}
