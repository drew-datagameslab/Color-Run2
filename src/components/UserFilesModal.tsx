import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  Download,
  Eye,
  Calendar,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { UserAccount, UserFileRecord } from '../types/game';
import {
  uploadUserFile,
  getUserFiles,
  deleteUserFile,
  subscribeUserFiles,
} from '../lib/firebase';

interface UserFilesModalProps {
  isOpen: boolean;
  user: UserAccount;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const UserFilesModal: React.FC<UserFilesModalProps> = ({
  isOpen,
  user,
  onClose,
  onToast,
}) => {
  const [files, setFiles] = useState<UserFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [previewFile, setPreviewFile] = useState<UserFileRecord | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Subscribe to user files in real-time from Firestore
  useEffect(() => {
    if (!isOpen || !user.uid) return;

    setLoading(true);
    getUserFiles(user.uid)
      .then(res => {
        setFiles(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const unsubscribe = subscribeUserFiles(user.uid, updatedFiles => {
      setFiles(updatedFiles);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, user.uid]);

  if (!isOpen) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleFileUpload = async (selectedFile: File) => {
    // Limit to 5MB for Firestore document payload
    if (selectedFile.size > 5 * 1024 * 1024) {
      onToast('File too large (limit is 5MB for cloud database document)');
      return;
    }

    setUploading(true);
    try {
      await uploadUserFile(user.uid, selectedFile, notes);
      setNotes('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onToast(`Uploaded "${selectedFile.name}" successfully!`);
    } catch (err: any) {
      console.error('Error uploading file:', err);
      onToast(err.message || 'Failed to upload file to cloud database');
    } finally {
      setUploading(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      handleFileUpload(fileList[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!window.confirm(`Delete "${fileName}" from your cloud storage?`)) return;

    try {
      await deleteUserFile(user.uid, fileId);
      onToast(`Deleted "${fileName}"`);
      if (previewFile?.id === fileId) {
        setPreviewFile(null);
      }
    } catch (err: any) {
      console.error('Error deleting file:', err);
      onToast(err.message || 'Failed to delete file');
    }
  };

  const handleDownload = (fileRecord: UserFileRecord) => {
    if (!fileRecord.dataUrl) {
      onToast('No file data available');
      return;
    }
    const a = document.createElement('a');
    a.href = fileRecord.dataUrl;
    a.download = fileRecord.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onToast(`Downloading "${fileRecord.name}"`);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-purple-500" />;
    }
    if (type.includes('pdf') || type.includes('text') || type.includes('json') || type.includes('csv')) {
      return <FileText className="w-5 h-5 text-amber-500" />;
    }
    return <File className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
        {/* Header */}
        <div className="bg-[#181818] text-white p-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1c6a35] flex items-center justify-center text-white shadow-md">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide flex items-center gap-2">
                <span>Cloud File Storage</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#2f9a4f]/30 text-[#84e19d] border border-[#2f9a4f]/50">
                  Firebase Database
                </span>
              </h2>
              <p className="text-xs text-stone-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Private to: <strong className="text-stone-200">{user.name}</strong></span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#2a2a2a] hover:bg-[#383838] text-white flex items-center justify-center border border-white/10 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Rule Notice Banner */}
        <div className="bg-[#f0e8cf] px-4 py-2 border-b border-[#d8c89f] flex items-center gap-2 text-xs text-[#523d2a] shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#2f9a4f] shrink-0" />
          <span>
            Security Rules active: Files and metadata in <code>users/{'{userId}'}/files</code> are encrypted and strictly isolated to your account.
          </span>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Upload Section */}
          <div className="bg-white border-2 border-dashed border-[#c9b877] rounded-2xl p-4 flex flex-col items-center justify-center transition-colors hover:border-[#1c6a35]">
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileInputChange}
              className="hidden"
              id="cloud-file-input"
            />

            <div
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`w-full flex flex-col items-center justify-center py-3 rounded-xl transition-colors cursor-pointer ${
                dragOver ? 'bg-[#eef8f1]' : ''
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 rounded-full bg-[#1c6a35]/10 text-[#1c6a35] flex items-center justify-center mb-2">
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#1c6a35]" />
                ) : (
                  <UploadCloud className="w-6 h-6" />
                )}
              </div>

              <p className="text-sm font-black text-[#2e2316] text-center">
                {uploading ? 'Uploading to Firestore...' : 'Click to Upload or Drag & Drop'}
              </p>
              <p className="text-xs text-[#8c745e] text-center mt-0.5">
                Avatars, game scorecards, rule sheets, logs, or images (up to 5MB)
              </p>
            </div>

            {/* Optional Note / Tag input */}
            <div className="w-full flex items-center gap-2 mt-2 pt-2 border-t border-[#ebdcb9]">
              <input
                type="text"
                placeholder="Optional tag or description (e.g. High Score Screenshot)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="flex-1 text-xs px-3 py-1.5 bg-[#faf4e6] border border-[#d8c89f] rounded-lg text-[#2e2316] placeholder-[#8c745e]"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1.5 bg-[#1c6a35] hover:bg-[#155328] disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Choose File</span>
              </button>
            </div>
          </div>

          {/* Files List */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#6e533c] flex items-center gap-1.5">
                <span>Stored Files</span>
                <span className="bg-[#ebdcb9] text-[#523d2a] px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {files.length}
                </span>
              </h3>
              {files.length > 0 && (
                <span className="text-[11px] text-[#8c745e]">
                  Total: {formatFileSize(files.reduce((acc, f) => acc + (f.size || 0), 0))}
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center text-[#8c745e] gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#1c6a35]" />
                <span className="text-xs font-medium">Loading your cloud files...</span>
              </div>
            ) : files.length === 0 ? (
              <div className="py-8 bg-white/70 border border-[#e4d6b6] rounded-2xl flex flex-col items-center justify-center text-center p-4">
                <File className="w-10 h-10 text-[#c2b08a] mb-2" />
                <p className="text-sm font-bold text-[#5c442d]">No files uploaded yet</p>
                <p className="text-xs text-[#8c745e] max-w-xs mt-1">
                  Upload files to save metadata, timestamps, and data securely in your connected Firebase project.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {files.map(file => (
                  <div
                    key={file.id}
                    className="bg-white border border-[#d8c89f] hover:border-[#1c6a35] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-colors"
                  >
                    {/* File Icon & Info */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-lg bg-[#faf4e6] border border-[#e2d5b8] shrink-0 mt-0.5">
                        {getFileIcon(file.type)}
                      </div>

                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-black text-[#2e2316] truncate" title={file.name}>
                          {file.name}
                        </span>

                        {/* Metadata pills */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-[#785b3f]">
                          <span className="font-mono bg-[#f0e7d0] px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {formatFileSize(file.size)}
                          </span>
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <Calendar className="w-3 h-3 text-[#9c8a74]" />
                            {formatDate(file.uploadDate)}
                          </span>
                          <span className="text-[#9c8a74] text-[10px] truncate max-w-[140px]">
                            {file.type || 'file'}
                          </span>
                        </div>

                        {file.notes && (
                          <span className="text-[11px] text-[#523d2a] bg-[#f9f5ea] px-2 py-0.5 rounded mt-1 border border-[#ebdcb9] font-medium">
                            📝 {file.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {file.dataUrl && (
                        <>
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="p-1.5 bg-[#faf4e6] hover:bg-[#ebdcb9] text-[#523d2a] rounded-lg border border-[#d8c89f] transition-colors cursor-pointer"
                            title="Preview File"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDownload(file)}
                            className="p-1.5 bg-[#1c6a35]/10 hover:bg-[#1c6a35]/20 text-[#1c6a35] rounded-lg border border-[#1c6a35]/30 transition-colors cursor-pointer"
                            title="Download File"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDelete(file.id, file.name)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition-colors cursor-pointer"
                        title="Delete File"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#ede3c9] border-t border-[#ebdcb9] flex items-center justify-between text-xs text-[#6e533c] shrink-0">
          <span className="font-mono text-[11px]">Database: <strong>Firestore ({user.provider})</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2e2316] hover:bg-[#140f09] text-white font-bold rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl p-4 shadow-2xl border border-white/20 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="min-w-0 pr-2">
                <h4 className="text-sm font-bold text-gray-900 truncate">{previewFile.name}</h4>
                <p className="text-[11px] text-gray-500 font-mono">
                  {formatFileSize(previewFile.size)} • {formatDate(previewFile.uploadDate)}
                </p>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 flex-1 overflow-auto flex items-center justify-center bg-stone-50 rounded-xl my-3">
              {previewFile.type.startsWith('image/') && previewFile.dataUrl ? (
                <img
                  src={previewFile.dataUrl}
                  alt={previewFile.name}
                  className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-sm"
                />
              ) : previewFile.type.includes('text') || previewFile.type.includes('json') ? (
                <div className="p-4 text-xs font-mono text-gray-800 break-words whitespace-pre-wrap max-h-[40vh] overflow-y-auto w-full">
                  File preview available. Click download to view complete content.
                </div>
              ) : (
                <div className="flex flex-col items-center text-center p-6 text-gray-500">
                  <File className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-700">Preview not available for this binary format</p>
                  <p className="text-xs text-gray-500 mt-1">You can download the original file to view it.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                onClick={() => handleDownload(previewFile)}
                className="px-4 py-2 bg-[#1c6a35] hover:bg-[#155328] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
              <button
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
