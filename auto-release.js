const shell = require('shelljs');
const { branchName } = require('./scripts/utils/branch-name');
const isCanaryRelease = branchName === 'master';
const isFullRelease = branchName === 'release-2.x';
const { normalizeUrlAlias } = require('./scripts/utils/normalize-url-alias');
const { gitSha } = require('./scripts/utils');
const execSync = require('child_process').execSync;
const { spawn } = require('child_process');
const { getLatestDeploy } = require('./scripts/utils');
const { IncomingWebhook } = require('@slack/webhook');
const chalk = require('chalk');
const semver = require('semver');

const lernaConfig = require('./lerna.json');
const currentVersion = lernaConfig.version;

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SLACK_WEBPACK_URL_CANARY = process.env.SLACK_WEBPACK_URL_CANARY;

// figure out what a canary release version would be
const canaryVersion = `.${process.env.TRAVIS_PULL_REQUEST_SHA ||
  process.env.TRAVIS_JOB_NUMBER ||
  gitSha}`;

// force color output in CLI
// @ts-ignore
process.env.FORCE_COLOR = true;

async function getLernaPackages() {
  const packages = shell.exec('npx lerna ls -pl', {
    silent: true,
  }).stdout;
  const formattedPackages = [];
  packages.split('\n').map(packageInfo => {
    const [packagePath, name, version] = packageInfo.split(':');

    if (packagePath && version) {
      formattedPackages.push({ path: packagePath, name, version });
    }
  });

  return formattedPackages;
}

async function init() {
  if (isCanaryRelease) {
    try {
      const version = shell
        .exec('auto version', { silent: true })
        .stdout.trim();

      shell.exec(
        `npx lerna publish pre${version} --dist-tag canary --preid canary${canaryVersion} --no-git-reset --no-git-tag-version --exact --ignore-scripts --no-push --yes -m "[skip travis] chore(release): pre-release %s"`,
        { async: true },
        (code, stdout, stderr) => {
          console.log('', stdout);
          console.log('', stderr);
        },
      );

      console.log(
        'Canary release successfully published to NPM. Doing a fresh build + deploying to now.sh.',
      );

      const packages = await getLernaPackages();
      const versioned = packages.find(p => p.version.includes('canary'));
      if (!versioned) {
        console.log(
          'No packages were changed so no canary version was published.',
        );
      }

      // get the version we just published
      const canaryReleaseVersion = `v${versioned.version.split('+')[0].trim()}`; // ex. 2.9.0-canary.6b70020b5.0

      const branchSpecificUrl = await normalizeUrlAlias(branchName);
      const tagSpecificUrl = await normalizeUrlAlias(canaryReleaseVersion);

      const nowAliases = [];
      nowAliases.push(branchSpecificUrl);
      nowAliases.push(await normalizeUrlAlias('canary'));
      nowAliases.push(tagSpecificUrl);

      await shell.exec(`
        git reset --hard HEAD
        npx json -I -f docs-site/.incache -e 'this["bolt-tags"].expiresOn = "2019-06-14T12:30:26.377Z"'
        npx json -I -f docs-site/.incache -e 'this["bolt-urls-to-test"].expiresOn = "2019-06-14T12:30:26.377Z"'
        npx now alias boltdesignsystem.com ${tagSpecificUrl}
      `);

      // do the full build + output CLI in real time
      shell.exec('npm run build', { async: true }, (code, stdout, stderr) => {
        console.log('Exit code:', code);
        console.log('', stdout);
        console.log('', stderr);
      });
      shell.exec(
        `npx now deploy --meta gitSha='${gitSha}' --token=${process.env.NOW_TOKEN}`,
      );

      const latestUrl = await getLatestDeploy();

      nowAliases.forEach(alias => {
        shell.exec(`npx now alias ${latestUrl} ${alias}`);
      });

      await shell.exec('git reset --hard HEAD').stdout;

      if (SLACK_WEBPACK_URL_CANARY) {
        const webhook = new IncomingWebhook(SLACK_WEBPACK_URL_CANARY);
        await webhook.send({
          text: `Bolt canary release, *${canaryReleaseVersion}*, has successfully published!
           - <https://canary.boltdesignsystem.com|Shared Canary URL>
           - <${tagSpecificUrl}|Unique Canary URL>`,
        });
      } else {
        console.log(
          chalk.yellow(
            'Skipped sending Slack notification about upcoming Canary release -- missing `SLACK_WEBPACK_URL_CANARY` env variable!',
          ),
        );
      }
    } catch (error) {
      console.error(error);
    }
  } else if (isFullRelease) {
    try {
      const version = shell
        .exec('auto version', { silent: true })
        .stdout.trim();

      const nextVersion = semver.inc(currentVersion, version);

      shell.exec(`
        node scripts/release/update-php-package-versions.js -v ${nextVersion}
        git add packages/core-php/composer.json packages/drupal-modules/bolt_connect/bolt_connect.info.yml packages/drupal-modules/bolt_connect/composer.json
        git commit -m "[skip travis] chore: version bump PHP-related dependencies to v${nextVersion}"
      `);

      shell.exec(
        `npx lerna publish ${nextVersion} --yes -m "[skip travis] chore(release): release %s"`,
        { async: true },
        (code, stdout, stderr) => {
          console.log('', stdout);
          console.log('', stderr);
        },
      );

      console.log(
        'Bolt release successfully published to NPM. Doing a fresh build + deploying to now.sh.',
      );

      // get the version we just published
      const releaseVersion = `v${nextVersion}`; // ex. v2.9.0

      const branchSpecificUrl = await normalizeUrlAlias(branchName);
      const tagSpecificUrl = await normalizeUrlAlias(releaseVersion);

      const nowAliases = [];
      nowAliases.push(branchSpecificUrl);
      nowAliases.push(tagSpecificUrl);
      nowAliases.push('www.boltdesignsystem.com');
      nowAliases.push('boltdesignsystem.com');
      nowAliases.push('www.bolt-design-system.com');
      nowAliases.push('bolt-design-system.com');
      nowAliases.push(await normalizeUrlAlias('latest'));

      await shell.exec(`
        git reset --hard HEAD
        npx json -I -f docs-site/.incache -e 'this["bolt-tags"].expiresOn = "2019-06-14T12:30:26.377Z"'
        npx json -I -f docs-site/.incache -e 'this["bolt-urls-to-test"].expiresOn = "2019-06-14T12:30:26.377Z"'
        npx now alias boltdesignsystem.com ${tagSpecificUrl}
      `);

      // do the full build + output CLI in real time
      shell.exec('npm run build', { async: true }, (code, stdout, stderr) => {
        console.log('Exit code:', code);
        console.log('', stdout);
        console.log('', stderr);
      });

      shell.exec(
        `npx now deploy --meta gitSha='${gitSha}' --token=${process.env.NOW_TOKEN}`,
      );

      const latestUrl = await getLatestDeploy();

      nowAliases.forEach(alias => {
        shell.exec(`npx now alias ${latestUrl} ${alias}`);
      });

      await shell.exec(`
        git add docs-site/.incache
        git commit -m "[skip travis] chore: update .incache file"
        git tag -fa ${releaseVersion} -m ${releaseVersion}
        git push --no-verify
        git push origin ${releaseVersion} --no-verify --force
      `);
      await shell.exec('git reset --hard HEAD').stdout;

      if (SLACK_WEBHOOK_URL) {
        const webhook = new IncomingWebhook(SLACK_WEBHOOK_URL);
        await webhook.send({
          text: `Bolt \`${releaseVersion}\` has been released! Check out the <https://github.com/boltdesignsystem/bolt/releases/tag/${releaseVersion}|latest release notes> for more details!
           - <https://boltdesignsystem.com|Updated Docs Site>`,
        });
      } else {
        console.log(
          chalk.yellow(
            'Skipped sending Slack notification about upcoming Bolt release -- missing `SLACK_WEBPACK_URL` env variable!',
          ),
        );
      }

      await shell.exec(`
        git fetch origin master
        git checkout master
        git pull
        git merge release/2.x
        git push
      `);
    } catch (error) {
      console.error(error);
    }
  } else {
    console.log(
      `Skipping doing an auto-release since the current branch, ${branchName}, isn't master or a release branch!`,
    );
  }
}
init();