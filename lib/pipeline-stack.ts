import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { AppDeploymentStage } from './app-stage';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CodeConnections/CodeStar ARN exported or imported from SSM
    const githubConnectionArn = cdk.Fn.importValue('WithingsGithubConnectionArn');

    const pipeline = new pipelines.CodePipeline(this, 'WithingsPipeline', {
      pipelineName: 'Withings-Telemetry-Delivery-Pipeline',
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.connection('ideaclara/withings-data-on-aws', 'main', {
          connectionArn: githubConnectionArn,
        }),
        commands: [
          'npm ci',
          'npx cdk synth',
        ],
      }),
      selfMutation: true,
      dockerEnabledForSynth: false,
    });

    pipeline.addStage(new AppDeploymentStage(this, 'Prod', {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: 'eu-west-2',
      },
    }));
  }
}