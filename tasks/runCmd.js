// Node dependencies
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const process = require('process');
//

// 3rd party dependencies
const nodeRun = require('node-run-cmd');
//

module.exports = function(config, dstDir, pkg, task, doneCallback) {
    var cmd = undefined;
    var args = undefined;

    if (task[os.platform()]) {
        if (task[os.platform()][os.arch()]) {
            if (!cmd && task[os.platform()][os.arch()].cmd) {
                cmd = task[os.platform()][os.arch()].cmd;
            }

            if (!args && task[os.platform()][os.arch()].args) {
                args = task[os.platform()][os.arch()].args;
            }
        }

        if (!cmd && task[os.platform()].cmd) {
            cmd = task[os.platform()].cmd;
        }

        if (!args && task[os.platform()].args) {
            args = task[os.platform()].args;
        }
    }

    if (!cmd && task.cmd) {
        cmd = task.cmd;
    }

    if (!args && task.args) {
        args = task.args;
    }

    if (!cmd) {
        doneCallback('[' + pkg.name + '] runCmd - Sem cmd que atenda ' + os.platform() + '-' + os.arch());
        return;
    }

    cmd = cmd
        .replace('${config.repoURL}', config.repoURL)
        .replace('${config.envRoot}', config.envRoot);
    args = args
        .replace('${config.repoURL}', config.repoURL)
        .replace('${config.envRoot}', config.envRoot);

    var cmdDir = path.dirname(cmd);
    var cmdLine = cmd + ' ' + args;

    console.log('[' + pkg.name + '] runCmd - cmd: ' + cmd);
    console.log('[' + pkg.name + '] runCmd - args: ' + args);
    console.log('[' + pkg.name + '] runCmd - cmdLine: ' + cmdLine);
    console.log('[' + pkg.name + '] runCmd - dir: ' + cmdDir);

    nodeRun.run(cmdLine, { shell: true, verbose: true, cwd: cmdDir }).then(function(exitCodes) {
        doneCallback(null);
      }, function(err) {
        doneCallback('Command failed to run with error: ', err);
      });
}