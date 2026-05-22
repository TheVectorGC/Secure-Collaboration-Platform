const os = require('node:os');
const { app } = require('electron');

function resolvePlatform() {
  const platform = process.platform;

  if (platform === 'win32') {
    return 'WINDOWS';
  }

  if (platform === 'darwin') {
    return 'MACOS';
  }

  if (platform === 'linux') {
    return 'LINUX';
  }

  return 'WEB';
}

function getDeviceEnvironment() {
  const hostname = os.hostname() || 'Desktop';
  const osType = os.type() || 'Unknown OS';
  const osRelease = os.release() || 'Unknown version';
  const architecture = os.arch() || process.arch || 'unknown';
  const clientVersion = app?.getVersion?.() ?? '0.2.0';

  return {
    platform: resolvePlatform(),
    deviceName: hostname,
    clientVersion,
    osName: osType,
    osVersion: `${osType} ${osRelease}`,
    architecture,
    hostname,
  };
}

module.exports = {
  getDeviceEnvironment,
};
