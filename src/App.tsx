/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  MessageCircle, 
  FileText, 
  BarChart2, 
  RefreshCw, 
  Download, 
  Upload, 
  PlusCircle, 
  Plus, 
  List, 
  FileSpreadsheet, 
  Send, 
  Search,
  AlertCircle,
  Clock,
  CheckCircle,
  Trash2,
  Edit2,
  X,
  AlertTriangle,
  Info,
  Shield,
  FileCheck,
  PieChart,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TaxPayer, TabType, AppBackup } from './types.ts';
import { ReportView } from './components/ReportView.tsx';

const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxs6dijT3fsPRDZ_CFc9BTuYbo6nvXEsOHozJyIqrCKz169W8Etg67OgxvpPEcU2aZC/exec";
const STORAGE_KEY = 'samsat_wajib_pajak_data';
const TEMPLATE_KEY = 'samsat_template_pesan';
const DEFAULT_TEMPLATE = 'Yth. Bapak/Ibu [Nama], kami informasikan bahwa pajak kendaraan dengan No. Pol [Nopol] akan jatuh tempo pada [Tanggal]. Mohon segera melakukan pembayaran di Samsat Bangli. Terima kasih.';

export default function App() {
  // --- States ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('samsat_auth') === 'true');
  const [userRole, setUserRole] = useState<'admin' | 'user'>(() => (localStorage.getItem('samsat_role') as any) || 'user');
  const [loginError, setLoginError] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  const [allData, setAllData] = useState<TaxPayer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState(() => localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE);
  const [useAntiBan, setUseAntiBan] = useState(() => localStorage.getItem('samsat_use_antiban') === 'true');
  const [previewTrigger, setPreviewTrigger] = useState(0);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' | 'warn' | 'info' }[]>([]);
  const [sendingMethod, setSendingMethod] = useState<'wa_web' | 'cloud_api'>(() => {
    return (localStorage.getItem('samsat_sending_method') as 'wa_web' | 'cloud_api') || 'wa_web';
  });
  const [waConfig, setWaConfig] = useState<{ configured: boolean; hasToken: boolean; hasPhoneId: boolean } | null>(null);
  const [blastProgress, setBlastProgress] = useState<{ total: number; sent: number; active: boolean; currentName: string; errors: string[] } | null>(null);
  
  // Modals
  const [deleteTarget, setDeleteTarget] = useState<TaxPayer | null>(null);
  const [editTarget, setEditTarget] = useState<TaxPayer | null>(null);
  
  // Filters
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterName, setFilterName] = useState('');
  const [blastFilterDays, setBlastFilterDays] = useState('all');
  const [blastFilterMonth, setBlastFilterMonth] = useState('all');
  const [blastFilterStatus, setBlastFilterStatus] = useState('all');
  const [blastFilterSearch, setBlastFilterSearch] = useState('');

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
  }, [allData]);

  useEffect(() => {
    localStorage.setItem(TEMPLATE_KEY, template);
  }, [template]);

  useEffect(() => {
    localStorage.setItem('samsat_use_antiban', String(useAntiBan));
  }, [useAntiBan]);

  useEffect(() => {
    localStorage.setItem('samsat_sending_method', sendingMethod);
    if (sendingMethod === 'cloud_api') {
      checkWaConfigStatus();
    }
  }, [sendingMethod]);

  const checkWaConfigStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp-status');
      if (res.ok) {
        const data = await res.json();
        setWaConfig(data);
      }
    } catch (e) {
      console.error('Gagal mengecek konfigurasi WhatsApp', e);
    }
  };

  useEffect(() => {
    // Initial fetch from Google Sheet and check WA config status
    loadFromGoogleSheet();
    checkWaConfigStatus();
  }, []);

  // --- Helpers ---
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'warn' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const formatDate = (d: string) => {
    if (!d) return '-';
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'Format Tanggal Salah';
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const daysUntil = (d: string) => {
    if (!d) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return 0;
    dt.setHours(0, 0, 0, 0);
    return Math.ceil((dt.getTime() - now.getTime()) / 86400000);
  };

  const getWaktuGreeting = () => {
    const hr = new Date().getHours();
    if (hr >= 4 && hr < 11) return 'Pagi';
    if (hr >= 11 && hr < 15) return 'Siang';
    if (hr >= 15 && hr < 18) return 'Sore';
    return 'Malam';
  };

  const generateRandomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const applySpintax = (text: string) => {
    let spun = text;
    const regex = /\{([^{}]+)\}/;
    while (regex.test(spun)) {
      spun = spun.replace(regex, (match, choicesGroup) => {
        const choices = choicesGroup.split('|');
        const randomIndex = Math.floor(Math.random() * choices.length);
        return choices[randomIndex];
      });
    }
    return spun;
  };

  const formatMessage = useCallback((item: TaxPayer, isPreview = false) => {
    let msg = template
      .replace(/\[Nama\]/g, item.nama)
      .replace(/\[Nopol\]/g, item.nopol)
      .replace(/\[Tanggal\]/g, formatDate(item.jatuh_tempo))
      .replace(/\[Waktu\]/g, getWaktuGreeting())
      .replace(/\[IdAcak\]/g, generateRandomId());
    
    msg = applySpintax(msg);

    if (useAntiBan) {
      msg += `\n\n[Ref: #${generateRandomId()}]`;
    }

    return msg;
  }, [template, useAntiBan]);

  const previewMessage = useMemo(() => {
    const dummy: TaxPayer = {
      nama: 'Bpk/Ibu I Wayan Sudiana',
      nopol: 'DK 1234 AB',
      jatuh_tempo: '2025-08-15',
      no_wa: '628123456789',
      status: 'pending',
      sent_at: '',
      timestamp: ''
    };
    return formatMessage(dummy, true);
  }, [template, useAntiBan, previewTrigger, formatMessage]);

  const normalizeData = (data: any[]): TaxPayer[] => {
    if (!Array.isArray(data)) return [];
    return data.map(item => {
      // Handle data from Google Sheet or manual input
      let nopol = String(item.nopol || '').toUpperCase().trim();
      let nama = String(item.nama || '').trim();
      let rawTempo = String(item.jatuh_tempo || '').trim();
      
      let jatutempo = '';
      if (rawTempo) {
        // Handle common formats from sheets
        let dt = new Date(rawTempo);
        
        // If JS Date fails, try local formats DD-MM-YYYY or DD/MM/YYYY
        if (isNaN(dt.getTime())) {
          const parts = rawTempo.split(/[-/]/);
          if (parts.length === 3) {
            // Check if year is first or last
            if (parts[0].length === 4) { // YYYY-MM-DD
              dt = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
            } else if (parts[2].length === 4) { // DD-MM-YYYY
              dt = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            }
          }
        }

        if (!isNaN(dt.getTime())) {
          jatutempo = dt.toISOString().split('T')[0];
        } else {
          jatutempo = rawTempo; // Fallback, though filters might struggle
        }
      }

      return {
        nopol,
        nama,
        jatuh_tempo: jatutempo,
        no_wa: formatWA(String(item.no_wa || '')),
        status: (item.status === 'sent' ? 'sent' : 'pending') as 'pending' | 'sent',
        sent_at: item.sent_at || '',
        timestamp: item.timestamp || new Date().toISOString()
      };
    }).filter(d => d.nopol && d.nama); // Filter out empty entries
  };

  const formatWA = (num: string) => {
    let clean = num.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (!clean.startsWith('62')) clean = '62' + clean;
    return clean;
  };

  // --- Core Functions ---
  const loadFromGoogleSheet = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${GOOGLE_SHEET_URL}?action=getData`);
      const result = await response.json();
      if (result.status === 'success' && result.data) {
        const cleaned = normalizeData(result.data);
        setAllData(cleaned);
        showToast(`✅ ${cleaned.length} data berhasil dimuat!`);
      }
    } catch (error) {
      console.error('Error loading from GS:', error);
      showToast('Gagal terhubung ke Google Sheet. Menggunakan data lokal.', 'warn');
    } finally {
      setLoading(false);
    }
  };

  const syncToGoogleSheet = async (dataToSync = allData) => {
    if (dataToSync.length === 0) {
      showToast('Tidak ada data untuk disinkronkan', 'warn');
      return;
    }
    setLoading(true);
    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'syncData', data: dataToSync, timestamp: new Date().toISOString() })
      });
      showToast('✅ Data sedang disinkronkan ke Google Sheet!');
    } catch (error) {
      showToast('Gagal menyinkronkan data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddData = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nopol = (formData.get('nopol') as string).toUpperCase();
    
    if (allData.some(d => d.nopol === nopol)) {
      showToast('No. Polisi sudah ada!', 'error');
      return;
    }

    const newData: TaxPayer = {
      nopol,
      nama: formData.get('nama') as string,
      jatuh_tempo: formData.get('tempo') as string,
      no_wa: formatWA(formData.get('wa') as string),
      status: 'pending',
      sent_at: '',
      timestamp: new Date().toISOString()
    };

    setAllData(prev => [...prev, newData]);
    e.currentTarget.reset();
    showToast('✅ Data berhasil ditambahkan!');
    syncToGoogleSheet([...allData, newData]);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const nopol = deleteTarget.nopol;
    setAllData(prev => prev.filter(d => d.nopol !== nopol));
    setDeleteTarget(null);
    showToast('✅ Data telah dihapus');
    
    // Sync deletion
    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ action: 'deleteData', nopol, timestamp: new Date().toISOString() })
      });
    } catch (e) {}
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    const formData = new FormData(e.currentTarget);
    const updated: TaxPayer = {
      ...editTarget,
      nopol: (formData.get('nopol') as string).toUpperCase(),
      nama: formData.get('nama') as string,
      jatuh_tempo: formData.get('tempo') as string,
      no_wa: formatWA(formData.get('wa') as string)
    };

    setAllData(prev => prev.map(d => d.nopol === editTarget.nopol ? updated : d));
    setEditTarget(null);
    showToast('✅ Perubahan disimpan');
    syncToGoogleSheet(allData.map(d => d.nopol === editTarget.nopol ? updated : d));
  };

  const sendWA = async (item: TaxPayer) => {
    const msg = formatMessage(item);
    
    if (sendingMethod === 'wa_web') {
      const url = `https://wa.me/${item.no_wa}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');

      const updated = { ...item, status: 'sent' as const, sent_at: new Date().toISOString() };
      setAllData(prev => prev.map(d => d.nopol === item.nopol ? updated : d));
      syncToGoogleSheet(allData.map(d => d.nopol === item.nopol ? updated : d));
      showToast('📱 Membuka WhatsApp Web...');
    } else {
      showToast('📤 Mengirim pesan via WhatsApp Cloud API...', 'info');
      try {
        const res = await fetch('/api/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: item.no_wa, message: msg })
        });
        const data = await res.json();
        if (data.success) {
          const updated = { ...item, status: 'sent' as const, sent_at: new Date().toISOString() };
          setAllData(prev => prev.map(d => d.nopol === item.nopol ? updated : d));
          syncToGoogleSheet(allData.map(d => d.nopol === item.nopol ? updated : d));
          showToast(`✅ Pesan berhasil dikirim ke ${item.nama}!`);
        } else {
          showToast(`❌ Gagal: ${data.error}`, 'error');
        }
      } catch (err: any) {
        showToast(`❌ Terjadi kesalahan: ${err.message || err}`, 'error');
      }
    }
  };

  const sendBlastAll = async () => {
    const list = filteredBlastData.filter(d => d.status === 'pending');
    if (list.length === 0) {
      showToast('Tidak ada data pending untuk dikirim', 'info');
      return;
    }

    if (sendingMethod === 'wa_web') {
      list.forEach(item => {
        const msg = formatMessage(item);
        const url = `https://wa.me/${item.no_wa}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
      });

      const now = new Date().toISOString();
      const newData = allData.map(d => {
        if (list.some(l => l.nopol === d.nopol)) {
          return { ...d, status: 'sent' as const, sent_at: now };
        }
        return d;
      });
      setAllData(newData);
      syncToGoogleSheet(newData);
      showToast(`📤 Membuka ${list.length} chat WhatsApp...`);
    } else {
      setBlastProgress({ total: list.length, sent: 0, active: true, currentName: '', errors: [] });
      
      let sentCount = 0;
      let updatedData = [...allData];
      const errorsList: string[] = [];

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        setBlastProgress(prev => prev ? { ...prev, currentName: item.nama } : null);
        const msg = formatMessage(item);

        try {
          const res = await fetch('/api/send-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: item.no_wa, message: msg })
          });
          const resData = await res.json();
          if (resData.success) {
            sentCount++;
            const now = new Date().toISOString();
            updatedData = updatedData.map(d => d.nopol === item.nopol ? { ...d, status: 'sent' as const, sent_at: now } : d);
            setAllData(updatedData);
            setBlastProgress(prev => prev ? { ...prev, sent: sentCount } : null);
          } else {
            errorsList.push(`${item.nama} (${item.nopol}): ${resData.error}`);
          }
        } catch (err: any) {
          errorsList.push(`${item.nama} (${item.nopol}): ${err.message || err}`);
        }

        await new Promise(resolve => setTimeout(resolve, 800));
      }

      syncToGoogleSheet(updatedData);
      setBlastProgress(prev => prev ? { ...prev, active: false, errors: errorsList } : null);
      
      if (sentCount === list.length) {
        showToast(`✅ Blast selesai! Berhasil mengirim ${sentCount} pesan.`);
      } else {
        showToast(`⚠️ Blast selesai. Terkirim: ${sentCount}/${list.length}.`, 'warn');
      }
    }
  };

  // --- Helpers for Date & Stats ---
  const isSentToday = useCallback((dateStr?: string) => {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const trimmed = dateStr.trim();
    if (!trimmed) return false;

    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (trimmed.startsWith(todayISO) || trimmed.startsWith(todayLocal)) {
      return true;
    }

    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return false;
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }, []);

  const formatSentTime = (dateStr?: string) => {
    if (!dateStr) return 'Hari ini';
    try {
      const dt = new Date(dateStr);
      if (isNaN(dt.getTime())) return 'Hari ini';
      return dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';
    } catch {
      return 'Hari ini';
    }
  };

  // --- Computed Data ---
  const stats = useMemo(() => {
    const total = allData.length;
    const sent = allData.filter(d => d.status === 'sent').length;
    const sentTodayList = allData.filter(d => d.status === 'sent' && isSentToday(d.sent_at));
    const sentToday = sentTodayList.length;
    const pending = total - sent;
    const dueSoon = allData.filter(d => {
      const dd = daysUntil(d.jatuh_tempo);
      return dd >= 0 && dd <= 7;
    });
    const overdue = allData.filter(d => daysUntil(d.jatuh_tempo) < 0);
    const percent = total > 0 ? Math.round((sent / total) * 100) : 0;
    return { total, sent, sentToday, sentTodayList, pending, dueSoon, overdue, percent };
  }, [allData, isSentToday]);

  const filteredTableData = useMemo(() => {
    let data = [...allData];
    if (filterFrom) data = data.filter(d => d.jatuh_tempo && d.jatuh_tempo >= filterFrom);
    if (filterTo) data = data.filter(d => d.jatuh_tempo && d.jatuh_tempo <= filterTo);
    
    if (filterName) {
      const q = filterName.toLowerCase().trim();
      const terms = q.split(/\s+/).filter(t => t.length > 0);
      const normalizedQ = q.replace(/[^a-z0-9]/g, '');
      
      data = data.filter(d => {
        const name = (d.nama || '').toLowerCase();
        const nopol = (d.nopol || '').toLowerCase();
        const normalizedNopol = nopol.replace(/[^a-z0-9]/g, '');
        
        // Match all terms or normalized string
        const matchesTerms = terms.length > 0 && terms.every(t => name.includes(t) || nopol.includes(t));
        const normalizedMatch = normalizedQ && normalizedNopol.includes(normalizedQ);
        
        return matchesTerms || normalizedMatch;
      });
    }
    return data.sort((a, b) => a.jatuh_tempo.localeCompare(b.jatuh_tempo));
  }, [allData, filterFrom, filterTo, filterName]);

  const filteredBlastData = useMemo(() => {
    let data = [...allData];
    
    // Day-based filter (exclusive of month filter usually preferred but here we combine)
    if (blastFilterDays !== 'all') {
      const days = parseInt(blastFilterDays);
      data = data.filter(d => {
        const dd = daysUntil(d.jatuh_tempo);
        return dd >= 0 && dd <= days;
      });
    }

    // Month filter - use string split for reliability
    if (blastFilterMonth !== 'all') {
      const monthIndex = parseInt(blastFilterMonth); // 0-11
      const monthStr = (monthIndex + 1).toString().padStart(2, '0'); // "01"-"12"
      data = data.filter(d => {
        if (!d.jatuh_tempo || d.jatuh_tempo.length < 7) return false;
        // Format YYYY-MM-DD
        const [y, m] = d.jatuh_tempo.split('-');
        return m === monthStr;
      });
    }

    // Status filter
    if (blastFilterStatus !== 'all') {
      data = data.filter(d => d.status === blastFilterStatus);
    }

    // Search filter - more flexible matching
    if (blastFilterSearch) {
      const q = blastFilterSearch.toLowerCase().trim();
      const terms = q.split(/\s+/).filter(t => t.length > 0);
      const normalizedQ = q.replace(/[^a-z0-9]/g, '');
      
      data = data.filter(d => {
        const name = (d.nama || '').toLowerCase();
        const nopol = (d.nopol || '').toLowerCase();
        const normalizedNopol = nopol.replace(/[^a-z0-9]/g, '');
        
        const matchesTerms = terms.length > 0 && terms.every(t => name.includes(t) || nopol.includes(t));
        const normalizedMatch = normalizedQ && normalizedNopol.includes(normalizedQ);
        
        return matchesTerms || normalizedMatch;
      });
    }
    
    return data.sort((a, b) => a.jatuh_tempo.localeCompare(b.jatuh_tempo));
  }, [allData, blastFilterDays, blastFilterStatus, blastFilterMonth, blastFilterSearch]);

  // --- Export/Backup ---
  const exportCSV = () => {
    const headers = ['No. Polisi', 'Nama', 'Jatuh Tempo', 'No. WhatsApp', 'Status', 'Waktu Kirim'];
    const rows = filteredTableData.map(d => [
      d.nopol, d.nama, d.jatuh_tempo, d.no_wa, d.status, d.sent_at
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `samsat_data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('📊 CSV berhasil diekspor');
  };

  const handleBackup = () => {
    const backup: AppBackup = {
      version: '1.0',
      date: new Date().toISOString(),
      data: allData,
      template
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `samsat_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    showToast('💾 Backup berhasil');
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string) as AppBackup;
        if (backup.data && Array.isArray(backup.data)) {
          const cleaned = normalizeData(backup.data);
          setAllData(cleaned);
          if (backup.template) setTemplate(backup.template);
          showToast(`✅ Restore berhasil! ${cleaned.length} data dimuat.`);
          syncToGoogleSheet(cleaned);
        }
      } catch (err) {
        showToast('Format file backup tidak valid', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawData = JSON.parse(event.target?.result as string);
        const items = Array.isArray(rawData) ? rawData : (rawData.data || []);
        if (!Array.isArray(items)) {
          showToast('Format file JSON tidak dikenal', 'error');
          return;
        }
        
        const cleaned = normalizeData(items);
        if (cleaned.length === 0) {
          showToast('Tidak ada data valid yang ditemukan', 'warn');
          return;
        }

        setAllData(prev => {
          const existingNopols = new Set(prev.map(d => d.nopol));
          const newEntries = cleaned.filter(d => !existingNopols.has(d.nopol));
          
          if (newEntries.length === 0) {
            showToast('Semua data sudah ada di sistem', 'info');
            return prev;
          }

          const result = [...prev, ...newEntries];
          syncToGoogleSheet(result);
          showToast(`✅ Berhasil mengimpor ${newEntries.length} data baru!`);
          return result;
        });
      } catch (err) {
        showToast('Gagal membaca file JSON', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.username === 'admin' && loginForm.password === '123') {
      setIsAuthenticated(true);
      setUserRole('admin');
      localStorage.setItem('samsat_auth', 'true');
      localStorage.setItem('samsat_role', 'admin');
      showToast('✅ Login berhasil! Selamat datang Admin.');
    } else if (loginForm.username === 'user' && loginForm.password === '123') {
      setIsAuthenticated(true);
      setUserRole('user');
      localStorage.setItem('samsat_auth', 'true');
      localStorage.setItem('samsat_role', 'user');
      setCurrentTab('dashboard'); // Ensure they start on dashboard
      showToast('✅ Login berhasil! Selamat datang User.');
    } else {
      setLoginError('ID atau Password salah. Silakan coba lagi.');
      showToast('❌ Login gagal', 'error');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole('user');
    localStorage.removeItem('samsat_auth');
    localStorage.removeItem('samsat_role');
    showToast('🚪 Anda telah keluar sistem');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-blue-600/30 mx-auto mb-6 transform -rotate-3">
                S
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">SAMSAT BANGLI</h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Sistem Notifikasi Terpadu</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nama Pengguna (ID)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    value={loginForm.username}
                    onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Masukkan ID"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-medium focus:bg-white focus:border-blue-600 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Kata Sandi</label>
                <div className="relative">
                  <input 
                    type="password" 
                    required
                    value={loginForm.password}
                    onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Masukkan Password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-medium focus:bg-white focus:border-blue-600 outline-none transition-all"
                  />
                </div>
              </div>

              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg border border-rose-100 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" /> {loginError}
                </motion.div>
              )}

              <button 
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all uppercase tracking-widest text-xs"
              >
                Masuk Ke Sistem
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-50 text-center">
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Digital Governance Solution • Kabupaten Bangli</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <nav className="w-64 bg-white flex flex-col flex-shrink-0 z-40 border-r border-slate-200">
        <div className="p-8 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/20">S</div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 leading-none">SAMSAT</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kabupaten Bangli</span>
            </div>
          </div>
        </div>
        
        <div className="px-4 py-6 space-y-1 flex-1">
          {[
            { id: 'dashboard' as TabType, icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'data' as TabType, icon: Database, label: 'Basis Data' },
            { id: 'blast' as TabType, icon: MessageCircle, label: 'Kirim Pesan', adminOnly: true },
            { id: 'template' as TabType, icon: FileText, label: 'Format Pesan', adminOnly: true },
            { id: 'laporan' as TabType, icon: FileSpreadsheet, label: 'Laporan' },
            { id: 'statistik' as TabType, icon: BarChart2, label: 'Statistik' },
          ].filter(item => !item.adminOnly || userRole === 'admin').map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`sidebar-link w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentTab === item.id 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10 active:scale-95' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${currentTab === item.id ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        
        <div className="p-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status Sistem</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Terhubung dengan server pusat secara real-time.</p>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Toast Notification Container */}
        <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map(t => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`px-4 py-3 rounded-lg shadow-xl text-sm font-semibold text-white flex items-center gap-3 pointer-events-auto ${
                  t.type === 'error' ? 'bg-rose-600' : t.type === 'warn' ? 'bg-amber-500' : t.type === 'info' ? 'bg-blue-600' : 'bg-emerald-600'
                }`}
              >
                {t.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                {t.msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between flex-shrink-0 relative z-30">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {currentTab === 'dashboard' ? 'Ringkasan Laporan' : currentTab === 'data' ? 'Basis Data Wajib Pajak' : currentTab === 'blast' ? 'Automasi Pengiriman' : currentTab === 'template' ? 'Konfigurasi Pesan' : currentTab === 'laporan' ? 'Laporan Status & Distribusi Pajak' : 'Analisis Statistik'}
            </h1>
            <div className="w-px h-6 bg-slate-200" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Aplikasi Samsat v2.4</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-xs font-semibold text-slate-500">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>{allData.length} Wajib Pajak</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50/80 rounded-lg border border-indigo-100 text-xs font-semibold text-indigo-700">
              <Send className="w-3.5 h-3.5 text-indigo-600" />
              <span>{stats.sentToday} Terkirim Hari Ini</span>
            </div>
            
            <button 
              onClick={loadFromGoogleSheet}
              className="w-10 h-10 bg-white flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-all shadow-sm"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="w-px h-8 bg-slate-200 mx-1" />
            
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-200 flex items-center gap-2"
            >
              Keluar
            </button>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto relative z-10">
        <AnimatePresence mode="wait">
          {currentTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Quick Actions Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Kendalikan Data Anda</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gunakan fitur import/export untuk kecepatan input</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setCurrentTab('laporan')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all active:scale-95"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                    <span>Laporan Resmi</span>
                  </button>
                  <label className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer shadow-lg shadow-blue-600/20 active:scale-95 group">
                    <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                    <span>Import JSON</span>
                    <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                  </label>
                  <button 
                    onClick={exportCSV}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all active:scale-95 group"
                  >
                    <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                    <span>Ekspor CSV</span>
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                {[
                  { label: 'Total Wajib Pajak', val: stats.total, color: 'text-blue-600', icon: Database, bg: 'bg-blue-50 text-blue-600', badge: 'Basis Data' },
                  { label: 'Pesan Terkirim Hari Ini', val: stats.sentToday, color: 'text-indigo-600', icon: Send, bg: 'bg-indigo-50 text-indigo-600', badge: 'Hari Ini' },
                  { label: 'Total Terkirim', val: stats.sent, color: 'text-emerald-600', icon: CheckCircle, bg: 'bg-emerald-50 text-emerald-600', badge: `${stats.percent}%` },
                  { label: 'Menunggu Antrian', val: stats.pending, color: 'text-amber-600', icon: Clock, bg: 'bg-amber-50 text-amber-600', badge: 'Antrian' },
                  { label: 'Hampir Jatuh Tempo', val: stats.dueSoon.length, color: 'text-rose-600', icon: AlertCircle, bg: 'bg-rose-50 text-rose-600', badge: '≤ 7 Hari' },
                ].map((s, i) => (
                  <div key={i} className="elegant-card p-6 flex flex-col justify-between hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${s.bg}`}>
                         <s.icon className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100 uppercase tracking-wider">{s.badge}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
                      <h2 className={`text-3xl font-bold ${s.color} tracking-tight`}>{s.val}</h2>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pesan Terkirim Hari Ini */}
                <div className="elegant-card flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                        <Send className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm tracking-tight uppercase">Pesan Terkirim Hari Ini</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aktivitas WhatsApp Terakhir</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">{stats.sentToday} Terkirim</span>
                  </div>
                  <div className="p-6 space-y-4 max-h-[400px] overflow-auto custom-scrollbar bg-slate-50/10">
                    {stats.sentTodayList.length === 0 ? (
                      <div className="text-center py-20 text-slate-300 flex flex-col items-center gap-3">
                         <Send className="w-10 h-10 opacity-20" />
                         <span className="text-xs font-bold uppercase tracking-widest opacity-50 italic">Belum ada pesan terkirim hari ini</span>
                      </div>
                    ) : stats.sentTodayList.map(d => (
                      <div key={d.nopol} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:border-indigo-200 transition-all group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 text-xs border border-indigo-100 flex-shrink-0">
                            {d.nopol.slice(0, 2)}
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="text-sm font-bold text-slate-900 tracking-tight truncate">{d.nopol}</p>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5 truncate">{d.nama}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> {formatSentTime(d.sent_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 text-center">
                    {userRole === 'admin' ? (
                      <button onClick={() => setCurrentTab('blast')} className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] hover:text-indigo-600 transition-all">Buka Automasi Pengiriman</button>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Log Notifikasi Hari Ini</span>
                    )}
                  </div>
                </div>

                {/* Tunggakan Pajak */}
                <div className="elegant-card flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm tracking-tight uppercase">Daftar Tunggakan Pajak</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Berpengaruh pada kepatuhan pajak</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-rose-600 bg-white px-3 py-1.5 rounded-lg border border-rose-100">{stats.overdue.length} Data</span>
                  </div>
                  <div className="p-6 space-y-4 max-h-[400px] overflow-auto custom-scrollbar bg-slate-50/10">
                    {stats.overdue.length === 0 ? (
                      <div className="text-center py-20 text-slate-300 flex flex-col items-center gap-3">
                         <CheckCircle className="w-10 h-10 opacity-20" />
                         <span className="text-xs font-bold uppercase tracking-widest opacity-50 italic">Tidak ada tunggakan pajak terdeteksi</span>
                      </div>
                    ) : stats.overdue.map(d => (
                      <div key={d.nopol} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:border-blue-200 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center font-bold text-slate-400 text-xs border border-slate-100">
                            {d.nopol.slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 tracking-tight">{d.nopol}</p>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">{d.nama}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">+{Math.abs(daysUntil(d.jatuh_tempo))} Hari</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 text-center">
                    <button onClick={() => setCurrentTab('data')} className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] hover:text-blue-600 transition-all">Lihat Seluruh Basis Data</button>
                  </div>
                </div>

                {/* Segera Jatuh Tempo */}
                <div className="elegant-card flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm tracking-tight uppercase">Mendekati Jatuh Tempo</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Periode 7 Hari Ke Depan</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-amber-600 bg-white px-3 py-1.5 rounded-lg border border-amber-100">{stats.dueSoon.length} Data</span>
                  </div>
                  <div className="p-6 space-y-4 max-h-[400px] overflow-auto custom-scrollbar bg-slate-50/10">
                    {stats.dueSoon.length === 0 ? (
                      <div className="text-center py-20 text-slate-300 flex flex-col items-center gap-3">
                         <Shield className="w-10 h-10 opacity-20" />
                         <span className="text-xs font-bold uppercase tracking-widest opacity-50 italic">Belum ada jatuh tempo terdekat</span>
                      </div>
                    ) : stats.dueSoon.map(d => (
                      <div key={d.nopol} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:border-blue-200 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center font-bold text-slate-400 text-xs border border-slate-100">
                             {d.nopol.slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 tracking-tight">{d.nopol}</p>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">{d.nama}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100">Sisa {daysUntil(d.jatuh_tempo)} Hari</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 text-center">
                    {userRole === 'admin' ? (
                      <button onClick={() => setCurrentTab('blast')} className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] hover:text-blue-600 transition-all">Buka Menu Pengiriman</button>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Samsat Bangli Digital</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentTab === 'data' && (
            <motion.div 
              key="data"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Form Input */}
              <div className="elegant-card p-8 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <PlusCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg tracking-tight">Tambah Wajib Pajak Baru</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Input data kendaraan dan pemilik</p>
                  </div>
                </div>
                <form onSubmit={handleAddData} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1">No. Polisi</label>
                    <input name="nopol" required placeholder="Contoh: DK 1234 AB" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-blue-600 outline-none transition-all placeholder:text-slate-300" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1">Nama Pemilik</label>
                    <input name="nama" required placeholder="Masukkan Nama Lengkap" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-blue-600 outline-none transition-all placeholder:text-slate-300" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1">Jatuh Tempo</label>
                    <input name="tempo" type="date" required className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-blue-600 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1">No. WhatsApp</label>
                    <input name="wa" required placeholder="08123456789" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-blue-600 outline-none transition-all placeholder:text-slate-300" />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="btn-primary w-full py-2.5 h-[42px] leading-none">
                      <Plus className="w-4 h-4" /> Simpan Data
                    </button>
                  </div>
                </form>
              </div>

              {/* Table List */}
              <div className="elegant-card overflow-hidden flex flex-col bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="px-8 py-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                      <List className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base tracking-tight">Basis Data Wajib Pajak</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Total terdaftar: {allData.length} Kendaraan</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100 text-xs text-slate-500">
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Cari Nama / No. Polisi..." 
                        value={filterName}
                        onChange={e => setFilterName(e.target.value)}
                        className="bg-transparent outline-none font-semibold w-40 placeholder:text-slate-300"
                      />
                      {filterName && <button onClick={() => setFilterName('')} className="text-rose-500 font-bold ml-1">X</button>}
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100 text-xs text-slate-500">
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                      <div className="flex items-center gap-2">
                        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="bg-transparent outline-none font-semibold uppercase tracking-wider" />
                        <span className="text-slate-300">s/d</span>
                        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="bg-transparent outline-none font-semibold uppercase tracking-wider" />
                      </div>
                      {(filterFrom || filterTo) && <button onClick={() => { setFilterFrom(''); setFilterTo(''); }} className="ml-2 text-rose-500 font-bold">X</button>}
                    </div>
                    <button onClick={exportCSV} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Laporan CSV
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                        <th className="px-8 py-4 w-16 text-center">No</th>
                        <th className="px-4 py-4 w-40">No. Polisi</th>
                        <th className="px-4 py-4">Nama Pemilik</th>
                        <th className="px-4 py-4">Jatuh Tempo</th>
                        <th className="px-4 py-4 w-32">Status Pesan</th>
                        <th className="px-8 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredTableData.length === 0 ? (
                        <tr><td colSpan={6} className="py-20 text-center text-slate-300 font-medium text-xs">Belum ada data tersedia...</td></tr>
                      ) : filteredTableData.map((d, i) => (
                        <tr key={d.nopol} className="hover:bg-slate-50/50 transition-all group">
                          <td className="px-8 py-4 text-center text-slate-300 font-mono text-[11px] font-bold">{(i + 1).toString().padStart(2, '0')}</td>
                          <td className="px-4 py-4">
                            <span className="px-3 py-1 bg-slate-900 text-white rounded-md text-xs font-bold tracking-wider inline-block">{d.nopol}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-900 tracking-tight">{d.nama}</span>
                              <span className="text-[10px] font-medium text-slate-400 mt-0.5 flex items-center gap-1.5 uppercase tracking-wider">
                                <MessageCircle className="w-3 h-3 text-emerald-500" /> {d.no_wa}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-600 tracking-tight">{formatDate(d.jatuh_tempo)}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${daysUntil(d.jatuh_tempo) < 0 ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${daysUntil(d.jatuh_tempo) < 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                                  {daysUntil(d.jatuh_tempo) < 0 ? `Telat ${Math.abs(daysUntil(d.jatuh_tempo))} Hari` : `${daysUntil(d.jatuh_tempo)} Hari Lagi`}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className={d.status === 'sent' ? 'status-sent' : 'status-pending'}>
                              {d.status === 'sent' ? 'Terkirim' : 'Tertunda'}
                            </div>
                          </td>
                          <td className="px-8 py-4 text-right">
                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => setEditTarget(d)} className="w-8 h-8 bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-lg transition-all">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteTarget(d)} className="w-8 h-8 bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:border-rose-200 rounded-lg transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-50 text-center">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sistem Pengelolaan Data Samsat • Kabupaten Bangli</p>
                </div>
              </div>
            </motion.div>
          )}

          {currentTab === 'blast' && (
            <motion.div 
              key="blast"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="elegant-card p-8 bg-white border border-slate-200 shadow-sm rounded-xl">
                <div className="flex flex-wrap items-center justify-between gap-8 mb-10">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                      <Send className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-xl tracking-tight leading-none">Automasi Pengiriman Pesan</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full" /> Protokol Komunikasi Massal
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${sendingMethod === 'cloud_api' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                      Metode: {sendingMethod === 'cloud_api' ? '📡 Cloud API' : '💻 WhatsApp Web'}
                    </span>
                    <button 
                      onClick={sendBlastAll}
                      disabled={filteredBlastData.filter(d => d.status === 'pending').length === 0}
                      className="bg-blue-600 disabled:bg-slate-100 disabled:text-slate-300 text-white font-bold px-8 py-3 rounded-lg shadow-lg shadow-blue-600/20 transition-all flex items-center gap-3 active:scale-95 text-sm"
                    >
                      <MessageCircle className="w-4 h-4" /> Kirim Sekaligus ({filteredBlastData.filter(d => d.status === 'pending').length})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 p-6 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Cari Nama / No. Polisi</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={blastFilterSearch} 
                        onChange={e => setBlastFilterSearch(e.target.value)}
                        placeholder="Contoh: Budi / DK..."
                        className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-600 outline-none focus:border-blue-600 shadow-sm transition-all"
                      />
                      {blastFilterSearch && (
                        <button onClick={() => setBlastFilterSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 font-bold hover:scale-110 transition-transform">X</button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Rentang Waktu</label>
                    <select value={blastFilterDays} onChange={e => setBlastFilterDays(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 outline-none focus:border-blue-600 shadow-sm transition-all">
                      <option value="all">Semua Data</option>
                      <option value="7">7 Hari Ke Depan</option>
                      <option value="14">14 Hari Ke Depan</option>
                      <option value="30">30 Hari Ke Depan</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Filter Bulan</label>
                    <select value={blastFilterMonth} onChange={e => setBlastFilterMonth(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 outline-none focus:border-blue-600 shadow-sm transition-all">
                      <option value="all">Semua Bulan</option>
                      <option value="0">Januari</option>
                      <option value="1">Februari</option>
                      <option value="2">Maret</option>
                      <option value="3">April</option>
                      <option value="4">Mei</option>
                      <option value="5">Juni</option>
                      <option value="6">Juli</option>
                      <option value="7">Agustus</option>
                      <option value="8">September</option>
                      <option value="9">Oktober</option>
                      <option value="10">November</option>
                      <option value="11">Desember</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Status Verifikasi</label>
                    <select value={blastFilterStatus} onChange={e => setBlastFilterStatus(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 outline-none focus:border-blue-600 shadow-sm transition-all">
                      <option value="all">Semua Status</option>
                      <option value="pending">Belum Terkirim</option>
                      <option value="sent">Sudah Terkirim</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-auto pr-2 custom-scrollbar">
                  {filteredBlastData.length === 0 ? (
                    <div className="col-span-full py-32 text-center text-slate-300 flex flex-col items-center gap-4">
                      <div className="p-6 bg-slate-50 rounded-full border border-slate-100">
                        <Search className="w-8 h-8 opacity-20" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest opacity-50 italic">Tidak ada data yang sesuai filter</span>
                    </div>
                  ) : filteredBlastData.map(d => (
                    <div key={d.nopol} className="bg-white p-5 rounded-xl border border-slate-100 flex items-center justify-between gap-4 hover:border-blue-200 hover:shadow-md transition-all group relative">
                      {d.status === 'sent' && <div className="absolute top-0 right-0 p-1.5 bg-emerald-500 text-white rounded-tr-xl rounded-bl-xl shadow-sm"><CheckCircle className="w-3 h-3" /></div>}
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-[15px] truncate tracking-tight mb-1">{d.nama}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase tracking-wider">{d.nopol}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d.no_wa}</span>
                        </div>
                        <div className={`mt-3 inline-flex items-center gap-2 font-bold text-[9px] uppercase tracking-wider px-3 py-1 rounded-md ${daysUntil(d.jatuh_tempo) < 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                           {formatDate(d.jatuh_tempo)}
                        </div>
                      </div>
                      <button 
                        onClick={() => sendWA(d)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-90 shadow-sm ${
                          d.status === 'sent' ? 'bg-slate-50 text-slate-300 hover:text-blue-600 hover:bg-white border border-slate-200' : 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600'
                        }`}
                        title="Kirim Pesan Manual"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {currentTab === 'statistik' && (
            <motion.div 
              key="statistik"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="elegant-card p-12 flex flex-col items-center bg-white relative overflow-hidden">
                  <div className="absolute left-0 top-0 w-32 h-32 bg-purple-50/50 rounded-full blur-3xl" />
                  <div className="w-full flex items-center justify-between mb-12 relative z-10">
                    <div>
                      <h3 className="font-black text-[#0e1318] text-xl tracking-tight">System Efficiency</h3>
                      <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1">Data Processing Metrics</p>
                    </div>
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm">
                      <PieChart className="w-6 h-6 text-canva-purple" />
                    </div>
                  </div>
                  
                  <div className="relative w-64 h-64 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 224 224">
                      <circle cx="112" cy="112" r="90" fill="transparent" stroke="#f2f3f7" strokeWidth="24" />
                      <circle 
                        cx="112" cy="112" r="90" fill="transparent" 
                        stroke="url(#canvaGradient)" strokeWidth="24" strokeLinecap="round"
                        strokeDasharray="565.48" 
                        strokeDashoffset={565.48 - (565.48 * (stats.sent / (stats.total || 1)))} 
                        className="transition-all duration-1000 ease-out"
                      />
                      <defs>
                        <linearGradient id="canvaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#7d2ae8" />
                          <stop offset="100%" stopColor="#00c4cc" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-5xl font-black text-[#0e1318] tracking-tighter">{Math.round((stats.sent / (stats.total || 1)) * 100)}%</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 translate-y-1">Synced Node</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8 w-full mt-14 bg-[#f2f3f7]/50 p-8 rounded-[32px] border border-white shadow-inner relative z-10">
                    <div className="text-center">
                       <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivered</p>
                       <p className="text-2xl font-black text-canva-purple">{stats.sent}</p>
                    </div>
                    <div className="text-center border-l border-white/50">
                       <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">In Buffer</p>
                       <p className="text-2xl font-black text-canva-cyan">{stats.pending}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="p-12 canva-gradient rounded-[40px] shadow-2xl shadow-purple-500/20 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                    <div className="flex items-center gap-5 mb-10 relative z-10">
                       <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                         <BarChart2 className="w-7 h-7 text-white" />
                       </div>
                       <div>
                         <h4 className="text-white font-black text-2xl tracking-tight">Kesehatan Data</h4>
                         <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em]">Real-time Health Score</p>
                       </div>
                    </div>
                    <div className="space-y-10 relative z-10">
                      <div>
                        <div className="flex justify-between text-[11px] font-black text-white/50 uppercase tracking-[0.2em] mb-4">
                          <span>Valid Node Access</span>
                          <span className="text-white">{Math.round((stats.total - stats.overdue.length) / (stats.total || 1) * 100)}%</span>
                        </div>
                        <div className="h-4 bg-white/10 rounded-[20px] overflow-hidden border border-white/10 p-1">
                          <div className="h-full bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.5)] transition-all duration-1000" style={{ width: `${((stats.total - stats.overdue.length) / (stats.total || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] font-black text-white/50 uppercase tracking-[0.2em] mb-4">
                          <span>Overdue Protocol</span>
                          <span className="text-rose-300">{Math.round(stats.overdue.length / (stats.total || 1) * 100)}%</span>
                        </div>
                        <div className="h-4 bg-white/10 rounded-[20px] overflow-hidden border border-white/10 p-1">
                          <div className="h-full bg-rose-500 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.5)] transition-all duration-1000" style={{ width: `${(stats.overdue.length / (stats.total || 1)) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-12 text-[11px] text-white/40 font-black uppercase tracking-[0.1em] border-t border-white/10 pt-6">Last Intelligence Sync: {new Date().toLocaleTimeString()} WITA</div>
                  </div>

                  <div className="elegant-card p-10 bg-white overflow-hidden relative group border-none">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                       <TrendingUp className="w-24 h-24 text-canva-purple" />
                    </div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-canva-purple" />
                      </div>
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Prediksi Intelijen</h4>
                    </div>
                    <p className="text-[15px] font-bold text-slate-700 leading-[1.7] italic border-l-4 border-canva-purple pl-6">
                      Terdapat <span className="text-canva-purple not-italic font-black decoration-purple-100 decoration-[6px] underline-offset-[-2px] tracking-tight">{stats.dueSoon.length} unit kendaraan</span> terdeteksi akan mencapai masa jatuh tempo. <span className="text-slate-900 not-italic font-black">Rekomendasi:</span> Segera inisiasi messaging protocol.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentTab === 'template' && (
            <motion.div 
              key="template"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-4xl mx-auto"
            >
              <div className="elegant-card p-10 bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600" />
                <div className="flex items-center gap-6 mb-10">
                  <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg shadow-slate-900/10">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-2xl tracking-tight leading-none">Konfigurasi Template Pesan</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-2">Format pengiriman pesan otomatis</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" /> Variabel Data Otomatis
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { tag: '[Nama]', desc: 'Nama Pemilik' },
                          { tag: '[Nopol]', desc: 'No. Polisi' },
                          { tag: '[Tanggal]', desc: 'Tgl Jatuh Tempo' },
                          { tag: '[Waktu]', desc: 'Pagi/Siang/Sore/Malam' },
                          { tag: '[IdAcak]', desc: 'Kode Acak 5 Karakter' }
                        ].map(v => (
                          <div key={v.tag} className="bg-white border border-slate-200 p-2 rounded-lg text-xs shadow-sm flex flex-col gap-1">
                            <span className="font-bold text-blue-600 font-mono">{v.tag}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{v.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> Sintaks Variasi Pesan (Spintax) 🛡️
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed mb-3 font-medium">
                        Ketik beberapa alternatif kata di dalam kurung kurawal <code className="font-mono font-bold text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">{"{...|...}"}</code> yang dipisahkan dengan tanda pipa <code className="font-mono font-bold text-indigo-600 bg-white px-1 py-0.5 rounded border border-slate-200">|</code>. Sistem akan memilih salah satu secara acak pada setiap pengiriman pesan agar terhindar dari pemblokiran (banned).
                      </p>
                      <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-[11px] text-slate-600 font-medium font-mono leading-relaxed shadow-sm">
                        <span className="text-indigo-600 font-bold">Contoh:</span> <br />
                        {"{Halo|Selamat [Waktu]|Yth.} [Nama], kami {informasikan|beritahukan}... "}
                      </div>
                    </div>
                  </div>

                  {/* Anti-Ban Safeguard Toggle */}
                  <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-blue-900 tracking-tight flex items-center gap-2">
                        <span>🛡️ Sistem Tambahan Anti-Banned</span>
                        <span className="bg-blue-600 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Direkomendasikan</span>
                      </h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        Secara otomatis menyematkan kode referensi unik di akhir setiap pesan (contoh: <code className="font-mono text-[11px] bg-blue-100 text-blue-800 px-1 py-0.5 rounded font-bold">[Ref: #A4F92]</code>) untuk memastikan keunikan pesan 100%.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input 
                        type="checkbox" 
                        checked={useAntiBan} 
                        onChange={e => setUseAntiBan(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Metode Pengiriman WhatsApp Select Card */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-emerald-500" />
                          <span>Metode Pengiriman WhatsApp</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">Pilih antara WhatsApp Web (Manual) atau WhatsApp Cloud API Meta (Otomatis & Serverless)</p>
                      </div>
                      <div className="flex bg-slate-200/70 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setSendingMethod('wa_web')}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${sendingMethod === 'wa_web' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          WhatsApp Web
                        </button>
                        <button
                          type="button"
                          onClick={() => setSendingMethod('cloud_api')}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${sendingMethod === 'cloud_api' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          Cloud API (Meta)
                        </button>
                      </div>
                    </div>

                    {sendingMethod === 'cloud_api' && (
                      <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-start gap-3.5">
                        <div className={`p-2 rounded-lg ${waConfig?.configured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} flex-shrink-0`}>
                          <Shield className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 w-full">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700">Status Integrasi Meta Cloud API:</span>
                            {waConfig?.configured ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Terhubung
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Menunggu Kunci Rahasia (.env)
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                            {waConfig?.configured 
                              ? "Server backend terhubung dengan token Meta dan Phone ID Anda. Siap mengirim pesan instan secara otomatis."
                              : "WhatsApp Cloud API membutuhkan token akses dan Phone ID dari Meta Developer. Harap tambahkan kunci WHATSAPP_ACCESS_TOKEN dan WHATSAPP_PHONE_NUMBER_ID di tab Pengaturan / Secrets Anda."}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <button
                              type="button"
                              onClick={checkWaConfigStatus}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100/70 px-2 py-1 rounded transition-all"
                            >
                              <RefreshCw className="w-3 h-3" /> Cek Ulang Konfigurasi
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider ml-1">Isi Format Pesan</label>
                    <textarea 
                      value={template}
                      onChange={e => setTemplate(e.target.value)}
                      className="w-full min-h-[220px] p-6 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:border-blue-600 outline-none transition-all leading-relaxed text-sm shadow-sm"
                      placeholder="Contoh: {Halo|Selamat [Waktu]} [Nama], kami {ingatkan|informasikan} bahwa pajak kendaraan No. Pol [Nopol]..."
                    />
                  </div>

                  <div className="bg-slate-900 p-8 rounded-xl relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 px-6 py-2 bg-blue-600 text-[10px] font-bold text-white uppercase tracking-[0.3em] rounded-bl-xl flex items-center gap-1">
                      <span>Pratinjau Pesan</span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 mt-6 items-start justify-between">
                      <div className="flex gap-4 w-full">
                        <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
                          <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <div className="bg-white text-slate-700 p-6 rounded-xl rounded-tl-none max-w-[95%] text-sm leading-relaxed font-medium shadow-sm border border-slate-100 whitespace-pre-wrap w-full">
                          {previewMessage}
                          <div className="mt-3 flex justify-end">
                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Terkirim • Baru Saja</span>
                          </div>
                        </div>
                      </div>

                      <button 
                        type="button"
                        onClick={() => setPreviewTrigger(prev => prev + 1)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
                        title="Acak Spintax Ulang"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Acak Spintax</span>
                      </button>
                    </div>
                  </div>
                  
                  <button onClick={() => showToast('Template berhasil disimpan')} className="bg-blue-600 hover:bg-blue-700 w-full py-4 text-white font-bold rounded-lg shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all text-sm uppercase tracking-widest">
                    Simpan Perubahan Template
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentTab === 'laporan' && (
            <motion.div
              key="laporan"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto pb-12"
            >
              <ReportView allData={allData} onRefresh={loadFromGoogleSheet} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* --- Modals --- */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setDeleteTarget(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
             />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
               className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full relative z-[210] border border-slate-200 overflow-hidden"
             >
                <div className="w-16 h-16 bg-rose-50 rounded-xl flex items-center justify-center mb-6 mx-auto group">
                   <Trash2 className="w-8 h-8 text-rose-500 transition-transform group-hover:scale-110" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 text-center tracking-tight">Hapus Data Wajib Pajak?</h3>
                <p className="text-xs text-slate-500 mb-8 leading-relaxed text-center font-medium">Data dengan plat nomor <span className="text-rose-600 font-bold">{deleteTarget.nopol}</span> akan dihapus secara permanen dari sistem.</p>
                <div className="grid grid-cols-2 gap-4">
                   <button onClick={() => setDeleteTarget(null)} className="py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">Batal</button>
                   <button onClick={handleConfirmDelete} className="py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20">Hapus Data</button>
                </div>
             </motion.div>
          </div>
        )}

        {editTarget && (
           <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setEditTarget(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
             />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
               className="bg-white rounded-2xl p-10 shadow-2xl max-w-2xl w-full relative z-[210] border border-slate-200"
             >
                <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                        <Edit2 className="w-6 h-6 text-blue-600" />
                     </div>
                     <div>
                       <h3 className="text-xl font-bold text-slate-900 tracking-tight">Ubah Data Wajib Pajak</h3>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Lakukan modifikasi pada parameter data</p>
                     </div>
                   </div>
                   <button onClick={() => setEditTarget(null)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-all group"><X className="w-5 h-5 text-slate-300 group-hover:text-rose-500 transition-colors" /></button>
                </div>
                <form onSubmit={handleSaveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider ml-1">No. Polisi</label>
                    <input name="nopol" defaultValue={editTarget.nopol} required className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-600 transition-all font-semibold text-slate-700 shadow-sm" />
                  </div>
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider ml-1">Nama Pemilik</label>
                    <input name="nama" defaultValue={editTarget.nama} required className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-600 transition-all font-semibold text-slate-700 shadow-sm" />
                  </div>
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider ml-1">Jatuh Tempo</label>
                    <input name="tempo" type="date" defaultValue={editTarget.jatuh_tempo} required className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-600 transition-all font-semibold text-slate-700 shadow-sm" />
                  </div>
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider ml-1">No. WhatsApp</label>
                    <input name="wa" defaultValue={editTarget.no_wa} required className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-600 transition-all font-semibold text-slate-700 shadow-sm" />
                  </div>
                  <div className="pt-6 border-t border-slate-100 col-span-2 flex gap-4">
                    <button type="button" onClick={() => setEditTarget(null)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">Batalkan</button>
                    <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all">Simpan Perubahan</button>
                  </div>
                </form>
             </motion.div>
          </div>
        )}

        {/* Blast Progress Overlay for WhatsApp Cloud API */}
        {blastProgress && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => !blastProgress.active && setBlastProgress(null)}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl p-8 shadow-2xl max-w-lg w-full relative z-[310] border border-slate-200 overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${blastProgress.active ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {blastProgress.active ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {blastProgress.active ? 'Mengirim Pesan Massal...' : 'Proses Blast Selesai!'}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">Metode: WhatsApp Cloud API (Meta)</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Progress Pengiriman:</span>
                  <span className="font-mono text-slate-800">{blastProgress.sent} / {blastProgress.total} Sukses</span>
                </div>
                
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                  <div 
                    className="h-full bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-all duration-300"
                    style={{ width: `${(blastProgress.sent / blastProgress.total) * 100}%` }}
                  />
                </div>

                {blastProgress.active && blastProgress.currentName && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Mengirim ke:</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">{blastProgress.currentName}</span>
                  </div>
                )}

                {blastProgress.errors.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-rose-500 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Gagal ({blastProgress.errors.length})
                    </span>
                    <div className="max-h-[120px] overflow-y-auto bg-rose-50/50 border border-rose-100 p-3 rounded-xl text-[11px] font-medium text-rose-700 space-y-1.5 font-mono custom-scrollbar">
                      {blastProgress.errors.map((err, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                          <span>•</span>
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!blastProgress.active && (
                <div className="mt-8">
                  <button 
                    onClick={() => setBlastProgress(null)}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg active:scale-[0.98]"
                  >
                    Tutup Progress
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="h-16 bg-white border-t border-slate-200 px-10 flex items-center justify-between flex-shrink-0 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
        <div>© 2024 SAMSAT BANGLI · KABUPATEN BANGLI, BALI</div>
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Server Terhubung</span>
          <span className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-slate-200" /> Keamanan Terjamin</span>
        </div>
      </footer>
    </div>
  </div>
  );
}
