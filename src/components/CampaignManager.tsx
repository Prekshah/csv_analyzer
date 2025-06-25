import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Alert,
  CircularProgress,
  FormHelperText,
  Skeleton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  FormControl,
  InputLabel,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  People as PeopleIcon,
  Analytics as AnalyticsIcon,
  Schedule as ScheduleIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Share as ShareIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { Campaign } from '../types/Campaign';
import {
  createCampaign as firestoreCreateCampaign,
  updateCampaign as firestoreUpdateCampaign,
  deleteCampaign as firestoreDeleteCampaign,
  subscribeToUserCampaigns
} from '../utils/firestoreCampaignService';
import { validateCampaignName } from '../utils/storage';
import { getUidByEmail } from '../utils/userUtils';

interface CampaignManagerProps {
  onCampaignSelect: (campaign: Campaign) => void;
  onNewCampaign: () => void;
}

type CollaboratorRole = 'editor' | 'viewer' | 'owner';
const validRoles: CollaboratorRole[] = ['editor', 'viewer', 'owner'];

const CampaignManager: React.FC<CampaignManagerProps> = ({ onCampaignSelect, onNewCampaign }) => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDescription, setNewCampaignDescription] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editCampaignName, setEditCampaignName] = useState('');
  const [editCampaignDescription, setEditCampaignDescription] = useState('');
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [collaboratorRole, setCollaboratorRole] = useState<CollaboratorRole>('editor');
  const [shareError, setShareError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteSpinner, setShowDeleteSpinner] = useState(false);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  let deleteSpinnerTimeout: NodeJS.Timeout | null = null;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = subscribeToUserCampaigns(user.uid, (userCampaigns) => {
      // Sort campaigns by most recently accessed (updatedAt or createdAt)
      const sortedCampaigns = [...userCampaigns].sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bTime - aTime;
      });
      setCampaigns(sortedCampaigns);
      setLoading(false);
      if (deletingCampaignId && !sortedCampaigns.some(c => c.id === deletingCampaignId)) {
        setShowDeleteSpinner(false);
        setDeletingCampaignId(null);
      }
    });
    return unsubscribe;
  }, [user, deletingCampaignId]);

  const handleCreateCampaign = async () => {
    if (!user || !newCampaignName.trim()) return;
    setCreating(true);
    setCreateDialogOpen(false);
    try {
      // Validate campaign name
      const validation = validateCampaignName(newCampaignName.trim(), campaigns);
      if (!validation.isValid && validation.error) {
        setNameError(validation.error);
        return;
      }

      // Build campaign data, only include description if not empty
      const campaignData: any = {
        name: newCampaignName.trim(),
        createdBy: user.uid,
        collaborators: {
          [user.uid]: {
            user: {
              uid: user.uid,
              email: user.email || 'unknown@games24x7.com',
              displayName: user.displayName || 'Unknown User',
              photoURL: user.photoURL || undefined
            },
            role: 'owner',
            addedAt: new Date(),
            addedBy: user.uid
          }
        },
        isPublic: false,
        tags: []
      };
      if (newCampaignDescription.trim()) {
        campaignData.description = newCampaignDescription.trim();
      }

      await firestoreCreateCampaign(campaignData, user.uid);

      setNewCampaignName('');
      setNewCampaignDescription('');
      setError(null);
      setNameError(null);

      // Firestore will update campaigns via subscription
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create campaign. Please try again.';
      setError(errorMessage);
      console.error('Error creating campaign:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewCampaignName(value);
    
    // Clear previous errors
    setNameError(null);
    
    // Validate as user types
    if (value.trim()) {
      const validation = validateCampaignName(value.trim(), campaigns);
      if (!validation.isValid && validation.error) {
        setNameError(validation.error);
      }
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, campaign: Campaign) => {
    setMenuAnchor(event.currentTarget);
    setSelectedCampaign(campaign);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedCampaign(null);
  };

  const handleDeleteCampaign = async () => {
    if (!selectedCampaign) return;
    setDeleteConfirmOpen(false);
    handleMenuClose();
    setDeleting(true);
    setShowDeleteSpinner(false);
    setDeletingCampaignId(selectedCampaign.id);
    if (deleteSpinnerTimeout) clearTimeout(deleteSpinnerTimeout);
    deleteSpinnerTimeout = setTimeout(() => {
      setShowDeleteSpinner(true);
    }, 300);
    try {
      await firestoreDeleteCampaign(selectedCampaign.id);
      setError(null);
    } catch (err) {
      setError('Failed to delete campaign. Please try again.');
      console.error('Error deleting campaign:', err);
    } finally {
      setDeleting(false);
      if (deleteSpinnerTimeout) clearTimeout(deleteSpinnerTimeout);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getUserRole = (campaign: Campaign) => {
    if (!user) return null;
    return campaign.collaborators[user.uid]?.role || null;
  };

  const getCollaboratorCount = (campaign: Campaign) => {
    return Object.keys(campaign.collaborators).length;
  };

  const handleEditClick = () => {
    if (selectedCampaign) {
      setEditCampaignName(selectedCampaign.name);
      setEditCampaignDescription(selectedCampaign.description || '');
      setEditNameError(null);
      setEditDialogOpen(true);
      setMenuAnchor(null);
    }
  };

  const handleEditNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEditCampaignName(value);
    setEditNameError(null);
    if (value.trim()) {
      // Exclude the current campaign from duplicate check
      const otherCampaigns = campaigns.filter(c => c.id !== selectedCampaign?.id);
      const validation = validateCampaignName(value.trim(), otherCampaigns);
      if (!validation.isValid && validation.error) {
        setEditNameError(validation.error);
      }
    }
  };

  const handleEditSave = async () => {
    if (!selectedCampaign) return;
    setEditing(true);
    setEditDialogOpen(false);
    // Validate
    const otherCampaigns = campaigns.filter(c => c.id !== selectedCampaign.id);
    const validation = validateCampaignName(editCampaignName.trim(), otherCampaigns);
    if (!validation.isValid && validation.error) {
      setEditNameError(validation.error);
      return;
    }
    try {
      // Only include description if not empty
      const updates: any = { name: editCampaignName.trim() };
      if (editCampaignDescription.trim()) {
        updates.description = editCampaignDescription.trim();
      }
      await firestoreUpdateCampaign(selectedCampaign.id, updates);
      setEditNameError(null);
    } catch (err) {
      setEditNameError('Failed to update campaign. Please try again.');
      console.error('Error updating campaign:', err);
    } finally {
      setEditing(false);
    }
  };

  const handleShareClick = () => {
    setShareDialogOpen(true);
    setShareError(null);
  };

  const handleAddCollaborator = async () => {
    if (!selectedCampaign || !collaboratorEmail.trim()) return;
    setShareError(null);
    setLoading(true);
    // Lookup UID by email using utility
    const foundUid = await getUidByEmail(collaboratorEmail.trim());
    if (!foundUid) {
      setShareError('User not found. They must log in at least once first.');
      setLoading(false);
      return;
    }
    const uid = foundUid; // Now guaranteed to be string
    const newCollaborators = { ...selectedCampaign.collaborators };
    newCollaborators[uid] = {
      user: {
        uid,
        email: collaboratorEmail.trim(),
        displayName: collaboratorEmail.trim().split('@')[0],
        photoURL: undefined
      },
      role: collaboratorRole,
      addedAt: new Date(),
      addedBy: user?.uid || ''
    };
    const newCollaboratorIds = Object.keys(newCollaborators);
    try {
      await firestoreUpdateCampaign(selectedCampaign.id, {
        collaborators: newCollaborators,
        collaboratorIds: newCollaboratorIds
      });
      setCollaboratorEmail('');
      setCollaboratorRole('editor');
      setShareError(null);
    } catch (err) {
      setShareError('Failed to add collaborator.');
    }
    setLoading(false);
  };

  const handleRemoveCollaborator = async (uid: string) => {
    if (!selectedCampaign) return;
    const newCollaborators = { ...selectedCampaign.collaborators };
    delete newCollaborators[uid];
    try {
      await firestoreUpdateCampaign(selectedCampaign.id, {
        collaborators: newCollaborators,
        collaboratorIds: Object.keys(newCollaborators)
      });
    } catch (err) {
      setShareError('Failed to remove collaborator.');
    }
  };

  const handleRoleChange = async (uid: string, newRole: CollaboratorRole) => {
    if (!selectedCampaign) return;
    const newCollaborators = { ...selectedCampaign.collaborators };
    newCollaborators[uid].role = newRole;
    try {
      await firestoreUpdateCampaign(selectedCampaign.id, {
        collaborators: newCollaborators,
        collaboratorIds: Object.keys(newCollaborators)
      });
    } catch (err) {
      setShareError('Failed to update role.');
    }
  };

  const getValidRole = (role: any): CollaboratorRole => validRoles.includes(role as CollaboratorRole) ? (role as CollaboratorRole) : 'viewer';

  if (loading) {
    // Show skeletons for campaign cards while loading
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" fontWeight="bold">
            My Campaigns
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled
          >
            New Campaign
          </Button>
        </Box>
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} md={6} lg={4} key={i}>
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2, mb: 2 }} />
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="80%" />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          My Campaigns
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setCreateDialogOpen(true);
            setNewCampaignName('');
            setNewCampaignDescription('');
            setNameError(null);
            setCreating(false);
          }}
        >
          New Campaign
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Campaigns Grid */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <AnalyticsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No campaigns yet
            </Typography>
            <Typography color="text.secondary" mb={3}>
              Create your first campaign to start analyzing CSV data with your team.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create First Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {campaigns.map((campaign) => (
            <Grid item xs={12} md={6} lg={4} key={campaign.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { 
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                    transition: 'all 0.2s ease-in-out'
                  }
                }}
                onClick={() => onCampaignSelect(campaign)}
              >
                <CardContent>
                  {/* Header with menu */}
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1, mr: 1 }}>
                      {campaign.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuClick(e, campaign);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  {/* Description */}
                  {campaign.description && (
                    <Typography color="text.secondary" variant="body2" mb={2}>
                      {campaign.description}
                    </Typography>
                  )}

                  {/* Role chip */}
                  <Box mb={2}>
                    <Chip 
                      label={getUserRole(campaign)} 
                      size="small" 
                      color={getUserRole(campaign) === 'owner' ? 'primary' : 'default'}
                    />
                  </Box>

                  {/* Stats */}
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Tooltip title="Collaborators">
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <PeopleIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {getCollaboratorCount(campaign)}
                        </Typography>
                      </Box>
                    </Tooltip>
                    
                    {campaign.csvAnalysis && (
                      <Tooltip title="Has CSV Data">
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <AnalyticsIcon fontSize="small" color="primary" />
                          <Typography variant="body2" color="primary">
                            {campaign.csvAnalysis.fileName}
                          </Typography>
                        </Box>
                      </Tooltip>
                    )}
                  </Box>

                  {/* Timestamps */}
                  <Box display="flex" flexDirection="column" alignItems="flex-start" gap={0.5}>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <ScheduleIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        Updated {formatDate(campaign.updatedAt)}
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <ScheduleIcon fontSize="small" color="action" sx={{ opacity: 0.7 }} />
                      <Typography variant="caption" color="text.secondary">
                        Created {formatDate(campaign.createdAt)} by {campaign.collaborators && campaign.collaborators[campaign.createdBy]?.user.displayName || campaign.collaborators && campaign.collaborators[campaign.createdBy]?.user.email || 'Unknown'}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={createDialogOpen} onClose={() => {
        setCreateDialogOpen(false);
        setNewCampaignName('');
        setNewCampaignDescription('');
        setNameError(null);
        setCreating(false);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Campaign</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Campaign Name"
            fullWidth
            variant="outlined"
            value={newCampaignName}
            onChange={handleNameChange}
            error={Boolean(nameError)}
            helperText={nameError}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newCampaignDescription}
            onChange={(e) => setNewCampaignDescription(e.target.value)}
          />
          <FormHelperText>
            Campaign name must start with a letter or number. Special characters are allowed after the first character.
          </FormHelperText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setNewCampaignName('');
            setNewCampaignDescription('');
            setNameError(null);
            setCreating(false);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateCampaign} 
            variant="contained"
            disabled={!newCampaignName.trim() || Boolean(nameError) || creating}
            startIcon={creating ? <CircularProgress size={20} /> : undefined}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Campaign Menu */}
      {menuAnchor && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleEditClick}>
            <EditIcon sx={{ mr: 1 }} />
            Edit
          </MenuItem>
          <MenuItem onClick={handleShareClick}>
            <ShareIcon sx={{ mr: 1 }} />
            Share
          </MenuItem>
          <MenuItem onClick={() => setDeleteConfirmOpen(true)} sx={{ color: 'error.main' }}>
            <DeleteIcon sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>
      )}

      {/* Edit Campaign Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Campaign</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Campaign Name"
            fullWidth
            variant="outlined"
            value={editCampaignName}
            onChange={handleEditNameChange}
            error={Boolean(editNameError)}
            helperText={editNameError}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={editCampaignDescription}
            onChange={e => setEditCampaignDescription(e.target.value)}
          />
          <FormHelperText>
            Campaign name must start with a letter or number. Special characters are allowed after the first character.
          </FormHelperText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            disabled={!editCampaignName.trim() || Boolean(editNameError) || editing}
            startIcon={editing ? <CircularProgress size={20} /> : undefined}
          >
            {editing ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share/Collaborators Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share Campaign / Manage Collaborators</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              label="Collaborator Email"
              value={collaboratorEmail}
              onChange={e => setCollaboratorEmail(e.target.value)}
              fullWidth
              sx={{ mb: 1 }}
            />
            <FormControl fullWidth sx={{ mb: 1 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={collaboratorRole}
                label="Role"
                onChange={e => {
                  const value = e.target.value as CollaboratorRole;
                  if (validRoles.includes(value)) {
                    setCollaboratorRole(value);
                  }
                }}
              >
                <MenuItem value="editor">Editor</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={handleAddCollaborator}
              disabled={!collaboratorEmail.trim()}
            >
              Add Collaborator
            </Button>
            {shareError && <Alert severity="error" sx={{ mt: 2 }}>{shareError}</Alert>}
          </Box>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Current Collaborators:</Typography>
          <List>
            {selectedCampaign && Object.values(selectedCampaign.collaborators).map((collab, idx) => (
              <ListItem key={collab.user.uid}>
                <ListItemText
                  primary={collab.user.displayName || collab.user.email}
                  secondary={collab.role}
                />
                <ListItemSecondaryAction>
                  <FormControl size="small" sx={{ minWidth: 100, mr: 1 }}>
                    <Select
                      value={getValidRole(collab.role) as any}
                      onChange={e => {
                        const value = e.target.value as CollaboratorRole;
                        if (validRoles.includes(value)) {
                          handleRoleChange(collab.user.uid, value);
                        }
                      }}
                      disabled={user?.uid !== selectedCampaign.createdBy}
                    >
                      <MenuItem value="editor">Editor</MenuItem>
                      <MenuItem value="viewer">Viewer</MenuItem>
                      <MenuItem value="owner">Owner</MenuItem>
                    </Select>
                  </FormControl>
                  {user?.uid === selectedCampaign.createdBy && collab.user.uid !== user?.uid && (
                    <IconButton edge="end" onClick={() => handleRemoveCollaborator(collab.user.uid)}>
                      <DeleteIcon />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => {
        setDeleteConfirmOpen(false);
        handleMenuClose();
      }}>
        <DialogTitle>Delete Campaign</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this campaign?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteConfirmOpen(false);
            handleMenuClose();
          }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteCampaign} color="error" variant="contained" disabled={deleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Spinner Snackbar */}
      <Snackbar
        open={showDeleteSpinner && !!deletingCampaignId && campaigns.some(c => c.id === deletingCampaignId)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={<span style={{ display: 'flex', alignItems: 'center' }}><CircularProgress size={20} style={{ marginRight: 8 }} />Deleting campaign...</span>}
      />
    </Box>
  );
};

export default CampaignManager; 