import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  Snackbar
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  FilePresent as FilePresentIcon,
  CheckCircle as CheckCircleIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
  SwapHoriz as SwitchIcon
} from '@mui/icons-material';
import { CSVFileVersion } from '../types/Campaign';
import { useAuth } from '../contexts/AuthContext';
import CSVDownloadButton from './CSVDownloadButton';
import { subscribeToCollaborationCSVUploads } from '../utils/enhancedCollaboration';

interface CSVVersionManagerProps {
  campaignId: string;
  csvVersions: Record<string, CSVFileVersion>;
  activeCsvVersionId?: string;
  onSwitchVersion: (csvVersionId: string) => void;
  onDeleteVersion?: (csvVersionId: string) => void;
  showDeleteOption?: boolean;
  compact?: boolean;
}

const CSVVersionManager: React.FC<CSVVersionManagerProps> = ({
  campaignId,
  csvVersions,
  activeCsvVersionId,
  onSwitchVersion,
  onDeleteVersion,
  showDeleteOption = false,
  compact = false
}) => {
  const { user } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedVersionForDelete, setSelectedVersionForDelete] = useState<string | null>(null);
  const [newUploadNotification, setNewUploadNotification] = useState<{
    fileName: string;
    uploadedBy: string;
  } | null>(null);

  const versions = Object.values(csvVersions).sort((a, b) => 
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  const activeVersion = activeCsvVersionId ? csvVersions[activeCsvVersionId] : null;

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleVersionSwitch = (csvVersionId: string) => {
    onSwitchVersion(csvVersionId);
    handleMenuClose();
  };

  const handleDeleteClick = (csvVersionId: string) => {
    setSelectedVersionForDelete(csvVersionId);
  };

  const handleDeleteConfirm = () => {
    if (selectedVersionForDelete && onDeleteVersion) {
      onDeleteVersion(selectedVersionForDelete);
      setSelectedVersionForDelete(null);
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
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 0) {
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
      }
      return `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(new Date(date));
    }
  };

  const isCurrentUserUpload = (version: CSVFileVersion): boolean => {
    return user?.uid === version.uploadedBy;
  };

  // Subscribe to real-time CSV upload notifications
  useEffect(() => {
    const unsubscribe = subscribeToCollaborationCSVUploads((csvVersion, uploadedBy) => {
      // Only show notification if it's not uploaded by current user
      if (user?.uid !== uploadedBy) {
        setNewUploadNotification({
          fileName: csvVersion.fileName,
          uploadedBy
        });
      }
    });

    return unsubscribe;
  }, [user?.uid]);

  if (versions.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        No CSV files uploaded yet. Upload a CSV file to get started.
      </Alert>
    );
  }

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Chip
          icon={<FilePresentIcon />}
          label={activeVersion ? activeVersion.fileName : 'No active CSV'}
          color={activeVersion ? 'primary' : 'default'}
          variant={activeVersion ? 'filled' : 'outlined'}
        />
        {versions.length > 1 && (
          <Button
            size="small"
            variant="outlined"
            endIcon={<ExpandMoreIcon />}
            onClick={handleMenuClick}
          >
            Switch ({versions.length})
          </Button>
        )}
        {activeVersion && !isCurrentUserUpload(activeVersion) && (
          <CSVDownloadButton
            campaignId={campaignId}
            csvVersion={activeVersion}
            variant="icon"
            size="small"
          />
        )}
      </Box>
    );
  }

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">
          CSV Files ({versions.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => setShowHistoryDialog(true)}
          >
            History
          </Button>
          {versions.length > 1 && (
            <Button
              size="small"
              variant="outlined"
              endIcon={<ExpandMoreIcon />}
              onClick={handleMenuClick}
            >
              Switch Version
            </Button>
          )}
        </Box>
      </Box>

      {activeVersion && (
        <Box sx={{ mb: 2 }}>
          <Alert 
            severity="info" 
            icon={<CheckCircleIcon />}
            action={
              !isCurrentUserUpload(activeVersion) ? (
                <CSVDownloadButton
                  campaignId={campaignId}
                  csvVersion={activeVersion}
                  variant="icon"
                  size="small"
                />
              ) : null
            }
          >
            <Typography variant="body2">
              <strong>Active:</strong> {activeVersion.fileName} 
              ({formatFileSize(activeVersion.fileSize)}) - 
              Uploaded {formatUploadDate(activeVersion.uploadedAt)}
              {!isCurrentUserUpload(activeVersion) && (
                <span> by another collaborator</span>
              )}
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Version selection menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          style: {
            maxHeight: 300,
            width: '350px',
          },
        }}
      >
        {versions.map((version) => (
          <MenuItem
            key={version.id}
            onClick={() => handleVersionSwitch(version.id)}
            selected={version.id === activeCsvVersionId}
          >
            <ListItemIcon>
              {version.id === activeCsvVersionId ? (
                <CheckCircleIcon color="primary" />
              ) : (
                <FilePresentIcon />
              )}
            </ListItemIcon>
            <ListItemText
              primary={version.fileName}
              secondary={
                <Box>
                  <Typography variant="caption" display="block">
                    {formatFileSize(version.fileSize)} • {formatUploadDate(version.uploadedAt)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isCurrentUserUpload(version) ? 'Uploaded by you' : 'Uploaded by collaborator'}
                  </Typography>
                </Box>
              }
            />
            {showDeleteOption && versions.length > 1 && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(version.id);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </MenuItem>
        ))}
      </Menu>

      {/* History dialog */}
      <Dialog
        open={showHistoryDialog}
        onClose={() => setShowHistoryDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>CSV Version History</DialogTitle>
        <DialogContent>
          <List>
            {versions.map((version, index) => (
              <ListItem key={version.id} divider={index < versions.length - 1}>
                <ListItemAvatar>
                  <Avatar>
                    {version.id === activeCsvVersionId ? (
                      <CheckCircleIcon color="primary" />
                    ) : (
                      <FilePresentIcon />
                    )}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">{version.fileName}</Typography>
                      {version.id === activeCsvVersionId && (
                        <Chip label="Active" color="primary" size="small" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Size: {formatFileSize(version.fileSize)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Uploaded: {formatUploadDate(version.uploadedAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        By: {isCurrentUserUpload(version) ? 'You' : 'Collaborator'}
                      </Typography>
                    </Box>
                  }
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {!isCurrentUserUpload(version) && (
                    <CSVDownloadButton
                      campaignId={campaignId}
                      csvVersion={version}
                      variant="icon"
                      size="small"
                    />
                  )}
                  {version.id !== activeCsvVersionId && (
                    <Tooltip title="Switch to this version">
                      <IconButton
                        size="small"
                        onClick={() => {
                          handleVersionSwitch(version.id);
                          setShowHistoryDialog(false);
                        }}
                      >
                        <SwitchIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!selectedVersionForDelete}
        onClose={() => setSelectedVersionForDelete(null)}
      >
        <DialogTitle>Delete CSV Version</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this CSV version? This action cannot be undone.
          </Typography>
          {selectedVersionForDelete && csvVersions[selectedVersionForDelete] && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>File:</strong> {csvVersions[selectedVersionForDelete].fileName}
              </Typography>
              <Typography variant="body2">
                <strong>Size:</strong> {formatFileSize(csvVersions[selectedVersionForDelete].fileSize)}
              </Typography>
              <Typography variant="body2">
                <strong>Uploaded:</strong> {formatUploadDate(csvVersions[selectedVersionForDelete].uploadedAt)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedVersionForDelete(null)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Real-time CSV Upload Notification */}
      <Snackbar
        open={!!newUploadNotification}
        autoHideDuration={6000}
        onClose={() => setNewUploadNotification(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNewUploadNotification(null)} 
          severity="info" 
          sx={{ width: '100%' }}
        >
          📊 New CSV uploaded: <strong>{newUploadNotification?.fileName}</strong> by {newUploadNotification?.uploadedBy}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default CSVVersionManager; 