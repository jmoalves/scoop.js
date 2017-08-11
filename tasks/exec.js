// Node dependencies
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const execFile = require('child_process').execFile;
//

module.exports = function(config, dstDir, pkg, task, doneCallback) {
    var url = undefined;

    if (task[os.platform()]) {
        if (task[os.platform()][os.arch()]) {
            if (!url && task[os.platform()][os.arch()].url) {
                url = task[os.platform()][os.arch()].url;
            }
        }

        if (!url && task[os.platform()].url) {
            url = task[os.platform()].url;
        }
    }

    if (!url && task.url) {
        url = task.url;
    }

    if (!url) {
        doneCallback('[' + pkg.name + '] EXEC - Sem url que atenda ' + os.platform() + '-' + os.arch());
        return;
    }

    url = url.replace('${config.repoURL}', config.repoURL);

    console.log('[' + pkg.name + '] EXEC - url: ' + url);
    console.log('[' + pkg.name + '] EXEC -  to: ' + dstDir);

    if (task.args) {
        for (var x in task.args) {
            task.args[x] = task.args[x].replace('${pkg.dstDir}', dstDir);
            task.args[x] = task.args[x].replace(/\\/g, '\\\\');
        }
    }

    var archiveTmpDir = fs.mkdtempSync(os.tmpdir() + path.sep + 'exec-http-');
    var archiveTmpFile = archiveTmpDir + path.sep + path.basename(url);

    if (url.startsWith("http://")) {
        http.get(url, receiveFile);
    } else if (url.startsWith("https://")) {
        https.get(url, receiveFile);
    } else {
        doneCallback('[' + pkg.name + '] EXEC - Can\'t handle ' + url);
    }

    return;

    function receiveFile(res) {
        if (res.statusCode !== 200) {
            doneCallback('[' + pkg.name + '] EXEC - HTTP GOT STATUS ' + res.statusCode + ' for ' + url);
            return;
        }

        res.on('error', (error) => {
            doneCallback('[' + pkg.name + '] EXEC - HTTP ERROR: ' + error.message);
            return;
        });

        res.pipe(fs.createWriteStream(archiveTmpFile))
            .on('error', (error) => {
                doneCallback('[' + pkg.name + '] EXEC - TMPFILE ERROR: ' + JSON.stringify(error, null, 3));
                return;
            })
            .on('finish', () => {
                setImmediate(executeFile);
            });
    }

    function executeFile() {
        // console.log('[' + pkg.name + ']\tEXEC - TMPFILE ended: ' + archiveTmpFile + ' with ' + fs.lstatSync(archiveTmpFile).size + ' bytes');

        const executable = archiveTmpFile;
        console.log('[' + pkg.name + '] EXEC - executable ' + executable + " " + task.args);
        console.log(executable);
        for (var x in task.args) {
            console.log(task.args[x]);
        }

        const child = execFile(executable, task.args, (error, stdout, stderr) => {
            console.log("DONE?");
            console.log(stdout);
            doneCallback(null);
        });
    }
}