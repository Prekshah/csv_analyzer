import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Tab,
  Tabs,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  LinearProgress,
  Select,
  MenuItem,
  TextField,
  FormControl,
  InputLabel,
  Grid,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Tooltip as RechartsTooltip,
  ScatterChart, Scatter, PieChart, Pie, Cell,
  ResponsiveContainer
} from 'recharts';
import Papa from 'papaparse';
import { styled } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import InfoIcon from '@mui/icons-material/Info';
import PowerAnalysis from './components/PowerAnalysis';
/* Temporarily commented out */
// import GroupSplitting from './components/GroupSplitting';

// Define colors for charts
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];

const UploadArea = styled(Paper)(({ theme }) => ({
  border: '2px dashed #ccc',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(4),
  textAlign: 'center',
  marginBottom: theme.spacing(3),
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),
  '&:hover': {
    borderColor: '#666',
    backgroundColor: '#f9f9f9',
  },
}));

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

interface DependencyMetric {
  column1: string;
  column2: string;
  type: 'correlation' | 'categorical_association';
  strength: number;
  description: string;
}

interface CSVValue {
  value: string | number | null;
}

interface CSVData {
  rowCount: number;
  columnCount: number;
  columns: string[];
  data: CSVValue[][];
  statistics: Record<string, ColumnStatistics>;
  dependencies: DependencyMetric[];
  dependentMetrics: string[];
}

interface ColumnStatistics {
  type: 'numeric' | 'categorical' | 'date';
  mean?: number;
  median?: number;
  mode?: string | number;
  min?: number;
  max?: number;
  standardDeviation?: number;
  skewness?: number;
  kurtosis?: number;
  percentile25?: number;
  percentile75?: number;
  uniqueValues?: number;
  frequencies?: Record<string, number>;
  nullCount: number;
  missingCount: number;
  totalCount: number;
  completeness: number;
}

interface BoxPlotData {
  column: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
}

interface CorrelationPair {
  source: string;
  target: string;
  value: number;
  description: string;
}

interface HeatmapCell {
  x: string;
  y: string;
  value: number;
}

function detectColumnType(values: (string | number | null)[]): 'numeric' | 'categorical' | 'date' {
  const numericCount = values.filter(v => v !== null && !isNaN(Number(v))).length;
  const dateCount = values.filter(v => v !== null && !isNaN(Date.parse(String(v)))).length;
  
  if (numericCount / values.length > 0.8) return 'numeric';
  if (dateCount / values.length > 0.8) return 'date';
  return 'categorical';
}

function calculateStatistics(data: CSVValue[][], columnIndex: number): ColumnStatistics {
  const values = data.map(row => row[columnIndex].value);
  const type = detectColumnType(values);
  
  const stats: ColumnStatistics = { 
    type,
    nullCount: values.filter(val => val === null || val === 'null').length,
    missingCount: values.filter(val => val === '' || val === undefined).length,
    totalCount: values.length,
    completeness: 0
  };
  
  // Calculate completeness percentage
  const validValues = values.filter(val => val !== null && val !== '' && val !== undefined && val !== 'null');
  stats.completeness = (validValues.length / values.length) * 100;
  
  if (type === 'numeric') {
    const numbers = validValues.map(Number).filter(n => !isNaN(n));
    const n = numbers.length;
    
    // Basic statistics
    stats.mean = numbers.reduce((a, b) => a + b, 0) / n;
    const sortedNumbers = numbers.sort((a, b) => a - b);
    stats.median = sortedNumbers[Math.floor(n / 2)];
    stats.min = Math.min(...numbers);
    stats.max = Math.max(...numbers);
    
    // Standard deviation
    const variance = numbers.reduce((acc, val) => acc + Math.pow(val - stats.mean!, 2), 0) / n;
    stats.standardDeviation = Math.sqrt(variance);
    
    // Skewness
    const m3 = numbers.reduce((acc, val) => acc + Math.pow(val - stats.mean!, 3), 0) / n;
    stats.skewness = m3 / Math.pow(stats.standardDeviation!, 3);
    
    // Kurtosis
    const m4 = numbers.reduce((acc, val) => acc + Math.pow(val - stats.mean!, 4), 0) / n;
    stats.kurtosis = (m4 / Math.pow(stats.standardDeviation!, 4)) - 3; // Excess kurtosis
    
    // Percentiles
    stats.percentile25 = sortedNumbers[Math.floor(n * 0.25)];
    stats.percentile75 = sortedNumbers[Math.floor(n * 0.75)];
  }
  
  // Calculate frequencies for all types
  const frequencies: Record<string, number> = {};
  validValues.forEach(val => {
    frequencies[String(val)] = (frequencies[String(val)] || 0) + 1;
  });
  stats.frequencies = frequencies;
  stats.uniqueValues = Object.keys(frequencies).length;
  
  // Find mode
  const mode = Object.entries(frequencies).reduce((a, b) => 
    (frequencies[a[0]] > frequencies[b[0]] ? a : b))[0];
  stats.mode = type === 'numeric' ? Number(mode) : mode;
  
  return stats;
}

function calculateCorrelation(values1: number[], values2: number[]): number {
  const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
  const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;

  const numerator = values1.reduce((sum, v1, idx) => 
    sum + (v1 - mean1) * (values2[idx] - mean2), 0);
  
  const denom1 = Math.sqrt(values1.reduce((sum, v) => 
    sum + Math.pow(v - mean1, 2), 0));
  const denom2 = Math.sqrt(values2.reduce((sum, v) => 
    sum + Math.pow(v - mean2, 2), 0));
  
  return numerator / (denom1 * denom2);
}

function calculateCategoricalAssociation(col1: (string | number | null)[], col2: (string | number | null)[]): number {
  const jointFreq: Record<string, Record<string, number>> = {};
  const marginalFreq1: Record<string, number> = {};
  const marginalFreq2: Record<string, number> = {};
  
  // Calculate joint and marginal frequencies
  col1.forEach((val1, idx) => {
    const val2 = col2[idx];
    const strVal1 = String(val1);
    const strVal2 = String(val2);
    jointFreq[strVal1] = jointFreq[strVal1] || {};
    jointFreq[strVal1][strVal2] = (jointFreq[strVal1][strVal2] || 0) + 1;
    marginalFreq1[strVal1] = (marginalFreq1[strVal1] || 0) + 1;
    marginalFreq2[strVal2] = (marginalFreq2[strVal2] || 0) + 1;
  });
  
  // Calculate Cramer's V
  let chiSquare = 0;
  Object.keys(jointFreq).forEach(val1 => {
    Object.keys(jointFreq[val1]).forEach(val2 => {
      const observed = jointFreq[val1][val2];
      const expected = (marginalFreq1[val1] * marginalFreq2[val2]) / col1.length;
      chiSquare += Math.pow(observed - expected, 2) / expected;
    });
  });
  
  const minCategories = Math.min(
    Object.keys(marginalFreq1).length,
    Object.keys(marginalFreq2).length
  ) - 1;
  
  return Math.sqrt(chiSquare / (col1.length * minCategories));
}

function findDependencies(data: CSVValue[][], columns: string[], statistics: Record<string, ColumnStatistics>): DependencyMetric[] {
  const dependencies: DependencyMetric[] = [];
  
  for (let i = 0; i < columns.length; i++) {
    for (let j = i + 1; j < columns.length; j++) {
      const col1 = columns[i];
      const col2 = columns[j];
      const stats1 = statistics[col1];
      const stats2 = statistics[col2];
      
      // Skip if either column has too many missing values
      if (stats1.completeness < 50 || stats2.completeness < 50) continue;
      
      if (stats1.type === 'numeric' && stats2.type === 'numeric') {
        const numericValues1 = data.map(row => Number(row[i].value)).filter(v => !isNaN(v));
        const numericValues2 = data.map(row => Number(row[j].value)).filter(v => !isNaN(v));
        
        if (numericValues1.length === numericValues2.length && numericValues1.length > 0) {
          const correlation = calculateCorrelation(numericValues1, numericValues2);
          if (Math.abs(correlation) > 0.5) {
            dependencies.push({
              column1: col1,
              column2: col2,
              type: 'correlation',
              strength: Math.abs(correlation),
              description: `Strong ${correlation > 0 ? 'positive' : 'negative'} correlation (${(correlation * 100).toFixed(1)}%)`
            });
          }
        }
      } else if (stats1.type === 'categorical' && stats2.type === 'categorical') {
        const categoricalValues1 = data.map(row => row[i].value).filter(v => v !== null && v !== '');
        const categoricalValues2 = data.map(row => row[j].value).filter(v => v !== null && v !== '');
        
        if (categoricalValues1.length === categoricalValues2.length && categoricalValues1.length > 0) {
          const association = calculateCategoricalAssociation(categoricalValues1, categoricalValues2);
          if (association > 0.3) {
            dependencies.push({
              column1: col1,
              column2: col2,
              type: 'categorical_association',
              strength: association,
              description: `Strong categorical association (${(association * 100).toFixed(1)}%)`
            });
          }
        }
      }
    }
  }
  
  return dependencies.sort((a, b) => b.strength - a.strength);
}

function identifyDependentMetrics(columns: string[]): string[] {
  const businessMetricKeywords = [
    'retention', 'ltv', 'revenue', 'churn', 'conversion',
    'sales', 'profit', 'income', 'roi', 'return',
    'engagement', 'satisfaction', 'nps', 'csat',
    'acquisition', 'growth', 'performance', 'success',
    'outcome', 'target', 'goal', 'kpi', 'metric',
    'dependent', 'output', 'result'
  ];

  return columns.filter(column => {
    const columnLower = column.toLowerCase();
    return businessMetricKeywords.some(keyword => 
      columnLower.includes(keyword) || 
      columnLower.endsWith('_rate') ||
      columnLower.endsWith('_score') ||
      columnLower.endsWith('_value')
    );
  });
}

function calculateQuartiles(data: number[]): { q1: number; median: number; q3: number } {
  const sorted = [...data].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const medianIndex = Math.floor(sorted.length * 0.5);
  const q3Index = Math.floor(sorted.length * 0.75);
  
  return {
    q1: sorted[q1Index],
    median: sorted[medianIndex],
    q3: sorted[q3Index]
  };
}

function prepareBoxPlotData(values: number[], columnName: string): BoxPlotData {
  const sorted = [...values].sort((a, b) => a - b);
  const { q1, median, q3 } = calculateQuartiles(sorted);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  
  const outliers = sorted.filter(v => v < lowerFence || v > upperFence);
  const min = sorted.find(v => v >= lowerFence) || sorted[0];
  const max = sorted.reverse().find(v => v <= upperFence) || sorted[sorted.length - 1];
  
  return {
    column: columnName,
    min,
    q1,
    median,
    q3,
    max,
    outliers
  };
}

function prepareCorrelationMatrix(
  data: CSVValue[][],
  columns: string[],
  statistics: Record<string, ColumnStatistics>,
  dependentMetric?: string
): { pairs: CorrelationPair[], heatmap: HeatmapCell[] } {
  const numericColumns = columns.filter(col => statistics[col].type === 'numeric');
  const correlationPairs: CorrelationPair[] = [];
  const heatmapData: HeatmapCell[] = [];
  
  // Function to describe correlation strength
  const describeCorrelation = (value: number): string => {
    const abs = Math.abs(value);
    if (abs >= 0.9) return 'Very strong';
    if (abs >= 0.7) return 'Strong';
    if (abs >= 0.5) return 'Moderate';
    if (abs >= 0.3) return 'Weak';
    return 'Very weak';
  };

  // Function to calculate correlation and create description
  const processCorrelation = (col1: string, col2: string): number => {
    const values1 = data.map(row => Number(row[columns.indexOf(col1)].value)).filter(v => !isNaN(v));
    const values2 = data.map(row => Number(row[columns.indexOf(col2)].value)).filter(v => !isNaN(v));
    
    if (values1.length > 0 && values2.length > 0) {
      return calculateCorrelation(values1, values2);
    }
    return 0;
  };

  // If dependent metric is specified, prioritize correlations with it
  if (dependentMetric && numericColumns.includes(dependentMetric)) {
    numericColumns
      .filter(col => col !== dependentMetric)
      .forEach(col => {
        const correlation = processCorrelation(col, dependentMetric);
        const strength = describeCorrelation(correlation);
        const direction = correlation > 0 ? 'positive' : 'negative';
        
        correlationPairs.push({
          source: col,
          target: dependentMetric,
          value: correlation,
          description: `${strength} ${direction} correlation: As ${col} ${correlation > 0 ? 'increases' : 'decreases'}, ${dependentMetric} tends to ${correlation > 0 ? 'increase' : 'decrease'}`
        });
      });
  }

  // Calculate full correlation matrix for heatmap
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = 0; j < numericColumns.length; j++) {
      const col1 = numericColumns[i];
      const col2 = numericColumns[j];
      
      if (i !== j) {
        const correlation = processCorrelation(col1, col2);
        
        // Add to heatmap data
        heatmapData.push({
          x: col1,
          y: col2,
          value: correlation
        });
        
        // Add to pairs only if it's not already covered by dependent metric correlations
        if (i < j && (!dependentMetric || (col1 !== dependentMetric && col2 !== dependentMetric))) {
          const strength = describeCorrelation(correlation);
          const direction = correlation > 0 ? 'positive' : 'negative';
          
          correlationPairs.push({
            source: col1,
            target: col2,
            value: correlation,
            description: `${strength} ${direction} correlation: As ${col1} ${correlation > 0 ? 'increases' : 'decreases'}, ${col2} tends to ${correlation > 0 ? 'increase' : 'decrease'}`
          });
        }
      } else {
        // Add diagonal elements for complete heatmap
        heatmapData.push({
          x: col1,
          y: col2,
          value: 1
        });
      }
    }
  }

  // Sort correlation pairs by absolute value
  correlationPairs.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return { pairs: correlationPairs, heatmap: heatmapData };
}

// Add new component for correlation heatmap
function CorrelationHeatmap({ data, width, height }: { data: HeatmapCell[], width: number, height: number }) {
  const uniqueColumns = Array.from(new Set(data.map(d => d.x)));
  const cellSize = Math.min(width, height) / (uniqueColumns.length + 1);
  
  // Color scale function
  const getColor = (value: number): string => {
    if (value === 1) return '#8884d8';
    if (value > 0) return `rgba(76, 175, 80, ${Math.abs(value)})`;
    return `rgba(244, 67, 54, ${Math.abs(value)})`;
  };

  return (
    <svg width={width} height={height}>
      <g transform={`translate(${cellSize}, ${cellSize})`}>
        {/* Column labels */}
        {uniqueColumns.map((col, i) => (
          <text
            key={`col-${i}`}
            x={i * cellSize + cellSize / 2}
            y={-10}
            textAnchor="end"
            transform={`rotate(-45, ${i * cellSize + cellSize / 2}, -10)`}
            fontSize={12}
          >
            {col}
          </text>
        ))}
        
        {/* Row labels */}
        {uniqueColumns.map((col, i) => (
          <text
            key={`row-${i}`}
            x={-10}
            y={i * cellSize + cellSize / 2}
            textAnchor="end"
            alignmentBaseline="middle"
            fontSize={12}
          >
            {col}
          </text>
        ))}
        
        {/* Heatmap cells */}
        {data.map((d, i) => {
          const x = uniqueColumns.indexOf(d.x) * cellSize;
          const y = uniqueColumns.indexOf(d.y) * cellSize;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={getColor(d.value)}
                stroke="#fff"
              />
              <text
                x={x + cellSize / 2}
                y={y + cellSize / 2}
                textAnchor="middle"
                alignmentBaseline="middle"
                fontSize={10}
                fill={Math.abs(d.value) > 0.5 ? '#fff' : '#000'}
              >
                {d.value.toFixed(2)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// Add helper function to determine the best visualization type
function determineVisualizationType(stats: ColumnStatistics, columnName: string): 'none' | 'bar' | 'pie' | 'box' | 'simple' {
  const uniqueValueCount = stats.uniqueValues || 0;
  const totalCount = stats.totalCount;
  const frequencies = stats.frequencies || {};
  const values = Object.values(frequencies);
  
  // Check if all frequencies are the same
  const allSameFrequency = values.every(v => v === values[0]);
  
  // Check if it's likely an ID column (all unique values or name suggests ID)
  const isIdColumn = uniqueValueCount === totalCount || 
    columnName.toLowerCase().includes('id') ||
    columnName.toLowerCase().includes('identifier');

  // For numeric columns
  if (stats.type === 'numeric') {
    // If it's an ID or timestamp, don't visualize
    if (isIdColumn) {
      return 'none';
    }
    
    // If there's significant variation in the data, use box plot
    if (uniqueValueCount > 5) {
      return 'box';
    }
    
    // For small number of unique values with varying frequencies
    return 'bar';
  }
  
  // For categorical columns
  if (stats.type === 'categorical') {
    // Don't visualize IDs
    if (isIdColumn) {
      return 'none';
    }
    
    // If all values have the same frequency or there are too many unique values
    if (allSameFrequency || uniqueValueCount > 20) {
      return 'simple';
    }
    
    // For binary or very few categories
    if (uniqueValueCount <= 2) {
      return 'simple';
    }
    
    // For moderate number of categories with varying frequencies
    if (uniqueValueCount <= 8) {
      return 'pie';
    }
    
    // Default to bar chart for other cases
    return 'bar';
  }
  
  return 'none';
}

// Update the BoxPlot component for better spacing
function BoxPlot({ data, width, height }: { data: BoxPlotData; width: number; height: number }) {
  const plotWidth = width - 60;  // Adjust for margins

  const scale = (value: number) => {
    return 30 + (plotWidth * (value - (data.min - 0.05))) / (data.max - data.min + 0.1);
  };

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(num) >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(1);
  };

  const checkOverlap = (pos1: number, pos2: number, minSpace: number) => {
    return Math.abs(pos1 - pos2) < minSpace;
  };

  // Calculate positions for staggered labels
  const keyPoints = [
    { value: data.min, label: 'Min' },
    { value: data.q1, label: 'Q1' },
    { value: data.median, label: 'Median' },
    { value: data.q3, label: 'Q3' },
    { value: data.max, label: 'Max' }
  ];

  // Calculate label positions to avoid overlap
  const labelPositions = keyPoints.map((point, i) => {
    const basePos = scale(point.value);
    const prevPos = i > 0 ? scale(keyPoints[i - 1].value) : -Infinity;
    
    let yOffset = -45;
    if (i > 0 && checkOverlap(basePos, prevPos, 80)) {
      yOffset = i % 2 === 0 ? -45 : -65;
    }
    return { ...point, yOffset };
  });

  return (
    <svg width={width} height={height}>
      {/* Title with more space */}
      <text
        x={width / 2}
        y={30}
        textAnchor="middle"
        fontSize="14"
        fontWeight="bold"
      >
        Distribution of {data.column}
      </text>

      {/* X-axis with better spacing */}
      <line
        x1={30}
        y1={height - 40}
        x2={width - 30}
        y2={height - 40}
        stroke="#666"
        strokeWidth={1}
      />

      {/* X-axis ticks and labels with improved spacing */}
      {keyPoints.map((point, i) => (
        <g key={i}>
          <line
            x1={scale(point.value)}
            y1={height - 40}
            x2={scale(point.value)}
            y2={height - 40 + 5}
            stroke="#666"
          />
          <text
            x={scale(point.value)}
            y={height - 40 + 25}
            textAnchor="middle"
            fontSize="11"
          >
            {formatNumber(point.value)}
          </text>
        </g>
      ))}

      {/* X-axis label with more space */}
      <text
        x={width / 2}
        y={height - 15}
        textAnchor="middle"
        fontSize="12"
      >
        Values
      </text>

      {/* Main box plot elements with increased spacing */}
      <g transform={`translate(0, ${height / 2})`}>
        {/* Whisker lines */}
        <line
          x1={scale(data.min)}
          x2={scale(data.q1)}
          y1={0}
          y2={0}
          stroke="#666"
          strokeWidth={1}
          strokeDasharray="4"
        />
        <line
          x1={scale(data.q3)}
          x2={scale(data.max)}
          y1={0}
          y2={0}
          stroke="#666"
          strokeWidth={1}
          strokeDasharray="4"
        />

        {/* Box */}
        <rect
          x={scale(data.q1)}
          y={-30}
          width={scale(data.q3) - scale(data.q1)}
          height={60}
          fill="#8884d8"
          fillOpacity={0.3}
          stroke="#8884d8"
          strokeWidth={1}
        />

        {/* Median line */}
        <line
          x1={scale(data.median)}
          x2={scale(data.median)}
          y1={-30}
          y2={30}
          stroke="#ff7300"
          strokeWidth={2}
        />

        {/* Whisker endpoints */}
        <line
          x1={scale(data.min)}
          x2={scale(data.min)}
          y1={-20}
          y2={20}
          stroke="#666"
          strokeWidth={1}
        />
        <line
          x1={scale(data.max)}
          x2={scale(data.max)}
          y1={-20}
          y2={20}
          stroke="#666"
          strokeWidth={1}
        />

        {/* Outliers with tooltips */}
        {data.outliers.map((value, i) => (
          <g key={i}>
            <circle
              cx={scale(value)}
              cy={0}
              r={3}
              fill="#ff0000"
            />
            <text
              x={scale(value)}
              y={-10}
              textAnchor="middle"
              fontSize="10"
              fill="#ff0000"
            >
              {formatNumber(value)}
            </text>
          </g>
        ))}

        {/* Labels with improved positioning */}
        {labelPositions.map((point, i) => (
          <g key={i}>
            {/* Connect line from label to point */}
            <line
              x1={scale(point.value)}
              y1={point.yOffset + 15}
              x2={scale(point.value)}
              y2={point.yOffset < -50 ? -35 : -25}
              stroke="#666"
              strokeWidth={0.5}
              strokeDasharray="2"
            />
            {/* Label background for better readability */}
            <rect
              x={scale(point.value) - 25}
              y={point.yOffset - 8}
              width={50}
              height={20}
              fill="white"
              fillOpacity={0.8}
            />
            {/* Label text */}
            <text
              x={scale(point.value)}
              y={point.yOffset}
              textAnchor="middle"
              fontSize="11"
            >
              {point.label}
            </text>
            {/* Value text */}
            <text
              x={scale(point.value)}
              y={45}
              textAnchor="middle"
              fontSize="11"
            >
              {formatNumber(point.value)}
            </text>
          </g>
        ))}
      </g>

      {/* Legend with improved spacing and alignment */}
      <g transform={`translate(30, 30)`}>
        <g>
          <rect x="0" y="-8" width="12" height="12" fill="#8884d8" fillOpacity={0.3} stroke="#8884d8" />
          <text x="20" y="0" fontSize="11" dominantBaseline="middle">IQR Box</text>
        </g>
        
        <g transform="translate(120, 0)">
          <line x1="0" y1="-3" x2="12" y2="-3" stroke="#ff7300" strokeWidth="2" />
          <text x="20" y="0" fontSize="11" dominantBaseline="middle">Median</text>
        </g>
        
        <g transform="translate(240, 0)">
          <circle cx="6" cy="-3" r="3" fill="#ff0000" />
          <text x="20" y="0" fontSize="11" dominantBaseline="middle">Outliers</text>
        </g>
      </g>
    </svg>
  );
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDependentMetric, setSelectedDependentMetric] = useState<string>('');
  const [manualMetricInput, setManualMetricInput] = useState<string>('');
  const [metricError, setMetricError] = useState<string>('');
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      setFile(event.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const processFile = () => {
    if (!file) return;
    
    setIsProcessing(true);
    Papa.parse(file, {
      complete: (results) => {
        const headers = results.data[0] as string[];
        const rawData = results.data.slice(1) as string[][];
        
        const data: CSVValue[][] = rawData.map(row =>
          row.map(cell => ({
            value: cell === '' || cell === null ? null : isNaN(Number(cell)) ? cell : Number(cell)
          }))
        );

        const statistics: Record<string, ColumnStatistics> = {};
        headers.forEach((_, index) => {
          statistics[headers[index]] = calculateStatistics(data, index);
        });

        // First try to identify dependent metrics automatically
        const autoDetectedMetrics = identifyDependentMetrics(headers);
        
        // Calculate both general and target-specific dependencies
        const generalDependencies = findDependencies(data, headers, statistics);
        const targetDependencies = autoDetectedMetrics.length > 0
          ? findDependenciesWithTarget(data, headers, statistics, autoDetectedMetrics[0])
          : [];

        // Combine both types of dependencies
        const allDependencies = [...generalDependencies, ...targetDependencies];

        setCsvData({
          rowCount: data.length,
          columnCount: headers.length,
          columns: headers,
          data: data,
          statistics: statistics,
          dependencies: allDependencies,
          dependentMetrics: autoDetectedMetrics
        });

        // Reset selection state when loading new file
        setSelectedDependentMetric('');
        setManualMetricInput('');
        setMetricError('');
        setIsProcessing(false);
      },
      header: false,
      skipEmptyLines: true,
      error: (error) => {
        console.error('Error parsing CSV:', error);
        setIsProcessing(false);
      }
    });
  };

  const handleDependentMetricSelect = (event: any) => {
    const metric = event.target.value;
    setSelectedDependentMetric(metric);
    setMetricError('');
    if (csvData) {
      // Calculate both general dependencies and target-specific dependencies
      const generalDependencies = findDependencies(csvData.data, csvData.columns, csvData.statistics);
      const targetDependencies = findDependenciesWithTarget(
        csvData.data,
        csvData.columns,
        csvData.statistics,
        metric
      );

      // Combine both types of dependencies
      const allDependencies = [...generalDependencies, ...targetDependencies];
      
      setCsvData({
        ...csvData,
        dependencies: allDependencies,
        dependentMetrics: [metric]
      });
    }
  };

  const handleManualMetricSubmit = () => {
    if (!csvData) return;
    
    const columnExists = csvData.columns.includes(manualMetricInput);
    if (!columnExists) {
      setMetricError('Column name not found in the dataset');
      return;
    }
    
    handleDependentMetricSelect({ target: { value: manualMetricInput } });
    setManualMetricInput('');
  };

  const findDependenciesWithTarget = (
    data: CSVValue[][],
    columns: string[],
    statistics: Record<string, ColumnStatistics>,
    targetColumn: string
  ): DependencyMetric[] => {
    const dependencies: DependencyMetric[] = [];
    const targetIndex = columns.indexOf(targetColumn);
    const targetStats = statistics[targetColumn];
    
    if (targetIndex === -1) return dependencies;
    
    columns.forEach((column, i) => {
      if (column === targetColumn) return;
      
      const stats = statistics[column];
      
      // Skip if either column has too many missing values
      if (stats.completeness < 50 || targetStats.completeness < 50) return;
      
      if (stats.type === 'numeric' && targetStats.type === 'numeric') {
        const values1 = data.map(row => Number(row[i].value)).filter(v => !isNaN(v));
        const values2 = data.map(row => Number(row[targetIndex].value)).filter(v => !isNaN(v));
        
        if (values1.length === values2.length && values1.length > 0) {
          const correlation = calculateCorrelation(values1, values2);
          if (Math.abs(correlation) > 0.3) { // Lower threshold for target analysis
            dependencies.push({
              column1: column,
              column2: targetColumn,
              type: 'correlation',
              strength: Math.abs(correlation),
              description: `${correlation > 0 ? 'Positive' : 'Negative'} correlation with ${targetColumn} (${(correlation * 100).toFixed(1)}%)`
            });
          }
        }
      } else if (stats.type === 'categorical' && targetStats.type === 'categorical') {
        const values1 = data.map(row => row[i].value).filter(v => v !== null && v !== '');
        const values2 = data.map(row => row[targetIndex].value).filter(v => v !== null && v !== '');
        
        if (values1.length === values2.length && values1.length > 0) {
          const association = calculateCategoricalAssociation(values1, values2);
          if (association > 0.2) { // Lower threshold for target analysis
            dependencies.push({
              column1: column,
              column2: targetColumn,
              type: 'categorical_association',
              strength: association,
              description: `Association with ${targetColumn} (${(association * 100).toFixed(1)}%)`
            });
          }
        }
      }
    });
    
    return dependencies.sort((a, b) => b.strength - a.strength);
  };

  const renderSummaryTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>Basic Information</Typography>
      <Typography>Number of rows: {csvData?.rowCount}</Typography>
      <Typography>Number of columns: {csvData?.columnCount}</Typography>
      
      {/* Dependent Metric Section */}
      {csvData && (
        <>
          <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
            Dependent Metric Analysis
          </Typography>
          {csvData.dependentMetrics.length > 0 ? (
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography>
                Analyzing relationships with dependent metric:
              </Typography>
              <Typography variant="h6" color="primary">
                {csvData.dependentMetrics[0]} ({csvData.statistics[csvData.dependentMetrics[0]].type})
              </Typography>
            </Paper>
          ) : (
            renderDependentMetricSelection()
          )}
        </>
      )}

      {/* Data Quality Overview Section */}
      {csvData && (
        <>
          <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>Data Quality Overview</Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Column</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Completeness</TableCell>
                  <TableCell>Missing Values</TableCell>
                  <TableCell>Null Values</TableCell>
                  <TableCell>Unique Values</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {csvData.columns.map((column, index) => {
                  const stats = csvData.statistics[column];
                  return (
                    <TableRow key={index}>
                      <TableCell>{column}</TableCell>
                      <TableCell>{stats.type}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={stats.completeness} 
                            sx={{ 
                              width: 100,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: '#e0e0e0',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: stats.completeness > 90 ? '#2e7d32' : stats.completeness > 70 ? '#ed6c02' : '#d32f2f'
                              }
                            }}
                          />
                          <Typography variant="body2">
                            {stats.completeness.toFixed(1)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{stats.missingCount}</TableCell>
                      <TableCell>{stats.nullCount}</TableCell>
                      <TableCell>{stats.uniqueValues}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Dependencies Analysis Section */}
      {csvData?.dependencies && (
        <>
          <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Column Dependencies Analysis
              <Tooltip title="Shows relationships between columns based on correlation (for numeric data) and categorical association (for categorical data)">
                <Box component="span" sx={{ cursor: 'help' }}>ℹ️</Box>
              </Tooltip>
            </Box>
          </Typography>

          {csvData.dependencies.length === 0 ? (
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography color="text.secondary">
                No significant dependencies found between columns. This could mean:
                <ul>
                  <li>The columns are mostly independent</li>
                  <li>The relationships are weaker than our thresholds (correlation {'>'}0.5 or association {'>'}0.3)</li>
                  <li>There is insufficient data to determine relationships</li>
                </ul>
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Related Columns</TableCell>
                    <TableCell>Relationship Type</TableCell>
                    <TableCell>Strength</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {csvData.dependencies.map((dep, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography>{`${dep.column1} ↔ ${dep.column2}`}</Typography>
                          <Tooltip title="These columns show a significant relationship">
                            <Box component="span" sx={{ cursor: 'help' }}>ℹ️</Box>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography>
                            {dep.type === 'correlation' ? 'Correlation' : 'Categorical Association'}
                          </Typography>
                          <Tooltip title={
                            dep.type === 'correlation' 
                              ? "Pearson correlation coefficient - measures linear relationship between numeric columns"
                              : "Cramer's V - measures association between categorical columns"
                          }>
                            <Box component="span" sx={{ cursor: 'help' }}>ℹ️</Box>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={dep.strength * 100} 
                            sx={{ 
                              width: 100,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: '#e0e0e0',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: dep.strength > 0.7 ? '#2e7d32' : dep.strength > 0.5 ? '#ed6c02' : '#1976d2'
                              }
                            }}
                          />
                          <Typography variant="body2">
                            {(dep.strength * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{dep.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
          )}
        </>
      )}

      {/* Preview Section */}
      <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>Preview</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {csvData?.columns.map((column, index) => (
                <TableCell key={index}>{column}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {csvData?.data.slice(0, 5).map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {row.map((cell: CSVValue, cellIndex: number) => (
                  <TableCell key={cellIndex}>
                    {cell.value === null || cell.value === '' ? (
                      <Typography color="text.secondary">(empty)</Typography>
                    ) : (
                      cell.value
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderStatisticsTab = () => (
    <Box>
      {csvData?.columns.map((column, index) => {
        const stats = csvData.statistics[column];
        return (
          <Paper key={index} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6">{column}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography><strong>Type:</strong> {stats.type}</Typography>
              <Typography><strong>Data Quality:</strong></Typography>
              <Box sx={{ pl: 2 }}>
                <Typography>
                  Completeness: 
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, ml: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={stats.completeness} 
                      sx={{ 
                        width: 100,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: stats.completeness > 90 ? '#2e7d32' : stats.completeness > 70 ? '#ed6c02' : '#d32f2f'
                        }
                      }}
                    />
                    <Typography variant="body2">
                      {stats.completeness.toFixed(1)}%
                    </Typography>
                  </Box>
                </Typography>
                <Typography>Missing Values: {stats.missingCount}</Typography>
                <Typography>Null Values: {stats.nullCount}</Typography>
              </Box>
              
              <Typography><strong>Distribution:</strong></Typography>
              <Box sx={{ pl: 2 }}>
                <Typography>Unique Values: {stats.uniqueValues}</Typography>
                {stats.type === 'numeric' && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5, color: 'primary.main' }}>
                      Central Tendency:
                      <Tooltip title="Measures of central location in the data">
                        <IconButton size="small">
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Typography>
                    <Box sx={{ pl: 2, mb: 2 }}>
                      <Typography>Mean: <strong>{stats.mean?.toFixed(2)}</strong></Typography>
                      <Typography>Median: <strong>{stats.median?.toFixed(2)}</strong></Typography>
                      <Typography>Mode: <strong>{stats.mode}</strong></Typography>
                    </Box>
                    
                    <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5, color: 'primary.main' }}>
                      Range & Percentiles:
                      <Tooltip title="Distribution boundaries and quartile values">
                        <IconButton size="small">
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Typography>
                    <Box sx={{ pl: 2, mb: 2 }}>
                      <Typography>Minimum: <strong>{stats.min?.toFixed(2)}</strong></Typography>
                      <Typography>Maximum: <strong>{stats.max?.toFixed(2)}</strong></Typography>
                      <Typography>25th Percentile (Q1): <strong>{stats.percentile25?.toFixed(2)}</strong></Typography>
                      <Typography>75th Percentile (Q3): <strong>{stats.percentile75?.toFixed(2)}</strong></Typography>
                    </Box>
                    
                    <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5, color: 'primary.main' }}>
                      Distribution Shape:
                      <Tooltip title="Metrics describing the shape and spread of the distribution">
                        <IconButton size="small">
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      <Typography>
                        Standard Deviation: <strong>{stats.standardDeviation?.toFixed(2)}</strong>
                        <Tooltip title="Measures the average deviation from the mean">
                          <IconButton size="small">
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Typography>
                      <Typography>
                        Skewness: <strong>{stats.skewness?.toFixed(2)}</strong>
                        <Tooltip title="Measures asymmetry of the distribution. Positive values indicate right skew, negative values indicate left skew">
                          <IconButton size="small">
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Typography>
                      <Typography>
                        Kurtosis: <strong>{stats.kurtosis?.toFixed(2)}</strong>
                        <Tooltip title="Measures the 'tailedness' of the distribution. Higher values indicate heavier tails">
                          <IconButton size="small">
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Typography>
                    </Box>
                  </>
                )}
                {stats.type === 'categorical' && (
                  <>
                    <Typography>Mode (Most Common Value): {stats.mode}</Typography>
                    <Typography>Top 5 Most Common Values:</Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Value</TableCell>
                            <TableCell align="right">Count</TableCell>
                            <TableCell align="right">Percentage</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(stats.frequencies || {})
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 5)
                            .map(([value, count]) => (
                              <TableRow key={value}>
                                <TableCell>{value}</TableCell>
                                <TableCell align="right">{count}</TableCell>
                                <TableCell align="right">
                                  {((count / stats.totalCount) * 100).toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </Box>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );

  const renderDistributionsTab = () => {
    return (
      <Box>
        <Typography variant="h5" gutterBottom>Distribution Analysis</Typography>
        
        {csvData?.columns.map((column, index) => {
          const stats = csvData.statistics[column];
          const visualizationType = determineVisualizationType(stats, column);
          
          if (visualizationType === 'none') {
            return null;
          }
          
          if (stats.type === 'numeric' && csvData) {
            const numericValues = csvData.data
              .map(row => Number(row[index].value))
              .filter(v => !isNaN(v));
            
            if (visualizationType === 'box') {
              const boxPlotData = prepareBoxPlotData(numericValues, column);
              
              return (
                <Paper key={index} sx={{ p: 4, mb: 4 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    {column} Distribution
                    <Tooltip title="Shows the distribution of values using quartiles. The box represents Q1 to Q3, the line inside is the median, whiskers show min/max, and dots are outliers.">
                      <IconButton size="small">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Typography>
                  <Box sx={{ 
                    height: 350, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    mt: 2 
                  }}>
                    <BoxPlot data={boxPlotData} width={900} height={320} />
                  </Box>
                </Paper>
              );
            }
            
            if (visualizationType === 'bar') {
              const distributionData = Object.entries(stats.frequencies || {})
                .map(([value, count]) => ({
                  value: Number(value),
                  count
                }))
                .sort((a, b) => a.value - b.value);
              
              return (
                <Paper key={index} sx={{ p: 4, mb: 4 }}>
                  <Typography variant="subtitle1" gutterBottom>{column} Distribution</Typography>
                  <Box sx={{ height: 450 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={distributionData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="value"
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            if (!value) return '';
                            return typeof value === 'string' && value.length > 20 
                              ? value.substring(0, 17) + '...' 
                              : value;
                          }}
                        />
                        <YAxis />
                        <RechartsTooltip
                          formatter={(value: any, name: any, props: any) => {
                            const displayName = props?.payload?.name;
                            if (!displayName) return [value, name];
                            return [
                              value,
                              typeof displayName === 'string' && displayName.length > 20 
                                ? displayName 
                                : name
                            ];
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="count"
                          fill="#8884d8"
                          name="Count"
                          label={{
                            position: 'top',
                            fontSize: 11,
                            fill: '#666',
                            formatter: (value: any) => {
                              if (!value) return '';
                              return value > 999 ? `${(value/1000).toFixed(1)}K` : value;
                            }
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              );
            }
          } else if (stats.type === 'categorical') {
            const categoryData = Object.entries(stats.frequencies || {})
              .map(([value, count]) => ({
                name: value,
                value: count
              }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 8);  // Show top 8 categories max
            
            if (visualizationType === 'simple') {
              return (
                <Paper key={index} sx={{ p: 4, mb: 4 }}>
                  <Typography variant="subtitle1" gutterBottom>{column} Distribution</Typography>
                  <Box sx={{ height: 450 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={categoryData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            if (!value) return '';
                            return typeof value === 'string' && value.length > 20 
                              ? value.substring(0, 17) + '...' 
                              : value;
                          }}
                        />
                        <YAxis />
                        <RechartsTooltip
                          formatter={(value: any, name: any, props: any) => {
                            const displayName = props?.payload?.name;
                            if (!displayName) return [value, name];
                            return [
                              value,
                              typeof displayName === 'string' && displayName.length > 20 
                                ? displayName 
                                : name
                            ];
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="value"
                          fill="#8884d8"
                          name="Count"
                          label={{
                            position: 'top',
                            fontSize: 11,
                            fill: '#666',
                            formatter: (value: any) => {
                              if (!value) return '';
                              return value > 999 ? `${(value/1000).toFixed(1)}K` : value;
                            }
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              );
            }
            
            if (visualizationType === 'pie') {
              return (
                <Paper key={index} sx={{ p: 4, mb: 4 }}>
                  <Typography variant="subtitle1" gutterBottom>{column} Distribution</Typography>
                  <Box sx={{ height: 450 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={160}
                          label={({ name, percent }) => {
                            if (!name) return '';
                            const displayName = typeof name === 'string' && name.length > 20 
                              ? name.substring(0, 17) + '...' 
                              : name;
                            return `${displayName} (${(percent * 100).toFixed(1)}%)`;
                          }}
                          labelLine={{ strokeWidth: 1, stroke: '#666', strokeDasharray: '2 2' }}
                        >
                          {categoryData.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: any, name: any) => {
                            if (!name) return [value, ''];
                            const displayName = typeof name === 'string' && name.length > 20 
                              ? name 
                              : name;
                            return [value, displayName];
                          }}
                        />
                        <Legend
                          formatter={(value: any) => {
                            if (!value) return '';
                            return typeof value === 'string' && value.length > 20 
                              ? value.substring(0, 17) + '...' 
                              : value;
                          }}
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          wrapperStyle={{
                            paddingLeft: '40px',
                            maxWidth: '30%',
                            overflowWrap: 'break-word'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              );
            }
            
            if (visualizationType === 'bar') {
              return (
                <Paper key={index} sx={{ p: 4, mb: 4 }}>
                  <Typography variant="subtitle1" gutterBottom>{column} Distribution</Typography>
                  <Box sx={{ height: 450 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={categoryData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            if (!value) return '';
                            return typeof value === 'string' && value.length > 20 
                              ? value.substring(0, 17) + '...' 
                              : value;
                          }}
                        />
                        <YAxis />
                        <RechartsTooltip
                          formatter={(value: any, name: any, props: any) => {
                            const displayName = props?.payload?.name;
                            if (!displayName) return [value, name];
                            return [
                              value,
                              typeof displayName === 'string' && displayName.length > 20 
                                ? displayName 
                                : name
                            ];
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="value"
                          fill="#8884d8"
                          name="Count"
                          label={{
                            position: 'top',
                            fontSize: 11,
                            fill: '#666',
                            formatter: (value: any) => {
                              if (!value) return '';
                              return value > 999 ? `${(value/1000).toFixed(1)}K` : value;
                            }
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              );
            }
          }
          return null;
        })}
      </Box>
    );
  };

  const renderCorrelationsTab = () => {
    if (!csvData) return null;

    const correlationResults = prepareCorrelationMatrix(
      csvData.data,
      csvData.columns,
      csvData.statistics,
      csvData.dependentMetrics[0]
    );
    
    const significantCorrelations = correlationResults.pairs
      .filter((corr: CorrelationPair) => Math.abs(corr.value) > 0.3);
    
    if (significantCorrelations.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No significant correlations found between numeric columns.
        </Alert>
      );
    }

    return (
      <Box>
        <Typography variant="h5" gutterBottom>Correlation Analysis</Typography>
        
        {csvData.dependentMetrics.length > 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Analyzing correlations with dependent metric: <strong>{csvData.dependentMetrics[0]}</strong>
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Correlation Heatmap
            <Tooltip title="Shows correlations between all numeric columns. Blue diagonal shows perfect self-correlation. Green shows positive correlations, red shows negative correlations. Intensity indicates correlation strength.">
              <IconButton size="small">
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Typography>
          <Box sx={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CorrelationHeatmap data={correlationResults.heatmap} width={600} height={400} />
          </Box>
        </Paper>

        <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
          Detailed Correlation Analysis
          <Tooltip title="Showing correlations stronger than ±0.3. Scatter plots help visualize the relationship between pairs of variables.">
            <IconButton size="small">
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Typography>

        <Grid container spacing={2}>
          {significantCorrelations.map((correlation, index) => {
            const sourceIndex = csvData.columns.indexOf(correlation.source);
            const targetIndex = csvData.columns.indexOf(correlation.target);
            
            const scatterData = csvData.data
              .map(row => ({
                x: Number(row[sourceIndex].value),
                y: Number(row[targetIndex].value)
              }))
              .filter(point => !isNaN(point.x) && !isNaN(point.y));
            
            return (
              <Grid item xs={12} md={6} key={index}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    {correlation.source} vs {correlation.target}
                    <Tooltip title={correlation.description}>
                      <IconButton size="small">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Typography>
                  <Typography variant="body2" color={
                    Math.abs(correlation.value) >= 0.7 ? 'success.main' :
                    Math.abs(correlation.value) >= 0.5 ? 'warning.main' : 'text.secondary'
                  }>
                    Correlation: {correlation.value.toFixed(3)}
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="x"
                        name={correlation.source}
                        type="number"
                        label={{ value: correlation.source, position: 'bottom' }}
                      />
                      <YAxis
                        dataKey="y"
                        name={correlation.target}
                        type="number"
                        label={{ value: correlation.target, angle: -90, position: 'left' }}
                      />
                      <RechartsTooltip
                        formatter={(value: any, name: any) => [value.toFixed(2), name]}
                      />
                      <Scatter
                        name={`${correlation.source} vs ${correlation.target}`}
                        data={scatterData}
                        fill={correlation.value > 0 ? '#4caf50' : '#f44336'}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };

  const renderDependentMetricSelection = () => (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Select Dependent Metric
      </Typography>
      <Typography color="text.secondary" gutterBottom>
        We couldn't find a dependent metric automatically.
        Please select the dependent metric column or enter it manually:
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
        <FormControl fullWidth>
          <InputLabel id="dependent-metric-label">Select from columns</InputLabel>
          <Select
            labelId="dependent-metric-label"
            value={selectedDependentMetric}
            onChange={handleDependentMetricSelect}
            label="Select from columns"
          >
            {csvData?.columns.map((column) => (
              <MenuItem key={column} value={column}>
                {column} ({csvData.statistics[column].type})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Typography align="center">OR</Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            label="Type column name"
            value={manualMetricInput}
            onChange={(e) => setManualMetricInput(e.target.value)}
            error={!!metricError}
            helperText={metricError}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleManualMetricSubmit();
              }
            }}
          />
          <Button
            variant="contained"
            onClick={handleManualMetricSubmit}
            disabled={!manualMetricInput}
          >
            Set
          </Button>
        </Box>
      </Box>
      
      {selectedDependentMetric && (
        <Typography color="success.main" sx={{ mt: 2 }}>
          ✓ Using "{selectedDependentMetric}" as the dependent metric
        </Typography>
      )}
    </Paper>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>CSV File Analyzer</Typography>
      
      <UploadArea
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <Typography variant="h6" gutterBottom>
          {file ? 'Selected file:' : 'Upload your CSV file'}
        </Typography>
        
        {file ? (
          <>
            <Typography color="primary" gutterBottom>
              {file.name}
            </Typography>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              sx={{ mb: 1 }}
            >
              Choose Different File
              <VisuallyHiddenInput
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
              />
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={processFile}
              disabled={isProcessing}
              startIcon={isProcessing ? <CircularProgress size={20} /> : <FileUploadIcon />}
            >
              {isProcessing ? 'Processing...' : 'Upload and Analyze'}
            </Button>
          </>
        ) : (
          <>
            <Typography color="text.secondary" gutterBottom>
              Drag and drop a CSV file here, or click the button below
            </Typography>
            <Button
              component="label"
              variant="contained"
              startIcon={<CloudUploadIcon />}
            >
              Select CSV File
              <VisuallyHiddenInput
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
              />
            </Button>
          </>
        )}
      </UploadArea>

      {csvData && (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
              <Tab label="Summary" />
              <Tab label="Statistics" />
              <Tab label="Distributions" />
              <Tab label="Correlations" />
              <Tab label="Power Analysis" />
              {/* Temporarily hidden Group Splitting tab */}
              {/* <Tab label="Group Splitting" /> */}
            </Tabs>
          </Box>

          <Box>
            {activeTab === 0 && renderSummaryTab()}
            {activeTab === 1 && renderStatisticsTab()}
            {activeTab === 2 && renderDistributionsTab()}
            {activeTab === 3 && renderCorrelationsTab()}
            {activeTab === 4 && <PowerAnalysis csvData={csvData} />}
            {/* Temporarily hidden Group Splitting rendering */}
            {/* {activeTab === 5 && <GroupSplitting csvData={csvData} />} */}
          </Box>
        </>
      )}
    </Container>
  );
}

export default App;
