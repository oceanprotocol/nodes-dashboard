import { FC } from 'react';
import { Card, CardContent, Grid, IconButton, Typography, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { NodeData } from '../../shared/types/RowDataType';
import { formatPlatform, formatSupportedStorage, formatUptime } from './utils'

interface NodeDetailsProps {
  nodeData: NodeData;
  onClose: () => void;
}

const NodeDetails: FC<NodeDetailsProps> = ({ nodeData, onClose }) => {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        bgcolor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
    >
      <Card
        sx={{
          width: '90%',
          maxWidth: 800,
          fontFamily: "'Sharp Sans', sans-serif"
        }}
      >
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: "'Sharp Sans', sans-serif"
            }}
          >
            <Typography
              variant="h5"
              gutterBottom
              sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
            >
              Node Details
            </Typography>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Node ID:</strong> {nodeData.id}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Address:</strong> {nodeData.address}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Network:</strong>{' '}
                {nodeData.indexer?.map((idx) => idx.network).join(', ')}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>DNS / IP:</strong> {nodeData.ipAndDns?.dns || ''} /{' '}
                {nodeData.ipAndDns?.ip || ''}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Port:</strong> {nodeData.ipAndDns?.port || ''}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Location:</strong>{' '}
                {`${nodeData.location?.city || ''} ${nodeData.location?.country || ''}`}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Eligible Week Uptime:</strong> {formatUptime(nodeData.uptime)}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Supported Storage:</strong>{' '}
                {formatSupportedStorage(nodeData.supportedStorage)}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Platform:</strong> {formatPlatform(nodeData.platform)}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Public Key:</strong> {nodeData.publicKey}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Version:</strong> {nodeData.version}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Code Hash:</strong> {nodeData.codeHash}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Allowed Admins:</strong> {nodeData.allowedAdmins?.join(', ')}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Last Check:</strong>{' '}
                {new Date(nodeData.lastCheck)?.toLocaleString(undefined, {
                  timeZoneName: 'short'
                })}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Last Round Eligibility Check:</strong>{' '}
                {nodeData?.eligible?.toLocaleString()}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: "'Sharp Sans', sans-serif" }}
              >
                <strong>Eligiblity Issue:</strong>{' '}
                {nodeData.eligibilityCauseStr?.toLocaleString()}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  )
};

export default NodeDetails;
