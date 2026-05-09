import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCcw, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: number | null = null;

    const startCamera = async () => {
      try {
        setError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsScanning(true);
        }

        // Initialize BarcodeDetector if available
        if ('BarcodeDetector' in window) {
          // @ts-ignore
          const barcodeDetector = new window.BarcodeDetector({
            formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e']
          });

          intervalId = window.setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              try {
                // @ts-ignore
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const code = barcodes[0].rawValue;
                  onScan(code);
                  stopCamera();
                  onClose();
                }
              } catch (e) {
                // Detection failed for this frame, continue
              }
            }
          }, 500);
        } else {
          setError('الماسح الضوئي غير مدعوم في هذا المتصفح. يرجى استخدام متصفح حديث مثل Chrome.');
        }
      } catch (err) {
        setError('لا يمكن الوصول إلى الكاميرا. تأكد من منح الأذونات اللازمة.');
        console.error(err);
      }
    };

    startCamera();

    const stopCamera = () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };

    return () => stopCamera();
  }, [onScan, onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-terminal-title"
      aria-describedby="scanner-terminal-description"
    >
      <div className="max-w-xl w-full flex flex-col items-center">
        <span id="scanner-terminal-description" className="sr-only">Barcode scanning interface. Use your camera to scan product barcodes for automatic identification.</span>
        <div className="w-full flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3 text-white">
            <div className="w-10 h-10 bg-[#B91c1c] rounded-xl flex items-center justify-center shadow-lg shadow-[#B91c1c]/20">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 id="scanner-terminal-title" className="text-xl font-black tracking-tight">Scanner Terminal</h3>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Active Optical Scan</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="relative w-full aspect-[4/3] bg-slate-900 rounded-[2.5rem] overflow-hidden border-4 border-white/10 shadow-2xl">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
              <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
              <p className="text-white font-bold text-lg mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-white text-slate-900 font-black px-8 py-3 rounded-xl flex items-center space-x-2"
              >
                <RefreshCcw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Scanning Frame Overlay */}
                <div className="w-64 h-40 border-2 border-[#B91c1c]/50 rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#B91c1c] rounded-tl-xl -translate-x-1 -translate-y-1"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#B91c1c] rounded-tr-xl translate-x-1 -translate-y-1"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#B91c1c] rounded-bl-xl -translate-x-1 translate-y-1"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#B91c1c] rounded-br-xl translate-x-1 translate-y-1"></div>
                  {/* Scanning Animation Line */}
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-[#B91c1c]/80 shadow-[0_0_15px_rgba(185,28,28,0.8)] animate-scan-line"></div>
                </div>
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20">
                <p className="text-white font-bold text-xs animate-pulse tracking-widest uppercase">Position barcode inside frame</p>
              </div>
            </>
          )}
        </div>

        <p className="mt-8 text-white/30 text-[10px] font-bold uppercase tracking-[0.3em] text-center max-w-xs">
          Automatic redirection upon successful identification of product code
        </p>
      </div>

      <style>{`
        @keyframes scan-line {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};
