import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Paper,
  Grid,
  Button,
  Alert,
  Tooltip,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  ButtonGroup,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { erf } from 'mathjs';

interface PowerAnalysisProps {
  csvData: any;
}

const PowerAnalysis: React.FC<PowerAnalysisProps> = ({ csvData }) => {
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [alpha, setAlpha] = useState<string>('0.05');
  const [beta, setBeta] = useState<string>('0.8');
  const [mde, setMde] = useState<string>('5');
  const [customMde, setCustomMde] = useState<string>('');
  const [mdeType, setMdeType] = useState<'absolute' | 'percentage'>('percentage');
  const [testType, setTestType] = useState<'one-tailed' | 'two-tailed'>('two-tailed');
  const [numPaths, setNumPaths] = useState<'2' | '3'>('2');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Common values for dropdowns
  const alphaOptions = [
    { value: '0.01', label: '1% (α = 0.01)' },
    { value: '0.05', label: '5% (α = 0.05)' },
    { value: '0.1', label: '10% (α = 0.1)' }
  ];

  const betaOptions = [
    { value: '0.8', label: '80% (β = 0.8)' },
    { value: '0.9', label: '90% (β = 0.9)' },
    { value: '0.95', label: '95% (β = 0.95)' }
  ];

  const mdeOptions = [
    { value: '2', label: '2%' },
    { value: '5', label: '5%' },
    { value: '10', label: '10%' },
    { value: '15', label: '15%' },
    { value: '20', label: '20%' },
    { value: 'custom', label: 'Custom value' }
  ];

  const handleMdeChange = (value: string) => {
    setMde(value);
    if (value !== 'custom') {
      setCustomMde('');
    } else {
      setCustomMde(mde !== 'custom' ? mde : '');
    }
  };

  const getEffectiveMde = () => {
    return mde === 'custom' ? customMde : mde;
  };

  const calculateSampleSize = () => {
    try {
      setError('');
      const effectiveMde = getEffectiveMde();
      if (!selectedMetric || !alpha || !beta || !effectiveMde) {
        throw new Error('Please fill in all required fields');
      }

      const stats = csvData.statistics[selectedMetric];
      const mean = stats.mean;
      const stdDev = stats.standardDeviation;
      
      if (typeof mean !== 'number' || typeof stdDev !== 'number') {
        throw new Error('Selected metric must be numeric');
      }

      // Convert percentage MDE to absolute if needed
      let absoluteMde = parseFloat(effectiveMde);
      if (mdeType === 'percentage') {
        absoluteMde = (mean * parseFloat(effectiveMde)) / 100;
      }

      // Calculate z-scores
      const zAlpha = testType === 'one-tailed' 
        ? -1 * inversePhi(parseFloat(alpha))
        : -1 * inversePhi(parseFloat(alpha) / 2);
      const zBeta = -1 * inversePhi(parseFloat(beta));

      // Calculate sample size per group
      const variance = stdDev * stdDev;
      let sampleSizePerGroup = Math.ceil(
        2 * variance * (zAlpha + zBeta) * (zAlpha + zBeta) / (absoluteMde * absoluteMde)
      );

      // Adjust for multiple paths if needed
      const totalSampleSize = numPaths === '2' 
        ? sampleSizePerGroup * 2 
        : sampleSizePerGroup * 3;

      setResults({
        sampleSizePerGroup,
        totalSampleSize,
        mean,
        stdDev,
        absoluteMde,
        relativeMde: (absoluteMde / mean) * 100,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Helper function to calculate inverse of standard normal CDF
  const inversePhi = (p: number): number => {
    if (p <= 0 || p >= 1) {
      throw new Error('Probability must be between 0 and 1');
    }
    
    // Approximation of inverse error function
    const a = 0.147;
    const y = Math.sqrt(-2 * Math.log(p));
    let x0 = -(2.30753 + 0.27061 * y) / (1 + 0.99229 * y + 0.04481 * y * y);
    
    for (let i = 0; i < 2; i++) {
      const err = erf(x0 / Math.sqrt(2)) - (1 - 2 * p);
      const dx = err * Math.sqrt(2 * Math.PI) * Math.exp(x0 * x0 / 2);
      x0 -= dx / (1 + x0 * dx);
    }
    
    return x0;
  };

  const handleReset = () => {
    setSelectedMetric('');
    setAlpha('0.05');
    setBeta('0.8');
    setMde('5');
    setCustomMde('');
    setMdeType('percentage');
    setTestType('two-tailed');
    setNumPaths('2');
    setResults(null);
    setError('');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Power Analysis Calculator</Typography>
        <ButtonGroup>
          <Button
            startIcon={<RefreshIcon />}
            onClick={calculateSampleSize}
            disabled={!selectedMetric}
            color="primary"
            variant="contained"
            size="small"
          >
            Re-run Analysis
          </Button>
          <Button
            startIcon={<RestartAltIcon />}
            onClick={handleReset}
            color="secondary"
            variant="outlined"
            size="small"
          >
            Reset
          </Button>
        </ButtonGroup>
      </Box>
      
      {/* Metric Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Primary Metric</InputLabel>
              <Select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                label="Primary Metric"
              >
                {csvData?.columns.map((column: string) => (
                  <MenuItem key={column} value={column}>
                    {column}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {selectedMetric && (
            <Grid item xs={12}>
              <Typography variant="body2">
                Mean: {csvData.statistics[selectedMetric].mean?.toFixed(4)}
                <Tooltip title="The average value of your metric">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Typography>
              <Typography variant="body2">
                Standard Deviation: {csvData.statistics[selectedMetric].standardDeviation?.toFixed(4)}
                <Tooltip title="A measure of variability in your metric">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Test Parameters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Alpha (Significance Level)</InputLabel>
              <Select
                value={alpha}
                onChange={(e) => setAlpha(e.target.value)}
                label="Alpha (Significance Level)"
              >
                {alphaOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Beta (Statistical Power)</InputLabel>
              <Select
                value={beta}
                onChange={(e) => setBeta(e.target.value)}
                label="Beta (Statistical Power)"
              >
                {betaOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Minimum Detectable Effect (MDE)</InputLabel>
              <Select
                value={mde}
                onChange={(e) => handleMdeChange(e.target.value)}
                label="Minimum Detectable Effect (MDE)"
              >
                {mdeOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {mde === 'custom' && (
              <TextField
                fullWidth
                label="Custom MDE Value"
                value={customMde}
                onChange={(e) => setCustomMde(e.target.value)}
                type="number"
                inputProps={{ step: 'any' }}
                sx={{ mt: 2 }}
                helperText={`Enter custom value ${mdeType === 'percentage' ? '(in %)' : ''}`}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>MDE Type</InputLabel>
              <Select
                value={mdeType}
                onChange={(e) => setMdeType(e.target.value as 'absolute' | 'percentage')}
                label="MDE Type"
              >
                <MenuItem value="percentage">Percentage</MenuItem>
                <MenuItem value="absolute">Absolute</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl>
              <FormLabel>Test Type</FormLabel>
              <RadioGroup
                row
                value={testType}
                onChange={(e) => setTestType(e.target.value as 'one-tailed' | 'two-tailed')}
              >
                <FormControlLabel 
                  value="two-tailed" 
                  control={<Radio />} 
                  label="Two-tailed" 
                />
                <FormControlLabel 
                  value="one-tailed" 
                  control={<Radio />} 
                  label="One-tailed" 
                />
              </RadioGroup>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl>
              <FormLabel>Number of Paths</FormLabel>
              <RadioGroup
                row
                value={numPaths}
                onChange={(e) => setNumPaths(e.target.value as '2' | '3')}
              >
                <FormControlLabel 
                  value="2" 
                  control={<Radio />} 
                  label="2-path (A/B)" 
                />
                <FormControlLabel 
                  value="3" 
                  control={<Radio />} 
                  label="3-path (A/B/C)" 
                />
              </RadioGroup>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Results */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {results && !error && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Results</Typography>
            <Button
              startIcon={<RefreshIcon />}
              onClick={calculateSampleSize}
              color="primary"
              size="small"
            >
              Recalculate
            </Button>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body1">
                Required Sample Size per Group: <strong>{results.sampleSizePerGroup.toLocaleString()}</strong>
                <Tooltip title="Minimum number of samples needed in each test group">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body1">
                Total Required Sample Size: <strong>{results.totalSampleSize.toLocaleString()}</strong>
                <Tooltip title="Total number of samples needed across all test groups">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Absolute MDE: {results.absoluteMde.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Relative MDE: {results.relativeMde.toFixed(2)}%
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default PowerAnalysis; 