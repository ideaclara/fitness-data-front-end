import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class TelemetryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Reference Existing DynamoDB Table
    const telemetryTable = dynamodb.Table.fromTableName(
      this,
      'ImportedWithingsTelemetryTable',
      'WithingsTelemetry'
    );

    // 2. Read-optimized Python Lambda Query Function (ARM64 Graviton)
    const queryHandler = new lambda.Function(this, 'GetMeasuresHandler', {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../backend/functions/get_measures')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        TABLE_NAME: telemetryTable.tableName,
        DEFAULT_USER_ID: '31179536',
      },
    });

    telemetryTable.grantReadData(queryHandler);

    // 3. API Gateway HTTP API (v2) with strict CORS
    const httpApi = new apigwv2.HttpApi(this, 'WithingsTelemetryHttpApi', {
      apiName: 'withings-telemetry-api',
      corsPreflight: {
        allowHeaders: ['Authorization', 'Content-Type', 'X-Amz-Date'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.days(1),
      },
    });

    const lambdaIntegration = new apigwIntegrations.HttpLambdaIntegration(
      'GetMeasuresIntegration',
      queryHandler
    );

    httpApi.addRoutes({
      path: '/telemetry/measures',
      methods: [apigwv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // 4. AWS Amplify Hosting (L2 Alpha Construct)
    const githubToken = secretsmanager.Secret.fromSecretNameV2(
      this,
      'IdeaclaraGitHubPat',
      'ideaclara/github-pat'
    ).secretValue;

    const amplifyApp = new amplify.App(this, 'WithingsDashboardAmplify', {
      appName: 'withings-health-dashboard',
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: 'ideaclara',
        repository: 'fitness-data-front-end',
        oauthToken: githubToken,
      }),
      environmentVariables: {
        VITE_API_BASE_URL: httpApi.apiEndpoint,
        AMPLIFY_MONOREPO_APP_ROOT: 'frontend',
      },
    });

    const mainBranch = amplifyApp.addBranch('main', {
      autoBuild: true,
      stage: 'PRODUCTION',
    });

    new cdk.CfnOutput(this, 'HttpApiEndpoint', {
      value: httpApi.apiEndpoint,
      description: 'API Gateway HTTP API Base Endpoint',
    });

    new cdk.CfnOutput(this, 'AmplifyAppUrl', {
      value: `https://${mainBranch.branchName}.${amplifyApp.defaultDomain}`,
      description: 'Amplify Hosting Production URL',
    });
  }
}