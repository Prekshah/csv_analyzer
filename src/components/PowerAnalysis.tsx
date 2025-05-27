import React, { useState, useRef } from 'react';
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
  ButtonGroup,
  Fade,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  Divider,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
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
  const [numPaths, setNumPaths] = useState<string>('2');
  const [customPaths, setCustomPaths] = useState<string>('');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string>('');
  
  const resultsRef = useRef<HTMLDivElement>(null);

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

      // Adjust for multiple paths
      const effectiveNumPaths = numPaths === 'custom' ? parseInt(customPaths) || 2 : parseInt(numPaths);
      const totalSampleSize = sampleSizePerGroup * effectiveNumPaths;

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
    setCustomPaths('');
    setResults(null);
    setError('');
  };

  const isFormValid = () => {
    const effectiveMde = mde === 'custom' ? customMde : mde;
    return Boolean(selectedMetric && alpha && beta && effectiveMde);
  };

  const handleRunAnalysis = () => {
    calculateSampleSize();
    // Scroll to results after a short delay to allow for state update
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
          {/* Alpha and Beta in the first row */}
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

          {/* MDE Selection and Number of Paths side by side */}
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
              <InputLabel>Number of Paths</InputLabel>
              <Select
                value={numPaths}
                onChange={(e) => {
                  setNumPaths(e.target.value);
                  if (e.target.value !== 'custom') {
                    setCustomPaths('');
                  }
                }}
                label="Number of Paths"
              >
                <MenuItem value="1">1-path (Control only)</MenuItem>
                <MenuItem value="2">2-path (A/B)</MenuItem>
                <MenuItem value="3">3-path (A/B/C)</MenuItem>
                <MenuItem value="4">4-path (A/B/C/D)</MenuItem>
                <MenuItem value="custom">Custom number of paths</MenuItem>
              </Select>
            </FormControl>
            {numPaths === 'custom' && (
              <TextField
                fullWidth
                label="Custom Number of Paths"
                value={customPaths}
                onChange={(e) => setCustomPaths(e.target.value)}
                type="number"
                inputProps={{ min: 1 }}
                sx={{ mt: 2 }}
                helperText="Enter the number of paths (e.g. 20)"
              />
            )}
          </Grid>

          {/* Radio button groups in the same row */}
          <Grid item xs={12} sm={6}>
            <FormControl>
              <FormLabel>MDE Type</FormLabel>
              <RadioGroup
                row
                value={mdeType}
                onChange={(e) => setMdeType(e.target.value as 'absolute' | 'percentage')}
              >
                <FormControlLabel 
                  value="percentage" 
                  control={<Radio />} 
                  label="Percentage" 
                />
                <FormControlLabel 
                  value="absolute" 
                  control={<Radio />} 
                  label="Absolute" 
                />
              </RadioGroup>
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
        </Grid>
      </Paper>

      {/* Run Analysis Button */}
      <Fade in={isFormValid()}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<PlayArrowIcon />}
            onClick={handleRunAnalysis}
            sx={{ minWidth: 200 }}
          >
            Run Analysis
          </Button>
        </Box>
      </Fade>

      {/* Results */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {results && !error && (
        <Box ref={resultsRef}>
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

            {/* Main Results */}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  Required Sample Size per Group: <strong>{results.sampleSizePerGroup.toLocaleString()}</strong>
                  <Tooltip title="Minimum number of samples needed in each test group">
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  Total Required Sample Size: <strong>{results.totalSampleSize.toLocaleString()}</strong>
                  <Tooltip title="Total number of samples needed across all test groups">
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Absolute MDE: {results.absoluteMde.toFixed(4)}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Relative MDE: {results.relativeMde.toFixed(2)}%
                </Typography>
              </Grid>

              {/* Formula Section */}
              <Grid item xs={12}>
                <Divider sx={{ mb: 3 }} />
                <Typography variant="subtitle1" gutterBottom sx={{ mb: 2 }}>
                  Power Analysis Calculation Details
                  <Tooltip title="The formula and components used in this calculation">
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Typography>

                {/* Formula Box */}
                <Box sx={{ 
                  bgcolor: 'grey.50',
                  p: 3,
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.8'
                }}>
                  {/* Main Formula */}
                  <Box sx={{ 
                    mb: 3, 
                    textAlign: 'center',
                    fontSize: '1.1rem',
                    fontWeight: 'bold'
                  }}>
                    n = 2σ² × (Zα + Zβ)² / δ²
                  </Box>

                  {/* Components */}
                  <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
                    Components:
                  </Typography>

                  <Box sx={{ pl: 2 }}>
                    <Typography sx={{ mb: 1, fontFamily: 'inherit' }}>
                      n  = {results.sampleSizePerGroup.toLocaleString()}
                      <Box component="span" sx={{ color: 'text.secondary' }}> (required sample size per group)</Box>
                    </Typography>

                    <Typography sx={{ mb: 1, fontFamily: 'inherit' }}>
                      σ  = {results.stdDev.toFixed(4)}
                      <Box component="span" sx={{ color: 'text.secondary' }}> (standard deviation of the metric)</Box>
                    </Typography>

                    <Typography sx={{ mb: 1, fontFamily: 'inherit' }}>
                      δ  = {results.absoluteMde.toFixed(4)}
                      <Box component="span" sx={{ color: 'text.secondary' }}> (minimum detectable effect)</Box>
                    </Typography>

                    <Typography sx={{ mb: 1, fontFamily: 'inherit' }}>
                      Zα = {testType === 'one-tailed' ? 
                           (-1 * inversePhi(parseFloat(alpha))).toFixed(4) :
                           (-1 * inversePhi(parseFloat(alpha) / 2)).toFixed(4)}
                      <Box component="span" sx={{ color: 'text.secondary' }}> (Z-score for {alpha} significance level{testType === 'two-tailed' ? ' (two-tailed)' : ''})</Box>
                    </Typography>

                    <Typography sx={{ mb: 3, fontFamily: 'inherit' }}>
                      Zβ = {(-1 * inversePhi(parseFloat(beta))).toFixed(4)}
                      <Box component="span" sx={{ color: 'text.secondary' }}> (Z-score for {(1 - parseFloat(beta)).toFixed(2)} power level)</Box>
                    </Typography>
                  </Box>

                  {/* Total Sample Size Calculation */}
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
                    Total Sample Size:
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Typography sx={{ fontFamily: 'inherit' }}>
                      Total = n × {numPaths === 'custom' ? customPaths : numPaths} (number of groups)
                    </Typography>
                    <Typography sx={{ 
                      fontFamily: 'inherit', 
                      fontWeight: 'bold',
                      mt: 1 
                    }}>
                      Total = {results.totalSampleSize.toLocaleString()} samples
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default PowerAnalysis; 