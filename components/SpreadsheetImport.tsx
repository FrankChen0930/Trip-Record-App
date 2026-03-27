'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import type { Trip } from '@/lib/types';

interface ParsedRow {
  day: number;
  start_time: string;
  end_time: string;
  location: string;
  transport_type: string;
  item_type: string;
  note: string;
  map_url: string;
}

interface SpreadsheetImportProps {
  tripId: string;
  tripInfo: Trip | null;
  onImportComplete: () => void;
  onClose: () => void;
}

export default function SpreadsheetImport({ tripId, tripInfo, onImportComplete, onClose }: SpreadsheetImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [importing, setImporting] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<'horizontal' | 'vertical' | null>(null);
  const { toast } = useToast();

  // ===== 輔助工具 =====

  const parseTime = (val: any): string => {
    if (!val && val !== 0) return '';
    const s = String(val).trim();
    if (!s) return '';

    // Excel 時間序列值 (0 < x < 1)
    if (!isNaN(Number(s)) && Number(s) > 0 && Number(s) < 1) {
      const totalMinutes = Math.round(Number(s) * 24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // HH:MM 格式
    const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return `${String(timeMatch[1]).padStart(2, '0')}:${timeMatch[2]}`;
    }

    // 純數字 4 位 (如 0836 → 08:36, 1530 → 15:30)
    const fourDigit = s.match(/^(\d{3,4})$/);
    if (fourDigit) {
      const num = fourDigit[1].padStart(4, '0');
      return `${num.substring(0, 2)}:${num.substring(2, 4)}`;
    }

    return '';
  };

  const parseTransport = (val: any): string => {
    if (!val) return '機車';
    const s = String(val).trim().toLowerCase();
    if (/高鐵|hsr|thsr/.test(s)) return '高鐵';
    if (/火車|台鐵|train|區間|自強|莒光/.test(s)) return '火車';
    if (/汽車|開車|car|自駕/.test(s)) return '汽車';
    if (/步行|走路|walk|徒步|散步/.test(s)) return '步行';
    return '機車';
  };

  const isTimeValue = (val: any): boolean => {
    if (!val) return false;
    const s = String(val).trim();
    return /^\d{1,2}:\d{2}/.test(s) || (/^\d{3,4}$/.test(s) && parseInt(s) <= 2400) ||
           (!isNaN(Number(s)) && Number(s) > 0 && Number(s) < 1);
  };

  const isDayHeader = (val: any): number | null => {
    if (!val) return null;
    const s = String(val).trim();
    // 匹配: "第一天", "第二天", "Day 1", "D1", "第1天", "第一天 7/19 (五)" 等
    const patterns = [
      /第([一二三四五六七八九十\d]+)天/,
      /day\s*(\d+)/i,
      /^D(\d+)$/i,
    ];
    const numMap: Record<string, number> = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    };
    for (const p of patterns) {
      const m = s.match(p);
      if (m) {
        const raw = m[1];
        if (numMap[raw]) return numMap[raw];
        const n = parseInt(raw);
        if (!isNaN(n) && n > 0 && n <= 100) return n;
      }
    }
    return null;
  };

  const isEmptyRow = (row: any[]): boolean => {
    return !row || row.every((c: any) => !c || String(c).trim() === '');
  };

  const isLocationLike = (val: any): boolean => {
    if (!val) return false;
    const s = String(val).trim();
    if (!s || s.length < 2) return false;
    // 排除純數字、純時間、太長的欄位名
    if (/^\d+$/.test(s)) return false;
    if (isTimeValue(s)) return false;
    return true;
  };

  // ===== 橫向格式解析（你的主要格式）=====
  // 行1: 第一天 7/19 (五) | | | 第二天 7/20 (六) | ...
  // 行2: 時間 | 行程 | 備註 | 時間 | 行程 | 備註 | ...
  // 行3+: 資料

  const parseHorizontal = (rawData: any[][]): ParsedRow[] => {
    const row0 = rawData[0] as any[] || [];
    const row1 = rawData[1] as any[] || [];
    const rows: ParsedRow[] = [];

    // 找出每天的欄位起始位置和天數
    const dayGroups: { day: number; startCol: number }[] = [];
    for (let c = 0; c < row0.length; c++) {
      const dayNum = isDayHeader(row0[c]);
      if (dayNum !== null) {
        dayGroups.push({ day: dayNum, startCol: c });
      }
    }

    if (dayGroups.length === 0) return [];

    // 判斷每天佔幾欄
    const colsPerDay = dayGroups.length > 1 ? dayGroups[1].startCol - dayGroups[0].startCol : 3;

    // 在每個 day group 內辨識子欄位（時間、行程、備註）
    for (const dg of dayGroups) {
      // 分析 row1 (子標題行) 來辨識哪欄是什麼
      let timeCol = -1, locCol = -1, noteCol = -1;

      for (let c = dg.startCol; c < dg.startCol + colsPerDay && c < row1.length; c++) {
        const header = String(row1[c] || '').trim().toLowerCase();
        if (/時間|time/.test(header)) timeCol = c;
        else if (/行程|地點|景點|location|place|目的/.test(header)) locCol = c;
        else if (/備註|note|memo|說明/.test(header)) noteCol = c;
      }

      // 如果沒找到，用位置猜測 (時間、行程、備註)
      if (timeCol === -1 && locCol === -1) {
        timeCol = dg.startCol;
        locCol = dg.startCol + 1;
        noteCol = colsPerDay >= 3 ? dg.startCol + 2 : -1;
      } else if (locCol === -1) {
        // 有時間欄但沒行程欄，行程在時間右邊
        locCol = timeCol + 1;
      }

      // 從第三行開始讀資料
      for (let r = 2; r < rawData.length; r++) {
        const row = rawData[r] as any[];
        if (!row) continue;

        const location = locCol >= 0 ? String(row[locCol] || '').trim() : '';
        const timeVal = timeCol >= 0 ? row[timeCol] : '';
        const noteVal = noteCol >= 0 ? String(row[noteCol] || '').trim() : '';

        // 跳過空行或非行程內容（如「攜帶清單」等段落標題）
        if (!location || !isLocationLike(location)) continue;

        // 檢查是否為段落分隔（如「攜帶清單」）
        const firstCell = String(row[0] || '').trim();
        if (/清單|準備|事項|ToDo|checklist/i.test(firstCell)) break;

        rows.push({
          day: dg.day,
          start_time: parseTime(timeVal),
          end_time: '',
          location,
          transport_type: parseTransport(noteVal),
          item_type: 'activity',
          note: noteVal,
          map_url: '',
        });
      }
    }

    return rows;
  };

  // ===== 縱向格式解析（備用）=====
  const parseVertical = (rawData: any[][]): ParsedRow[] => {
    const headers = (rawData[0] as any[]).map((h: any) => String(h).trim());
    const rows: ParsedRow[] = [];

    const identifyCol = (h: string): string | null => {
      const lc = h.toLowerCase().replace(/\s/g, '');
      if (/day|天|日期/.test(lc)) return 'day';
      if (/^(start|開始|出發|時間)/.test(lc) || /starttime/.test(lc)) return 'start_time';
      if (/^(end|結束|抵達)/.test(lc) || /endtime/.test(lc)) return 'end_time';
      if (/地[點址]|location|place|景點|行程|目的/.test(lc)) return 'location';
      if (/交通|transport|移動|方式/.test(lc)) return 'transport_type';
      if (/備註|note|memo|說明/.test(lc)) return 'note';
      if (/map|地圖|連結|link|url|google/.test(lc)) return 'map_url';
      return null;
    };

    const colMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const field = identifyCol(h);
      if (field && !(field in colMap)) colMap[field] = i;
    });

    if (!('location' in colMap)) {
      headers.forEach((h, i) => {
        if (!Object.values(colMap).includes(i) && !('location' in colMap) && h.length > 0) {
          colMap['location'] = i;
        }
      });
    }

    let currentDay = 1;
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      if (isEmptyRow(row)) continue;

      const location = colMap['location'] !== undefined ? String(row[colMap['location']] || '').trim() : '';
      if (!location) continue;

      if (colMap['day'] !== undefined) {
        const dayVal = isDayHeader(row[colMap['day']]);
        if (dayVal) currentDay = dayVal;
        else {
          const n = parseInt(String(row[colMap['day']]).replace(/[^\d]/g, ''));
          if (!isNaN(n) && n > 0 && n <= 100) currentDay = n;
        }
      }

      rows.push({
        day: currentDay,
        start_time: colMap['start_time'] !== undefined ? parseTime(row[colMap['start_time']]) : '',
        end_time: colMap['end_time'] !== undefined ? parseTime(row[colMap['end_time']]) : '',
        location,
        transport_type: parseTransport(colMap['transport_type'] !== undefined ? row[colMap['transport_type']] : ''),
        item_type: 'activity',
        note: colMap['note'] !== undefined ? String(row[colMap['note']] || '').trim() : '',
        map_url: colMap['map_url'] !== undefined ? String(row[colMap['map_url']] || '').trim() : '',
      });
    }
    return rows;
  };

  // ===== 自動偵測格式 =====
  const detectFormat = (rawData: any[][]): 'horizontal' | 'vertical' => {
    const row0 = rawData[0] as any[] || [];
    // 橫向：第一行有多個「第X天」
    let dayHeaders = 0;
    for (const cell of row0) {
      if (isDayHeader(cell) !== null) dayHeaders++;
    }
    if (dayHeaders >= 2) return 'horizontal';

    // 橫向：第二行有重複的「時間」「行程」模式
    const row1 = rawData[1] as any[] || [];
    let timeHeaders = 0;
    for (const cell of row1) {
      if (/時間|time/i.test(String(cell || ''))) timeHeaders++;
    }
    if (timeHeaders >= 2) return 'horizontal';

    return 'vertical';
  };

  // ===== 主要處理流程 =====
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    try {
      const XLSX = await import('xlsx');
      const buffer = await selected.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });

      if (rawData.length < 2) {
        toast('檔案內容太少', 'warning');
        return;
      }

      const format = detectFormat(rawData as any[][]);
      setDetectedFormat(format);

      const rows = format === 'horizontal'
        ? parseHorizontal(rawData as any[][])
        : parseVertical(rawData as any[][]);

      if (rows.length === 0) {
        toast('未能解析出行程資料，試試手動檢查表格格式', 'warning');
        return;
      }

      setParsedRows(rows);
      setStep('preview');
      toast(`解析成功：${rows.length} 筆行程（${format === 'horizontal' ? '橫向' : '縱向'}格式）`, 'success');
    } catch (error: any) {
      toast('檔案解析失敗：' + error.message, 'error');
    }
  }, [toast]);

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');
    try {
      const payload = parsedRows.map(row => ({
        trip_id: tripId,
        day: row.day,
        start_time: row.start_time || '08:00:00',
        end_time: row.end_time || null,
        location: row.location,
        transport_type: row.transport_type,
        item_type: row.item_type,
        note: row.note || null,
        map_url: row.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.location)}`,
      }));

      const { error } = await supabase.from('trip_itinerary').insert(payload);
      if (error) throw error;

      toast(`成功匯入 ${parsedRows.length} 筆行程！`, 'success');
      onImportComplete();
      onClose();
    } catch (error: any) {
      toast('匯入失敗：' + error.message, 'error');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  // 手動刪除某一筆
  const removeRow = (index: number) => {
    setParsedRows(prev => prev.filter((_, i) => i !== index));
  };

  const dayGroups = parsedRows.reduce<Record<number, (ParsedRow & { _index: number })[]>>((acc, row, i) => {
    if (!acc[row.day]) acc[row.day] = [];
    acc[row.day].push({ ...row, _index: i });
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {step === 'upload' && (
        <div className="text-center">
          <div className="mb-6">
            <span className="text-5xl block mb-4">📊</span>
            <h3 className="font-bold text-lg mb-1">匯入試算表行程</h3>
            <p className="text-xs text-gray-400">支援 .xlsx, .xls, .csv</p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">支援兩種格式</p>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded-xl border border-gray-100">
                <p className="text-xs font-bold mb-1">📐 橫向格式（推薦）</p>
                <p className="text-[10px] text-gray-400">每天佔 3 欄（時間、行程、備註），天數從左到右排列</p>
                <div className="flex gap-1 mt-2">
                  <span className="text-[8px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded">第一天|時間|行程|備註</span>
                  <span className="text-[8px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded">第二天|時間|行程|備註</span>
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-100">
                <p className="text-xs font-bold mb-1">📋 縱向格式</p>
                <p className="text-[10px] text-gray-400">每行一筆行程，欄位有天數、時間、地點等</p>
              </div>
            </div>
          </div>

          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" id="spreadsheet-file" />
          <label htmlFor="spreadsheet-file" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm cursor-pointer inline-block hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg">
            選擇檔案
          </label>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">預覽匯入內容</h3>
              <p className="text-[10px] text-gray-400">
                {file?.name} · {parsedRows.length} 筆 · {detectedFormat === 'horizontal' ? '橫向格式' : '縱向格式'}
              </p>
            </div>
            <button onClick={() => { setStep('upload'); setFile(null); setParsedRows([]); }} className="text-xs text-blue-600 font-bold">重選</button>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 mb-4 border border-amber-100">
            <p className="text-[10px] text-amber-700 font-bold">💡 可以點 ✕ 移除不要的行程，再確認匯入</p>
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-4 pr-1">
            {Object.entries(dayGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([day, items]) => (
              <div key={day}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 sticky top-0 bg-white py-1 z-10">Day {day} · {items.length} 筆</div>
                <div className="space-y-1">
                  {items.map((item) => (
                    <div key={item._index} className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl text-xs group">
                      <span className="font-mono text-gray-400 w-12 shrink-0">{item.start_time || '--:--'}</span>
                      <span className="font-bold text-gray-800 flex-1 truncate">{item.location}</span>
                      {item.note && <span className="text-[9px] text-gray-300 max-w-[80px] truncate">{item.note}</span>}
                      <span className="text-[9px] text-gray-400 shrink-0">{item.transport_type}</span>
                      <button onClick={() => removeRow(item._index)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-4 bg-gray-50 rounded-2xl font-bold hover:bg-gray-100 transition-colors">取消</button>
            <button onClick={handleImport} disabled={parsedRows.length === 0} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all hover:bg-emerald-700 disabled:opacity-30">
              確認匯入 {parsedRows.length} 筆
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="text-center py-12">
          <span className="text-5xl block mb-4 animate-bounce">📊</span>
          <p className="font-bold text-gray-600 animate-pulse">正在匯入行程...</p>
          <p className="text-xs text-gray-400 mt-2">{parsedRows.length} 筆資料寫入中</p>
        </div>
      )}
    </div>
  );
}
