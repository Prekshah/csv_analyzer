import React from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import { styled } from '@mui/material/styles';
import GoogleIcon from '@mui/icons-material/Google';
import SecurityIcon from '@mui/icons-material/Security';

const LoginContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: '#f5f5f5',
}));

const LoginCard = styled(Card)(({ theme }) => ({
  maxWidth: 450,
  width: '100%',
  padding: theme.spacing(4),
  textAlign: 'center',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  borderRadius: theme.spacing(2),
}));

const CompanyLogo = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  '& img': {
    maxHeight: '80px',
    maxWidth: '200px',
    objectFit: 'contain',
  },
}));

const GoogleButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1.5, 4),
  fontSize: '1.1rem',
  fontWeight: 600,
  textTransform: 'none',
  borderRadius: theme.spacing(1),
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  '&:hover': {
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
  },
}));

const SecurityNote = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(3),
  padding: theme.spacing(2),
  backgroundColor: '#e3f2fd',
  borderRadius: theme.spacing(1),
  border: '1px solid #bbdefb',
}));

interface LoginScreenProps {
  onSignIn: () => Promise<void>;
  error: string | null;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSignIn, error }) => {
  const [loading, setLoading] = React.useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await onSignIn();
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginContainer maxWidth="sm">
      <LoginCard>
        <CardContent>
          {/* Company Branding */}
          <CompanyLogo>
            <img src="/games24x7-logo.png" alt="Games24x7 Logo" />
          </CompanyLogo>
          
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            CSV Analyzer
          </Typography>
          
          <Typography variant="h6" color="textSecondary" gutterBottom>
            A/B Testing Platform
          </Typography>
          
          <Divider sx={{ my: 3 }} />
          
          {/* Authentication Section */}
          <Typography variant="body1" sx={{ mb: 3 }}>
            Sign in with your Games24x7 Google Workspace account to access collaborative analytics tools.
          </Typography>
          
          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          {/* Google Sign-In Button */}
          <GoogleButton
            variant="contained"
            size="large"
            fullWidth
            onClick={handleGoogleSignIn}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
          >
            {loading ? 'Signing in...' : 'Sign in with Google Workspace'}
          </GoogleButton>
          
          {/* Security Information */}
          <SecurityNote>
            <Box display="flex" alignItems="center" justifyContent="center" mb={1}>
              <SecurityIcon sx={{ mr: 1, color: '#1976d2' }} />
              <Typography variant="subtitle2" fontWeight="bold">
                Secure Access
              </Typography>
            </Box>
            <Typography variant="body2" color="textSecondary">
              • Only @games24x7.com email addresses are allowed
              <br />
              • Google Workspace authentication required
              <br />
              • No manual email entry - popup authentication only
              <br />
              • Session persists until you log out
            </Typography>
          </SecurityNote>
          
          {/* Additional Information */}
          <Typography variant="caption" display="block" sx={{ mt: 3, color: 'text.secondary' }}>
            Having trouble signing in? Contact IT support or ensure you're using your official Games24x7 Google Workspace account.
          </Typography>
        </CardContent>
      </LoginCard>
    </LoginContainer>
  );
};

export default LoginScreen; 