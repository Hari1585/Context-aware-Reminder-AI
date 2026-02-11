import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  envName: string;
  apiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  cognitoDomain: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly distributionUrl: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { envName, apiUrl, userPoolId, userPoolClientId, cognitoDomain } = props;

    // S3 Bucket for static website
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `reminder-app-${envName}-frontend-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: envName !== 'prod',
      versioned: envName === 'prod',
      lifecycleRules: envName === 'prod' ? [
        {
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ] : undefined,
    });

    // CloudFront Origin Access Identity
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for reminder-app-${envName}`,
    });

    this.bucket.grantRead(oai);

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: envName === 'prod' 
        ? cloudfront.PriceClass.PRICE_CLASS_ALL 
        : cloudfront.PriceClass.PRICE_CLASS_100,
      enableLogging: envName === 'prod',
      comment: `reminder-app-${envName} frontend`,
    });

    this.distributionUrl = `https://${this.distribution.distributionDomainName}`;

    // Outputs
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.bucket.bucketName,
      description: 'S3 Bucket for frontend',
      exportName: `${envName}-FrontendBucketName`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `${envName}-DistributionId`,
    });

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: this.distributionUrl,
      description: 'CloudFront Distribution URL',
      exportName: `${envName}-DistributionUrl`,
    });

    new cdk.CfnOutput(this, 'FrontendConfig', {
      value: JSON.stringify({
        apiUrl,
        userPoolId,
        userPoolClientId,
        cognitoDomain,
        region: cdk.Stack.of(this).region,
      }),
      description: 'Frontend configuration (copy to .env.local)',
    });
  }
}
