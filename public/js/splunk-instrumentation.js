import SplunkOtelWeb from '@splunk/otel-web';

SplunkOtelWeb.init({
  realm: '<realm>',
  rumAccessToken: '<your_rum_token>',
  applicationName: '<your_application_name>',
  version: '<your_app_version>',
  deploymentEnvironment: '<your_environment_name>'
});
