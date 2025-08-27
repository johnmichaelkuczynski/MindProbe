import React, { useState, useCallback, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, X } from 'lucide-react';

interface DragDropTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  onFileUpload?: (file: File) => Promise<void>;
}

export function DragDropTextarea({
  value,
  onChange,
  placeholder,
  className,
  rows = 20,
  onFileUpload
}: DragDropTextareaProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    
    const allowedExtensions = ['.txt', '.pdf', '.docx', '.doc'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
      return { 
        valid: false, 
        error: 'Only TXT, PDF, and Word documents are supported' 
      };
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return { 
        valid: false, 
        error: 'File size must be less than 10MB' 
      };
    }
    
    return { valid: true };
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const validation = validateFile(file);
      if (!validation.valid) {
        setUploadError(validation.error || 'Invalid file');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      onChange(data.text);
      
      if (onFileUpload) {
        await onFileUpload(file);
      }
    } catch (error) {
      console.error('File processing error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  }, [onChange, onFileUpload]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onChange, onFileUpload]);

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const clearError = () => {
    setUploadError(null);
  };

  return (
    <div className="relative">
      <div
        className={`relative ${isDragOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''} transition-all duration-200`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="drag-drop-textarea"
      >
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${className} min-h-[400px]`}
          rows={rows}
          data-testid="input-text"
        />
        
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-300 rounded-md flex items-center justify-center z-10">
            <div className="text-center">
              <Upload className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-blue-600 font-medium">Drop your file here</p>
              <p className="text-blue-500 text-sm">TXT, PDF, or Word documents</p>
            </div>
          </div>
        )}
        
        {/* Upload overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-white bg-opacity-90 rounded-md flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-600 font-medium">Processing file...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Upload button */}
      {!value && (
        <div className="absolute top-4 right-4 z-5">
          <button
            onClick={handleBrowseClick}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors"
            disabled={isUploading}
            data-testid="button-upload"
          >
            <FileText className="h-4 w-4" />
            Upload File
          </button>
        </div>
      )}
      
      {/* Error message */}
      {uploadError && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md flex items-start justify-between">
          <div className="flex items-start gap-2">
            <div className="text-red-600 text-sm font-medium">Upload Error:</div>
            <div className="text-red-600 text-sm">{uploadError}</div>
          </div>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-600 transition-colors"
            data-testid="button-clear-error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf,.doc,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-file"
      />
    </div>
  );
}