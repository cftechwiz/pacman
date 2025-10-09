'use strict';

import SplunkOtelWeb from '@splunk/otel-web';

SplunkOtelWeb.init({
    realm: process.env.SPLUNK_REALM || '',
    rumAccessToken: process.env.SPLUNK_RUM_ACCESS_TOKEN || '',
    applicationName: process.env.SPLUNK_APPLICATION_NAME || 'pacman',
    version: process.env.SPLUNK_APPLICATION_VERSION || '0.0.1',
    deploymentEnvironment: process.env.SPLUNK_DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || 'production'
});
