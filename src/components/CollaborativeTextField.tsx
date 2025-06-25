import React, { useState, useEffect, useRef } from 'react';
import {
  TextField,
  Box,
  Chip,
  Avatar,
  Tooltip,
  Alert,
  TextFieldProps,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';

import LockIcon from '@mui/icons-material/Lock';
import WarningIcon from '@mui/icons-material/Warning';
import { collaborationManager } from '../utils/collaboration';
import { FieldLock, UserPresence, CollaborationState } from '../types/Campaign';

const CollaborativeContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
}));

const PresenceIndicator = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: -8,
  right: -8,
  zIndex: 1000,
  display: 'flex',
  gap: theme.spacing(0.5),
}));

const LockedFieldOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(255, 193, 7, 0.1)',
  border: `2px solid ${theme.palette.warning.main}`,
  borderRadius: theme.shape.borderRadius,
  pointerEvents: 'none',
  zIndex: 999,
}));

interface CollaborativeTextFieldProps extends Omit<TextFieldProps, 'onChange'> {
  fieldName: string;
  value: string;
  onChange: (value: string) => void;
  collaborationEnabled?: boolean;
}

const CollaborativeTextField: React.FC<CollaborativeTextFieldProps> = ({
  fieldName,
  value,
  onChange,
  collaborationEnabled = true,
  ...textFieldProps
}) => {

  const [isLocked, setIsLocked] = useState<FieldLock | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideUser, setOverrideUser] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (!collaborationEnabled) return;

    const handleCollaborationUpdate = (state: CollaborationState) => {
      console.log(`[CollaborativeTextField] Collaboration update for ${fieldName}, recent activities:`, state.recentActivity.length);
      
      // Check if field is locked
      const fieldLock = collaborationManager.isFieldLocked(fieldName);
      setIsLocked(fieldLock);
      
      // Get active users for this field
      const usersOnField = Array.from(state.activeUsers.values())
        .filter(user => user.currentField === fieldName);
      setActiveUsers(usersOnField);
      
      // Handle incoming field updates from other users
      const recentUpdate = state.recentActivity.find(
        activity => 
          activity.type === 'FIELD_UPDATE' && 
          activity.data?.fieldName === fieldName &&
          activity.userId !== collaborationManager.getCurrentUser().id && // Don't process our own updates
          activity.timestamp > Date.now() - 10000 // Within last 10 seconds
      );
      
      if (recentUpdate && 
          recentUpdate.data?.fieldValue !== undefined && 
          recentUpdate.data.fieldValue !== lastValueRef.current &&
          recentUpdate.data.fieldValue !== value) {
        // Update the field value from remote user
        console.log(`[CollaborativeTextField] Updating ${fieldName} from remote user ${recentUpdate.userName}:`, recentUpdate.data.fieldValue);
        console.log(`[CollaborativeTextField] Current value: "${value}", New value: "${recentUpdate.data.fieldValue}"`);
        onChange(recentUpdate.data.fieldValue);
        lastValueRef.current = recentUpdate.data.fieldValue;
      }
    };

    collaborationManager.addListener(handleCollaborationUpdate);
    
    return () => {
      collaborationManager.removeListener(handleCollaborationUpdate);
    };
  }, [fieldName, onChange, collaborationEnabled, value]);

  // Update last value ref when value changes
  useEffect(() => {
    lastValueRef.current = value;
  }, [value]);

  const handleFocus = () => {
    if (!collaborationEnabled) return;
    
    const fieldLock = collaborationManager.isFieldLocked(fieldName);
    if (fieldLock) {
      setOverrideUser(fieldLock.userName);
      setShowOverrideDialog(true);
      return; // Don't focus until user decides
    }
    
    collaborationManager.broadcastFieldFocus(fieldName);
  };

  const handleOverrideConfirm = () => {
    setShowOverrideDialog(false);
    collaborationManager.broadcastFieldFocus(fieldName);
    
    // Notify the original user about the override attempt
    collaborationManager.broadcastMessage({
      type: 'OVERRIDE_ATTEMPT',
      campaignId: collaborationManager.getCurrentCampaignId()!,
      userId: collaborationManager.getCurrentUser().id,
      userName: collaborationManager.getCurrentUser().name,
      timestamp: Date.now(),
      data: {
        fieldName,
        originalUser: overrideUser
      }
    });
    
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleOverrideCancel = () => {
    setShowOverrideDialog(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleBlur = () => {
    if (!collaborationEnabled) return;
    collaborationManager.broadcastFieldBlur(fieldName);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    const previousValue = lastValueRef.current;
    
    console.log(`[CollaborativeTextField] Local change in ${fieldName}:`, newValue);
    console.log(`[CollaborativeTextField] Collaboration enabled:`, collaborationEnabled);
    console.log(`[CollaborativeTextField] Campaign ID:`, collaborationManager.getCurrentCampaignId());
    
    onChange(newValue);
    lastValueRef.current = newValue;
    
    if (collaborationEnabled) {
      collaborationManager.broadcastFieldUpdate(fieldName, newValue, previousValue);
    }
  };

  const getUserInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getFieldDisplayName = (fieldName: string): string => {
    // Convert camelCase to readable format
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <CollaborativeContainer>
      {/* Lock Warning */}
      {isLocked && (
        <Alert 
          severity="warning" 
          sx={{ mb: 1, fontSize: '0.875rem' }}
          icon={<LockIcon fontSize="small" />}
        >
          {isLocked.userName} is currently editing this field
        </Alert>
      )}

      {/* Main TextField */}
      <TextField
        {...textFieldProps}
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        sx={{
          width: '100%',
          ...textFieldProps.sx,
          ...(isLocked && {
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'warning.main',
                borderWidth: 2,
              },
            },
          }),
        }}
        helperText={
          isLocked 
            ? `${isLocked.userName} is editing this field`
            : textFieldProps.helperText
        }
        FormHelperTextProps={{
          ...textFieldProps.FormHelperTextProps,
          sx: {
            color: isLocked ? 'warning.main' : 'text.secondary',
            ...textFieldProps.FormHelperTextProps?.sx,
          },
        }}
      />

      {/* Locked Field Overlay */}
      {isLocked && <LockedFieldOverlay />}

      {/* User Presence Indicators */}
      {collaborationEnabled && activeUsers.length > 0 && (
        <PresenceIndicator>
          {activeUsers.slice(0, 3).map((user) => (
            <Tooltip 
              key={user.userId}
              title={`${user.userName} is editing ${getFieldDisplayName(fieldName)}`}
              arrow
            >
              <Chip
                size="small"
                avatar={
                  <Avatar 
                    sx={{ 
                      bgcolor: user.color,
                      width: 20,
                      height: 20,
                      fontSize: '0.75rem'
                    }}
                  >
                    {getUserInitials(user.userName)}
                  </Avatar>
                }
                label={user.userName.split(' ')[0]}
                sx={{
                  height: 24,
                  fontSize: '0.75rem',
                  bgcolor: `${user.color}20`,
                  border: `1px solid ${user.color}`,
                  '& .MuiChip-label': {
                    px: 0.5,
                  },
                }}
              />
            </Tooltip>
          ))}
          {activeUsers.length > 3 && (
            <Tooltip title={`+${activeUsers.length - 3} more users`}>
              <Chip
                size="small"
                avatar={<Avatar sx={{ width: 20, height: 20, fontSize: '0.75rem' }}>+{activeUsers.length - 3}</Avatar>}
                label=""
                sx={{ height: 24, minWidth: 24 }}
              />
            </Tooltip>
          )}
        </PresenceIndicator>
      )}

      {/* Override Confirmation Dialog */}
      <Dialog
        open={showOverrideDialog}
        onClose={handleOverrideCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            Field Currently Being Edited
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            <strong>{overrideUser}</strong> is currently editing the <strong>{getFieldDisplayName(fieldName)}</strong> field.
          </Typography>
          <Typography color="text.secondary">
            If you continue editing, {overrideUser} will be notified that you're taking over this field. 
            Any unsaved changes they have might be lost.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleOverrideCancel} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleOverrideConfirm} color="warning" variant="contained">
            Edit Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </CollaborativeContainer>
  );
};

export default CollaborativeTextField; 