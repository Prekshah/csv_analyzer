import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Grid,
  Alert,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  CircularProgress,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';

interface GroupSplittingProps {
  csvData: any;
}

interface ColumnAnalysis {
  columnName: string;
  isSuitable: boolean;
  suitabilityScore: number; // 0-100
  categories: CategoryAnalysis[];
  warnings: string[];
  recommendations: string[];
}

interface CategoryAnalysis {
  name: string;
  count: number;
  percentage: number;
  metricStats: {
    mean?: number;
    median?: number;
    standardDeviation?: number;
    conversionRate?: number;
  };
}

const GroupSplitting: React.FC<GroupSplittingProps> = ({ csvData }) => {
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [selectedSplitColumn, setSelectedSplitColumn] = useState<string>('');
  const [numGroups, setNumGroups] = useState<'2' | '3'>('2');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Memoize the statistics lookup for better performance
  const statistics = useMemo(() => csvData?.statistics || {}, [csvData]);

  // Function to determine if a metric is continuous or conversion
  const isMetricContinuous = useCallback((metricName: string): boolean => {
    if (!statistics || !metricName || !statistics[metricName]) {
      return false;
    }
    return statistics[metricName].type === 'numeric';
  }, [statistics]);

  // Calculate variance in metric distribution across categories
  const calculateMetricVariance = useCallback((categories: CategoryAnalysis[], metricName: string): number => {
    if (isMetricContinuous(metricName)) {
      const means = categories.map(cat => cat.metricStats.mean).filter((mean): mean is number => mean !== undefined);
      if (means.length === 0) return 0;
      const overallMean = means.reduce((a, b) => a + b, 0) / means.length;
      return Math.max(...means.map(mean => Math.abs((mean - overallMean) / overallMean)));
    } else {
      const rates = categories.map(cat => cat.metricStats.conversionRate).filter((rate): rate is number => rate !== undefined);
      if (rates.length === 0) return 0;
      const overallRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      return Math.max(...rates.map(rate => Math.abs((rate - overallRate) / overallRate)));
    }
  }, [isMetricContinuous]);

  // Function to calculate standard deviation
  const calculateStandardDeviation = useCallback((values: number[]): number | undefined => {
    if (values.length === 0) return undefined;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
  }, []);

  // Optimize createBins function with memoization for frequently used calculations
  const createBins = useCallback((columnName: string, numBins: number = 5): CategoryAnalysis[] => {
    if (!statistics || !columnName || !statistics[columnName]) {
      return [];
    }

    const columnIndex = csvData.columns.indexOf(columnName);
    if (columnIndex === -1) {
      return [];
    }

    // Extract values once and filter invalid ones
    const values = csvData.data
      .map((row: any) => {
        const cell = row[columnIndex];
        return cell && typeof cell.value !== 'undefined' ? Number(cell.value) : NaN;
      })
      .filter((v: number) => !isNaN(v));
    
    if (values.length === 0) {
      return [];
    }

    // Calculate min/max once
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = (max - min) / numBins;
    
    // Pre-calculate bin boundaries
    const binBoundaries = Array.from({ length: numBins }, (_, i) => ({
      start: min + (i * binSize),
      end: min + ((i + 1) * binSize),
      values: [] as number[]
    }));

    // Distribute values to bins
    values.forEach((value: number) => {
      const binIndex = Math.min(
        Math.floor((value - min) / binSize),
        numBins - 1
      );
      binBoundaries[binIndex].values.push(value);
    });

    // Convert to CategoryAnalysis format
    return binBoundaries.map(({ start, end, values: binValues }) => ({
      name: `${start.toFixed(2)} - ${end.toFixed(2)}`,
      count: binValues.length,
      percentage: (binValues.length / values.length) * 100,
      metricStats: {
        mean: binValues.length > 0 ? binValues.reduce((a, b) => a + b, 0) / binValues.length : undefined,
        median: binValues.length > 0 ? binValues.sort((a, b) => a - b)[Math.floor(binValues.length / 2)] : undefined,
        standardDeviation: calculateStandardDeviation(binValues),
      }
    }));
  }, [csvData, statistics, calculateStandardDeviation]);

  // Optimize the analyzeColumnSuitability function
  const analyzeColumnSuitability = useCallback((columnName: string, metricName: string): ColumnAnalysis => {
    if (!statistics || !csvData?.data || !columnName || !metricName) {
      return {
        columnName,
        isSuitable: false,
        suitabilityScore: 0,
        categories: [],
        warnings: ['Data not available'],
        recommendations: ['Cannot analyze column without data']
      };
    }

    const stats = statistics[columnName];
    const columnIndex = csvData.columns.indexOf(columnName);
    const metricIndex = csvData.columns.indexOf(metricName);

    if (!stats || columnIndex === -1 || metricIndex === -1) {
      return {
        columnName,
        isSuitable: false,
        suitabilityScore: 0,
        categories: [],
        warnings: ['Column or metric not found in data'],
        recommendations: ['Please check column names']
      };
    }

    const totalRows = csvData.rowCount;
    const minSampleSize = 100;
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    let categories: CategoryAnalysis[];
    
    if (stats.type === 'numeric') {
      categories = createBins(columnName);
    } else {
      // Pre-calculate metric values for all rows
      const metricValuesByCategory: { [key: string]: number[] } = {};
      const frequencies = stats.frequencies || {};
      
      // First pass: organize metric values by category
      csvData.data.forEach((row: any) => {
        const cell = row[columnIndex];
        const metricCell = row[metricIndex];
        
        if (cell && typeof cell.value !== 'undefined' && 
            metricCell && typeof metricCell.value !== 'undefined') {
          const categoryValue = cell.value;
          const metricValue = Number(metricCell.value);
          
          if (!isNaN(metricValue)) {
            if (!metricValuesByCategory[categoryValue]) {
              metricValuesByCategory[categoryValue] = [];
            }
            metricValuesByCategory[categoryValue].push(metricValue);
          }
        }
      });

      // Second pass: calculate statistics for each category
      categories = Object.entries(frequencies).map(([value, count]) => {
        const metricValues = metricValuesByCategory[value] || [];
        const sortedValues = [...metricValues].sort((a, b) => a - b);
        
        return {
          name: value,
          count: count as number,
          percentage: (count as number / totalRows) * 100,
          metricStats: {
            mean: metricValues.length > 0 ? metricValues.reduce((a, b) => a + b, 0) / metricValues.length : undefined,
            median: sortedValues.length > 0 ? sortedValues[Math.floor(sortedValues.length / 2)] : undefined,
            standardDeviation: calculateStandardDeviation(metricValues),
            conversionRate: isMetricContinuous(metricName) ? undefined :
              (metricValues.filter(v => v === 1).length / metricValues.length) * 100
          }
        };
      });
    }

    // Analyze categories in batches for better performance
    const batchSize = 5;
    for (let i = 0; i < categories.length; i += batchSize) {
      const batch = categories.slice(i, i + batchSize);
      
      // Check sample size for this batch
      const hasSmallSamples = batch.some(cat => cat.count < minSampleSize);
      if (hasSmallSamples && !warnings.includes(`Some categories have less than ${minSampleSize} samples`)) {
        warnings.push(`Some categories have less than ${minSampleSize} samples`);
      }

      // Check for empty categories in this batch
      const hasEmptyCategories = batch.some(cat => 
        !cat.metricStats.mean && !cat.metricStats.conversionRate
      );
      if (hasEmptyCategories && !warnings.includes('Some categories have no valid metric values')) {
        warnings.push('Some categories have no valid metric values');
      }
    }

    // Calculate distribution metrics once
    const meanPercentage = 100 / categories.length;
    const distributionVariance = Math.max(
      ...categories.map(cat => Math.abs(cat.percentage - meanPercentage))
    );
    
    if (distributionVariance > 20) {
      warnings.push('Categories are not evenly distributed');
    }

    // Calculate metric variance once
    const metricVariance = calculateMetricVariance(categories, metricName);
    if (metricVariance > 0.2) {
      warnings.push('Primary metric is not evenly distributed across categories');
    }

    // Calculate final score
    let suitabilityScore = 100;
    suitabilityScore -= warnings.includes(`Some categories have less than ${minSampleSize} samples`) ? 30 : 0;
    suitabilityScore -= (distributionVariance > 20) ? 30 : 0;
    suitabilityScore -= (metricVariance > 0.2) ? 40 : 0;

    // Add recommendations based on score
    if (suitabilityScore >= 70) {
      recommendations.push('This column is suitable for splitting test groups');
    } else if (suitabilityScore >= 40) {
      recommendations.push('This column can be used but may introduce bias');
    } else {
      recommendations.push('Not recommended for splitting test groups');
    }

    return {
      columnName,
      isSuitable: suitabilityScore >= 70,
      suitabilityScore,
      categories,
      warnings,
      recommendations
    };
  }, [csvData, statistics, isMetricContinuous, createBins, calculateMetricVariance]);

  // Process columns in batches
  const columnAnalysis = useMemo(() => {
    if (!selectedMetric || !csvData?.columns || !statistics) {
      return [];
    }

    setIsAnalyzing(true);

    // Filter out the selected metric from columns to analyze
    const columnsToAnalyze = csvData.columns.filter((column: string) => column !== selectedMetric);
    
    // Process columns in batches of 3 for smoother UI updates
    const batchSize = 3;
    const results: ColumnAnalysis[] = [];
    
    const processNextBatch = (startIndex: number) => {
      const batch = columnsToAnalyze.slice(startIndex, startIndex + batchSize);
      const batchResults = batch.map((column: string) => analyzeColumnSuitability(column, selectedMetric));
      results.push(...batchResults);
      
      if (startIndex + batchSize < columnsToAnalyze.length) {
        setTimeout(() => processNextBatch(startIndex + batchSize), 0);
      } else {
        results.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
        setIsAnalyzing(false);
      }
    };

    processNextBatch(0);
    return results;
  }, [selectedMetric, csvData, statistics, analyzeColumnSuitability]);

  // Calculate group sizes for selected split
  const groupSizes = useMemo(() => {
    if (!selectedSplitColumn || !selectedMetric || !csvData?.rowCount) {
      return null;
    }

    const analysis = columnAnalysis.find((col: ColumnAnalysis) => col.columnName === selectedSplitColumn);
    if (!analysis) return null;

    const totalUsers = csvData.rowCount;
    const numGroupsInt = parseInt(numGroups);
    const usersPerGroup = Math.floor(totalUsers / numGroupsInt);

    return {
      usersPerGroup,
      totalUsers,
      expectedSplit: (100 / numGroupsInt).toFixed(1) + '%'
    };
  }, [selectedSplitColumn, selectedMetric, numGroups, csvData?.rowCount, columnAnalysis]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Group Splitting Plan</Typography>
      
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
                    {column} ({statistics[column]?.type})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {selectedMetric && (
        <>
          {/* Loading State */}
          {isAnalyzing ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Analyzing columns...</Typography>
            </Box>
          ) : (
            <>
              {/* Column Analysis */}
              <Typography variant="h6" gutterBottom>Available Splitting Columns</Typography>
              
              {columnAnalysis.map((analysis: ColumnAnalysis) => (
                <Paper key={analysis.columnName} sx={{ p: 3, mb: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="subtitle1">
                          {analysis.columnName}
                          {analysis.isSuitable && (
                            <Chip
                              icon={<CheckCircleIcon />}
                              label="Recommended"
                              color="success"
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Typography>
                        <Box>
                          <Tooltip title="Suitability score based on sample size, distribution, and metric variance">
                            <LinearProgress
                              variant="determinate"
                              value={analysis.suitabilityScore}
                              sx={{
                                width: 100,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: '#e0e0e0',
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: 
                                    analysis.suitabilityScore >= 70 ? '#2e7d32' :
                                    analysis.suitabilityScore >= 40 ? '#ed6c02' : '#d32f2f'
                                }
                              }}
                            />
                          </Tooltip>
                        </Box>
                      </Box>

                      {/* Warnings and Recommendations */}
                      {analysis.warnings.map((warning: string, index: number) => (
                        <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                          {warning}
                        </Alert>
                      ))}
                      {analysis.recommendations.map((recommendation: string, index: number) => (
                        <Alert key={index} severity="info" sx={{ mb: 1 }}>
                          {recommendation}
                        </Alert>
                      ))}

                      {/* Category Distribution */}
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Category</TableCell>
                              <TableCell align="right">Count</TableCell>
                              <TableCell align="right">Percentage</TableCell>
                              {isMetricContinuous(selectedMetric) ? (
                                <>
                                  <TableCell align="right">Mean</TableCell>
                                  <TableCell align="right">Std Dev</TableCell>
                                </>
                              ) : (
                                <TableCell align="right">Conversion Rate</TableCell>
                              )}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {analysis.categories.map((category: CategoryAnalysis) => (
                              <TableRow key={category.name}>
                                <TableCell>{category.name}</TableCell>
                                <TableCell align="right">{category.count}</TableCell>
                                <TableCell align="right">{category.percentage.toFixed(1)}%</TableCell>
                                {isMetricContinuous(selectedMetric) ? (
                                  <>
                                    <TableCell align="right">
                                      {category.metricStats.mean?.toFixed(2)}
                                    </TableCell>
                                    <TableCell align="right">
                                      {category.metricStats.standardDeviation?.toFixed(2)}
                                    </TableCell>
                                  </>
                                ) : (
                                  <TableCell align="right">
                                    {category.metricStats.conversionRate?.toFixed(1)}%
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                  </Grid>
                </Paper>
              ))}

              {/* Split Configuration */}
              <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>Configure Split</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Split Column</InputLabel>
                      <Select
                        value={selectedSplitColumn}
                        onChange={(e) => setSelectedSplitColumn(e.target.value)}
                        label="Split Column"
                      >
                        {columnAnalysis.map((analysis: ColumnAnalysis) => (
                          <MenuItem 
                            key={analysis.columnName} 
                            value={analysis.columnName}
                            disabled={!analysis.isSuitable}
                          >
                            {analysis.columnName}
                            {!analysis.isSuitable && " (Not Recommended)"}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl>
                      <FormLabel>Number of Groups</FormLabel>
                      <RadioGroup
                        row
                        value={numGroups}
                        onChange={(e) => setNumGroups(e.target.value as '2' | '3')}
                      >
                        <FormControlLabel 
                          value="2" 
                          control={<Radio />} 
                          label="2 Groups (A/B)" 
                        />
                        <FormControlLabel 
                          value="3" 
                          control={<Radio />} 
                          label="3 Groups (A/B/C)" 
                        />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                </Grid>

                {/* Group Size Summary */}
                {groupSizes && (
                  <Box sx={{ mt: 3 }}>
                    <Alert severity="success">
                      <Typography variant="subtitle2" gutterBottom>
                        Split Summary:
                      </Typography>
                      <Typography variant="body2">
                        • Total Users: {groupSizes.totalUsers}
                      </Typography>
                      <Typography variant="body2">
                        • Users per Group: {groupSizes.usersPerGroup}
                      </Typography>
                      <Typography variant="body2">
                        • Expected Split: {groupSizes.expectedSplit} per group
                      </Typography>
                    </Alert>
                  </Box>
                )}
              </Paper>
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default GroupSplitting; 