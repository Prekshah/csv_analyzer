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

interface PowerAnalysisProps {
  csvData: any;
}

type TestType = 'one-tailed' | 'two-tailed';
type AlphaValue = '0.01' | '0.05' | '0.1';
type BetaValue = '0.05' | '0.1' | '0.2';

interface CalculationResults {
  sampleSizePerGroup: number;
  totalSampleSize: number;
  mean: number;
  stdDev: number;
  absoluteMde: number;
  relativeMde: number;
  zAlpha: number;
  zBeta: number;
  correctedAlpha: number;
  numComparisons: number;
  warnings?: string[];
}

const PowerAnalysis: React.FC<PowerAnalysisProps> = ({ csvData }) => {
  // Z-score lookup tables - temporarily commented out
  /*
  const zAlphaTable = {
    'one-tailed': {
      '0.1': 1.28,
      '0.05': 1.64,
      '0.01': 2.33
    },
    'two-tailed': {
      '0.1': 1.64,
      '0.05': 1.96,
      '0.01': 2.58
    }
  } as const;

  const zBetaTable = {
    '0.2': 0.84,   // 80% power
    '0.1': 1.28,   // 90% power
    '0.05': 1.645  // 95% power
  } as const;
  */

  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [alpha, setAlpha] = useState<AlphaValue>('0.05');
  const [beta, setBeta] = useState<BetaValue>('0.2');
  const [mde, setMde] = useState<string>('5');
  const [customMde, setCustomMde] = useState<string>('');
  const [mdeType, setMdeType] = useState<'absolute' | 'percentage'>('percentage');
  const [testType, setTestType] = useState<TestType>('two-tailed');
  const [numPaths, setNumPaths] = useState<string>('2');
  const [customPaths, setCustomPaths] = useState<string>('');
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [error, setError] = useState<string>('');
  
  const resultsRef = useRef<HTMLDivElement>(null);

  // Common values for dropdowns
  const alphaOptions = [
    { value: '0.01', label: '1% (α = 0.01)' },
    { value: '0.05', label: '5% (α = 0.05)' },
    { value: '0.1', label: '10% (α = 0.1)' }
  ];

  const betaOptions = [
    { value: '0.2', label: '80% Power (β = 0.2)' },
    { value: '0.1', label: '90% Power (β = 0.1)' },
    { value: '0.05', label: '95% Power (β = 0.05)' }
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

  // Helper function to calculate inverse of standard normal CDF (Z-score)
  const inversePhi = (p: number): number => {
    if (p <= 0 || p >= 1) {
      throw new Error('Probability must be between 0 and 1');
    }

    // Rational approximation for inverse normal CDF
    // Reference: Wichura, M.J. (1988)
    if (p < 0.5) {
      // F^-1(p) = - G^-1(p)
      return -rationalApproximation(Math.sqrt(-2.0 * Math.log(p)));
    } else {
      // F^-1(p) = G^-1(1-p)
      return rationalApproximation(Math.sqrt(-2.0 * Math.log(1 - p)));
    }
  };

  // Helper function for rational approximation
  const rationalApproximation = (t: number): number => {
    // Coefficients from Wichura's algorithm
    const c = [2.515517, 0.802853, 0.010328];
    const d = [1.432788, 0.189269, 0.001308];
    
    return t - ((c[2]*t + c[1])*t + c[0]) / 
             (((d[2]*t + d[1])*t + d[0])*t + 1.0);
  };

  const calculateSampleSize = () => {
    try {
      setError('');
      const warnings: string[] = [];
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
        absoluteMde = (parseFloat(effectiveMde) / 100) * mean;
      }

      // Calculate Z-scores
      const alphaValue = parseFloat(alpha);
      const betaValue = parseFloat(beta);
      
      // Get number of paths and calculate Bonferroni-corrected alpha
      const effectiveNumPaths = numPaths === 'custom' ? parseInt(customPaths) || 2 : parseInt(numPaths);
      // For k groups, we have k(k-1)/2 pairwise comparisons
      const numComparisons = (effectiveNumPaths * (effectiveNumPaths - 1)) / 2;
      const correctedAlpha = alphaValue / numComparisons;

      // Add warning for large number of paths
      if (numComparisons > 10) {
        warnings.push(`Note: With ${effectiveNumPaths} paths, there are ${numComparisons} pairwise comparisons. ` +
          `The Bonferroni-corrected significance level (${(correctedAlpha * 100).toFixed(4)}%) ` +
          `is very conservative and may require a larger sample size than necessary.`);
      }
      
      // Calculate Z-alpha based on test type and corrected alpha
      const zAlpha = testType === 'one-tailed' 
        ? inversePhi(1 - correctedAlpha)
        : inversePhi(1 - correctedAlpha / 2);
      
      // Calculate Z-beta (power)
      const zBeta = inversePhi(1 - betaValue);

      // Calculate sample size per group
      const variance = stdDev * stdDev;
      let sampleSizePerGroup = Math.ceil(
        2 * Math.pow(zAlpha + zBeta, 2) * variance / Math.pow(absoluteMde, 2)
      );

      // Calculate total sample size
      const totalSampleSize = sampleSizePerGroup * effectiveNumPaths;

      // Calculate relative MDE as percentage of mean
      const relativeMde = (absoluteMde / mean) * 100;

      setResults({
        sampleSizePerGroup,
        totalSampleSize,
        mean,
        stdDev,
        absoluteMde,
        relativeMde,
        zAlpha,
        zBeta,
        correctedAlpha,
        numComparisons,
        warnings
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReset = () => {
    setSelectedMetric('');
    setAlpha('0.05');
    setBeta('0.2');
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
                {csvData?.columns?.map((column: string) => (
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
                onChange={(e) => setAlpha(e.target.value as AlphaValue)}
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
              <InputLabel>Statistical Power (1-β)</InputLabel>
              <Select
                value={beta}
                onChange={(e) => setBeta(e.target.value as BetaValue)}
                label="Statistical Power (1-β)"
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
            {results.warnings && results.warnings.length > 0 && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                {results.warnings.map((warning: string, index: number) => (
                  <div key={index}>{warning}</div>
                ))}
              </Alert>
            )}
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
                  <Tooltip title="The MDE must have the same unit as your metric's standard deviation for the sample size calculation">
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
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
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1
                  }}>
                    <Box component="span" sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                      pb: '0.5rem'
                    }}>
                      n =
                    </Box>
                    <Box sx={{ 
                      display: 'inline-flex', 
                      flexDirection: 'column', 
                      alignItems: 'center'
                    }}>
                      <Box className="numerator" sx={{
                        whiteSpace: 'nowrap',
                        minWidth: '240px',
                        textAlign: 'center'
                      }}>
                        2σ² × (Z<sub>{testType === 'one-tailed' ? '1-α' : '1-α/2'}</sub> + Z<sub>1-β</sub>)²
                      </Box>
                      <Box className="fraction-line" sx={{ 
                        width: '100%',
                        height: '2px',
                        backgroundColor: 'text.primary',
                        my: 0.5
                      }} />
                      <Box className="denominator" sx={{
                        whiteSpace: 'nowrap',
                        minWidth: '240px',
                        textAlign: 'center'
                      }}>
                        δ²
                      </Box>
                    </Box>
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
                      <Box component="span" sx={{ color: 'text.secondary' }}> (standard deviation in 
                        <Box component="span" sx={{ fontWeight: 600, color: 'text.primary', opacity: 0.9 }}> {selectedMetric} units</Box>)
                      </Box>
                    </Typography>

                    <Typography sx={{ mb: 1, fontFamily: 'inherit' }}>
                      δ  = {results.absoluteMde.toFixed(4)}
                      <Box component="span" sx={{ color: 'text.secondary' }}> (minimum detectable effect in 
                        <Box component="span" sx={{ fontWeight: 600, color: 'text.primary', opacity: 0.9 }}> {selectedMetric} units</Box>)
                      </Box>
                    </Typography>

                    <Typography sx={{ mb: 1, fontFamily: 'inherit' }}>
                      Z<sub>{testType === 'one-tailed' ? '1-α' : '1-α/2'}</sub> = {results.zAlpha.toFixed(4)}
                      <Box component="span" sx={{ color: 'text.secondary' }}> 
                        (Z-score for {(results.correctedAlpha * 100).toFixed(3)}% significance level
                        {testType === 'two-tailed' ? ' (two-tailed)' : ''}, 
                        Bonferroni-corrected for {results.numComparisons} comparisons)
                      </Box>
                    </Typography>

                    <Typography sx={{ mb: 3, fontFamily: 'inherit' }}>
                      Z<sub>1-β</sub> = {results.zBeta.toFixed(4)}
                      <Box component="span" sx={{ color: 'text.secondary' }}> (Z-score for {((1 - parseFloat(beta)) * 100).toFixed(0)}% power level)</Box>
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