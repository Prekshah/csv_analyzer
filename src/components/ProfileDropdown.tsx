import React, { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
  Tooltip,
  Chip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Logout,
  Person,
  Email,
  Business,
  ExpandMore
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const ProfileContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const UserInfoButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  color: theme.palette.text.primary,
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.spacing(1),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const UserAvatar = styled(Avatar)(({ theme }) => ({
  width: 32,
  height: 32,
  fontSize: '0.875rem',
  fontWeight: 600,
  backgroundColor: theme.palette.primary.main,
}));

const MenuItemStyled = styled(MenuItem)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  minWidth: 280,
}));

const ProfileDropdown: React.FC = () => {
  const { user, signOut } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoggingOut(false);
      handleClose();
    }
  };

  if (!user) {
    return null;
  }

  // Get user initials for avatar
  const getInitials = (name: string | null): string => {
    if (!name) return user.email?.charAt(0).toUpperCase() || 'U';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get display name
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const shortName = displayName.split(' ')[0]; // First name only for compact display

  return (
    <ProfileContainer>
      <Tooltip title="Account settings">
        <UserInfoButton
          onClick={handleClick}
          endIcon={<ExpandMore />}
          startIcon={
            <UserAvatar
              src={user.photoURL || undefined}
              alt={displayName}
            >
              {getInitials(user.displayName)}
            </UserAvatar>
          }
        >
          <Box sx={{ textAlign: 'left', display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="body2" fontWeight="medium">
              {shortName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              @games24x7.com
            </Typography>
          </Box>
        </UserInfoButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          elevation: 8,
          sx: {
            mt: 1,
            borderRadius: 2,
            minWidth: 280,
          },
        }}
      >
        {/* User Info Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" gap={2}>
            <UserAvatar
              src={user.photoURL || undefined}
              alt={displayName}
              sx={{ width: 48, height: 48 }}
            >
              {getInitials(user.displayName)}
            </UserAvatar>
            <Box flex={1}>
              <Typography variant="subtitle1" fontWeight="medium">
                {displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
              <Chip
                label="Games24x7"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ mt: 0.5, fontSize: '0.75rem' }}
              />
            </Box>
          </Box>
        </Box>

        {/* Account Information */}
        <MenuItemStyled disabled>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Account"
            secondary={user.displayName || 'Google Workspace User'}
          />
        </MenuItemStyled>

        <MenuItemStyled disabled>
          <ListItemIcon>
            <Email fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Email"
            secondary={user.email}
          />
        </MenuItemStyled>

        <MenuItemStyled disabled>
          <ListItemIcon>
            <Business fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Organization"
            secondary="Games24x7"
          />
        </MenuItemStyled>

        <Divider sx={{ my: 1 }} />

        {/* Logout Option */}
        <MenuItemStyled onClick={handleLogout} disabled={loggingOut}>
          <ListItemIcon>
            <Logout fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText
            primary={loggingOut ? 'Signing out...' : 'Sign out'}
            sx={{ '& .MuiListItemText-primary': { color: 'error.main' } }}
          />
        </MenuItemStyled>
      </Menu>
    </ProfileContainer>
  );
};

export default ProfileDropdown; 