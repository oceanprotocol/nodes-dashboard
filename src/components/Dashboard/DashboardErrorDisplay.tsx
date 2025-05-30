import React from 'react'
import { Alert, Box } from '@mui/material'

interface DashboardErrorDisplayProps {
  message?: string
  error?: Error | null
}

const DashboardErrorDisplay: React.FC<DashboardErrorDisplayProps> = ({
  message,
  error
}) => {
  const errorMessage = message || error?.message || 'Something went wrong'

  return (
    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
      <Alert
        severity="error"
        sx={{
          width: '100%',
          maxWidth: '500px',
          '& .MuiAlert-icon': {
            color: '#e000cf'
          }
        }}
      >
        Error loading dashboard data: {errorMessage}
      </Alert>
    </Box>
  )
}

export default DashboardErrorDisplay
