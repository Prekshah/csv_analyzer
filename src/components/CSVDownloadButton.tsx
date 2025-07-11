import React, { useState } from 'react';
import {
  Button,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Download as DownloadIcon,
  FileDownload as FileDownloadIcon
} from '@mui/icons-material';
import { CSVFileVersion } from '../types/Campaign';
import { getCSVContentForDownload } from '../utils/firestoreCSVService';
import { base64ToFile } from '../utils/csvVersioning';

interface CSVDownloadButtonProps {
  campaignId: string;
  csvVersion: CSVFileVersion;
  variant?: 'button' | 'icon';
  size?: 'small' | 'medium' | 'large';
  showFileName?: boolean;
  className?: string;
}

const CSVDownloadButton: React.FC<CSVDownloadButtonProps> = ({
  campaignId,
  csvVersion,
  variant = 'button',
  size = 'medium',
  showFileName = true,
  className
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);

    try {
      // Get CSV content from Firestore
      const csvContent = await getCSVContentForDownload(campaignId, csvVersion.id);
      
      if (!csvContent) {
        throw new Error('CSV content not available for download');
      }

      // Convert base64 to file and trigger download
      const file = base64ToFile(csvContent, csvVersion.fileName);
      const url = URL.createObjectURL(file);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = csvVersion.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setShowSuccess(true);
      console.log(`Downloaded CSV: ${csvVersion.fileName}`);

    } catch (error) {
      console.error('Error downloading CSV:', error);
      setError(error instanceof Error ? error.message : 'Failed to download CSV');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUploadDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const tooltipContent = (
    <div>
      <div><strong>{csvVersion.fileName}</strong></div>
      <div>Size: {formatFileSize(csvVersion.fileSize)}</div>
      <div>Uploaded: {formatUploadDate(csvVersion.uploadedAt)}</div>
      <div>By: {csvVersion.uploadedBy}</div>
    </div>
  );

  if (variant === 'icon') {
    return (
      <>
        <Tooltip title={tooltipContent} arrow>
          <span>
            <Button
              variant="outlined"
              size={size}
              onClick={handleDownload}
              disabled={isDownloading}
              className={className}
              startIcon={isDownloading ? <CircularProgress size={16} /> : <DownloadIcon />}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              {isDownloading ? '' : <FileDownloadIcon />}
            </Button>
          </span>
        </Tooltip>
        
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
        >
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Snackbar>
        
        <Snackbar
          open={showSuccess}
          autoHideDuration={3000}
          onClose={() => setShowSuccess(false)}
        >
          <Alert severity="success" onClose={() => setShowSuccess(false)}>
            CSV downloaded successfully!
          </Alert>
        </Snackbar>
      </>
    );
  }

  return (
    <>
      <Tooltip title={tooltipContent} arrow>
        <span>
          <Button
            variant="outlined"
            size={size}
            onClick={handleDownload}
            disabled={isDownloading}
            className={className}
            startIcon={isDownloading ? <CircularProgress size={16} /> : <DownloadIcon />}
          >
            {isDownloading ? 'Downloading...' : `Download${showFileName ? ` ${csvVersion.fileName}` : ' CSV'}`}
          </Button>
        </span>
      </Tooltip>
      
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
      >
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          CSV downloaded successfully!
        </Alert>
      </Snackbar>
    </>
  );
};

export default CSVDownloadButton; 