import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Container
} from '@mui/material';
import { styled } from '@mui/material/styles';

const LoadingContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: '#f5f5f5',
}));

const LogoContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  '& img': {
    maxHeight: '60px',
    maxWidth: '150px',
    objectFit: 'contain',
  },
}));

const LoadingScreen: React.FC = () => {
  return (
    <LoadingContainer maxWidth="sm">
      <LogoContainer>
        <img src="/games24x7-logo.png" alt="Games24x7 Logo" />
      </LogoContainer>
      
      <Typography variant="h5" component="h1" gutterBottom fontWeight="medium">
        CSV Analyzer
      </Typography>
      
      <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={40} thickness={4} />
        <Typography variant="body1" color="text.secondary">
          Checking authentication...
        </Typography>
      </Box>
    </LoadingContainer>
  );
};

export default LoadingScreen; 