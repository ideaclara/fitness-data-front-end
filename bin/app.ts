#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

new PipelineStack(app, 'WithingsPipelineStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'eu-west-2',
  },
  description: 'Self-mutating CI/CD Pipeline for Withings Telemetry Dashboard',
});

app.synth();