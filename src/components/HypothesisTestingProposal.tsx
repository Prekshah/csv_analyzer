import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Grid,
  Divider,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { styled } from '@mui/material/styles';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import { saveAs } from 'file-saver';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  margin: theme.spacing(2),
  backgroundColor: '#fff',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  marginBottom: theme.spacing(2),
  marginTop: theme.spacing(2),
}));

interface ProposalData {
  title: string;
  architects: string;
  date: string;
  businessProblem: string;
  whyThisMatters: string;
  quantifyImpact: string;
  potentialBenefit: string;
  previousWork: string;
  researchQuestion: string;
  nullHypothesis: string;
  alternativeHypothesis: string;
  studyType: string;
  targetPopulation: string;
  samplingStrategy: string;
  eda: string;
  mde: string;
  power: string;
  significanceLevel: string;
  variance: string;
  sampleSize: string;
  expectedDate: string;
  primaryMetrics: string;
  secondaryMetrics: string;
  guardrailMetrics: string;
  potentialRisks: string;
  sanityChecks: string;
  statisticalTests: string;
  segments: string;
  fwerCorrection: string;
  comments: string;
}

interface HypothesisTestingProposalProps {
  calculatedSampleSize: string;
  calculatedVariance: string;
}

const HypothesisTestingProposal: React.FC<HypothesisTestingProposalProps> = ({ 
  calculatedSampleSize,
  calculatedVariance
}) => {
  const [proposalData, setProposalData] = useState<ProposalData>({
    title: '',
    architects: '',
    date: new Date().toISOString().split('T')[0],
    businessProblem: '',
    whyThisMatters: '',
    quantifyImpact: '',
    potentialBenefit: '',
    previousWork: '',
    researchQuestion: '',
    nullHypothesis: '',
    alternativeHypothesis: '',
    studyType: '',
    targetPopulation: '',
    samplingStrategy: '',
    eda: '',
    mde: '0.1', // Pre-filled from Power Analysis
    power: '0.8', // Pre-filled from Power Analysis
    significanceLevel: '0.05', // Pre-filled
    variance: '', // To be filled from CSV Summary
    sampleSize: '', // Calculated from Power Analysis
    expectedDate: '',
    primaryMetrics: '',
    secondaryMetrics: '',
    guardrailMetrics: '',
    potentialRisks: '',
    sanityChecks: '',
    statisticalTests: '',
    segments: '',
    fwerCorrection: 'Bonferroni Correction',
    comments: '',
  });

  const [openDialog, setOpenDialog] = useState(false);
  const [emptyFields, setEmptyFields] = useState<string[]>([]);

  // Auto-save functionality
  useEffect(() => {
    const savedData = localStorage.getItem('hypothesisProposalData');
    if (savedData) {
      setProposalData(JSON.parse(savedData));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('hypothesisProposalData', JSON.stringify(proposalData));
  }, [proposalData]);

  // Update sample size when calculatedSampleSize changes
  useEffect(() => {
    if (calculatedSampleSize) {
      setProposalData(prev => ({
        ...prev,
        sampleSize: calculatedSampleSize
      }));
    }
  }, [calculatedSampleSize]);

  // Update variance when calculatedVariance changes
  useEffect(() => {
    if (calculatedVariance) {
      setProposalData(prev => ({
        ...prev,
        variance: calculatedVariance
      }));
    }
  }, [calculatedVariance]);

  const handleChange = (field: keyof ProposalData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent
  ) => {
    setProposalData({
      ...proposalData,
      [field]: event.target.value,
    });
  };

  const handleExportConfirmation = () => {
    // Check for empty fields
    const empty = Object.entries(proposalData).reduce((acc: string[], [key, value]) => {
      if (!value || value.trim() === '') {
        // Convert camelCase to Title Case for display
        const fieldName = key.replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        acc.push(fieldName);
      }
      return acc;
    }, []);

    if (empty.length > 0) {
      setEmptyFields(empty);
      setOpenDialog(true);
    } else {
      // If no empty fields, export directly
      performExport();
    }
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
  };

  const performExport = () => {
    // Create sections for the Word document
    const sections = [
      {
        title: 'Hypothesis Testing Proposal',
        content: [
          { label: 'Experiment/Analysis Title', value: proposalData.title },
          { label: 'Experiment Architects', value: proposalData.architects },
          { label: 'Date', value: proposalData.date }
        ]
      },
      {
        title: '1. Business Context',
        content: [
          { label: 'Business Problem', value: proposalData.businessProblem },
          { label: 'Why This Matters', value: proposalData.whyThisMatters },
          { label: 'Quantify the Impact', value: proposalData.quantifyImpact },
          { label: 'Potential Benefit', value: proposalData.potentialBenefit },
          { label: 'Previous Work/Findings', value: proposalData.previousWork }
        ]
      },
      {
        title: '2. Research Question and Hypotheses',
        content: [
          { label: 'Research Question', value: proposalData.researchQuestion },
          { label: 'Null Hypothesis (H0)', value: proposalData.nullHypothesis },
          { label: 'Alternative Hypothesis (H1)', value: proposalData.alternativeHypothesis }
        ]
      },
      {
        title: '3. Study Design',
        content: [
          { label: 'Type of Study', value: proposalData.studyType },
          { label: 'Target Population', value: proposalData.targetPopulation },
          { label: 'Sampling Strategy', value: proposalData.samplingStrategy },
          { label: 'Exploratory Data Analysis (EDA)', value: proposalData.eda }
        ]
      },
      {
        title: '4. Sample Size and Power Analysis',
        content: [
          { label: 'Minimum Detectable Effect (MDE)', value: proposalData.mde },
          { label: 'Statistical Power', value: proposalData.power },
          { label: 'Significance Level (α)', value: proposalData.significanceLevel },
          { label: 'Variance', value: proposalData.variance },
          { label: 'Total Required Sample Size', value: proposalData.sampleSize },
          { label: 'Expected Date to Reach Sample Size', value: proposalData.expectedDate }
        ]
      },
      {
        title: '5. Statistical Analysis Plan',
        content: [
          { label: 'Primary Metric(s)', value: proposalData.primaryMetrics },
          { label: 'Secondary Metric(s)', value: proposalData.secondaryMetrics },
          { label: 'Guardrail Metric(s)', value: proposalData.guardrailMetrics },
          { label: 'Sanity Check Metric(s)', value: proposalData.sanityChecks },
          { label: 'Statistical Test(s)', value: proposalData.statisticalTests },
          { label: 'Potential Risks', value: proposalData.potentialRisks }
        ]
      },
      {
        title: '6. Segmentation and Multiple Comparisons',
        content: [
          { label: 'Potential Segments', value: proposalData.segments },
          { label: 'FWER Correction Method', value: proposalData.fwerCorrection }
        ]
      },
      {
        title: '7. Review and Additional Considerations',
        content: [
          { label: 'Comments/Changes', value: proposalData.comments }
        ]
      }
    ];

    // Create the document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: "Hypothesis Testing Proposal",
            heading: HeadingLevel.TITLE,
            spacing: {
              after: 400
            }
          }),
          
          // Generate content for each section
          ...sections.flatMap(section => [
            // Section Title
            new Paragraph({
              text: section.title,
              heading: HeadingLevel.HEADING_1,
              spacing: {
                before: 400,
                after: 200
              }
            }),
            
            // Section Content
            ...section.content.map(item => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${item.label}: `,
                    bold: true
                  }),
                  new TextRun({
                    text: item.value || 'Not specified',
                    bold: false
                  })
                ],
                spacing: {
                  before: 200,
                  after: 200
                }
              })
            ]).flat()
          ]).flat()
        ]
      }]
    });

    // Generate and save the document
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, 'hypothesis-testing-proposal.docx');
      setOpenDialog(false);
    });
  };

  return (
    <Box sx={{ maxWidth: '1200px', margin: 'auto', padding: 2 }}>
      <Typography variant="h4" gutterBottom>
        Hypothesis Testing Proposal
      </Typography>

      <StyledPaper>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Experiment/Analysis Title"
              value={proposalData.title}
              onChange={handleChange('title')}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Experiment Architects"
              value={proposalData.architects}
              onChange={handleChange('architects')}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="date"
              label="Date"
              value={proposalData.date}
              onChange={handleChange('date')}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">1. Business Context</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Business Problem"
              value={proposalData.businessProblem}
              onChange={handleChange('businessProblem')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Why This Matters"
              value={proposalData.whyThisMatters}
              onChange={handleChange('whyThisMatters')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Quantify the Impact"
              value={proposalData.quantifyImpact}
              onChange={handleChange('quantifyImpact')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Potential Benefit"
              value={proposalData.potentialBenefit}
              onChange={handleChange('potentialBenefit')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Previous Work/Findings"
              value={proposalData.previousWork}
              onChange={handleChange('previousWork')}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">2. Research Question and Hypotheses</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Research Question"
              value={proposalData.researchQuestion}
              onChange={handleChange('researchQuestion')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Null Hypothesis (H0)"
              value={proposalData.nullHypothesis}
              onChange={handleChange('nullHypothesis')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Alternative Hypothesis (H1)"
              value={proposalData.alternativeHypothesis}
              onChange={handleChange('alternativeHypothesis')}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">3. Study Design</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Type of Study</InputLabel>
              <Select
                value={proposalData.studyType}
                onChange={handleChange('studyType')}
                label="Type of Study"
              >
                <MenuItem value="A/B Test">A/B Test</MenuItem>
                <MenuItem value="MAB">Multi-Armed Bandit (MAB)</MenuItem>
                <MenuItem value="Factorial">Factorial Test</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Target Population"
              value={proposalData.targetPopulation}
              onChange={handleChange('targetPopulation')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Sampling Strategy"
              value={proposalData.samplingStrategy}
              onChange={handleChange('samplingStrategy')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Exploratory Data Analysis (EDA)"
              value={proposalData.eda}
              onChange={handleChange('eda')}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">4. Sample Size and Power Analysis</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Minimum Detectable Effect (MDE)"
              value={proposalData.mde}
              onChange={handleChange('mde')}
              type="number"
              inputProps={{ step: 0.01 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Statistical Power"
              value={proposalData.power}
              onChange={handleChange('power')}
              type="number"
              inputProps={{ step: 0.01 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Significance Level (α)"
              value={proposalData.significanceLevel}
              onChange={handleChange('significanceLevel')}
              type="number"
              inputProps={{ step: 0.01 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Variance"
              value={proposalData.variance}
              onChange={handleChange('variance')}
              type="number"
              inputProps={{ step: 0.01 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                fullWidth
                label="Total Required Sample Size"
                value={proposalData.sampleSize}
                onChange={handleChange('sampleSize')}
                type="number"
              />
              <Tooltip title="This is the total sample size needed for all group comparisons to achieve the desired statistical power. It accounts for the allocation ratios and multiple testing corrections.">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="date"
              label="Expected Date to Reach Sample Size"
              value={proposalData.expectedDate}
              onChange={handleChange('expectedDate')}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">5. Statistical Analysis Plan</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Primary Metric(s)"
              value={proposalData.primaryMetrics}
              onChange={handleChange('primaryMetrics')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Secondary Metric(s)"
              value={proposalData.secondaryMetrics}
              onChange={handleChange('secondaryMetrics')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Guardrail Metric(s)"
              value={proposalData.guardrailMetrics}
              onChange={handleChange('guardrailMetrics')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Sanity Check Metric(s)"
              value={proposalData.sanityChecks}
              onChange={handleChange('sanityChecks')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Statistical Test(s)"
              value={proposalData.statisticalTests}
              onChange={handleChange('statisticalTests')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Potential Risks"
              value={proposalData.potentialRisks}
              onChange={handleChange('potentialRisks')}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">6. Segmentation and Multiple Comparisons</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Potential Segments"
              value={proposalData.segments}
              onChange={handleChange('segments')}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>FWER Correction Method</InputLabel>
              <Select
                value={proposalData.fwerCorrection}
                onChange={handleChange('fwerCorrection')}
                label="FWER Correction Method"
              >
                <MenuItem value="Bonferroni Correction">Bonferroni Correction</MenuItem>
                <MenuItem value="FDR">False Discovery Rate (FDR)</MenuItem>
                <MenuItem value="None">None</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">7. Review and Additional Considerations</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Comments/Changes"
              value={proposalData.comments}
              onChange={handleChange('comments')}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <Box sx={{ mt: 3, mb: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleExportConfirmation}
          size="large"
        >
          Export Proposal
        </Button>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleDialogClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Incomplete Fields Detected"}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            The following fields are empty:
          </Alert>
          <DialogContentText id="alert-dialog-description">
            <ul>
              {emptyFields.map((field, index) => (
                <li key={index}>{field}</li>
              ))}
            </ul>
            Would you like to export the proposal anyway?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary">
            Cancel
          </Button>
          <Button onClick={performExport} color="primary" autoFocus>
            Export Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HypothesisTestingProposal; 