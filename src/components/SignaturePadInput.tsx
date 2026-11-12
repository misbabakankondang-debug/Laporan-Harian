import React, { useRef, useState, useEffect } from 'react';
import { PenTool, Upload, Trash2, CheckCircle2, RotateCcw, Image as ImageIcon } from 'lucide-react';

interface SignaturePadInputProps {
  value?: string;
  onChange: (signatureDataUrl: string) => void;
  reporterName?: string;
}

export const SignaturePadInput: React.FC<SignaturePadInputProps> = ({
  value,
  onChange,
  reporterName,
}) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(Boolean(value));

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-DPI resolution
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = (rect.width || 480) * dpr;
    canvas.height = (rect.height || 160) * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // If an existing signature value is provided and we are on draw tab, load it
    if (value && activeTab === 'draw') {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = value;
    }
  }, [activeTab]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ('touches' in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export as transparent PNG
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    onChange('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar tanda tangan berformat PNG atau JPG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file gambar tanda tangan maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onChange(result);
        setHasDrawn(true);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <PenTool className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-bold text-slate-800">
            Tanda Tangan Pembuat Laporan
          </span>
          {value ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Tanda Tangan Terlampir
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">
              (Opsional / Disarankan)
            </span>
          )}
        </div>

        {/* Tab Selector: Menggambar atau Upload PNG */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            className={`px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'draw'
                ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Gambar Tanda Tangan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Gambar .PNG</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Tanda tangan ini akan otomatis dicetak pada lembar pengesahan Petugas Penanggung Jawab di berkas PDF resmi SIBAHAR.
      </p>

      {/* Tab 1: Menggambar Tanda Tangan pada Canvas */}
      {activeTab === 'draw' && (
        <div className="space-y-2">
          <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-36 cursor-crosshair touch-none block"
            />
            {!hasDrawn && !value && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400">
                <PenTool className="w-6 h-6 mb-1 opacity-40" />
                <span className="text-xs">Goreskan tanda tangan Anda di area ini (Touchscreen / Mouse)</span>
                {reporterName && (
                  <span className="text-[11px] text-slate-400/80 mt-0.5">Atas nama: {reporterName}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Gunakan mouse atau layar sentuh untuk membuat goresan tanda tangan.</span>
            <button
              type="button"
              onClick={handleClearCanvas}
              className="px-2.5 py-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Bersihkan / Ulangi</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Upload Gambar Tanda Tangan (.png) */}
      {activeTab === 'upload' && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileUpload}
          />

          {value ? (
            <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-20 h-16 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center shrink-0">
                  <img
                    src={value}
                    alt="Pratinjau Tanda Tangan"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Berkas Tanda Tangan Digital Terpilih</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Format siap dicetak ke lembar pengesahan PDF</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg font-medium transition cursor-pointer"
                >
                  Ganti File
                </button>
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  title="Hapus tanda tangan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center cursor-pointer bg-slate-50/60 hover:bg-emerald-50/20 transition space-y-1.5"
            >
              <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-1" />
              <p className="text-xs font-semibold text-slate-700">
                Klik untuk mengunggah berkas gambar tanda tangan (.png)
              </p>
              <p className="text-[11px] text-slate-400">
                Direkomendasikan berkas transparan PNG (maksimal 5MB)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
