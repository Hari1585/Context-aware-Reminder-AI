import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  envName: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly cognitoDomain: string;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { envName } = props;

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `reminder-app-${envName}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
    });

    // Cognito Domain for Hosted UI
    const domainPrefix = `reminder-app-${envName}-${cdk.Stack.of(this).account.substring(0, 8)}`;
    const userPoolDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix,
      },
    });

    this.cognitoDomain = `${domainPrefix}.auth.${cdk.Stack.of(this).region}.amazoncognito.com`;

    // User Pool Client (for web app)
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `reminder-app-${envName}-web`,
      generateSecret: false, // Public client (SPA)
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: false,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:3000/callback',
          // CloudFront URL will be added via SSM parameter after frontend stack deploys
          // For now, user must manually add it in Console or via CLI
        ],
        logoutUrls: [
          'http://localhost:3000',
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${envName}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${envName}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: this.cognitoDomain,
      description: 'Cognito Hosted UI Domain',
      exportName: `${envName}-CognitoDomain`,
    });

    new cdk.CfnOutput(this, 'CognitoHostedUIUrl', {
      value: `https://${this.cognitoDomain}/login?client_id=${this.userPoolClient.userPoolClientId}&response_type=code&redirect_uri=http://localhost:3000/callback`,
      description: 'Cognito Hosted UI Login URL (update redirect_uri for prod)',
    });
  }
}
