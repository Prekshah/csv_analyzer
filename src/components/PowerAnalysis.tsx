import React, { useState, useRef, useEffect } from 'react';
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
import CheckCircle from '@mui/icons-material/CheckCircle';
import CollaborativeTextField from './CollaborativeTextField';

interface PowerAnalysisProps {
  campaignId?: string;
  csvData: any;
  onSampleSizeCalculated: (sampleSize: string, variance?: string) => void;
  onValuesChanged: (values: {
    mde: string;
    mdeType: 'absolute' | 'percentage';
    power: string;
    significanceLevel: string;
    selectedMetric: string;
    variance: string;
  }) => void;
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
  group1SampleSize: number;
  group2SampleSize: number;
}

interface VAFResults {
  pairwiseComparisons: ComparisonResult[];
  maxVAF: number;
  maxVAFPair: string;
  totalSampleSize: number;
  groupSampleSizes: Map<string, number>;
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
  vafResults: VAFResults;
}

const VAF_EQUAL = 4; // constant for 50-50 split (1/0.5 + 1/0.5)

const calculateVAF = (ratio1: number, ratio2: number): number => {
  return (1 / ratio1) + (1 / ratio2);
};

const calculateGroupSampleSizes = (totalSize: number, ratios: AllocationRatio[]): Map<string, number> => {
  const groupSizes = new Map<string, number>();
  let remainingSize = totalSize;
  let allocatedSize = 0;

  // First pass: Calculate raw sizes and floor them
  for (let i = 0; i < ratios.length - 1; i++) {
    const ratio = parseFloat(ratios[i].ratio) / 100;
    const size = Math.floor(totalSize * ratio);
    groupSizes.set(ratios[i].name, size);
    allocatedSize += size;
  }

  // Last group gets the remaining samples to ensure total adds up exactly
  groupSizes.set(ratios[ratios.length - 1].name, totalSize - allocatedSize);

  return groupSizes;
};

const PowerAnalysis: React.FC<PowerAnalysisProps> = ({ 
  campaignId, 
  csvData, 
  onSampleSizeCalculated,
  onValuesChanged 
}) => {
  // Default values
  const defaultValues = {
    selectedMetric: '',
    alpha: '0.05' as AlphaValue,
    beta: '0.2' as BetaValue,
    mde: '5',
    customMde: '',
    mdeType: 'percentage' as 'absolute' | 'percentage',
    testType: 'two-tailed' as TestType,
    numPaths: '2',
    customPaths: '',
    allocationRatios: [
      { name: 'Control', ratio: '50' },
      { name: 'Variant A', ratio: '50' }
    ]
  };

  // Get initial state from session storage or use defaults
  const getInitialState = () => {
    if (campaignId) {
      const sessionState = sessionStorage.getItem(`powerAnalysisState_${campaignId}`);
      if (sessionState) {
        return JSON.parse(sessionState);
      }
    }
    return defaultValues;
  };

  // Initialize with session storage values or defaults
  const [selectedMetric, setSelectedMetric] = useState<string>(getInitialState().selectedMetric);
  const [alpha, setAlpha] = useState<AlphaValue>(getInitialState().alpha);
  const [beta, setBeta] = useState<BetaValue>(getInitialState().beta);
  const [mde, setMde] = useState<string>(getInitialState().mde);
  const [customMde, setCustomMde] = useState<string>(getInitialState().customMde);
  const [mdeType, setMdeType] = useState<'absolute' | 'percentage'>(getInitialState().mdeType);
  const [testType, setTestType] = useState<TestType>(getInitialState().testType);
  const [numPaths, setNumPaths] = useState<string>(getInitialState().numPaths);
  const [customPaths, setCustomPaths] = useState<string>(getInitialState().customPaths);
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [error, setError] = useState<string>('');
  const [allocationRatios, setAllocationRatios] = useState<AllocationRatio[]>(getInitialState().allocationRatios);
  
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

  // Save state to sessionStorage whenever values change
  useEffect(() => {
    if (campaignId) {
      const stateToSave = {
        selectedMetric,
        alpha,
        beta,
        mde,
        customMde,
        mdeType,
        testType,
        numPaths,
        customPaths,
        allocationRatios
      };
      sessionStorage.setItem(`powerAnalysisState_${campaignId}`, JSON.stringify(stateToSave));
    }

    // Notify parent component of value changes for HypothesisTestingProposal sync
    onValuesChanged({
      mde: mde === 'custom' ? customMde : mde,
      mdeType,
      power: (1 - parseFloat(beta)).toString(),
      significanceLevel: alpha,
      selectedMetric,
      variance: (csvData?.statistics?.[selectedMetric]?.standardDeviation ** 2)?.toString() || ''
    });
  }, [selectedMetric, alpha, beta, mde, customMde, mdeType, testType, numPaths, customPaths, 
      allocationRatios, onValuesChanged, csvData?.statistics, campaignId]);

  // Clear session storage on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (campaignId) {
        sessionStorage.removeItem(`powerAnalysisState_${campaignId}`);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [campaignId]);

  // Reset state when campaignId changes
  useEffect(() => {
    setSelectedMetric(getInitialState().selectedMetric);
    setAlpha(getInitialState().alpha);
    setBeta(getInitialState().beta);
    setMde(getInitialState().mde);
    setCustomMde(getInitialState().customMde);
    setMdeType(getInitialState().mdeType);
    setTestType(getInitialState().testType);
    setNumPaths(getInitialState().numPaths);
    setCustomPaths(getInitialState().customPaths);
    setAllocationRatios(getInitialState().allocationRatios);
    setResults(null);
    setError('');
    // TODO: Unsubscribe from previous Firestore listeners and subscribe to new campaign if needed
    // Return cleanup function to unsubscribe
    return () => {
      // Unsubscribe logic here
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const handleMetricSelect = (value: string) => {
    setSelectedMetric(value);
    const variance = csvData?.statistics?.[value]?.standardDeviation ** 2;
    onValuesChanged({
      mde: mde === 'custom' ? customMde : mde,
      mdeType,
      power: (1 - parseFloat(beta)).toString(),
      significanceLevel: alpha,
      selectedMetric: value,
      variance: variance?.toString() || ''
    });
  };

  const handleMdeChange = (value: string) => {
    setMde(value);
    if (value !== 'custom') {
      setCustomMde('');
      onValuesChanged({
        mde: value,
        mdeType,
        power: (1 - parseFloat(beta)).toString(),
        significanceLevel: alpha,
        selectedMetric,
        variance: (csvData?.statistics?.[selectedMetric]?.standardDeviation ** 2)?.toString() || ''
      });
    } else {
      setCustomMde(mde !== 'custom' ? mde : '');
    }
  };

  const handleCustomMdeChange = (value: string) => {
    setCustomMde(value);
    onValuesChanged({
      mde: value,
      mdeType,
      power: (1 - parseFloat(beta)).toString(),
      significanceLevel: alpha,
      selectedMetric,
      variance: (csvData?.statistics?.[selectedMetric]?.standardDeviation ** 2)?.toString() || ''
    });
  };

  const handleAlphaChange = (value: AlphaValue) => {
    setAlpha(value);
    onValuesChanged({
      mde: mde === 'custom' ? customMde : mde,
      mdeType,
      power: (1 - parseFloat(beta)).toString(),
      significanceLevel: value,
      selectedMetric,
      variance: (csvData?.statistics?.[selectedMetric]?.standardDeviation ** 2)?.toString() || ''
    });
  };

  const handleBetaChange = (value: BetaValue) => {
    setBeta(value);
    onValuesChanged({
      mde: mde === 'custom' ? customMde : mde,
      mdeType,
      power: (1 - parseFloat(value)).toString(),
      significanceLevel: alpha,
      selectedMetric,
      variance: (csvData?.statistics?.[selectedMetric]?.standardDeviation ** 2)?.toString() || ''
    });
  };

  const handleMdeTypeChange = (value: 'absolute' | 'percentage') => {
    setMdeType(value);
    onValuesChanged({
      mde: mde === 'custom' ? customMde : mde,
      mdeType: value,
      power: (1 - parseFloat(beta)).toString(),
      significanceLevel: alpha,
      selectedMetric,
      variance: (csvData?.statistics?.[selectedMetric]?.standardDeviation ** 2)?.toString() || ''
    });
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
      
      // Validation checks
      if (!selectedMetric || !alpha || !beta || !effectiveMde) {
        throw new Error('Please fill in all required fields');
      }

      // Check if allocation ratios sum to approximately 100%
      const totalAllocation = getAllocationTotal();
      if (Math.abs(totalAllocation - 100) > 0.01) {
        throw new Error('Allocation ratios must sum to 100% (±0.01%)');
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

      // Calculate base sample size with Bonferroni correction
      const baseSampleSize = Math.ceil(
        2 * Math.pow(zAlpha + zBeta, 2) * variance / Math.pow(absoluteMde, 2)
      );

      // Calculate VAF for all pairs and find maximum
      const vafResults: VAFResults = {
        pairwiseComparisons: [],
        maxVAF: 0,
        maxVAFPair: '',
        totalSampleSize: 0,
        groupSampleSizes: new Map()
      };

      // Calculate VAF for each pair
      for (let i = 0; i < allocationRatios.length; i++) {
        for (let j = i + 1; j < allocationRatios.length; j++) {
          const ratio1 = parseFloat(allocationRatios[i].ratio) / 100;
          const ratio2 = parseFloat(allocationRatios[j].ratio) / 100;
          
          const vaf = calculateVAF(ratio1, ratio2);
          
          const comparison: ComparisonResult = {
            group1: allocationRatios[i].name,
            group2: allocationRatios[j].name,
            vaf: vaf,
            group1SampleSize: 0, // Will be set after total sample size calculation
            group2SampleSize: 0
          };
          
          vafResults.pairwiseComparisons.push(comparison);
          
          if (vaf > vafResults.maxVAF) {
            vafResults.maxVAF = vaf;
            vafResults.maxVAFPair = `${allocationRatios[i].name} vs ${allocationRatios[j].name}`;
          }
        }
      }

      // Calculate total sample size using max VAF
      vafResults.totalSampleSize = Math.ceil(baseSampleSize * (vafResults.maxVAF / VAF_EQUAL));

      // Calculate individual group sample sizes
      vafResults.groupSampleSizes = calculateGroupSampleSizes(vafResults.totalSampleSize, allocationRatios);

      // Update comparison results with group sample sizes
      vafResults.pairwiseComparisons = vafResults.pairwiseComparisons.map(comp => ({
        ...comp,
        group1SampleSize: vafResults.groupSampleSizes.get(comp.group1) || 0,
        group2SampleSize: vafResults.groupSampleSizes.get(comp.group2) || 0
      }));

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
        comparisons: vafResults.pairwiseComparisons,
        warnings,
        vafResults,
      };

      setResults(results);
      // Format variance to 4 decimal points before passing it up
      onSampleSizeCalculated(vafResults.totalSampleSize.toString(), variance.toFixed(4));
    } catch (err: any) {
      setError(err.message);
      console.error(err);
      onSampleSizeCalculated('', '');
    }
  };

  const handleReset = () => {
    // Reset to default values
    setSelectedMetric(defaultValues.selectedMetric);
    setAlpha(defaultValues.alpha);
    setBeta(defaultValues.beta);
    setMde(defaultValues.mde);
    setCustomMde(defaultValues.customMde);
    setMdeType(defaultValues.mdeType);
    setTestType(defaultValues.testType);
    setNumPaths(defaultValues.numPaths);
    setCustomPaths(defaultValues.customPaths);
    setResults(null);
    setError('');
    setAllocationRatios(defaultValues.allocationRatios);
    
    // Clear session storage
    if (campaignId) {
      sessionStorage.removeItem(`powerAnalysisState_${campaignId}`);
    }
    
    // Clear the calculated values
    onSampleSizeCalculated('', '');
    
    // Notify parent of reset values
    onValuesChanged({
      mde: defaultValues.mde,
      mdeType: defaultValues.mdeType,
      power: (1 - parseFloat(defaultValues.beta)).toString(),
      significanceLevel: defaultValues.alpha,
      selectedMetric: defaultValues.selectedMetric,
      variance: ''
    });
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

  const handleEqualSplit = () => {
    const numGroups = allocationRatios.length;
    const equalRatio = (100 / numGroups).toFixed(2);
    const lastGroupRatio = (100 - (parseFloat(equalRatio) * (numGroups - 1))).toFixed(2);
    
    setAllocationRatios(allocationRatios.map((ratio, index) => ({
      ...ratio,
      ratio: index === numGroups - 1 ? lastGroupRatio : equalRatio
    })));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Power Analysis Calculator</Typography>
        <Button
          startIcon={<RestartAltIcon />}
          onClick={handleReset}
          color="secondary"
          variant="outlined"
          size="small"
        >
          Reset
        </Button>
      </Box>
      
      {/* Metric Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>
                Primary Metric
                <Tooltip title="This is the main measurement you want to analyze in your experiment - like conversion rate, revenue per user, or time spent on page.">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputLabel>
              <Select
                value={selectedMetric}
                onChange={(e) => handleMetricSelect(e.target.value)}
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
                <Tooltip title="The average value in your data. This helps us understand what's 'normal' for your metric.">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Typography>
              <Typography variant="body2">
                Standard Deviation: {csvData?.statistics?.[selectedMetric]?.standardDeviation?.toFixed(4)}
                <Tooltip title="Shows how much your data varies from the average. Higher numbers mean more variation in your metric values.">
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
              <InputLabel>
                Alpha (Significance Level)
                <Tooltip title="Alpha is your tolerance for false positives - the chance you'll think there's a difference when there really isn't. 5% means you're willing to be wrong 1 out of 20 times.">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputLabel>
              <Select
                value={alpha}
                onChange={(e) => handleAlphaChange(e.target.value as AlphaValue)}
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
              <InputLabel>
                Statistical Power (1-β)
                <Tooltip title="Power is your ability to detect a real difference when it exists. 80% power means if there really is a difference, you'll catch it 8 out of 10 times.">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputLabel>
              <Select
                value={beta}
                onChange={(e) => handleBetaChange(e.target.value as BetaValue)}
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
              <InputLabel>
                Minimum Detectable Effect (MDE)
                <Tooltip title="The smallest change you want to be able to detect. For example, if you want to catch a 5% improvement in conversion rate, set MDE to 5%. Smaller effects need more data to detect.">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputLabel>
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
              <CollaborativeTextField
                fullWidth
                fieldName={`customMde_${campaignId}`}
                label="Custom MDE Value"
                value={customMde}
                onChange={handleCustomMdeChange}
                type="number"
                inputProps={{ step: 'any' }}
                sx={{ mt: 2 }}
                helperText={`Enter custom value ${mdeType === 'percentage' ? '(in %)' : ''}`}
              />
            )}
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>
                Number of Paths
                <Tooltip title="How many versions you're testing. A/B = 2 paths (control vs variant), A/B/C = 3 paths, etc. More paths means you need more traffic to get reliable results.">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputLabel>
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
              <CollaborativeTextField
                fullWidth
                fieldName={`customPaths_${campaignId}`}
                label="Custom Number of Paths"
                value={customPaths}
                onChange={handleCustomPathsChange}
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
              <FormLabel>
                MDE Type
                <Tooltip title="Percentage: your effect as a % change (like '5% improvement'). Absolute: your effect in the same units as your metric (like '+10 conversions').">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </FormLabel>
              <RadioGroup
                row
                value={mdeType}
                onChange={(e) => handleMdeTypeChange(e.target.value as 'absolute' | 'percentage')}
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
              <FormLabel>
                Test Type
                <Tooltip title="Two-tailed: you want to detect changes in either direction (increase OR decrease). One-tailed: you only care about changes in one direction (like only increases).">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </FormLabel>
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
          <Tooltip title="How you split your traffic between different versions. For example, 50-50 means half your users see each version. Must add up to 100%.">
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
            onClick={handleEqualSplit}
            startIcon={<RefreshIcon />}
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
                  <CollaborativeTextField
                    fullWidth
                    fieldName={`allocationRatio_${ratio.name}_${campaignId}`}
                    label={ratio.name}
                    value={ratio.ratio}
                    onChange={(value) => handleAllocationRatioChange(index, value)}
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
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 2 
            }}>
              <Typography variant="h6">Results</Typography>
              <Box sx={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: 1,
                p: 1,
                display: 'flex',
                gap: 1
              }}>
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={calculateSampleSize}
                  color="primary"
                  size="small"
                  variant="contained"
                >
                  Recalculate
                </Button>
                <Button
                  startIcon={<RestartAltIcon />}
                  onClick={handleReset}
                  color="secondary"
                  size="small"
                  variant="outlined"
                >
                  Reset
                </Button>
              </Box>
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
              </Box>

              <TableContainer>
                <Table size="small" sx={{ width: 'auto', minWidth: '400px', maxWidth: '600px' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '60%' }}>Group Comparison</TableCell>
                      <TableCell align="right" sx={{ width: '40%' }}>
                        VAF
                        <Tooltip title="Variance Adjustment Factor - a number that adjusts sample size based on how you split traffic. Unequal splits (like 70-30) need more users than equal splits (50-50) to get reliable results.">
                          <IconButton size="small">
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.vafResults.pairwiseComparisons.map((comparison, index) => (
                      <TableRow 
                        key={index}
                        sx={{
                          backgroundColor: comparison.vaf === results.vafResults.maxVAF ? 'rgba(0, 0, 0, 0.04)' : 'inherit'
                        }}
                      >
                        <TableCell sx={{ width: '60%' }}>{comparison.group1} vs {comparison.group2}</TableCell>
                        <TableCell align="right" sx={{ width: '40%' }}>{comparison.vaf.toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="h6" gutterBottom>
                  Final Sample Size Results
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  Maximum VAF: {results.vafResults.maxVAF.toFixed(4)} ({results.vafResults.maxVAFPair})
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  Total Required Sample Size: {results.vafResults.totalSampleSize.toLocaleString()}
                </Typography>
                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                  Sample Size per Group:
                </Typography>
                <Box sx={{ pl: 2 }}>
                  {Array.from(results.vafResults.groupSampleSizes.entries()).map(([group, size]) => (
                    <Typography key={group} variant="body2" sx={{ mb: 1 }}>
                      {group}: {size.toLocaleString()} samples ({((size / results.vafResults.totalSampleSize) * 100).toFixed(2)}%)
                    </Typography>
                  ))}
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Note: The highlighted row shows the comparison with the maximum VAF, which determines the total sample size requirement.
                Sample sizes are calculated using the Bonferroni-corrected base sample size and adjusted for the allocation ratios.
              </Typography>
            </Box>

            {/* Main Results */}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  Absolute MDE: {results.absoluteMde.toFixed(4)}
                  <Tooltip title="This is your minimum detectable effect in the same units as your metric. For example, if your metric is 'revenue per user', this shows the minimum dollar amount difference you can detect.">
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
                  <Tooltip title="Here's how we calculated your sample size. Don't worry about the math - the key takeaway is how your settings (like MDE and power) affect the final number.">
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
                        2σ² × (Z<sub>α</sub> + Z<sub>β</sub>)²
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
                      σ² = {(results.stdDev * results.stdDev).toFixed(4)}
                      <Box component="span" sx={{ color: 'text.secondary' }}> (variance in 
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
                      Z<sub>α</sub> = {results.zAlpha.toFixed(4)}
                      <Box component="span" sx={{ color: 'text.secondary' }}> 
                        (Z-score for {(results.correctedAlpha * 100).toFixed(3)}% significance level
                        {testType === 'two-tailed' ? ' (two-tailed)' : ''}, 
                        Bonferroni-corrected for {results.numComparisons} comparisons)
                      </Box>
                    </Typography>

                    <Typography sx={{ mb: 3, fontFamily: 'inherit' }}>
                      Z<sub>β</sub> = {results.zBeta.toFixed(4)}
                      <Box component="span" sx={{ color: 'text.secondary' }}> (Z-score for {((1 - parseFloat(beta)) * 100).toFixed(0)}% power level)</Box>
                    </Typography>
                  </Box>

                  {/* Sample Size Requirements */}
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 'bold' }}>
                    Sample Size Calculation for Unequal Splits:
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      ml: 2,
                      fontFamily: 'inherit'
                    }}>
                      <Typography sx={{ fontFamily: 'inherit' }}>
                        n<sub>total</sub> = n₀ × 
                      </Typography>
                      <Box sx={{ 
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        mx: 1
                      }}>
                        <Typography sx={{ fontFamily: 'inherit' }}>
                          {results.vafResults.maxVAF.toFixed(4)}
                        </Typography>
                        <Box sx={{ 
                          width: '100%',
                          height: '1px',
                          bgcolor: 'text.primary',
                          my: 0.5
                        }} />
                        <Typography sx={{ fontFamily: 'inherit' }}>
                          4
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      where {results.vafResults.maxVAF.toFixed(4)} is the maximum VAF from {results.vafResults.maxVAFPair}
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