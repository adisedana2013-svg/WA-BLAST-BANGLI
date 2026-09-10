import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  Download, 
  Copy, 
  Check, 
  FileSpreadsheet, 
  RefreshCw,
  Eye,
  Database
} from 'lucide-react';
import { TaxPayer } from '../types.ts';

interface ReportViewProps {
  allData: TaxPayer[];
  onRefresh?: () => void;
}

// Sample reference data from the user's uploaded spreadsheet image
const SAMPLE_IMAGE_DATA = {
  total: 7275,
  sent: 858,
  pending: 6417,
  successRate: 11.8,
  pendingRate: 88.2,
  yearlyDistribution: [
    { year: '2010', count: 3, percent: 0.0 },
    { year: '2011', count: 1, percent: 0.0 },
    { year: '2012', count: 2, percent: 0.0 },
    { year: '2013', count: 1, percent: 0.0 },
    { year: '2014', count: 3, percent: 0.0 },
    { year: '2015', count: 6, percent: 0.1 },
    { year: '2016', count: 2, percent: 0.0 },
    { year: '2017', count: 9, percent: 0.1 },
    { year: '2018', count: 8, percent: 0.1 },
    { year: '2019', count: 16, percent: 0.2 },
    { year: '2020', count: 36, percent: 0.5 },
    { year: '2021', count: 61, percent: 0.8 },
    { year: '2022', count: 67, percent: 0.9 },
    { year: '2023', count: 176, percent: 2.4 },
    { year: '2024', count: 771, percent: 10.6 },
    { year: '2025', count: 2200, percent: 30.2 },
    { year: '2026', count: 1860, percent: 25.6 },
    { year: '2027', count: 2052, percent: 28.2 },
    { year: '2028', count: 1, percent: 0.0 }
  ]
};

export const ReportView: React.FC<ReportViewProps> = ({ allData, onRefresh }) => {
  // If system has real data, default to live data; if empty, show sample data
  const [useSampleData, setUseSampleData] = useState<boolean>(() => allData.length === 0);
  const [copied, setCopied] = useState(false);

  // Formatting helpers matching Indonesian Excel output
  const formatNum = (num: number) => new Intl.NumberFormat('id-ID').format(num);
  const formatPct = (pct: number) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(pct) + '%';
  };

  // Helper to extract 4-digit year from date string
  const getYearFromTempo = (tempoStr: string): string => {
    if (!tempoStr) return 'Lainnya';
    const match = tempoStr.trim().match(/\b(19\d\d|20\d\d)\b/);
    if (match) return match[1];
    const dt = new Date(tempoStr);
    if (!isNaN(dt.getTime())) return String(dt.getFullYear());
    return 'Lainnya';
  };

  // Computed data for Live Mode
  const liveStats = useMemo(() => {
    const total = allData.length;
    const sent = allData.filter(d => d.status === 'sent').length;
    const pending = total - sent;
    const successRate = total > 0 ? (sent / total) * 100 : 0;
    const pendingRate = total > 0 ? (pending / total) * 100 : 0;

    // Group by year
    const counts: Record<string, number> = {};
    allData.forEach(item => {
      const yr = getYearFromTempo(item.jatuh_tempo);
      counts[yr] = (counts[yr] || 0) + 1;
    });

    const sortedYears = Object.keys(counts).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    const yearlyDistribution = sortedYears.map(year => {
      const count = counts[year];
      const percent = total > 0 ? (count / total) * 100 : 0;
      return { year, count, percent };
    });

    return {
      total,
      sent,
      pending,
      successRate,
      pendingRate,
      yearlyDistribution
    };
  }, [allData]);

  // Active dataset
  const activeReport = useSampleData ? SAMPLE_IMAGE_DATA : liveStats;

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    const lines: string[] = [];
    lines.push('=== LAPORAN STATUS & DISTRIBUSI WAJIB PAJAK SAMSAT BANGLI ===');
    lines.push(`Tanggal Dibuat:;${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`);
    lines.push(`Sumber Data:;${useSampleData ? 'Data Sampel Gambar (7.275)' : 'Basis Data Riil Sistem'}`);
    lines.push('');
    lines.push('RINGKASAN UTAMA');
    lines.push(`TOTAL TARGET DATA;${activeReport.total}`);
    lines.push(`BERHASIL TERKIRIM (SENT);${activeReport.sent}`);
    lines.push(`PENDING (BELUM KIRIM);${activeReport.pending}`);
    lines.push(`TINGKAT KEBERHASILAN;${formatPct(activeReport.successRate)}`);
    lines.push('');
    lines.push('REKAPITULASI STATUS PENGIRIMAN');
    lines.push('Status;Jumlah;Persentase');
    lines.push(`Berhasil Terkirim (Sent);${activeReport.sent};${formatPct(activeReport.successRate)}`);
    lines.push(`Belum Terkirim (Pending);${activeReport.pending};${formatPct(activeReport.pendingRate)}`);
    lines.push(`Total;${activeReport.total};100,0%`);
    lines.push('');
    lines.push('DISTRIBUSI JATUH TEMPO PER TAHUN');
    lines.push('Tahun;Jumlah Kendaraan;Persentase');
    activeReport.yearlyDistribution.forEach(row => {
      lines.push(`${row.year};${row.count};${formatPct(row.percent)}`);
    });
    lines.push(`Total;${activeReport.total};100,0%`);

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_Samsat_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy Summary Table to Clipboard
  const handleCopy = () => {
    let text = `REKAPITULASI STATUS PENGIRIMAN\n`;
    text += `Status\tJumlah\tPersentase\n`;
    text += `Berhasil Terkirim (Sent)\t${formatNum(activeReport.sent)}\t${formatPct(activeReport.successRate)}\n`;
    text += `Belum Terkirim (Pending)\t${formatNum(activeReport.pending)}\t${formatPct(activeReport.pendingRate)}\n`;
    text += `Total\t${formatNum(activeReport.total)}\t100,0%\n\n`;
    text += `DISTRIBUSI JATUH TEMPO PER TAHUN\n`;
    text += `Tahun\tJumlah Kendaraan\tPersentase\n`;
    activeReport.yearlyDistribution.forEach(r => {
      text += `${r.year}\t${formatNum(r.count)}\t${formatPct(r.percent)}\n`;
    });
    text += `Total\t${formatNum(activeReport.total)}\t100,0%\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // SVG Pie Chart Geometry
  const pieData = useMemo(() => {
    const total = activeReport.total;
    if (total === 0) return { empty: true };

    const pSent = activeReport.sent / total;
    const cx = 110;
    const cy = 110;
    const r = 90;

    if (pSent <= 0) {
      return { allPending: true, cx, cy, r };
    }
    if (pSent >= 1) {
      return { allSent: true, cx, cy, r };
    }

    // Start at top (-90 degrees / -PI/2)
    const angleStart = -Math.PI / 2;
    const angleEnd = angleStart + (2 * Math.PI * pSent);

    const x0 = cx + r * Math.cos(angleStart);
    const y0 = cy + r * Math.sin(angleStart);
    const x1 = cx + r * Math.cos(angleEnd);
    const y1 = cy + r * Math.sin(angleEnd);

    const largeArcFlag = pSent > 0.5 ? 1 : 0;

    const pathSent = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largeArcFlag} 1 ${x1} ${y1} Z`;
    const pathPending = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${1 - largeArcFlag} 1 ${x0} ${y0} Z`;

    return {
      empty: false,
      pathSent,
      pathPending,
      cx,
      cy,
      r
    };
  }, [activeReport]);

  return (
    <div className="space-y-6 print:p-0">
      {/* Control Bar & Mode Selector (Hidden in Print) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Laporan Eksekutif Status & Distribusi Pajak
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Format resmi sesuai standar rekapitulasi Samsat Kabupaten Bangli
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Toggle between Live Database and Sample Image Reference */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setUseSampleData(false)}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                !useSampleData 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Data Riil ({formatNum(allData.length)})</span>
            </button>
            <button
              onClick={() => setUseSampleData(true)}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                useSampleData 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Contoh Format (7.275)</span>
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:text-blue-600 transition-all active:scale-95 shadow-sm"
              title="Perbarui Data dari Pusat"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Salin Isi Tabel Laporan"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin!' : 'Salin Tabel'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Main Printable Report Canvas (Exact Layout from Image) */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0">
        
        {/* Top 4 KPI Metric Summary Cards (Exact from Spreadsheet Image) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {/* Card 1: TOTAL TARGET DATA */}
          <div className="bg-[#f1f5f9] border border-slate-300 rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-tight">
              TOTAL TARGET DATA
            </span>
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1d4ed8] mt-1 tracking-tight">
              {formatNum(activeReport.total)}
            </span>
          </div>

          {/* Card 2: BERHASIL TERKIRIM (SENT) */}
          <div className="bg-[#e8f5e9] border border-emerald-200 rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-tight">
              BERHASIL TERKIRIM (SENT)
            </span>
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#2e7d32] mt-1 tracking-tight">
              {formatNum(activeReport.sent)}
            </span>
          </div>

          {/* Card 3: PENDING (BELUM KIRIM) */}
          <div className="bg-[#fef3c7] border border-amber-200 rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-tight">
              PENDING (BELUM KIRIM)
            </span>
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#b45309] mt-1 tracking-tight">
              {formatNum(activeReport.pending)}
            </span>
          </div>

          {/* Card 4: TINGKAT KEBERHASILAN */}
          <div className="bg-[#f1f5f9] border border-slate-300 rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-tight">
              TINGKAT KEBERHASILAN
            </span>
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1d4ed8] mt-1 tracking-tight">
              {formatPct(activeReport.successRate)}
            </span>
          </div>
        </div>

        {/* Two-Column Section: Left (Rekap & Chart), Right (Distribusi per Tahun) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (5 of 12 cols): Rekapitulasi Status & Chart */}
          <div className="lg:col-span-6 space-y-8">
            
            {/* Table 1: Rekapitulasi Status Pengiriman */}
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#1e40af] mb-2 tracking-tight">
                Rekapitulasi Status Pengiriman
              </h3>
              
              <div className="border border-slate-300 rounded-none overflow-hidden">
                <table className="w-full text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#1e4b8a] text-white">
                      <th className="py-2.5 px-4 text-left font-bold border border-[#1e4b8a]">Status</th>
                      <th className="py-2.5 px-4 text-right font-bold border border-[#1e4b8a] w-28">Jumlah</th>
                      <th className="py-2.5 px-4 text-right font-bold border border-[#1e4b8a] w-28">Persentase</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white hover:bg-slate-50 border-b border-slate-200">
                      <td className="py-2 px-4 text-slate-800 font-medium border-x border-slate-200">
                        Berhasil Terkirim (Sent)
                      </td>
                      <td className="py-2 px-4 text-right font-medium text-slate-800 border-x border-slate-200">
                        {formatNum(activeReport.sent)}
                      </td>
                      <td className="py-2 px-4 text-right font-medium text-slate-800 border-x border-slate-200">
                        {formatPct(activeReport.successRate)}
                      </td>
                    </tr>
                    <tr className="bg-white hover:bg-slate-50 border-b border-slate-300">
                      <td className="py-2 px-4 text-slate-800 font-medium border-x border-slate-200">
                        Belum Terkirim (Pending)
                      </td>
                      <td className="py-2 px-4 text-right font-medium text-slate-800 border-x border-slate-200">
                        {formatNum(activeReport.pending)}
                      </td>
                      <td className="py-2 px-4 text-right font-medium text-slate-800 border-x border-slate-200">
                        {formatPct(activeReport.pendingRate)}
                      </td>
                    </tr>
                    {/* Summary Row */}
                    <tr className="bg-white border-t-2 border-b-2 border-slate-800 font-bold">
                      <td className="py-2.5 px-4 text-slate-900 border-x border-slate-200">
                        Total
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-900 border-x border-slate-200">
                        {formatNum(activeReport.total)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-900 border-x border-slate-200">
                        100,0%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart: Status Pengiriman (Pie Chart matching the image) */}
            <div className="border border-slate-300 rounded-none p-6 bg-white shadow-xs">
              <h4 className="text-center text-lg font-bold text-slate-900 mb-6">
                Status Pengiriman
              </h4>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                {/* SVG Pie Chart Canvas */}
                <div className="relative w-[220px] h-[220px] flex-shrink-0">
                  <svg viewBox="0 0 220 220" className="w-full h-full transform drop-shadow-sm">
                    {pieData.empty ? (
                      <circle cx="110" cy="110" r="90" fill="#e2e8f0" />
                    ) : pieData.allPending ? (
                      <circle cx="110" cy="110" r="90" fill="#c0504d" />
                    ) : pieData.allSent ? (
                      <circle cx="110" cy="110" r="90" fill="#4682b4" />
                    ) : (
                      <>
                        {/* Slice 1: Berhasil Terkirim (Sent) - Blue */}
                        <path 
                          d={pieData.pathSent} 
                          fill="#4682b4" 
                          stroke="#ffffff" 
                          strokeWidth="1.5"
                          className="hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          <title>Berhasil Terkirim (Sent): {formatNum(activeReport.sent)} ({formatPct(activeReport.successRate)})</title>
                        </path>

                        {/* Slice 2: Belum Terkirim (Pending) - Terracotta Red */}
                        <path 
                          d={pieData.pathPending} 
                          fill="#c0504d" 
                          stroke="#ffffff" 
                          strokeWidth="1.5"
                          className="hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          <title>Belum Terkirim (Pending): {formatNum(activeReport.pending)} ({formatPct(activeReport.pendingRate)})</title>
                        </path>
                      </>
                    )}
                  </svg>
                </div>

                {/* Legend on the right (Exact from image) */}
                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-none bg-[#4682b4] flex-shrink-0 shadow-xs" />
                    <span className="text-slate-700 font-medium">Berhasil Terkirim (Sent)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-none bg-[#c0504d] flex-shrink-0 shadow-xs" />
                    <span className="text-slate-700 font-medium">Belum Terkirim (Pending)</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column (6 of 12 cols): Distribusi Jatuh Tempo per Tahun */}
          <div className="lg:col-span-6">
            <h3 className="text-base sm:text-lg font-black text-[#1e40af] mb-2 tracking-tight">
              Distribusi Jatuh Tempo per Tahun
            </h3>

            <div className="border border-slate-300 rounded-none overflow-hidden max-h-[640px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#1e4b8a] text-white">
                    <th className="py-2.5 px-4 text-center font-bold border border-[#1e4b8a] w-24">Tahun</th>
                    <th className="py-2.5 px-4 text-right font-bold border border-[#1e4b8a]">Jumlah Kendaraan</th>
                    <th className="py-2.5 px-4 text-right font-bold border border-[#1e4b8a] w-28">Persentase</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReport.yearlyDistribution.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 italic">
                        Tidak ada data jatuh tempo
                      </td>
                    </tr>
                  ) : (
                    activeReport.yearlyDistribution.map((row, idx) => (
                      <tr 
                        key={row.year} 
                        className={`border-b border-slate-200 hover:bg-slate-50 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                        }`}
                      >
                        <td className="py-1.5 px-4 text-center text-slate-800 font-medium border-x border-slate-200">
                          {row.year}
                        </td>
                        <td className="py-1.5 px-4 text-right text-slate-800 font-medium border-x border-slate-200 font-mono">
                          {formatNum(row.count)}
                        </td>
                        <td className="py-1.5 px-4 text-right text-slate-800 font-medium border-x border-slate-200 font-mono">
                          {formatPct(row.percent)}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Summary Row */}
                  <tr className="bg-white border-t-2 border-b-2 border-slate-800 font-bold sticky bottom-0 shadow-xs">
                    <td className="py-2.5 px-4 text-center text-slate-900 border-x border-slate-200">
                      Total
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-900 border-x border-slate-200 font-mono">
                      {formatNum(activeReport.total)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-900 border-x border-slate-200 font-mono">
                      100,0%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Print Footer Note */}
            <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 font-medium print:mt-8">
              <span>Sistem Manajemen Samsat Kabupaten Bangli</span>
              <span>Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
