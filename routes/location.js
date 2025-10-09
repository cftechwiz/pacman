var http = require('http');
var https = require('https');
var express = require('express');
var router = express.Router();
var fs = require('fs');
var os = require('os');
var baseLogger = require('../lib/logger');

var logger = baseLogger.child({ module: 'routes/location' });

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    logger.debug({ timestamp: new Date().toISOString(), method: req.method, url: req.originalUrl }, 'Incoming request');
    next();
});

router.get('/metadata', function(req, res) {
    logger.info('Handling GET /location/metadata');
    var h = getHost();
    getCloudMetadata(function(c, z) {
        logger.info({ cloud: c, zone: z, host: h }, 'Resolved cloud metadata');
        res.json({
            cloud: c,
            zone: z,
            host: h
        });
    });
});

function getCloudMetadata(callback) {
    logger.debug('getCloudMetadata');
    // Query k8s node api
    getK8sCloudMetadata(function(err, c, z) {
        if (err) {
            logger.debug({ err }, 'k8s metadata lookup failed, trying AWS');
            // Try AWS next
            getAWSCloudMetadata(function(err, c, z) {
                if (err) {
                    logger.debug({ err }, 'AWS metadata lookup failed, trying Azure');
                    // Try Azure next
                    getAzureCloudMetadata(function(err, c, z) {
                        if (err) {
                            logger.debug({ err }, 'Azure metadata lookup failed, trying GCP');
                            // Try GCP next
                            getGCPCloudMetadata(function(err, c, z) {
                                if (err) {
                                    logger.debug({ err }, 'GCP metadata lookup failed, trying OpenStack');
                                    // Try Openstack next
                                    getOpenStackCloudMetadata(function(err, c, z) {
                                        // Return result regardless of error
                                        callback(c, z); // Running in OpenStack or unknown
                                    });
                                } else {
                                    callback(c, z); // Running in GCP
                                }
                            });
                        } else {
                            callback(c, z); // Running in Azure
                        }
                    });
                } else {
                    callback(c, z); // Running in AWS
                }
            });
        } else {
            logger.debug('k8s metadata lookup succeeded');
            callback(c, z); // Running against k8s api
        }
    });
}

function getOpenStackCloudMetadata(callback) {
    logger.debug('getOpenStackCloudMetadata');
    // Set options to retrieve OpenStack zone for instance
    var osOptions = {
        hostname: '169.254.169.254',
        port: 80,
        path: '/openstack/latest/meta_data.json',
        method: 'GET',
        timeout: 10000,
    };

    var cloudName = 'unknown',
        zone = 'unknown';

    var req = http.request(osOptions, (metadataRes) => {
        let error;

        if (metadataRes.statusCode !== 200) {
            error = new Error(`Request Failed.\n` +
                `Status Code: ${metadataRes.statusCode}`);
        }

        if (error) {
            logger.error({ err: error, statusCode: metadataRes.statusCode }, 'OpenStack metadata request failed');
            // consume response data to free up memory
            metadataRes.resume();
            callback(error, cloudName, zone);
            return;
        }

        logger.debug({ statusCode: metadataRes.statusCode, headers: metadataRes.headers }, 'OpenStack metadata response received');
        metadataRes.setEncoding('utf8');

        var metaData;

        metadataRes.on('data', (chunk) => {
            logger.debug({ chunk }, 'OpenStack metadata chunk received');
            metaData = JSON.parse(chunk);
        });

        metadataRes.on('end', () => {
            logger.debug('OpenStack metadata response ended');
            cloudName = 'OpenStack'; // Request was successful
            zone = metaData.availability_zone;

            // use extra metadata to identify the cloud if available
            if (metaData.meta) {
                var clusterId = metaData.meta.clusterid;
                if (clusterId) {
                    cloudName += ' - ' + clusterId.split('.')[0];
                }
            }

            logger.info({ cloud: cloudName, zone: zone }, 'OpenStack cloud metadata resolved');

            // return CLOUD and ZONE data
            callback(null, cloudName, zone);
        });

    });

    req.on('error', (e) => {
        logger.error({ err: e }, 'Error requesting OpenStack metadata');
        // return CLOUD and ZONE data
        callback(e, cloudName, zone);
    });

    // End request
    req.end();
}

function getAWSCloudMetadata(callback) {
    logger.debug('getAWSCloudMetadata');
    // Set options to retrieve AWS zone for instance
    var awsOptions = {
        hostname: '169.254.169.254',
        port: 80,
        path: '/latest/meta-data/placement/availability-zone',
        method: 'GET',
        timeout: 10000,
    };

    var cloudName = 'unknown',
        zone = 'unknown';

    var req = http.request(awsOptions, (zoneRes) => {
        let error;

        if (zoneRes.statusCode !== 200) {
            error = new Error(`Request Failed.\n` +
                `Status Code: ${zoneRes.statusCode}`);
        }

        if (error) {
            logger.error({ err: error, statusCode: zoneRes.statusCode }, 'AWS metadata request failed');
            // consume response data to free up memory
            zoneRes.resume();
            callback(error, cloudName, zone);
            return;
        }

        logger.debug({ statusCode: zoneRes.statusCode, headers: zoneRes.headers }, 'AWS metadata response received');
        zoneRes.setEncoding('utf8');

        zoneRes.on('data', (chunk) => {
            logger.debug({ chunk }, 'AWS metadata chunk received');
            zone = chunk;
        });

        zoneRes.on('end', () => {
            logger.debug('AWS metadata response ended');
            cloudName = 'AWS'; // Request was successful

            // get the zone substring in uppercase
            var zoneSplit = zone.split('/');
            zone = zoneSplit[zoneSplit.length - 1].toLowerCase();
            logger.info({ cloud: cloudName, zone: zone }, 'AWS cloud metadata resolved');

            // return CLOUD and ZONE data
            callback(null, cloudName, zone);
        });

    });

    req.on('error', (e) => {
        logger.error({ err: e }, 'Error requesting AWS metadata');
        // return CLOUD and ZONE data
        callback(e, cloudName, zone);
    });

    // End request
    req.end();
}

function getAzureCloudMetadata(callback) {
    logger.debug('getAzureCloudMetadata');
    // Set options to retrieve Azure zone for instance
    var azureOptions = {
        hostname: '169.254.169.254',
        port: 80,
        path: '/metadata/instance/compute/location?api-version=2017-04-02&format=text',
        method: 'GET',
        timeout: 10000,
        headers: {
            'Metadata': 'true'
        }
    };

    var cloudName = 'unknown',
        zone = 'unknown';

    var req = http.request(azureOptions, (zoneRes) => {
        let error;

        if (zoneRes.statusCode !== 200) {
            error = new Error(`Request Failed.\n` +
                `Status Code: ${zoneRes.statusCode}`);
        }

        if (error) {
            logger.error({ err: error, statusCode: zoneRes.statusCode }, 'Azure metadata request failed');
            // consume response data to free up memory
            zoneRes.resume();
            callback(error, cloudName, zone);
            return;
        }

        logger.debug({ statusCode: zoneRes.statusCode, headers: zoneRes.headers }, 'Azure metadata response received');
        zoneRes.setEncoding('utf8');

        zoneRes.on('data', (chunk) => {
            logger.debug({ chunk }, 'Azure metadata chunk received');
            zone = chunk;
        });

        zoneRes.on('end', () => {
            logger.debug('Azure metadata response ended');
            cloudName = 'Azure'; // Request was successful

            // get the zone substring in uppercase
            var zoneSplit = zone.split('/');
            zone = zoneSplit[zoneSplit.length - 1].toLowerCase();
            logger.info({ cloud: cloudName, zone: zone }, 'Azure cloud metadata resolved');

            // return CLOUD and ZONE data
            callback(null, cloudName, zone);
        });

    });

    req.on('error', (e) => {
        logger.error({ err: e }, 'Error requesting Azure metadata');
        // return CLOUD and ZONE data
        callback(e, cloudName, zone);
    });

    // End request
    req.end();
}

function getGCPCloudMetadata(callback) {
    logger.debug('getGCPCloudMetadata');
    // Set options to retrieve GCE zone for instance
    var gcpOptions = {
        hostname: 'metadata.google.internal',
        port: 80,
        path: '/computeMetadata/v1/instance/zone',
        method: 'GET',
        timeout: 10000,
        headers: {
            'Metadata-Flavor': 'Google'
        }
    };

    var cloudName = 'unknown',
        zone = 'unknown';

    var req = http.request(gcpOptions, (zoneRes) => {
        let error;

        if (zoneRes.statusCode !== 200) {
            error = new Error(`Request Failed.\n` +
                `Status Code: ${zoneRes.statusCode}`);
        }

        if (error) {
            logger.error({ err: error, statusCode: zoneRes.statusCode }, 'GCP metadata request failed');
            // consume response data to free up memory
            zoneRes.resume();
            callback(error, cloudName, zone);
            return;
        }

        logger.debug({ statusCode: zoneRes.statusCode, headers: zoneRes.headers }, 'GCP metadata response received');
        zoneRes.setEncoding('utf8');

        zoneRes.on('data', (chunk) => {
            logger.debug({ chunk }, 'GCP metadata chunk received');
            zone = chunk;
        });

        zoneRes.on('end', () => {
            logger.debug('GCP metadata response ended');
            cloudName = 'GCP'; // Request was successful

            // get the zone substring in uppercase
            var zoneSplit = zone.split('/');
            zone = zoneSplit[zoneSplit.length - 1].toLowerCase();
            logger.info({ cloud: cloudName, zone: zone }, 'GCP cloud metadata resolved');

            // return CLOUD and ZONE data
            callback(null, cloudName, zone);
        });

    });

    req.on('error', (e) => {
        logger.error({ err: e }, 'Error requesting GCP metadata');
        // return CLOUD and ZONE data
        callback(e, cloudName, zone);
    });

    // End request
    req.end();
}

function getK8sCloudMetadata(callback) {
    logger.debug('getK8sCloudMetadata');
    // Set options to retrieve k8s api information
    var node_name = process.env.MY_NODE_NAME;
    logger.debug({ nodeName: node_name }, 'Querying node for cloud data');

    var sa_token;
    var ca_file;

    try {
        sa_token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
        ca_file = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
    } catch (err) {
        logger.error({ err }, 'Failed to read Kubernetes service account credentials');
    }

    var headers = {
        'Authorization': `Bearer ${sa_token}`
    };

    var genericOptions = {
        host: 'kubernetes.default.svc',
        port: 443,
        path: `/api/v1/nodes/${node_name}`,
        timeout: 10000,
        ca: ca_file,
        headers: headers,
    };

    var cloudName = 'unknown',
        zone = 'unknown';

    var req = https.request(genericOptions, (zoneRes) => {
        let error;

        if (zoneRes.statusCode !== 200) {
            error = new Error(`Request Failed.\n` +
                `Status Code: ${zoneRes.statusCode}`);
        }

        if (error) {
            logger.error({ err: error, statusCode: zoneRes.statusCode }, 'Kubernetes metadata request failed');
            // consume response data to free up memory
            zoneRes.resume();
            callback(error, cloudName, zone);
            return;
        }

        logger.debug({ statusCode: zoneRes.statusCode, headers: zoneRes.headers }, 'Kubernetes metadata response received');
        zoneRes.setEncoding('utf8');

        var body = [];

        zoneRes.on('data', (chunk) => {
            body.push(chunk);
        });
        zoneRes.on('end', () => {
            var metaData = JSON.parse(body.join(''));
            logger.debug({ metadata: metaData }, 'Kubernetes metadata parsed');
            logger.debug('Kubernetes metadata response ended');

            if (metaData.spec.providerID) {
                var provider = metaData.spec.providerID;
                cloudName = String(provider.split(":", 1)); // Split on providerID if request was successful
            }

            // use the annotation  to identify the zone if available
            if (metaData.metadata.labels['failure-domain.beta.kubernetes.io/zone']) {
                zone = metaData.metadata.labels['failure-domain.beta.kubernetes.io/zone'].toLowerCase();

            }
            // return CLOUD and ZONE data
            if (cloudName == "unknown") {
                error = new Error(`CloudName not found on node Spec`);
                logger.error({ err: error }, 'Cloud name not found on Kubernetes node spec');
                callback(error, cloudName, zone);
            }
            else {
                logger.info({ cloud: cloudName, zone: zone }, 'Kubernetes cloud metadata resolved');
                callback(null, cloudName, zone);
            }
        });

    });

    req.on('error', (e) => {
        logger.error({ err: e }, 'Error requesting Kubernetes metadata');
        // return CLOUD and ZONE data
        callback(e, cloudName, zone);
    });

    // End request
    req.end();
}

function getHost() {
    var host = os.hostname();
    logger.debug({ host: host }, 'Determined host name');
    return host;
}

module.exports = router;
