import React, { useState, useEffect } from 'react';
import {
    
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem as MenuItemComponent,
  Alert,
  Chip,
  Tooltip
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { EnhancedProposalData } from '../types/Campaign';

interface EnhancedProposalFieldProps {
  fieldName: keyof EnhancedProposalData;
  label: string;
  value: string;
  placeholder?: string;
  type?: 'input' | 'textarea' | 'select';
  options?: string[];
  rows?: number;
  isEditing?: boolean;
  metadata?: {
    lastUpdatedAt: Date;
    lastUpdatedBy: { uid: string; displayName: string };
    history: any[];
    hasHistory: boolean;
  } | null;
  softBlockWarning?: {
    fieldName: keyof EnhancedProposalData;
    lastUpdatedBy: string;
    lastUpdatedAt: Date;
    timeSinceUpdate: number;
  } | null;
  onChange: (value: string) => void;
  onRestoreFromHistory?: (historyIndex: number) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  helperText?: string;
  InputLabelProps?: any;
}

// Utility function to format relative time
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
};

// Utility function to format soft block time
const formatSoftBlockTime = (timeSinceUpdate: number): string => {
  const minutes = Math.floor(timeSinceUpdate / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

export const EnhancedProposalField: React.FC<EnhancedProposalFieldProps> = ({
  fieldName,
  label,
  value,
  placeholder,
  type = 'input',
  options = [],
  rows = 3,
  isEditing = false,
  metadata,
  softBlockWarning,
  onChange,
  onRestoreFromHistory,
  disabled = false,
  fullWidth = true,
  helperText,
  InputLabelProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [historyMenuAnchor, setHistoryMenuAnchor] = useState<null | HTMLElement>(null);
  const [showSoftBlockWarning, setShowSoftBlockWarning] = useState(false);
  
  // Show soft block warning when field is focused and warning exists
  useEffect(() => {
    if (isFocused && softBlockWarning) {
      setShowSoftBlockWarning(true);
    } else {
      setShowSoftBlockWarning(false);
    }
  }, [isFocused, softBlockWarning]);
  
  const handleFocus = () => {
    setIsFocused(true);
  };
  
  const handleBlur = () => {
    setIsFocused(false);
  };
  
  const handleHistoryClick = (event: React.MouseEvent<HTMLElement>) => {
    setHistoryMenuAnchor(event.currentTarget);
  };
  
  const handleHistoryClose = () => {
    setHistoryMenuAnchor(null);
  };
  
  const handleHistoryRestore = (historyIndex: number) => {
    if (onRestoreFromHistory) {
      onRestoreFromHistory(historyIndex);
    }
    handleHistoryClose();
  };

  // Create enhanced helper text with metadata
  const enhancedHelperText = () => {
    const parts = [];
    
    if (helperText) {
      parts.push(helperText);
    }
    
    if (metadata) {
      const metadataText = `Last updated by ${metadata.lastUpdatedBy.displayName} • ${formatRelativeTime(metadata.lastUpdatedAt)}`;
      parts.push(metadataText);
    }
    
    return parts.join(' • ');
  };

  // Style modifications for editing state
  const getFieldStyles = () => {
    if (isEditing) {
      return {
        '& .MuiOutlinedInput-root': {
          '& fieldset': {
            borderColor: '#1976d2',
            borderWidth: '2px'
          }
        },
        backgroundColor: '#f3f8ff'
      };
    }
    return {};
  };

  const renderField = () => {
    const commonProps = {
      fullWidth,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        onChange(e.target.value),
      onFocus: handleFocus,
      onBlur: handleBlur,
      placeholder,
      disabled,
      helperText: enhancedHelperText(),
      sx: getFieldStyles(),
      InputLabelProps
    };
    
    if (type === 'textarea') {
      return (
        <TextField
          {...commonProps}
          label={label}
          multiline
          rows={rows}
        />
      );
    }
    
    if (type === 'select') {
      return (
        <FormControl fullWidth disabled={disabled} sx={getFieldStyles()}>
          <InputLabel>{label}</InputLabel>
          <Select
            value={value}
            onChange={(e) => onChange(e.target.value as string)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            label={label}
          >
            {placeholder && (
              <MenuItem value="">
                <em>{placeholder}</em>
              </MenuItem>
            )}
            {options.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
          {enhancedHelperText() && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
              {enhancedHelperText()}
            </Typography>
          )}
        </FormControl>
      );
    }
    
    return (
      <TextField
        {...commonProps}
        label={label}
        type={fieldName === 'date' ? 'date' : 'text'}
      />
    );
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Soft Block Warning */}
      {showSoftBlockWarning && softBlockWarning && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          onClose={() => setShowSoftBlockWarning(false)}
        >
          <strong>Edited by {softBlockWarning.lastUpdatedBy}</strong> {formatSoftBlockTime(softBlockWarning.timeSinceUpdate)}. 
          You're about to overwrite their changes.
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        {/* Main Field */}
        <Box sx={{ flex: 1 }}>
          {renderField()}
        </Box>
        
        {/* History Button */}
        {metadata?.hasHistory && (isFocused || Boolean(historyMenuAnchor)) && (
          <Tooltip title="View version history">
            <IconButton
              onClick={handleHistoryClick}
              size="small"
              sx={{ 
                mt: type === 'select' ? 1 : 1.5,
                color: 'text.secondary',
                '&:hover': { color: 'primary.main' }
              }}
            >
              <HistoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      
      {/* Editing Indicator */}
      {isEditing && (
        <Chip
          label="• editing"
          size="small"
          color="primary"
          variant="filled"
          sx={{ 
            position: 'absolute',
            top: -8,
            right: metadata?.hasHistory ? 40 : 8,
            fontSize: '0.65rem',
            height: 18,
            fontWeight: 400,
            fontStyle: 'italic',
            opacity: 0.8,
            backgroundColor: 'primary.light',
            color: 'white',
            '& .MuiChip-label': {
              paddingX: 1
            },
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': { opacity: 0.8 },
              '50%': { opacity: 1 },
              '100%': { opacity: 0.8 }
            }
          }}
        />
      )}
      
      {/* History Menu */}
      <Menu
        anchorEl={historyMenuAnchor}
        open={Boolean(historyMenuAnchor)}
        onClose={handleHistoryClose}
        PaperProps={{
          sx: { maxWidth: 400, maxHeight: 300 }
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon fontSize="small" />
            Version History
          </Typography>
        </Box>
        
        {metadata?.history && metadata.history.length > 0 ? (
          metadata.history.map((historyItem, index) => (
            <MenuItemComponent
              key={index}
              onClick={() => handleHistoryRestore(index)}
              sx={{ 
                flexDirection: 'column', 
                alignItems: 'flex-start',
                maxWidth: 380,
                whiteSpace: 'normal'
              }}
            >
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                "{historyItem.value.length > 80 
                  ? `${historyItem.value.substring(0, 80)}...` 
                  : historyItem.value}"
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {historyItem.updatedBy.displayName} • {formatRelativeTime(historyItem.updatedAt)}
              </Typography>
            </MenuItemComponent>
          ))
        ) : (
          <MenuItemComponent disabled>
            <Typography variant="body2" color="text.secondary">
              No history available
            </Typography>
          </MenuItemComponent>
        )}
      </Menu>
    </Box>
  );
}; 