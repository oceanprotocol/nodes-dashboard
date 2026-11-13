import { initBotId } from 'botid/client/core';

initBotId({
  protect: [
    { path: '/api/subsidy/details', method: 'POST' },
    { path: '/api/subsidy/resend-otp', method: 'POST' },
    { path: '/api/subsidy/verify', method: 'POST' },
    { path: '/api/subsidy/claim', method: 'POST' },
  ],
});
