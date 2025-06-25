import React, { useState, useEffect } from 'react';
import { Button, TextField, Box, Typography, Paper } from '@mui/material';

const BroadcastTest: React.FC = () => {
  const [message, setMessage] = useState('');
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [channel, setChannel] = useState<BroadcastChannel | null>(null);

  useEffect(() => {
    const bc = new BroadcastChannel('test-channel');
    
    bc.onmessage = (event) => {
      setReceivedMessages(prev => [...prev, `${new Date().toLocaleTimeString()}: ${event.data.message}`]);
    };

    setChannel(bc);

    return () => {
      bc.close();
    };
  }, []);

  const sendMessage = () => {
    if (channel && message.trim()) {
      channel.postMessage({ message: message.trim(), timestamp: Date.now() });
      setMessage('');
    }
  };

  const clearMessages = () => {
    setReceivedMessages([]);
  };

  return (
    <Paper sx={{ p: 3, m: 2 }}>
      <Typography variant="h6" gutterBottom>
        BroadcastChannel Test
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Test Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          sx={{ mb: 1 }}
        />
        <Button variant="contained" onClick={sendMessage} disabled={!message.trim()}>
          Send Message
        </Button>
        <Button variant="outlined" onClick={clearMessages} sx={{ ml: 1 }}>
          Clear Messages
        </Button>
      </Box>

      <Typography variant="subtitle1" gutterBottom>
        Received Messages:
      </Typography>
      <Box sx={{ 
        minHeight: 100, 
        maxHeight: 200, 
        overflow: 'auto', 
        border: '1px solid #ccc', 
        p: 1,
        bgcolor: '#f5f5f5'
      }}>
        {receivedMessages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No messages received yet. Open this page in multiple tabs and send messages to test.
          </Typography>
        ) : (
          receivedMessages.map((msg, index) => (
            <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
              {msg}
            </Typography>
          ))
        )}
      </Box>

      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
        Open this page in multiple browser tabs to test cross-tab communication.
      </Typography>
    </Paper>
  );
};

export default BroadcastTest; 