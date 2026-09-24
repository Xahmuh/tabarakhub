import React, { useRef, useState } from 'react';
import { Camera, CheckCircle2, UploadCloud, X } from 'lucide-react';

interface CAPAProofUploadProps {
  taskId: string;
  onResolve: (proofUrl: string, resolutionComment: string) => void;
  disabled?: boolean;
  className?: string;
}

export const CAPAProofUpload: React.FC<CAPAProofUploadProps> = ({
  taskId,
  onResolve,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setProofUrl(url);
    }
  };

  const handleMockUpload = () => {
    // Default placeholder proof if user prefers not to browse local file
    const sampleProof = 'https://placehold.co/600x400/10b981/ffffff?text=CAPA+Resolution+Proof+Verified';
    setProofUrl(sampleProof);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalProof = proofUrl || 'https://placehold.co/600x400/10b981/ffffff?text=CAPA+Resolution+Proof';
    onResolve(finalProof, comment);
    setIsOpen(false);
    setProofUrl(null);
    setComment('');
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={`
          inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-black text-xs transition-all
          bg-red-700 hover:bg-red-800 text-white active:scale-95 shadow-sm shadow-red-700/20
          disabled:opacity-40 disabled:cursor-not-allowed ${className}
        `}
      >
        <UploadCloud className="w-3.5 h-3.5" />
        <span>Upload Proof & Resolve</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-md animate-in fade-in duration-150 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-red-700" />
          <span>Upload Resolution Proof</span>
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Proof Preview or Upload Buttons */}
      {proofUrl ? (
        <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
          <img
            src={proofUrl}
            alt="Proof preview"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => setProofUrl(null)}
            className="absolute top-2 right-2 bg-black/70 hover:bg-black p-1 rounded-full text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-red-700 mb-1" />
            <span>Select Local File</span>
          </button>

          <button
            type="button"
            onClick={handleMockUpload}
            className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <Camera className="w-4 h-4 text-emerald-600 mb-1" />
            <span>Simulate Photo</span>
          </button>
        </div>
      )}

      {/* Resolution Notes */}
      <div>
        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
          Resolution Details / Action Taken:
        </label>
        <textarea
          rows={2}
          required
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Describe how this violation was corrected (e.g. Recalibrated refrigerator sensor and verified 4°C readings)..."
          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:ring-2 focus:ring-red-100 focus:border-red-400 focus:outline-none placeholder-slate-400 font-medium"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>

        <button
          type="submit"
          className="
            flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs
            bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-sm transition-all
          "
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Confirm & Mark Resolved</span>
        </button>
      </div>
    </form>
  );
};
