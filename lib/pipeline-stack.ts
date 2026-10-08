import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { AppDeploymentStage } from './app-stage';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const githubConnectionArn = ssm.StringParameter.valueFromLookup(
      this,
      '/ideaclara/cicd/github-connection-arn'
    );

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
        account: '022074716478',
        region: 'eu-west-2',
      },
    }));
  }
}