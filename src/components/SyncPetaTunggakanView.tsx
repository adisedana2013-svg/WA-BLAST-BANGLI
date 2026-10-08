import React, { useState, useMemo, useEffect } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileSpreadsheet, 
  Upload, 
  Search, 
  Printer, 
  Download, 
  Send, 
  Copy, 
  Plus, 
  Sparkles, 
  Filter, 
  MessageCircle, 
  ExternalLink,
  MapPin,
  Check,
  ChevronRight,
  UserCheck,
  Database,
  ArrowRightLeft
} from 'lucide-react';
import { TaxPayer } from '../types';

export interface PetaTunggakanItem {
  id: string;
  nopol: string;
  nama: string;
  wilayah: string;
  nominal_tunggakan?: number;
  tahun_tunggakan?: string;
  status_peta?: string;
}

export interface SyncMatchResult {
  petaItem: PetaTunggakanItem;
  matchedWaData?: TaxPayer;
  statusMatch: 'SENT_WITH_WA' | 'PENDING_WITH_WA' | 'NO_WA' | 'NOT_FOUND';
}

interface SyncPetaTunggakanViewProps {
  allData: TaxPayer[];
  onRefreshDatabase?: () => void;
  onSendSingleWA?: (item: TaxPayer) => void;
  onAddToWaBlast?: (newItems: TaxPayer[]) => void;
}

// Normalizer: hilangkan spasi, strip, ubah huruf besar (e.g. "dk 1234 pq" -> "DK1234PQ")
export const normalizeNopol = (str: string): string => {
  if (!str) return '';
  return str.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

// Data Sampel Peta Tunggakan Bangli (Kintamani, Susut, Tembuku, Bangli Kota)
const generateSamplePetaTunggakan = (existingData: TaxPayer[]): PetaTunggakanItem[] => {
  const items: PetaTunggakanItem[] = [];

  // Ambil beberapa nopol dari database yang sudah 'sent' jika ada
  const sentItems = existingData.filter(d => d.status === 'sent' && d.no_wa);
  const pendingItems = existingData.filter(d => d.status === 'pending' && d.no_wa);

  // Masukkan data sent dari database
  sentItems.slice(0, 8).forEach((d, idx) => {
    const wilayahList = ['Kec. Kintamani - Desa Batur', 'Kec. Bangli - Kel. Kawan', 'Kec. Susut - Desa Sulahan', 'Kec. Tembuku - Desa Peninjoan'];
    items.push({
      id: `peta-sent-${idx + 1}`,
      nopol: d.nopol,
      nama: d.nama,
      wilayah: wilayahList[idx % wilayahList.length],
      nominal_tunggakan: 850000 + (idx * 175000),
      tahun_tunggakan: '2023 - 2024',
      status_peta: 'SP-1 Lapangan'
    });
  });

  // Masukkan data pending dari database
  pendingItems.slice(0, 6).forEach((d, idx) => {
    const wilayahList = ['Kec. Kintamani - Desa Sukawana', 'Kec. Susut - Desa Penglumbaran', 'Kec. Bangli - Kel. Cempaga', 'Kec. Tembuku - Desa Undisan'];
    items.push({
      id: `peta-pending-${idx + 1}`,
      nopol: d.nopol,
      nama: d.nama,
      wilayah: wilayahList[idx % wilayahList.length],
      nominal_tunggakan: 620000 + (idx * 210000),
      tahun_tunggakan: '2024',
      status_peta: 'Verifikasi Tunggakan'
    });
  });

  // Tambahkan nopol sampel khas Bangli (DK ... P*)
  const sampleArrears = [
    { nopol: 'DK 4120 PA', nama: 'I WAYAN SUARJANA', wilayah: 'Kec. Kintamani - Desa Batur Selatan', nominal: 1450000, tahun: '2022 - 2024' },
    { nopol: 'DK 5892 PB', nama: 'NI KETUT SARIASIH', wilayah: 'Kec. Bangli - Kel. Bebalang', nominal: 780000, tahun: '2024' },
    { nopol: 'DK 2301 PQ', nama: 'I MADE SUKADANA', wilayah: 'Kec. Susut - Desa Abuan', nominal: 2100000, tahun: '2021 - 2024' },
    { nopol: 'DK 6645 PN', nama: 'I KOMANG WIRAWAN', wilayah: 'Kec. Tembuku - Desa Jehem', nominal: 950000, tahun: '2023' },
    { nopol: 'DK 8812 PK', nama: 'NI LUH PUTU DEWI', wilayah: 'Kec. Kintamani - Desa Kintamani', nominal: 1650000, tahun: '2022 - 2024' },
    { nopol: 'DK 3490 PZ', nama: 'I NYOMAN ARTA', wilayah: 'Kec. Susut - Desa Demulih', nominal: 890000, tahun: '2024' },
    { nopol: 'DK 7721 PD', nama: 'SANG AYU MADE PUSPITA', wilayah: 'Kec. Bangli - Kel. Kubu', nominal: 1320000, tahun: '2023 - 2024' },
    { nopol: 'DK 1944 PE', nama: 'I DEWA GEDE RAI', wilayah: 'Kec. Tembuku - Desa Yangapi', nominal: 540000, tahun: '2024' },
    { nopol: 'DK 9023 PM', nama: 'NI WAYAN MURTI', wilayah: 'Kec. Kintamani - Desa Songan A', nominal: 1850000, tahun: '2021 - 2024' },
    { nopol: 'DK 5178 PF', nama: 'I KETUT SUDIARTA', wilayah: 'Kec. Susut - Desa Tiga', nominal: 1100000, tahun: '2023' },
  ];

  sampleArrears.forEach((s, idx) => {
    // Pastikan tidak duplikat dengan yang sudah ada
    if (!items.some(it => normalizeNopol(it.nopol) === normalizeNopol(s.nopol))) {
      items.push({
        id: `peta-sample-${idx + 1}`,
        nopol: s.nopol,
        nama: s.nama,
        wilayah: s.wilayah,
        nominal_tunggakan: s.nominal,
        tahun_tunggakan: s.tahun,
        status_peta: 'Tunggakan Belum Bayar'
      });
    }
  });

  return items;
};

export const SyncPetaTunggakanView: React.FC<SyncPetaTunggakanViewProps> = ({
  allData,
  onRefreshDatabase,
  onSendSingleWA,
  onAddToWaBlast
}) => {
  // State data peta tunggakan (tersimpan di localStorage agar tidak hilang saat reload)
  const [petaList, setPetaList] = useState<PetaTunggakanItem[]>(() => {
    const saved = localStorage.getItem('samsat_peta_tunggakan_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return generateSamplePetaTunggakan(allData);
  });

  // Filter & Search
  const [activeFilter, setActiveFilter] = useState<'all' | 'sent' | 'pending' | 'not_found'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWilayah, setSelectedWilayah] = useState('all');

  // Input Modal state
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [inputTab, setInputTab] = useState<'paste' | 'single' | 'sample'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [singleForm, setSingleForm] = useState({
    nopol: '',
    nama: '',
    wilayah: 'Kec. Kintamani',
    nominal: '',
    tahun: '2024'
  });

  // Notifikasi / Toast lokal
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  // Simpan data peta ke localStorage jika berubah
  useEffect(() => {
    localStorage.setItem('samsat_peta_tunggakan_data', JSON.stringify(petaList));
  }, [petaList]);

  // PROSES SINKRONISASI UTAMA
  // Mencocokkan nopol dari peta tunggakan terhadap basis data WA Blast
  const syncResults: SyncMatchResult[] = useMemo(() => {
    // Map database WA Blast dengan key nopol yang dinormalisasi
    const waMap = new Map<string, TaxPayer>();
    allData.forEach(item => {
      const norm = normalizeNopol(item.nopol);
      if (norm) {
        waMap.set(norm, item);
      }
    });

    return petaList.map(item => {
      const normKey = normalizeNopol(item.nopol);
      const matchedWa = waMap.get(normKey);

      let statusMatch: SyncMatchResult['statusMatch'] = 'NOT_FOUND';

      if (matchedWa) {
        const hasValidWa = Boolean(matchedWa.no_wa && matchedWa.no_wa.replace(/\D/g, '').length >= 9);
        if (hasValidWa) {
          if (matchedWa.status === 'sent') {
            statusMatch = 'SENT_WITH_WA'; // SUDAH DIKIRIM & PUNYA NO WA
          } else {
            statusMatch = 'PENDING_WITH_WA'; // ADA NO WA, BELUM DIKIRIM
          }
        } else {
          statusMatch = 'NO_WA'; // ADA DI WA BLAST TAPI NO WA KOSONG
        }
      }

      return {
        petaItem: item,
        matchedWaData: matchedWa,
        statusMatch
      };
    });
  }, [petaList, allData]);

  // Statistik Ringkasan Hasil Sinkronisasi
  const stats = useMemo(() => {
    const total = syncResults.length;
    const sentWithWa = syncResults.filter(r => r.statusMatch === 'SENT_WITH_WA').length;
    const pendingWithWa = syncResults.filter(r => r.statusMatch === 'PENDING_WITH_WA').length;
    const notFound = syncResults.filter(r => r.statusMatch === 'NOT_FOUND').length;
    const noWaOnly = syncResults.filter(r => r.statusMatch === 'NO_WA').length;
    const percentageSent = total > 0 ? ((sentWithWa / total) * 100).toFixed(1) : '0';
    const totalFoundInWa = sentWithWa + pendingWithWa + noWaOnly;
    const percentageFound = total > 0 ? ((totalFoundInWa / total) * 100).toFixed(1) : '0';

    return {
      total,
      sentWithWa,
      pendingWithWa,
      notFound,
      noWaOnly,
      percentageSent,
      totalFoundInWa,
      percentageFound
    };
  }, [syncResults]);

  // Wilayah unik untuk filter dropdown
  const wilayahOptions = useMemo(() => {
    const set = new Set<string>();
    petaList.forEach(item => {
      if (item.wilayah) {
        // Ambil nama kecamatan di depan (e.g. Kec. Kintamani)
        const parts = item.wilayah.split(' - ');
        set.add(parts[0]);
      }
    });
    return Array.from(set);
  }, [petaList]);

  // Filter data sesuai kriteria
  const filteredResults = useMemo(() => {
    return syncResults.filter(result => {
      // Filter status
      if (activeFilter === 'sent' && result.statusMatch !== 'SENT_WITH_WA') return false;
      if (activeFilter === 'pending' && result.statusMatch !== 'PENDING_WITH_WA') return false;
      if (activeFilter === 'not_found' && result.statusMatch !== 'NOT_FOUND') return false;

      // Filter wilayah
      if (selectedWilayah !== 'all' && !result.petaItem.wilayah?.startsWith(selectedWilayah)) return false;

      // Filter search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const normQ = normalizeNopol(q);
        const matchNopol = normalizeNopol(result.petaItem.nopol).includes(normQ);
        const matchNamaPeta = result.petaItem.nama.toLowerCase().includes(q);
        const matchNamaWa = result.matchedWaData?.nama.toLowerCase().includes(q) || false;
        const matchWilayah = result.petaItem.wilayah.toLowerCase().includes(q);
        const matchNoWa = result.matchedWaData?.no_wa?.includes(q) || false;

        return matchNopol || matchNamaPeta || matchNamaWa || matchWilayah || matchNoWa;
      }

      return true;
    });
  }, [syncResults, activeFilter, selectedWilayah, searchQuery]);

  // Handler: Parse dan masukkan teks paste dari Excel / Peta Tunggakan
  const handleProcessPasteText = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const newItems: PetaTunggakanItem[] = [];

    lines.forEach((line, idx) => {
      // Deteksi pembatas tab (Excel) atau koma atau titik koma
      let parts = line.split('\t');
      if (parts.length === 1) parts = line.split(',');
      if (parts.length === 1) parts = line.split(';');

      const nopol = (parts[0] || '').trim().toUpperCase();
      if (!nopol) return;

      const nama = (parts[1] || 'Wajib Pajak SAMSAT Bangli').trim();
      const wilayah = (parts[2] || 'Kabupaten Bangli').trim();
      const rawNominal = parts[3] ? parseInt(parts[3].replace(/\D/g, ''), 10) : 750000;
      const tahun = (parts[4] || '2024').trim();

      newItems.push({
        id: `peta-paste-${Date.now()}-${idx}`,
        nopol,
        nama,
        wilayah,
        nominal_tunggakan: isNaN(rawNominal) ? 750000 : rawNominal,
        tahun_tunggakan: tahun,
        status_peta: 'Sinkronisasi Lapangan'
      });
    });

    if (newItems.length === 0) {
      showFeedback('❌ Tidak ada format Nopol valid yang terdeteksi.');
      return;
    }

    // Gabungkan dengan data yang ada tanpa duplikasi nopol
    const existingNorms = new Set(petaList.map(it => normalizeNopol(it.nopol)));
    const uniqueIncoming = newItems.filter(it => !existingNorms.has(normalizeNopol(it.nopol)));

    setPetaList(prev => [...uniqueIncoming, ...prev]);
    setIsInputModalOpen(false);
    setPasteText('');
    showFeedback(`✅ Berhasil menyinkronkan ${uniqueIncoming.length} Nopol dari Peta Tunggakan!`);
  };

  // Handler: Tambah 1 nopol manual
  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleForm.nopol.trim()) return;

    const newItem: PetaTunggakanItem = {
      id: `peta-single-${Date.now()}`,
      nopol: singleForm.nopol.trim().toUpperCase(),
      nama: singleForm.nama.trim() || 'Wajib Pajak',
      wilayah: singleForm.wilayah,
      nominal_tunggakan: singleForm.nominal ? parseInt(singleForm.nominal.replace(/\D/g, ''), 10) : 500000,
      tahun_tunggakan: singleForm.tahun || '2024',
      status_peta: 'Peta Tunggakan Bangli'
    };

    setPetaList(prev => [newItem, ...prev.filter(it => normalizeNopol(it.nopol) !== normalizeNopol(newItem.nopol))]);
    setSingleForm({ nopol: '', nama: '', wilayah: 'Kec. Kintamani', nominal: '', tahun: '2024' });
    setIsInputModalOpen(false);
    showFeedback(`✅ Nopol ${newItem.nopol} berhasil ditambahkan ke daftar sinkronisasi!`);
  };

  // Handler: Reset ke Data Sampel Bangli
  const handleLoadSampleBangli = () => {
    const sample = generateSamplePetaTunggakan(allData);
    setPetaList(sample);
    setIsInputModalOpen(false);
    showFeedback(`✅ Berhasil memuat ${sample.length} data contoh Peta Tunggakan SAMSAT Bangli!`);
  };

  // Handler: Hapus 1 item dari peta
  const handleDeleteItem = (id: string) => {
    setPetaList(prev => prev.filter(it => it.id !== id));
    showFeedback('Data nopol dihapus dari daftar peta tunggakan');
  };

  // Handler: Salin Nopol yang sudah dikirim ke clipboard
  const handleCopySentNopol = () => {
    const sentList = syncResults
      .filter(r => r.statusMatch === 'SENT_WITH_WA')
      .map(r => `${r.petaItem.nopol} - ${r.petaItem.nama} (${r.matchedWaData?.no_wa || '-'}) [Terkirim: ${r.matchedWaData?.sent_at ? new Date(r.matchedWaData.sent_at).toLocaleDateString('id-ID') : 'Ya'}]`)
      .join('\n');

    if (!sentList) {
      showFeedback('Belum ada data nopol yang terkirim.');
      return;
    }

    navigator.clipboard.writeText(sentList);
    showFeedback('📋 Daftar nopol terkirim berhasil disalin ke Clipboard!');
  };

  // Handler: Ekspor Hasil Sinkronisasi ke CSV
  const handleExportCSV = () => {
    const headers = [
      'No',
      'NOPOL Peta Tunggakan',
      'Nama Pemilik',
      'Wilayah / Desa',
      'Nominal Tunggakan',
      'Status Peta',
      'Status di WA Blast',
      'Nomor WhatsApp',
      'Waktu Terkirim WA Blast',
      'Keterangan Sinkronisasi'
    ];

    const rows = syncResults.map((r, i) => {
      let statusWaDesc = 'Belum Ada di WA Blast';
      let ket = 'Perlu dimasukkan ke database WA Blast';

      if (r.statusMatch === 'SENT_WITH_WA') {
        statusWaDesc = 'SUDAH DIKIRIM (SENT)';
        ket = 'Pesan pengingat sudah berhasil terkirim dan memiliki nomor WA';
      } else if (r.statusMatch === 'PENDING_WITH_WA') {
        statusWaDesc = 'ADA DI BASIS DATA (PENDING)';
        ket = 'Memiliki nomor WA tapi belum dikirimkan blast';
      } else if (r.statusMatch === 'NO_WA') {
        statusWaDesc = 'ADA DI BASIS DATA (TANPA NO WA)';
        ket = 'Data kendaraan terdaftar tapi belum memiliki nomor WA';
      }

      return [
        i + 1,
        `"${r.petaItem.nopol}"`,
        `"${r.petaItem.nama}"`,
        `"${r.petaItem.wilayah}"`,
        r.petaItem.nominal_tunggakan || 0,
        `"${r.petaItem.status_peta || '-'}"`,
        `"${statusWaDesc}"`,
        `"${r.matchedWaData?.no_wa || '-'}"`,
        `"${r.matchedWaData?.sent_at || '-'}"`,
        `"${ket}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sinkronisasi_Peta_Tunggakan_Samsat_Bangli_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFeedback('📥 File CSV hasil sinkronisasi berhasil diunduh!');
  };

  // Format rupiah
  const formatRupiah = (val?: number) => {
    if (!val) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // Format tanggal terkirim
  const formatDateTime = (dtStr?: string) => {
    if (!dtStr) return '-';
    try {
      const d = new Date(dtStr);
      if (isNaN(d.getTime())) return dtStr;
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dtStr;
    }
  };

  return (
    <div className="space-y-8 font-sans pb-16">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed top-6 right-6 z-[120] bg-slate-900 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* HEADER UTAMA SINKRONISASI */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-8 rounded-3xl shadow-xl border border-blue-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-bold uppercase tracking-wider">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Modul Integrasi & Sinkronisasi SAMSAT</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Sinkronisasi Data Peta Tunggakan</span>
            </h2>
            <p className="text-sm text-blue-100/80 leading-relaxed">
              Mencocokkan daftar Nopol dari <span className="font-bold text-white">Aplikasi Peta Tunggakan</span> dengan basis data <span className="font-bold text-emerald-300">WA Blast</span> untuk mendeteksi secara akurat kendaraan mana saja yang <span className="underline decoration-emerald-400 font-bold text-white">sudah memiliki nomor WA dan sudah pernah dikirimkan pesan penagihan</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <button
              onClick={() => setIsInputModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Input / Sinkronkan Data Peta</span>
            </button>

            {onRefreshDatabase && (
              <button
                onClick={onRefreshDatabase}
                className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 active:scale-95"
                title="Tarik pembaruan data terkini dari Google Sheets"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang Database</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 KARTU METRIK UTAMA HASIL SINKRONISASI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Nopol Peta Tunggakan */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Nopol Peta Tunggakan</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">{stats.total.toLocaleString('id-ID')}</span>
            <span className="text-xs text-slate-400 font-bold">Kendaraan</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">Sumber: Hasil mapping lapangan Peta Tunggakan</p>
        </div>

        {/* Card 2: DITEMUKAN & SUDAH PERNAH DIKIRIM (SENT + ADA NO WA) -> TARGET UTAMA USER */}
        <div className="bg-emerald-50/80 p-6 rounded-2xl border-2 border-emerald-400/80 shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-lg tracking-widest">
            Fokus Utama
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Sudah Dikirim (Ada No WA)</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700 tracking-tight">{stats.sentWithWa.toLocaleString('id-ID')}</span>
            <span className="text-xs text-emerald-600 font-bold">({stats.percentageSent}%)</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-2 font-semibold">
            Telah terkonfirmasi menerima pesan WA Blast SAMSAT
          </p>
        </div>

        {/* Card 3: Ditemukan tapi Belum Dikirim (Pending + Ada No WA) */}
        <div className="bg-amber-50/70 p-6 rounded-2xl border border-amber-300 shadow-sm relative overflow-hidden group hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Pending (Ada No WA)</span>
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <MessageCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-700 tracking-tight">{stats.pendingWithWa.toLocaleString('id-ID')}</span>
            <span className="text-xs text-amber-600 font-bold">Kendaraan</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-2 font-medium">Ada di database & ada no WA, siap untuk di-blast</p>
        </div>

        {/* Card 4: Belum Ada di Basis Data WA Blast */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <span>Belum Terdata di WA Blast</span>
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-200/70 text-slate-600 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-700 tracking-tight">{stats.notFound.toLocaleString('id-ID')}</span>
            <span className="text-xs text-slate-400 font-bold">Kendaraan</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">Nopol ada di Peta Tunggakan tapi belum di-input ke WA Blast</p>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Data ({stats.total})
            </button>

            {/* TAB FOKUS UTAMA: SUDAH DIKIRIM & ADA NO WA */}
            <button
              onClick={() => setActiveFilter('sent')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'sent'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sudah Dikirim Pesan & Ada No WA ({stats.sentWithWa})</span>
            </button>

            <button
              onClick={() => setActiveFilter('pending')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Belum Dikirim (Ada No WA) ({stats.pendingWithWa})</span>
            </button>

            <button
              onClick={() => setActiveFilter('not_found')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'not_found'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Belum Ada di WA Blast ({stats.notFound})</span>
            </button>
          </div>

          {/* Action Salin List Nopol Terkirim */}
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleCopySentNopol}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95"
              title="Salin daftar Nopol yang sudah dikirim ke clipboard"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Salin List Terkirim</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search & Wilayah */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Nopol (contoh: DK 4120 PA), Nama Pemilik, atau Nomor WA..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium focus:bg-white focus:border-blue-600 outline-none transition-all text-slate-800"
            />
          </div>

          <div className="relative">
            <select
              value={selectedWilayah}
              onChange={e => setSelectedWilayah(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:bg-white focus:border-blue-600 outline-none transition-all text-slate-700 cursor-pointer"
            >
              <option value="all">Semua Wilayah / Kecamatan Bangli</option>
              {wilayahOptions.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TABEL RINCIAN HASIL SINKRONISASI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
              <span>Hasil Pencocokan Nopol Peta Tunggakan vs Database WA Blast</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                {filteredResults.length} Baris
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Nopol otomatis dinormalisasi tanpa memperhatikan spasi atau huruf kapital untuk akurasi 100%
            </p>
          </div>
          {activeFilter === 'sent' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
              <Check className="w-3.5 h-3.5" />
              <span>Menampilkan Khusus Nopol yang Sudah Dikirim Pesan & Ada No WA</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                <th className="py-3.5 px-4 text-center w-12">No</th>
                <th className="py-3.5 px-4">NOPOL (Peta Tunggakan)</th>
                <th className="py-3.5 px-4">Wajib Pajak & Wilayah</th>
                <th className="py-3.5 px-4">Tunggakan Pajak</th>
                <th className="py-3.5 px-4">Status di WA Blast</th>
                <th className="py-3.5 px-4">No. WhatsApp</th>
                <th className="py-3.5 px-4">Waktu Terkirim</th>
                <th className="py-3.5 px-4 text-center print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600">Tidak ada data nopol yang cocok dengan kriteria filter</p>
                    <p className="text-[11px] text-slate-400 mt-1">Gunakan kata kunci pencarian lain atau pilih tab filter 'Semua Data'.</p>
                  </td>
                </tr>
              ) : (
                filteredResults.map((result, idx) => {
                  const isSentWithWa = result.statusMatch === 'SENT_WITH_WA';
                  const isPendingWithWa = result.statusMatch === 'PENDING_WITH_WA';
                  const isNoWa = result.statusMatch === 'NO_WA';
                  const isNotFound = result.statusMatch === 'NOT_FOUND';

                  return (
                    <tr 
                      key={result.petaItem.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSentWithWa ? 'bg-emerald-50/30' : isPendingWithWa ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Nopol dengan badge plat nomor SAMSAT */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-black text-xs tracking-wider shadow-sm border border-slate-700">
                          {result.petaItem.nopol}
                        </div>
                      </td>

                      {/* Wajib Pajak & Wilayah */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 leading-tight">
                          {result.petaItem.nama}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span>{result.petaItem.wilayah}</span>
                        </div>
                      </td>

                      {/* Nominal Tunggakan */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-rose-700">
                          {formatRupiah(result.petaItem.nominal_tunggakan)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold">
                          Masa: {result.petaItem.tahun_tunggakan || '-'}
                        </div>
                      </td>

                      {/* Status di WA Blast (Kolom Kunci Sesuai Permintaan) */}
                      <td className="py-3.5 px-4">
                        {isSentWithWa && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>DITEMUKAN & TERKIRIM</span>
                          </div>
                        )}

                        {isPendingWithWa && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-300">
                            <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                            <span>Ditemukan (Pending)</span>
                          </div>
                        )}

                        {isNoWa && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-900 text-[11px] font-bold border border-orange-300">
                            <AlertCircle className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                            <span>Ada, Tanpa No WA</span>
                          </div>
                        )}

                        {isNotFound && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>Belum Ada di WA Blast</span>
                          </div>
                        )}
                      </td>

                      {/* Nomor WhatsApp */}
                      <td className="py-3.5 px-4">
                        {result.matchedWaData?.no_wa ? (
                          <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>+{result.matchedWaData.no_wa}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Belum ada No. WA</span>
                        )}
                      </td>

                      {/* Waktu Terkirim (sent_at) */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {isSentWithWa ? (
                          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            {formatDateTime(result.matchedWaData?.sent_at) || 'Terkirim'}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>

                      {/* Aksi Cepat */}
                      <td className="py-3.5 px-4 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Kirim WA jika memiliki nomor WA */}
                          {result.matchedWaData?.no_wa && (
                            <button
                              onClick={() => {
                                if (onSendSingleWA && result.matchedWaData) {
                                  onSendSingleWA(result.matchedWaData);
                                } else {
                                  const text = encodeURIComponent(`Yth. Bapak/Ibu ${result.petaItem.nama}, kami informasikan dari Samsat Bangli bahwa kendaraan ${result.petaItem.nopol} memiliki tunggakan pajak. Mohon segera melakukan penyelesaian di Samsat Bangli.`);
                                  window.open(`https://wa.me/${result.matchedWaData?.no_wa}?text=${text}`, '_blank');
                                }
                              }}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all"
                              title="Kirim / Chat WhatsApp Langsung"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Tombol Tambahkan ke Antrean Blast jika belum ada */}
                          {isNotFound && onAddToWaBlast && (
                            <button
                              onClick={() => {
                                const newTaxPayer: TaxPayer = {
                                  nopol: result.petaItem.nopol,
                                  nama: result.petaItem.nama,
                                  jatuh_tempo: new Date().toISOString().split('T')[0],
                                  no_wa: '',
                                  status: 'pending',
                                  sent_at: '',
                                  timestamp: new Date().toISOString()
                                };
                                onAddToWaBlast([newTaxPayer]);
                                showFeedback(`Nopol ${result.petaItem.nopol} dimasukkan ke basis data WA Blast!`);
                              }}
                              className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-[10px] font-bold transition-all flex items-center gap-1"
                              title="Tambahkan kendaraan ini ke basis data WA Blast"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Ke WA Blast</span>
                            </button>
                          )}

                          {/* Tombol Salin Nopol */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(result.petaItem.nopol);
                              showFeedback(`Nopol ${result.petaItem.nopol} disalin!`);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all"
                            title="Salin Nopol"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL INPUT / SINKRONISASI PETA TUNGGAKAN */}
      {isInputModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/30">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Sinkronkan Data Peta Tunggakan</h3>
                  <p className="text-xs text-slate-400 font-medium">Input atau tempel daftar nopol tunggakan dari aplikasi peta tunggakan</p>
                </div>
              </div>
              <button
                onClick={() => setIsInputModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl mt-5">
              <button
                type="button"
                onClick={() => setInputTab('paste')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  inputTab === 'paste' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tempel Teks / Excel (Banyak Nopol)
              </button>
              <button
                type="button"
                onClick={() => setInputTab('single')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  inputTab === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Input Nopol Tunggal
              </button>
              <button
                type="button"
                onClick={() => setInputTab('sample')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  inputTab === 'sample' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Data Sampel Bangli
              </button>
            </div>

            {/* Modal Tab Content 1: Paste Teks */}
            {inputTab === 'paste' && (
              <div className="space-y-4 mt-5">
                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200/70 text-xs text-blue-900 font-medium leading-relaxed">
                  <span className="font-bold">Tips Cepat:</span> Salin langsung kolom Nopol dari Excel / Aplikasi Peta Tunggakan (1 baris per nopol atau dipisah koma/tab). Contoh format: <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono font-bold text-blue-700">DK 4120 PA, I WAYAN SUARJANA, Kintamani, 1500000</code> atau cukup Nopol saja per baris.
                </div>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={`Tempel daftar Nopol di sini, contoh:
DK 4120 PA
DK 5892 PB
DK 2301 PQ
DK 6645 PN`}
                  rows={8}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono focus:bg-white focus:border-blue-600 outline-none transition-all text-slate-800"
                />
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInputModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessPasteText}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-600/30"
                  >
                    Proses & Sinkronkan
                  </button>
                </div>
              </div>
            )}

            {/* Modal Tab Content 2: Single Nopol */}
            {inputTab === 'single' && (
              <form onSubmit={handleAddSingle} className="space-y-4 mt-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nomor Polisi (NOPOL)</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: DK 1234 PA"
                      value={singleForm.nopol}
                      onChange={e => setSingleForm(prev => ({ ...prev, nopol: e.target.value.toUpperCase() }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:bg-white focus:border-blue-600 outline-none uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nama Wajib Pajak</label>
                    <input
                      type="text"
                      placeholder="Nama Pemilik Kendaraan"
                      value={singleForm.nama}
                      onChange={e => setSingleForm(prev => ({ ...prev, nama: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:bg-white focus:border-blue-600 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Wilayah / Kecamatan Bangli</label>
                    <select
                      value={singleForm.wilayah}
                      onChange={e => setSingleForm(prev => ({ ...prev, wilayah: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:bg-white focus:border-blue-600 outline-none"
                    >
                      <option value="Kec. Kintamani">Kec. Kintamani</option>
                      <option value="Kec. Bangli">Kec. Bangli (Kota)</option>
                      <option value="Kec. Susut">Kec. Susut</option>
                      <option value="Kec. Tembuku">Kec. Tembuku</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nominal Tunggakan (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 1.250.000"
                      value={singleForm.nominal}
                      onChange={e => setSingleForm(prev => ({ ...prev, nominal: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:bg-white focus:border-blue-600 outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsInputModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-600/30"
                  >
                    Simpan & Sinkronkan
                  </button>
                </div>
              </form>
            )}

            {/* Modal Tab Content 3: Sample Bangli */}
            {inputTab === 'sample' && (
              <div className="space-y-4 mt-5">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Muat Data Sampel Peta Tunggakan SAMSAT Bangli</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Sistem akan memuat data tunggakan realistis dari wilayah Kintamani, Susut, Bangli Kota, dan Tembuku. Sebagian nopol akan otomatis cocok dengan database yang sudah pernah dikirimkan WA Blast (`Sent`), sebagian lagi `Pending`, dan sebagian belum terdata.
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInputModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSampleBangli}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Muat Contoh Data Bangli</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
