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
  Fade,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  Divider,
  ButtonGroup,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import CheckCircle from '@mui/icons-material/CheckCircle';

interface PowerAnalysisProps {
  csvData: any;
  onSampleSizeCalculated: (sampleSize: string, variance?: string) => void;
}

type TestType = 'one-tailed' | 'two-tailed';
type AlphaValue = '0.01' | '0.05' | '0.1';
type BetaValue = '0.05' | '0.1' | '0.2';

interface AllocationRatio {
  name: string;
  ratio: string;
}

interface ComparisonResult {
  group1: string;
  group2: string;
  vaf: number;
  totalSampleSize: number;
}

interface CalculationResults {
  baseSampleSize: number;
  mean: number;
  stdDev: number;
  absoluteMde: number;
  relativeMde: number;
  zAlpha: number;
  zBeta: number;
  correctedAlpha: number;
  numComparisons: number;
  comparisons: ComparisonResult[];
  warnings?: string[];
}

interface SortOrder {
  direction: 'asc' | 'desc' | null;
}

const PowerAnalysis: React.FC<PowerAnalysisProps> = ({ csvData, onSampleSizeCalculated }) => {
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
  const [allocationRatios, setAllocationRatios] = useState<AllocationRatio[]>([
    { name: 'Control', ratio: '50' },
    { name: 'Variant A', ratio: '50' }
  ]);
  
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

  const [sortOrder, setSortOrder] = useState<SortOrder>({ direction: null });

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

  const handleNumPathsChange = (value: string) => {
    setNumPaths(value);
    if (value !== 'custom') {
      setCustomPaths('');
      // Update allocation ratios based on number of paths
      const numGroups = parseInt(value);
      const baseRatio = Math.floor((100 / numGroups) * 100) / 100; // Round down to 2 decimals
      const newRatios: AllocationRatio[] = [];
      
      // First calculate the total with rounded down values
      const totalWithBase = baseRatio * numGroups;
      const remaining = +(100 - totalWithBase).toFixed(2);
      
      for (let i = 0; i < numGroups; i++) {
        let ratio: number;
        if (i === 1) { // Variant A always gets the remaining amount
          ratio = +(baseRatio + remaining).toFixed(2);
        } else {
          ratio = baseRatio;
        }
        
        newRatios.push({
          name: i === 0 ? 'Control' : `Variant ${String.fromCharCode(65 + i - 1)}`,
          ratio: ratio.toFixed(2)
        });
      }
      setAllocationRatios(newRatios);
    }
  };

  const handleCustomPathsChange = (value: string) => {
    setCustomPaths(value);
    const numGroups = parseInt(value) || 2;
    if (numGroups > 0) {
      const baseRatio = Math.floor((100 / numGroups) * 100) / 100; // Round down to 2 decimals
      const newRatios: AllocationRatio[] = [];
      
      // First calculate the total with rounded down values
      const totalWithBase = baseRatio * numGroups;
      const remaining = +(100 - totalWithBase).toFixed(2);
      
      for (let i = 0; i < numGroups; i++) {
        let ratio: number;
        if (i === 1) { // Variant A always gets the remaining amount
          ratio = +(baseRatio + remaining).toFixed(2);
        } else {
          ratio = baseRatio;
        }
        
        newRatios.push({
          name: i === 0 ? 'Control' : `Variant ${String.fromCharCode(65 + Math.min(i - 1, 25))}${i > 26 ? (i-25) : ''}`,
          ratio: ratio.toFixed(2)
        });
      }
      setAllocationRatios(newRatios);
    }
  };

  const handleAllocationRatioChange = (index: number, value: string) => {
    const newRatios = [...allocationRatios];
    // Store with 2 decimal places
    newRatios[index].ratio = parseFloat(value).toFixed(2);
    setAllocationRatios(newRatios);
  };

  const getAllocationTotal = () => {
    return allocationRatios.reduce((acc, curr) => acc + parseFloat(curr.ratio || '0'), 0);
  };

  const calculateSampleSize = () => {
    try {
      setError('');
      const warnings: string[] = [];
      const effectiveMde = getEffectiveMde();
      if (!selectedMetric || !alpha || !beta || !effectiveMde) {
        throw new Error('Please fill in all required fields');
      }

      if (Math.abs(getAllocationTotal() - 100) >= 0.01) {
        throw new Error('Allocation ratios must sum to 100%');
      }

      const stats = csvData?.statistics?.[selectedMetric];
      if (!stats) {
        throw new Error('No statistics available for selected metric');
      }

      const mean = stats.mean;
      const stdDev = stats.standardDeviation;
      
      if (typeof mean !== 'number' || typeof stdDev !== 'number') {
        throw new Error('Selected metric must be numeric');
      }

      // Calculate Z-scores first
      const alphaValue = parseFloat(alpha);
      const betaValue = parseFloat(beta);

      // Get number of paths and calculate Bonferroni-corrected alpha
      const effectiveNumPaths = numPaths === 'custom' ? parseInt(customPaths) || 2 : parseInt(numPaths);
      const numComparisons = (effectiveNumPaths * (effectiveNumPaths - 1)) / 2;
      const correctedAlpha = alphaValue / numComparisons;

      if (numComparisons > 10) {
        warnings.push(`Note: With ${effectiveNumPaths} paths, there are ${numComparisons} pairwise comparisons. ` +
          `The Bonferroni-corrected significance level (${(correctedAlpha * 100).toFixed(4)}%) ` +
          `is very conservative and may require a larger sample size than necessary.`);
      }

      const zAlpha = testType === 'one-tailed' 
        ? inversePhi(1 - correctedAlpha)
        : inversePhi(1 - correctedAlpha / 2);
      
      const zBeta = inversePhi(1 - betaValue);

      const variance = stdDev * stdDev;
      
      let absoluteMde = parseFloat(effectiveMde);
      if (mdeType === 'percentage') {
        absoluteMde = (parseFloat(effectiveMde) / 100) * mean;
      }

      // Calculate base sample size (n_0)
      const baseSampleSize = Math.ceil(
        2 * Math.pow(zAlpha + zBeta, 2) * variance / Math.pow(absoluteMde, 2)
      );

      // Calculate VAF and adjusted sample sizes for all group comparisons
      const comparisons: ComparisonResult[] = [];
      for (let i = 0; i < allocationRatios.length; i++) {
        for (let j = i + 1; j < allocationRatios.length; j++) {
          const ratio1 = parseFloat(allocationRatios[i].ratio) / 100;
          const ratio2 = parseFloat(allocationRatios[j].ratio) / 100;
          
          // Calculate VAF for this comparison
          const vaf = 1/ratio1 + 1/ratio2;
          
          // Calculate total sample size for this comparison
          const totalSampleSize = Math.ceil(vaf * baseSampleSize);
          
          comparisons.push({
            group1: allocationRatios[i].name,
            group2: allocationRatios[j].name,
            vaf: vaf,
            totalSampleSize: totalSampleSize
          });
        }
      }

      // Calculate relative MDE as percentage of mean
      const relativeMde = (absoluteMde / mean) * 100;

      const results: CalculationResults = {
        baseSampleSize,
        mean,
        stdDev,
        absoluteMde,
        relativeMde,
        zAlpha,
        zBeta,
        correctedAlpha,
        numComparisons,
        comparisons,
        warnings
      };

      // Get the maximum total sample size from all comparisons
      const maxTotalSampleSize = Math.max(...results.comparisons.map(comp => comp.totalSampleSize));

      setResults(results);
      onSampleSizeCalculated(maxTotalSampleSize.toString(), variance.toString());
    } catch (err: any) {
      setError(err.message);
      console.error(err);
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
                Mean: {csvData?.statistics?.[selectedMetric]?.mean?.toFixed(4)}
                <Tooltip title="The average value of your metric">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Typography>
              <Typography variant="body2">
                Standard Deviation: {csvData?.statistics?.[selectedMetric]?.standardDeviation?.toFixed(4)}
                <Tooltip title="A measure of variability in your metric">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Typography>
              <Typography variant="body2">
                Variance: {(csvData?.statistics?.[selectedMetric]?.standardDeviation ** 2)?.toFixed(4)}
                <Tooltip title="The square of standard deviation, another measure of variability">
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
                onChange={(e) => handleNumPathsChange(e.target.value)}
                label="Number of Paths"
              >
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
                onChange={(e) => handleCustomPathsChange(e.target.value)}
                type="number"
                inputProps={{ min: 2 }}
                sx={{ mt: 2 }}
                helperText="Enter the number of paths (minimum 2)"
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

      {/* Allocation Ratios */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Allocation Ratios
          <Tooltip title="Specify the percentage of total traffic allocated to each variant. Must sum to 100%.">
            <IconButton size="small">
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Typography>

        {/* Quick Actions */}
        <Box sx={{ mb: 2 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              const numGroups = allocationRatios.length;
              const equalRatio = (100 / numGroups).toFixed(2);
              setAllocationRatios(allocationRatios.map(ratio => ({
                ...ratio,
                ratio: equalRatio
              })));
            }}
            sx={{ mr: 1 }}
          >
            Equal Split
          </Button>
        </Box>
        
        {/* Scrollable container for many variants */}
        <Box sx={{ 
          maxHeight: '400px', 
          overflowY: 'auto',
          pr: 2,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#555',
          },
        }}>
          <Grid container spacing={3}>
            {allocationRatios.map((ratio, index) => (
              <Grid item xs={12} sm={6} md={4} key={ratio.name}>
                <Box sx={{ mt: 2, mb: 1 }}>
                  <TextField
                    fullWidth
                    label={ratio.name}
                    value={ratio.ratio}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        if (value.includes('.') && value.split('.')[1].length > 2) {
                          return;
                        }
                        handleAllocationRatioChange(index, value);
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value || '0');
                      handleAllocationRatioChange(index, value.toFixed(2));
                    }}
                    type="text"
                    inputProps={{ 
                      inputMode: 'decimal',
                      pattern: '[0-9]*[.]?[0-9]*'
                    }}
                    sx={{
                      '& .MuiInputLabel-root': {
                        background: '#fff',
                        padding: '0 4px',
                        top: '-8px',
                      },
                      '& .MuiInputLabel-shrink': {
                        transform: 'translate(14px, -6px) scale(0.75)',
                        backgroundColor: '#fff',
                        padding: '0 8px',
                      },
                      '& .MuiOutlinedInput-root': {
                        marginTop: '12px',
                        '& fieldset': {
                          top: 0,
                        },
                        '& input': {
                          textAlign: 'left',
                          paddingLeft: '14px',
                          height: '1.4375em',
                        }
                      }
                    }}
                    error={parseFloat(ratio.ratio) < 0 || parseFloat(ratio.ratio) > 100}
                    helperText={`${ratio.name} allocation (%)`}
                    variant="outlined"
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Running Total with better feedback */}
        <Box sx={{ 
          mt: 2, 
          p: 2,
          bgcolor: 'background.default',
          borderRadius: 1,
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2
        }}>
          <Typography 
            variant="body1" 
            sx={{ 
              color: Math.abs(getAllocationTotal() - 100) < 0.000001 ? '#2e7d32' : '#d32f2f',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            Total: {getAllocationTotal().toFixed(2)}%
            {Math.abs(getAllocationTotal() - 100) < 0.000001 && (
              <CheckCircle sx={{ color: '#2e7d32', fontSize: 20 }} />
            )}
          </Typography>
          {Math.abs(getAllocationTotal() - 100) >= 0.000001 && (
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#d32f2f',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              Must sum to 100%
            </Typography>
          )}
        </Box>
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

            {/* VAF and Sample Size Comparison Table */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Group Comparisons and Required Sample Sizes
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Base sample size (n₀): {results.baseSampleSize.toLocaleString()}
                </Typography>
                <ButtonGroup size="small">
                  <Button
                    startIcon={<ArrowUpward />}
                    onClick={() => setSortOrder({ direction: 'asc' })}
                    variant={sortOrder.direction === 'asc' ? 'contained' : 'outlined'}
                  >
                    Sort Ascending
                  </Button>
                  <Button
                    startIcon={<ArrowDownward />}
                    onClick={() => setSortOrder({ direction: 'desc' })}
                    variant={sortOrder.direction === 'desc' ? 'contained' : 'outlined'}
                  >
                    Sort Descending
                  </Button>
                </ButtonGroup>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Group Comparison</TableCell>
                      <TableCell align="right">
                        VAF
                        <Tooltip title="Variance Adjustment Factor (VAF) = 1/r₁ + 1/r₂, where r₁ and r₂ are the allocation ratios">
                          <IconButton size="small">
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        Required Total Sample Size
                        <Tooltip title="Total sample size = VAF × Base sample size">
                          <IconButton size="small">
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...results.comparisons]
                      .sort((a, b) => {
                        if (sortOrder.direction === 'asc') {
                          return a.totalSampleSize - b.totalSampleSize;
                        } else if (sortOrder.direction === 'desc') {
                          return b.totalSampleSize - a.totalSampleSize;
                        }
                        return 0;
                      })
                      .map((comparison, index) => (
                        <TableRow 
                          key={index}
                          sx={{
                            backgroundColor: index === 0 && sortOrder.direction === 'desc' ? 'rgba(0, 0, 0, 0.04)' : 'inherit'
                          }}
                        >
                          <TableCell>{comparison.group1} vs {comparison.group2}</TableCell>
                          <TableCell align="right">{comparison.vaf.toFixed(4)}</TableCell>
                          <TableCell align="right">{comparison.totalSampleSize.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Note: {sortOrder.direction === 'desc' ? 'The highlighted row shows' : 'The largest total sample size represents'} the minimum sample size needed to achieve 
                the desired statistical power for all group comparisons.
              </Typography>
            </Box>

            {/* Main Results */}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  Absolute MDE: {results.absoluteMde.toFixed(4)}
                  <Tooltip title="The MDE must have the same unit as your metric's standard deviation for the sample size calculation">
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body1" sx={{ mb: 1 }}>
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
                      n₀ =
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
                      n₀ = {results.baseSampleSize.toLocaleString()}
                      <Box component="span" sx={{ color: 'text.secondary' }}> (base sample size)</Box>
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

                  {/* Sample Size Requirements */}
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
                    Sample Size Requirements:
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Typography sx={{ fontFamily: 'inherit' }}>
                      Base sample size (n₀) = {results.baseSampleSize.toLocaleString()}
                    </Typography>
                    <Typography sx={{ fontFamily: 'inherit', mt: 1 }}>
                      For each comparison between groups:
                    </Typography>
                    <Typography sx={{ fontFamily: 'inherit', ml: 2 }}>
                      VAF<sub>ij</sub> = 1/r<sub>i</sub> + 1/r<sub>j</sub>
                    </Typography>
                    <Typography sx={{ fontFamily: 'inherit', ml: 2 }}>
                      n<sub>total</sub> = VAF<sub>ij</sub> × n₀
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      where i and j represent the groups being compared
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