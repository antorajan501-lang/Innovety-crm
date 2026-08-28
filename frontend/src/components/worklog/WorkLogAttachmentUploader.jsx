import React, { useRef, useState, useEffect } from 'react';
import {
  Upload,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';

const ALLOWED_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'webp', 'gif',
  'mp4', 'mov',
  'mp3', 'wav',
  'pdf', 'docx', 'xlsx', 'zip'
];

export const WorkLogAttachmentUploader = ({ attachments = [], onChange, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const getFileIcon = (fileType = '', fileName = '') => {
    const ext = fileName.split('.').pop().toLowerCase();
    const type = fileType.toLowerCase();

    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) || type.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-sky-500" />;
    }
    if (['mp4', 'mov'].includes(ext) || type.startsWith('video/')) {
      return <Film className="w-5 h-5 text-purple-500" />;
    }
    if (['mp3', 'wav'].includes(ext) || type.startsWith('audio/')) {
      return <Music className="w-5 h-5 text-pink-500" />;
    }
    if (['xlsx', 'csv'].includes(ext) || type.includes('spreadsheet') || type.includes('excel')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    }
    if (['zip', 'rar', '7z'].includes(ext) || type.includes('zip') || type.includes('compressed')) {
      return <Archive className="w-5 h-5 text-amber-500" />;
    }
    return <FileText className="w-5 h-5 text-primary" />;
  };

  const formatFileSize = (bytes = 0) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const uploadFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(`File format .${ext} is not supported. Supported: PNG, JPG, WEBP, GIF, MP4, MOV, MP3, WAV, PDF, DOCX, XLSX, ZIP.`);
      return;
    }

    setUploadError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/worklogs/upload-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newAttachment = {
        id: res.data.id || `temp-${Date.now()}-${Math.random()}`,
        fileName: res.data.fileName || file.name,
        fileType: res.data.fileType || file.type,
        fileSize: res.data.fileSize || file.size,
        filePath: res.data.filePath,
        uploadedAt: res.data.uploadedAt || new Date().toISOString()
      };

      onChange([...attachments, newAttachment]);
    } catch (err) {
      console.error('Attachment upload failed:', err);
      setUploadError(err.response?.data?.message || 'Failed to upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files) => {
    if (!files || files.length === 0 || disabled) return;
    Array.from(files).forEach(file => {
      uploadFile(file);
    });
  };

  // Clipboard Ctrl+V Paste Event Listener
  useEffect(() => {
    const handlePaste = (e) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            // Rename pasted image screenshot if default name
            let fileName = file.name;
            if (fileName === 'image.png' || fileName === 'blob') {
              const ext = file.type.split('/')[1] || 'png';
              fileName = `screenshot_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
            }
            const renamedFile = new File([file], fileName, { type: file.type });
            uploadFile(renamedFile);
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [attachments, disabled]);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (index) => {
    if (disabled) return;
    const updated = attachments.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-3 text-left">
      <label className="text-xs font-bold text-foreground flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Paperclip className="w-4 h-4 text-primary" /> Attachments
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          PNG, JPG, WEBP, GIF, MP4, MOV, MP3, WAV, PDF, DOCX, XLSX, ZIP
        </span>
      </label>

      {/* Drag & Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-primary bg-primary/10 shadow-md scale-[1.01]'
            : 'border-border/80 hover:border-primary/60 hover:bg-muted/30 bg-background/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFiles(e.target.files)}
          multiple
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center justify-center space-y-1.5">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">
              Drag & Drop Files Here
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Or click to upload • Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-muted border rounded shadow-xs text-foreground">Ctrl+V</kbd> anywhere to paste screenshots or copied files.
            </p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {uploadError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-2.5 rounded-xl flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {uploadError}
          </span>
          <button onClick={() => setUploadError('')} className="text-destructive hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Uploading Indicator */}
      {uploading && (
        <div className="text-xs text-primary font-bold animate-pulse flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          Uploading file attachment...
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {attachments.map((file, idx) => (
            <div
              key={file.id || idx}
              className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/70 shadow-xs hover:border-border transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2 rounded-lg bg-muted/60 flex-shrink-0">
                  {getFileIcon(file.fileType, file.fileName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate" title={file.fileName}>
                    {file.fileName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatFileSize(file.fileSize)}
                  </p>
                </div>
              </div>

              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(idx);
                  }}
                  className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-2"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkLogAttachmentUploader;
