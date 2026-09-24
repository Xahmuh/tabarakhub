import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, Trash2, UploadCloud } from 'lucide-react';
import { Attachment } from '../../types';

interface PhotoUploadProps {
  itemId: string;
  attachmentIds: string[];
  attachments: Attachment[];
  onAddAttachment: (attachment: Attachment) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  disabled?: boolean;
  className?: string;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  itemId,
  attachmentIds,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  disabled = false,
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const itemAttachments = attachments.filter(att =>
    attachmentIds.includes(att.id) || (att.owner_id === itemId && att.owner_type === 'nhra_audit_item')
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const objectUrl = URL.createObjectURL(file);
      const newAttachment: Attachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        owner_type: 'nhra_audit_item',
        owner_id: itemId,
        url: objectUrl,
        file_type: file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg',
        uploaded_by: 'current-supervisor',
        uploaded_at: new Date().toISOString()
      };
      onAddAttachment(newAttachment);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={handleFileChange}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all
            bg-white text-slate-700 border-slate-200 hover:border-red-200 hover:bg-red-50/30 hover:text-red-900 shadow-xs
            ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
          `}
        >
          <Camera className="w-3.5 h-3.5 text-red-700" />
          <span>Attach Photo / Proof</span>
          {itemAttachments.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-mono font-bold">
              {itemAttachments.length}
            </span>
          )}
        </button>
      </div>

      {/* Thumbnails Gallery */}
      {itemAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {itemAttachments.map(att => (
            <div
              key={att.id}
              className="group relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex-shrink-0 shadow-xs"
            >
              <img
                src={att.url}
                alt="Audit proof"
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src =
                    'https://placehold.co/100x100/f1f5f9/475569?text=Proof';
                }}
              />
              {!disabled && (
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => onRemoveAttachment(att.id)}
                  className="
                    absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity
                    flex items-center justify-center text-red-400 hover:text-white
                  "
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
