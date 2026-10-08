#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

new PipelineStack(app, 'WithingsPipelineStack', {
  env: {
    account: '022074716478',
    region: 'eu-west-2',
  },
  description: 'Self-mutating CI/CD Pipeline for Withings Telemetry Delivery',
});

app.synth();