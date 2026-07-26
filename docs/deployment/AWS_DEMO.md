# Universta AWS demo environment

This environment runs the three Phase 1 applications from one immutable
Git release on one dedicated EC2 instance. GitHub Actions validates every pull
request but deploys only an exact commit on `main`.

## Endpoints

| Service | URL |
| --- | --- |
| Public Web | `http://54.162.49.131` |
| Admin | `http://admin.54.162.49.131.nip.io` |
| API | `http://api.54.162.49.131.nip.io` |

The Elastic IP is stable. The `nip.io` Admin and API names resolve to that
same address so Nginx can route each host without exposing ports 3000, 3001,
or 4000.

There was no Route 53 hosted zone in AWS account `771413672221` at launch
time. The environment therefore uses the approved HTTP fallback. HTTPS remains
blocked until an owned domain or delegated hosted zone is available. Replace
these endpoints with owned Route 53 records and a trusted certificate before
using this environment for real personal data.

## AWS inventory

| Resource | Identifier |
| --- | --- |
| Region | `us-east-1` |
| EC2 instance | `i-0288a3283c26638b3` |
| Instance type | `t3.large` |
| Image | Ubuntu 24.04 x86_64 |
| Elastic IP | `54.162.49.131` |
| VPC | `vpc-098225f5d93724522` |
| Subnet | `subnet-0bcef43112bc39a13` |
| Security group | `sg-0f4ea6b3506f03595` |
| Artifact bucket | `universta-demo-artifacts-771413672221-us-east-1` |
| Runtime role | `universta-demo-ec2-role` |
| GitHub deploy role | `universta-demo-github-deploy-role` |
| GitHub environment | `demo` |

The security group accepts public TCP 80 and 443 only. There is no SSH rule.
The instance requires IMDSv2, has termination protection enabled, and is
managed through AWS Systems Manager.

The S3 bucket is private, encrypted, versioned, and public access is blocked.
Artifacts are stored below `releases/<exact-commit-sha>/` and tagged
`immutable=true`. The deployment job never replaces an existing SHA; a rerun
reuses its already-published artifact and checksum.

## Runtime layout

```text
/opt/universta/
├── current -> releases/<current-sha>
├── previous -> releases/<previous-sha>
├── releases/
│   └── <exact-sha>/
└── shared/
    ├── cache/
    ├── deploy/
    ├── env/
    ├── logs/
    └── deployment-history.log
```

The release directory is made read-only after installation. Next.js runtime
caches and all logs live under `shared`. `universta-api`,
`universta-web`, and `universta-admin` run as the unprivileged `universta`
system user. Nginx is the only public application listener.

MySQL runs on the same instance, listens only on `127.0.0.1`, and contains one
application database named `universta`. Prisma changes are applied only with
`prisma migrate deploy`; the deployment never uses `prisma db push`.

## Secrets and access

No AWS access keys or application secrets are stored in GitHub or this
repository. GitHub assumes the deployment role through the repository-scoped
OIDC trust for the `demo` environment. The instance reads runtime values from
SSM Parameter Store under `/universta/demo/`.

An authorized operator can retrieve the demo Admin identity when needed:

```bash
aws ssm get-parameter \
  --region us-east-1 \
  --name /universta/demo/admin/email \
  --with-decryption \
  --query Parameter.Value \
  --output text

aws ssm get-parameter \
  --region us-east-1 \
  --name /universta/demo/admin/password \
  --with-decryption \
  --query Parameter.Value \
  --output text
```

Do not copy those values into GitHub variables, source files, logs, tickets, or
documentation.

## Logs and retention

Application and Nginx logs are shipped by CloudWatch Agent to:

- `/universta/demo/api`
- `/universta/demo/web`
- `/universta/demo/admin`
- `/universta/demo/nginx`
- `/universta/demo/deploy`

CloudWatch retention is 30 days. Local application logs rotate daily and retain
14 rotations.
