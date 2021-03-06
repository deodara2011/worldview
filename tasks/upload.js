#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yargs = require('yargs');
const NodeSSH = require('node-ssh');
const ssh = new NodeSSH();

const error = (msg) => {
  const prog = path.basename(__filename);
  console.error(`${prog}: error: ${msg}`);
  process.exit(1);
};

var argv = yargs
  .usage('$0 [options] <name>')
  .option('d', {
    alias: 'dist',
    description: 'do not build, use artifacts found in dist directory',
    type: 'boolean'
  })
  .option('e', {
    alias: 'env',
    description: 'configuration environment if not "release"',
    requiresArg: true,
    type: 'string'
  })
  .option('h', {
    alias: 'host',
    description: 'upload to this host',
    requiresArg: true,
    type: 'string'
  })
  .option('k', {
    alias: 'key',
    description: 'path to private ssh key',
    requiresArg: true,
    type: 'string'
  })
  .option('r', {
    alias: 'root',
    description: 'extract application to this directory',
    requiresArg: true,
    type: 'string'
  })
  .option('u', {
    alias: 'user',
    description: 'login to remote host using this user name',
    requiresArg: true,
    type: 'string'
  })
  .epilog(`
Defaults for "host", "key", "root", and "user" should be placed in a JSON
file found at "${os.homedir()}/.worldview/upload.config".

Values on the command line override those found in the configuration file.

If "host" or "root" is not found in the configuration file, it must
appear on the command line.`)
  .argv;

if (argv.help) {
  yargs.showHelp();
  process.exit(0);
}

const baseDir = path.join(__dirname, '..');
const distDir = path.join(baseDir, 'dist');
const worldview = 'site-worldview-debug.tar.bz2';
const distWorldview = path.join(distDir, worldview);
const configFile = path.join(os.homedir(), '.worldview', 'upload.config');

let configData = '{}';
try {
  configData = fs.readFileSync(configFile);
} catch (err) {
  // okay if config file cannot be read
}

let config = {};
try {
  config = JSON.parse(configData);
} catch (err) {
  error(`${configFile}:\n${err}`);
}

const host = argv.host || config.host;
const root = argv.root || config.root;
const username = argv.user || config.user || os.userInfo().username;
const key = argv.key || config.key || path.join(os.homedir(), '.ssh', 'id_rsa');

if (!host) {
  error('host not found in config file or command line');
}
if (!root) {
  error('root not found in config file or command line');
}
if (!username) {
  error('user not found in config file or command line');
}

const name = argv._[0];
if (!name) {
  error('name is required');
}

async function upload() {
  try {
    await ssh.connect({ host, username, privateKey: key });
    let cmd = `
      [ -e ${root}/${name}/${worldview} ] &&
      rm -rf ${root}/${name} &&
      mkdir -p ${root}/${name}`;
    let result = await ssh.execCommand(cmd);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    await ssh.putFile(distWorldview, `${root}/${name}/${worldview}`);
    cmd = `
      cd ${root}/${name} &&
      tar xf ${worldview} --warning=no-unknown-keyword &&
      mv site-worldview-debug/web/{*,.htaccess} . &&
      rm -rf site-worldview-debug`;
    result = await ssh.execCommand(cmd);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    ssh.dispose();
  } catch (err) {
    error(err.toString());
  }
};

if (!argv.dist) {
  let cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  let args = ['run', 'build'];

  if (argv.env) {
    args = args.concat(['--', argv.env]);
  }
  console.log(`===>`, `${cmd} ${args.join(' ')}`);
  const proc = spawn(cmd, args);
  proc.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  proc.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  proc.on('close', (code) => {
    if (code === 0) {
      upload();
    } else {
      error('build failed');
    }
  });
  proc.on('error', (err) => {
    error(`build failed: ${err}`);
  });
} else {
  upload();
}
