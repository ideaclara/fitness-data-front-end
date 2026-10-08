import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { TelemetryStack } from './telemetry-stack';

export class AppDeploymentStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new TelemetryStack(this, 'WithingsTelemetryStack', {
      description: 'Production Data, API Gateway v2, and Amplify Hosting Stack',
    });
  }
}