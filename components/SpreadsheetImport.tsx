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
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const { toast } = useToast();

  // 嘗試智慧辨識欄位
  const identifyColumn = (header: string): string | null => {
    const h = header.toLowerCase().replace(/\s/g, '');
    if (/day|天|日期|第.*天/.test(h)) return 'day';
    if (/^(start|開始|出發|時間)/.test(h) || /starttime/.test(h)) return 'start_time';
    if (/^(end|結束|抵達)/.test(h) || /endtime/.test(h)) return 'end_time';
    if (/地[點址]|location|place|景點|目的/.test(h)) return 'location';
    if (/交通|transport|移動|方式/.test(h)) return 'transport_type';
    if (/type|類[型別]|種類/.test(h)) return 'item_type';
    if (/備註|note|memo|說明|描述|detail/.test(h)) return 'note';
    if (/map|地圖|連結|link|url|google/.test(h)) return 'map_url';
    return null;
  };

  // 解析時間字串
  const parseTime = (val: any): string => {
    if (!val) return '';
    const s = String(val).trim();

    // Excel 時間序列值 (0.xx)
    if (!isNaN(Number(s)) && Number(s) > 0 && Number(s) < 1) {
      const totalMinutes = Math.round(Number(s) * 24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // 已經是 HH:MM 或 H:MM 格式
    const timeMatch = s.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return `${String(timeMatch[1]).padStart(2, '0')}:${timeMatch[2]}`;
    }

    return s;
  };

  // 解析交通方式
  const parseTransport = (val: any): string => {
    if (!val) return '機車';
    const s = String(val).trim();
    const map: Record<string, string> = {
      '機車': '機車', '摩托': '機車', 'scooter': '機車', 'motorcycle': '機車',
      '汽車': '汽車', '開車': '汽車', 'car': '汽車', '自駕': '汽車',
      '火車': '火車', '台鐵': '火車', 'train': '火車', '區間': '火車',
      '高鐵': '高鐵', 'HSR': '高鐵', 'thsr': '高鐵',
      '步行': '步行', '走路': '步行', 'walk': '步行', '徒步': '步行',
    };
    for (const [key, value] of Object.entries(map)) {
      if (s.includes(key)) return value;
    }
    return '機車';
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    try {
      // 動態載入 xlsx
      const XLSX = await import('xlsx');
      const buffer = await selected.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });

      if (rawData.length < 2) {
        toast('檔案內容為空或只有標題行', 'warning');
        return;
      }

      // 第一行當標題
      const headers = (rawData[0] as any[]).map((h: any) => String(h).trim());
      setRawHeaders(headers);

      // 建立欄位映射
      const colMap: Record<string, number> = {};
      headers.forEach((h, i) => {
        const field = identifyColumn(h);
        if (field && !(field in colMap)) colMap[field] = i;
      });

      // 如果沒有找到 location 欄位，嘗試用最長文字欄位代替
      if (!('location' in colMap)) {
        // 找不到就用第一個非時間欄位
        headers.forEach((h, i) => {
          if (!(i in Object.values(colMap)) && !('location' in colMap)) {
            colMap['location'] = i;
          }
        });
      }

      // 解析資料行
      const rows: ParsedRow[] = [];
      let currentDay = 1;

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (!row || row.every((c: any) => !c || String(c).trim() === '')) continue;

        const location = colMap['location'] !== undefined ? String(row[colMap['location']] || '').trim() : '';
        if (!location) continue;

        let day = currentDay;
        if (colMap['day'] !== undefined) {
          const dayVal = row[colMap['day']];
          if (dayVal) {
            const parsed = parseInt(String(dayVal).replace(/[^\d]/g, ''));
            if (!isNaN(parsed) && parsed > 0) {
              day = parsed;
              currentDay = parsed;
            }
          }
        }

        rows.push({
          day,
          start_time: colMap['start_time'] !== undefined ? parseTime(row[colMap['start_time']]) : '',
          end_time: colMap['end_time'] !== undefined ? parseTime(row[colMap['end_time']]) : '',
          location,
          transport_type: parseTransport(colMap['transport_type'] !== undefined ? row[colMap['transport_type']] : ''),
          item_type: colMap['item_type'] !== undefined && String(row[colMap['item_type']]).includes('ticket') ? 'ticket' : 'activity',
          note: colMap['note'] !== undefined ? String(row[colMap['note']] || '').trim() : '',
          map_url: colMap['map_url'] !== undefined ? String(row[colMap['map_url']] || '').trim() : '',
        });
      }

      if (rows.length === 0) {
        toast('未能解析出任何行程資料，請確認試算表格式', 'warning');
        return;
      }

      setParsedRows(rows);
      setStep('preview');
      toast(`解析成功：${rows.length} 筆行程`, 'success');
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
        map_url: row.map_url || null,
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

  const dayGroups = parsedRows.reduce<Record<number, ParsedRow[]>>((acc, row) => {
    if (!acc[row.day]) acc[row.day] = [];
    acc[row.day].push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {step === 'upload' && (
        <div className="text-center">
          <div className="mb-6">
            <span className="text-5xl block mb-4">📊</span>
            <h3 className="font-bold text-lg mb-1">匯入試算表行程</h3>
            <p className="text-xs text-gray-400">支援 .xlsx, .xls, .csv 格式</p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 mb-6 text-left">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">智慧解析引擎會自動辨識以下欄位：</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <span>📅 天/Day/日期</span>
              <span>⏰ 開始時間/出發</span>
              <span>⏱️ 結束時間/抵達</span>
              <span>📍 地點/景點/目的</span>
              <span>🚗 交通/方式</span>
              <span>📝 備註/說明</span>
              <span>🔗 Map/連結/URL</span>
              <span>🏷️ 類型 (ticket)</span>
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
              <p className="text-[10px] text-gray-400">{file?.name} · {parsedRows.length} 筆行程</p>
            </div>
            <button onClick={() => { setStep('upload'); setFile(null); setParsedRows([]); }} className="text-xs text-blue-600 font-bold">重新選擇</button>
          </div>

          {rawHeaders.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-3 mb-4 flex flex-wrap gap-1">
              <span className="text-[9px] text-blue-500 font-bold mr-1">辨識欄位:</span>
              {rawHeaders.map((h, i) => {
                const field = identifyColumn(h);
                return (
                  <span key={i} className={`text-[9px] px-2 py-0.5 rounded-lg font-mono ${field ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-400'}`}>
                    {h}{field ? ` → ${field}` : ''}
                  </span>
                );
              })}
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto space-y-4 pr-1">
            {Object.entries(dayGroups).map(([day, items]) => (
              <div key={day}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 sticky top-0 bg-white py-1">Day {day} · {items.length} 筆</div>
                <div className="space-y-1">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl text-xs">
                      <span className="font-mono text-gray-400 w-12 shrink-0">{item.start_time || '--:--'}</span>
                      <span className="font-bold text-gray-800 flex-1 truncate">{item.location}</span>
                      <span className="text-[9px] text-gray-400 shrink-0">{item.transport_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-4 bg-gray-50 rounded-2xl font-bold hover:bg-gray-100 transition-colors">取消</button>
            <button onClick={handleImport} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all hover:bg-emerald-700">
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
