import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Upload, Eye, Download, ArrowLeft, WifiOff, AlertTriangle, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import mammoth from 'mammoth';

interface FileItem {
  file: File;
  id: string;
  preview?: string;
  outputFormat: string;
  thumbnail?: string;
  hasError?: boolean;
  errorMessage?: string;
}

interface FileConverterProps {
  type: 'images' | 'videos' | 'audios' | 'documents';
}

const FileConverter: React.FC<FileConverterProps> = ({ type }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [globalFormat, setGlobalFormat] = useState('');
  const [downloadAsZip, setDownloadAsZip] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('zconvert-server-url') || 'https://your-backend-url.onrender.com');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatOptions = {
    images: ['apng', 'bmp', 'exr', 'fits', 'gif', 'jp2', 'jpeg', 'jpg', 'pbm', 'pcx', 'pgm', 'pix', 'png', 'ppm', 'ras', 'sgi', 'tga', 'tiff', 'webp', 'xbm', 'xwd'],
    videos: ['asf', 'avi', 'f4v', 'flv', 'hevc', 'ivf', 'm4v', 'mjpeg', 'mkv', 'mov', 'mp4', 'mxf', 'nut', 'ogv', 'swf', 'vob', 'webm', 'wtv'],
    audios: ['aac', 'ac3', 'adts', 'adx', 'afc', 'aiff', 'au', 'caf', 'eac3', 'flac', 'g722', 'ircam', 'latm', 'loas', 'm4a', 'mp2', 'mp3', 'oga', 'ogg', 'opus', 'spx', 'tta', 'wav', 'wma'],
    documents: ['docx', 'html', 'txt', 'rtf', 'md', 'odt', 'pdf', 'epub', 'fb2', 'docm', 'pptx', 'xlsx']
  };

  // Enhanced document format support mapping
  const documentConversionSupport = {
    'docx': ['html', 'txt'],
    'html': ['txt'],
    'txt': ['html', 'md'],
    'md': ['html', 'txt'],
    'rtf': ['txt'],
    'odt': ['txt'], // Basic text extraction
    'pdf': [] // No client-side conversions available
  };

  // Formats that require server-side processing
  const serverOnlyFormats = ['pdf', 'epub', 'fb2', 'docm', 'pptx', 'xlsx'];

  // Get unsupported conversion message
  const getUnsupportedMessage = (fromFormat: string, toFormat: string): string => {
    if (serverOnlyFormats.includes(fromFormat) || serverOnlyFormats.includes(toFormat)) {
      return "This conversion requires server-side support and is not available offline.";
    }
    return `Conversion from ${fromFormat} to ${toFormat} is not supported client-side.`;
  };

  const fileLimits = {
    images: { maxSize: 50 * 1024 * 1024, maxFiles: 5 }, // 50MB, 5 files
    videos: { maxSize: 100 * 1024 * 1024, maxFiles: 3 }, // 100MB, 3 files
    audios: { maxSize: 30 * 1024 * 1024, maxFiles: 10 }, // 30MB, 10 files
    documents: { maxSize: 20 * 1024 * 1024, maxFiles: 10 } // 20MB, 10 files
  };

  const validateFiles = (selectedFiles: FileList): { validFiles: File[], errors: string[] } => {
    const validFiles: File[] = [];
    const errors: string[] = [];
    const currentCount = files.length;
    const limits = fileLimits[type];

    // Check file count limit
    if (currentCount + selectedFiles.length > limits.maxFiles) {
      errors.push(`Maximum ${limits.maxFiles} files allowed for ${type}`);
      return { validFiles, errors };
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Check file size
      if (file.size > limits.maxSize) {
        const maxSizeMB = Math.round(limits.maxSize / (1024 * 1024));
        errors.push(`${file.name}: File size exceeds ${maxSizeMB}MB limit`);
        continue;
      }

      validFiles.push(file);
    }

    return { validFiles, errors };
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      resolve('');
    });
  };

  const generatePreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (type === 'images' && file.type.startsWith('image/')) {
          resolve(e.target?.result as string);
        } else {
          resolve(''); // No preview for non-images
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (selectedFiles: FileList) => {
    const { validFiles, errors } = validateFiles(selectedFiles);
    
    // Show errors as toasts
    errors.forEach(error => {
      toast({
        title: "Upload Error",
        description: error,
        variant: "destructive"
      });
    });

    const newFiles: FileItem[] = [];
    
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const preview = await generatePreview(file);
      
      newFiles.push({
        file,
        id: Math.random().toString(36).substr(2, 9),
        preview,
        outputFormat: formatOptions[type][0] // Default to first format
      });
    }
    
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const removeFile = (id: string) => {
    // Add fade-out animation before removing
    const element = document.querySelector(`[data-file-id="${id}"]`);
    if (element) {
      element.classList.add('animate-fade-out', 'opacity-0', 'scale-95');
      setTimeout(() => {
        setFiles(prev => prev.filter(file => file.id !== id));
      }, 300);
    } else {
      setFiles(prev => prev.filter(file => file.id !== id));
    }
  };

  const updateFileFormat = (id: string, format: string) => {
    setFiles(prev => prev.map(file => 
      file.id === id ? { ...file, outputFormat: format } : file
    ));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Check if conversion is supported
  const isConversionSupported = (fileExtension: string, outputFormat: string): boolean => {
    if (type !== 'documents') return true;
    
    const normalizedExt = fileExtension.toLowerCase().replace('.', '');
    const supportedFormats = documentConversionSupport[normalizedExt as keyof typeof documentConversionSupport];
    
    return supportedFormats ? supportedFormats.includes(outputFormat) : false;
  };

  // Enhanced conversion function with server-side support
  const convertFile = async (fileItem: FileItem): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        const { file, outputFormat } = fileItem;
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
        
        // Try server-side conversion first if server URL is configured
        if (serverUrl) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('targetFormat', outputFormat);
            
            const response = await fetch(`${serverUrl}/api/convert`, {
              method: 'POST',
              body: formData,
            });
            
            if (response.ok) {
              const convertedBlob = await response.blob();
              resolve(convertedBlob);
              return;
            } else {
              console.warn('Server conversion failed, falling back to client-side');
            }
          } catch (serverError) {
            console.warn('Server conversion error, falling back to client-side:', serverError);
          }
        }
        
        // Fallback to client-side conversion
        // Check if conversion is supported for documents
        if (type === 'documents' && !isConversionSupported(fileExtension, outputFormat)) {
          const message = getUnsupportedMessage(fileExtension, outputFormat);
          throw new Error(message);
        }
        
        // Document conversions
        if (type === 'documents') {
          try {
            // DOCX conversions using mammoth.js
            if (fileExtension === 'docx') {
              const arrayBuffer = await file.arrayBuffer();
              
              if (outputFormat === 'html') {
                const result = await mammoth.convertToHtml({ arrayBuffer });
                const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${file.name}</title><style>body{font-family:Arial,sans-serif;line-height:1.6;max-width:800px;margin:0 auto;padding:20px;}</style></head><body>${result.value}</body></html>`;
                resolve(new Blob([htmlContent], { type: 'text/html' }));
                return;
              } else if (outputFormat === 'txt') {
                const result = await mammoth.extractRawText({ arrayBuffer });
                resolve(new Blob([result.value], { type: 'text/plain' }));
                return;
              }
            }
            
            // TXT conversions
            if (fileExtension === 'txt') {
              const text = await file.text();
              
              if (outputFormat === 'html') {
                const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${file.name}</title><style>body{font-family:monospace;white-space:pre-wrap;line-height:1.4;padding:20px;background:#f5f5f5;}</style></head><body>${escapedText}</body></html>`;
                resolve(new Blob([htmlContent], { type: 'text/html' }));
                return;
              } else if (outputFormat === 'md') {
                // Simple TXT to Markdown conversion
                const lines = text.split('\n');
                const mdContent = lines.map(line => {
                  // Convert simple formatting patterns
                  if (line.trim() === '') return '';
                  if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) return line;
                  if (line.match(/^\d+\./)) return line; // Numbered lists
                  if (line.startsWith('- ') || line.startsWith('* ')) return line; // Bullet lists
                  return line;
                }).join('\n');
                resolve(new Blob([mdContent], { type: 'text/markdown' }));
                return;
              }
            }
            
            // HTML conversions
            if (fileExtension === 'html') {
              const text = await file.text();
              
              if (outputFormat === 'txt') {
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                
                // Better text extraction with formatting preservation
                const extractText = (element: Element): string => {
                  let result = '';
                  for (const node of element.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                      result += node.textContent || '';
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                      const el = node as Element;
                      const tagName = el.tagName.toLowerCase();
                      
                      // Add line breaks for block elements
                      if (['div', 'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                        result += extractText(el) + '\n';
                      } else if (['li'].includes(tagName)) {
                        result += '• ' + extractText(el) + '\n';
                      } else {
                        result += extractText(el);
                      }
                    }
                  }
                  return result;
                };
                
                const plainText = extractText(doc.body || doc.documentElement).trim();
                resolve(new Blob([plainText], { type: 'text/plain' }));
                return;
              }
            }
            
            // Markdown conversions
            if (fileExtension === 'md') {
              const text = await file.text();
              
              if (outputFormat === 'html') {
                // Simple Markdown to HTML conversion
                let htmlContent = text
                  .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                  .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                  .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em>$1</em>')
                  .replace(/^\* (.*$)/gm, '<li>$1</li>')
                  .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
                  .replace(/\n/g, '<br>\n');
                
                // Wrap lists
                htmlContent = htmlContent.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
                
                const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${file.name}</title><style>body{font-family:Arial,sans-serif;line-height:1.6;max-width:800px;margin:0 auto;padding:20px;}h1,h2,h3{color:#333;}ul{padding-left:20px;}</style></head><body>${htmlContent}</body></html>`;
                resolve(new Blob([fullHtml], { type: 'text/html' }));
                return;
              } else if (outputFormat === 'txt') {
                // Strip Markdown formatting for plain text
                const plainText = text
                  .replace(/^#{1,6}\s+/gm, '') // Remove headers
                  .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
                  .replace(/\*(.*?)\*/g, '$1') // Remove italic
                  .replace(/^\* /gm, '• ') // Convert bullet points
                  .replace(/^\d+\. /gm, '') // Remove numbered list formatting
                  .trim();
                resolve(new Blob([plainText], { type: 'text/plain' }));
                return;
              }
            }
            
            // RTF basic text extraction
            if (fileExtension === 'rtf' && outputFormat === 'txt') {
              const text = await file.text();
              // Very basic RTF to text conversion - strips RTF control codes
              const plainText = text
                .replace(/\\[a-zA-Z]+\d*\s?/g, '') // Remove RTF control words
                .replace(/[{}]/g, '') // Remove braces
                .replace(/\\\\/g, '\\') // Unescape backslashes
                .replace(/\\'/g, "'") // Unescape quotes
                .trim();
              resolve(new Blob([plainText], { type: 'text/plain' }));
              return;
            }
            
            // ODT basic text extraction (limited)
            if (fileExtension === 'odt' && outputFormat === 'txt') {
              // ODT files are ZIP archives - this is a very basic approach
              try {
                const text = await file.text();
                // Try to extract any readable text (this is very limited)
                const textMatch = text.match(/[a-zA-Z\s.,!?;:'"()[\]{}\-—–]+/g);
                const extractedText = textMatch ? textMatch.join(' ').replace(/\s+/g, ' ').trim() : 'Unable to extract text from ODT file';
                resolve(new Blob([extractedText + '\n\n[Note: ODT conversion is limited. For better results, please use a dedicated ODT converter.]'], { type: 'text/plain' }));
                return;
              } catch (error) {
                throw new Error('ODT text extraction failed');
              }
            }
            
            // Fallback: try to read as text for unrecognized document formats
            if (outputFormat === 'txt') {
              try {
                const text = await file.text();
                const fallbackText = `[Original file: ${file.name}]\n[Warning: This file format may not be properly supported]\n\n${text}`;
                resolve(new Blob([fallbackText], { type: 'text/plain' }));
                return;
              } catch (error) {
                throw new Error('Unable to read file as text');
              }
            }
            
          } catch (conversionError) {
            console.error('Document conversion error:', conversionError);
            throw conversionError;
          }
        }
        
        // For non-document types, return original file (placeholder for actual conversion)
        setTimeout(() => {
          resolve(new Blob([file], { type: file.type }));
        }, 300);
        
      } catch (error) {
        console.warn('Conversion error:', error);
        reject(error);
      }
    });
  };

  const handleConvertAndDownload = async () => {
    if (files.length === 0 || !isOnline) return;

    let successfulConversions = 0;
    let failedConversions = 0;
    const failedFiles: string[] = [];

    try {
      if (downloadAsZip) {
        // Download as ZIP
        const zip = new JSZip();
        const folder = zip.folder('ZConvertAll');

        for (const fileItem of files) {
          try {
            const convertedBlob = await convertFile(fileItem);
            const fileName = `${fileItem.file.name.split('.')[0]}.${fileItem.outputFormat}`;
            
            if (folder) {
              folder.file(fileName, convertedBlob);
              successfulConversions++;
            }
          } catch (error) {
            console.warn(`Failed to convert ${fileItem.file.name}:`, error);
            failedConversions++;
            failedFiles.push(fileItem.file.name);
          }
        }

        if (successfulConversions > 0) {
          const zipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
          });
          
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'ZConvertAll.zip';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Clean up after a delay to ensure download starts
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } else {
        // Download files individually with user gesture preservation
        for (let i = 0; i < files.length; i++) {
          const fileItem = files[i];
          try {
            const convertedBlob = await convertFile(fileItem);
            const fileName = `${fileItem.file.name.split('.')[0]}.${fileItem.outputFormat}`;
            
            const url = URL.createObjectURL(convertedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up URL after download
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            successfulConversions++;
            
            // Small delay between downloads to avoid overwhelming
            if (i < files.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          } catch (error) {
            console.warn(`Failed to download ${fileItem.file.name}:`, error);
            failedConversions++;
            failedFiles.push(fileItem.file.name);
          }
        }
      }

      // Show appropriate modal based on results
      if (successfulConversions > 0 && failedConversions === 0) {
        // All conversions successful
        setShowSuccessModal(true);
      } else if (failedConversions > 0) {
        // Some or all conversions failed
        toast({
          title: "Conversion Failed",
          description: failedConversions === files.length 
            ? "All conversions failed" 
            : `${failedConversions} out of ${files.length} conversions failed: ${failedFiles.join(', ')}`,
          variant: "destructive",
          action: (
            <a 
              href={`https://mail.google.com/mail/?view=cm&to=zconvertall@gmail.com&su=Conversion%20Issue%20Report&body=Files%20that%20failed:%20${encodeURIComponent(failedFiles.join(', '))}%0A%0APlease%20describe%20your%20issue%20here...`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Report Issue
            </a>
          )
        });

        if (successfulConversions > 0) {
          // Some successful conversions
          toast({
            title: "Partial Success",
            description: `${successfulConversions} files converted successfully`,
            variant: "default"
          });
        }
      }
    } catch (error) {
      console.error('Download process failed:', error);
      toast({
        title: "Process Failed",
        description: "An error occurred during the conversion process",
        variant: "destructive",
        action: (
          <a 
            href="https://mail.google.com/mail/?view=cm&to=zconvertall@gmail.com&su=Process%20Error%20Report&body=Please%20describe%20your%20issue%20here..."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            Report Issue
          </a>
        )
      });
    }
  };

  const applyGlobalFormat = () => {
    if (globalFormat) {
      setFiles(prev => prev.map(file => ({ ...file, outputFormat: globalFormat })));
    }
  };

  const categoryEmojis = {
    images: '🖼',
    videos: '🎬',
    audios: '🎵',
    documents: '📄'
  };

  const openPreview = (fileItem: FileItem) => {
    setPreviewFile(fileItem);
    setIsPreviewOpen(true);
  };

  const renderPreviewContent = () => {
    if (!previewFile) return null;

    const fileType = previewFile.file.type;
    const fileUrl = URL.createObjectURL(previewFile.file);

    if (fileType.startsWith('image/')) {
      return (
        <img 
          src={fileUrl} 
          alt={previewFile.file.name}
          className="max-w-full max-h-[70vh] object-contain mx-auto"
        />
      );
    } else if (fileType.startsWith('video/')) {
      return (
        <video 
          src={fileUrl} 
          controls 
          className="max-w-full max-h-[70vh] mx-auto"
        >
          Your browser does not support the video tag.
        </video>
      );
    } else if (fileType.startsWith('audio/')) {
      return (
        <div className="text-center">
          <div className="text-6xl mb-4">🎵</div>
          <audio src={fileUrl} controls className="mx-auto" />
          <p className="mt-4 text-muted-foreground">{previewFile.file.name}</p>
        </div>
      );
    } else {
      return (
                        <div className="text-center">
                          <div className="text-6xl mb-4">📄</div>
                          <p className="text-lg font-medium">{previewFile.file.name}</p>
                          <p className="text-muted-foreground">
                            {formatFileSize(previewFile.file.size)} • {previewFile.file.type || 'Unknown type'}
                          </p>
                          <div className="mt-4 p-4 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground mb-2">
                              No preview available for this file type
                            </p>
                            {type === 'documents' && (
                              <p className="text-xs text-orange-600">
                                <AlertTriangle className="w-4 h-4 inline mr-1" />
                                Document preview coming soon
                              </p>
                            )}
                          </div>
                        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <header className="py-8 px-4 border-b border-border">
        <div className="max-w-4xl mx-auto">
          {/* Back Button and Settings */}
          <div className="mb-6 flex justify-between items-center">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="hover:bg-primary hover:text-primary-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            
          </div>
          
          {/* Title */}
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent cursor-pointer hover:scale-105 transition-transform duration-300"
                onClick={() => navigate('/')}>
              ZConvertAll
            </h1>
            <h2 className="text-2xl font-semibold text-foreground flex items-center justify-center gap-2">
              <span className="text-3xl">{categoryEmojis[type]}</span>
              {type.charAt(0).toUpperCase() + type.slice(1)} Converter
            </h2>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Drop Zone - Only show when no files */}
        {files.length === 0 && (
          <Card 
            className={`mb-8 border-2 border-dashed transition-all duration-300 ${
              isDragOver 
                ? 'border-primary bg-primary/5 shadow-glow' 
                : 'border-border hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="p-12 text-center">
              <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                Drop files here or{' '}
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select Files
                </Button>
              </h3>
              <p className="text-muted-foreground">
                Upload multiple files for batch conversion
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {type === 'videos' && 'Max: 100MB per file, 3 files total'}
                {type === 'images' && 'Max: 50MB per file, 5 files total'}
                {type === 'audios' && 'Max: 30MB per file, 10 files total'}
                {type === 'documents' && 'Max: 20MB per file, 10 files total'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                accept={type === 'images' ? 'image/*' : type === 'videos' ? 'video/*' : type === 'audios' ? 'audio/*' : '*'}
              />
            </div>
          </Card>
        )}

        {/* File Drop Area for when files exist */}
        {files.length > 0 && (
          <div 
            className={`mb-8 border-2 border-dashed rounded-lg transition-all duration-300 ${
              isDragOver 
                ? 'border-primary bg-primary/5 shadow-glow p-4' 
                : 'border-transparent p-2'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {isDragOver && (
              <div className="text-center py-8">
                <Upload className="w-12 h-12 mx-auto mb-2 text-primary" />
                <p className="text-primary font-medium">Drop files to add them</p>
              </div>
            )}
          </div>
        )}

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-6">
            <div className="grid gap-4">
              {files.map((fileItem) => (
                <Card 
                  key={fileItem.id} 
                  data-file-id={fileItem.id}
                  className="group hover:shadow-elegant transition-all duration-300"
                >
                  <div className="p-4 flex items-center gap-4">
                    {/* Preview */}
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      {fileItem.preview ? (
                        <img 
                          src={fileItem.preview} 
                          alt={fileItem.file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">{categoryEmojis[type]}</span>
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">
                        {fileItem.file.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(fileItem.file.size)}
                      </p>
                    </div>

                    {/* Format Selector */}
                    <div className="w-32">
                      <Select 
                        value={fileItem.outputFormat} 
                        onValueChange={(value) => updateFileFormat(fileItem.id, value)}
                      >
                        <SelectTrigger className="w-full border-primary/20 focus:border-primary focus:ring-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {formatOptions[type].map((format) => {
                            const fileExtension = fileItem.file.name.split('.').pop()?.toLowerCase() || '';
                            const isSupported = type !== 'documents' || isConversionSupported(fileExtension, format);
                            
                            return (
                              <SelectItem 
                                key={format} 
                                value={format}
                                className={!isSupported ? 'text-amber-600 dark:text-amber-400' : ''}
                              >
                                .{format} {!isSupported && '⚠️ Limited support'}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => openPreview(fileItem)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => removeFile(fileItem.id)}
                        className="hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Controls */}
            <Card className="p-6">
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Add More Files
                  </Button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                    accept={type === 'images' ? 'image/*' : type === 'videos' ? 'video/*' : type === 'audios' ? 'audio/*' : '*'}
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Convert all to:</span>
                    <Select value={globalFormat} onValueChange={setGlobalFormat}>
                      <SelectTrigger className="w-32 border-primary/20 focus:border-primary focus:ring-primary">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        {formatOptions[type].map((format) => (
                          <SelectItem key={format} value={format}>
                            .{format}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      size="sm" 
                      onClick={applyGlobalFormat}
                      disabled={!globalFormat}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
                    >
                      Apply
                    </Button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="zip-download"
                    checked={downloadAsZip}
                    onCheckedChange={(checked) => setDownloadAsZip(checked as boolean)}
                  />
                  <label htmlFor="zip-download" className="text-sm font-medium">
                    Download as a ZIP file
                  </label>
                </div>

                <Button 
                  size="lg"
                  className={`w-full transition-all duration-300 ${
                    isOnline 
                      ? 'bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow hover:shadow-elegant' 
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                  onClick={handleConvertAndDownload}
                  disabled={!isOnline}
                >
                  {isOnline ? (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Convert & Download All ({files.length} files)
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-5 h-5 mr-2" />
                      No Internet Connection
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>{previewFile?.file.name}</DialogTitle>
            </DialogHeader>
            <div className="overflow-auto">
              {renderPreviewContent()}
            </div>
          </DialogContent>
        </Dialog>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="max-w-md text-center">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">🎉 Success!</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-lg">Your files are successfully converted.</p>
              <p className="text-muted-foreground">
                Thanks for using <strong>ZConvertAll</strong>
              </p>
              <div className="pt-4 space-y-2">
                <a 
                  href="https://ko-fi.com/zconvertall"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 underline block"
                >
                  ☕ Support us on Ko-Fi
                </a>
                <a 
                  href="https://mail.google.com/mail/?view=cm&to=zconvertall@gmail.com&su=Issue%20Report&body=Please%20describe%20your%20issue%20here..."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 underline block"
                >
                  Report issues here
                </a>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Server Configuration Modal */}
        <Dialog open={showServerConfig} onOpenChange={setShowServerConfig}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Server Configuration</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="server-url" className="block text-sm font-medium mb-2">
                  Backend Server URL
                </label>
                <Input
                  id="server-url"
                  type="url"
                  placeholder="http://localhost:3001 or https://your-server.com"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Enable advanced conversions (HEIC, PDFs, etc.)</p>
                <p>• Use your Node.js backend from the provided setup</p>
                <p>• Leave empty to use client-side conversions only</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => {
                    localStorage.setItem('zconvert-server-url', serverUrl);
                    setShowServerConfig(false);
                    toast({
                      title: "Server Settings Saved",
                      description: serverUrl ? `Connected to: ${serverUrl}` : "Using client-side only",
                      variant: "default"
                    });
                  }}
                  className="flex-1"
                >
                  Save Settings
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setServerUrl('');
                    localStorage.removeItem('zconvert-server-url');
                    toast({
                      title: "Server Disconnected",
                      description: "Using client-side conversions only",
                      variant: "default"
                    });
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Tutorial Section */}
        <Card className="mt-12 p-6 bg-muted/30">
          <h3 className="text-xl font-semibold mb-4 text-center">How to Use ZConvertAll</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-primary-foreground font-bold">1</span>
              </div>
              <h4 className="font-medium mb-2">Upload Files</h4>
              <p className="text-sm text-muted-foreground">
                Drag & drop files or click "Select Files" to choose multiple files
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-primary-foreground font-bold">2</span>
              </div>
              <h4 className="font-medium mb-2">Choose Format</h4>
              <p className="text-sm text-muted-foreground">
                Select output format for each file individually or apply to all
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-primary-foreground font-bold">3</span>
              </div>
              <h4 className="font-medium mb-2">Download Options</h4>
              <p className="text-sm text-muted-foreground">
                Download files separately or check the ZIP option for a single package
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-primary-foreground font-bold">4</span>
              </div>
              <h4 className="font-medium mb-2">Convert & Download</h4>
              <p className="text-sm text-muted-foreground">
                Click the convert button and your files will be processed and downloaded
              </p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-card border border-border rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <span className="text-primary">💡</span>
              Pro Tips
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• You can add more files by dragging them into the file list area</li>
              <li>• Use "Convert all to" to quickly set the same format for all files</li>
              <li>• Preview images by clicking the eye icon</li>
              <li>• Remove files with the X button</li>
            </ul>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default FileConverter;