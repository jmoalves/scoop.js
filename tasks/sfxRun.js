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
        doneCallback('[' + pkg.name + '] sfxRun - Sem url que atenda ' + os.platform() + '-' + os.arch());
        return;
    }

    url = url.replace('${config.repoURL}', config.repoURL);

    console.log('[' + pkg.name + '] sfxRun - url: ' + url);
    console.log('[' + pkg.name + '] sfxRun -  to: ' + dstDir);

    var archiveTmpDir = fs.mkdtempSync(os.tmpdir() + path.sep + 'sfxRun-http-');
    var archiveTmpFile = archiveTmpDir + path.sep + path.basename(url);

    if (url.startsWith("http://")) {
        http.get(url, receiveFile);
    } else if (url.startsWith("https://")) {
        https.get(url, receiveFile);
    } else {
        doneCallback('[' + pkg.name + '] sfxRun - Can\'t handle ' + url);
    }

    return;

    function receiveFile(res) {
        if (res.statusCode !== 200) {
            doneCallback('[' + pkg.name + '] sfxRun - HTTP GOT STATUS ' + res.statusCode + ' for ' + url);
            return;
        }

        res.on('error', (error) => {
            doneCallback('[' + pkg.name + '] sfxRun - HTTP ERROR: ' + error.message);
            return;
        });

        res.pipe(fs.createWriteStream(archiveTmpFile))
            .on('error', (error) => {
                doneCallback('[' + pkg.name + '] sfxRun - TMPFILE ERROR: ' + JSON.stringify(error, null, 3));
                return;
            })
            .on('finish', () => {
                setImmediate(executeFile);
            });
    }

    function executeFile() {
        // console.log('[' + pkg.name + ']\tEXEC - TMPFILE ended: ' + archiveTmpFile + ' with ' + fs.lstatSync(archiveTmpFile).size + ' bytes');

        const executable = archiveTmpFile;
        console.log('[' + pkg.name + '] sfxRun - executable ' + executable + " " + task.args);

        const child = execFile(executable, ["-y"], (error, stdout, stderr) => {
            setImmediate(moveDir);
        });
    }

    function moveDir() {
        var sfxDir = path.resolve(archiveTmpDir, task.dir);
        var children = fs.readdirSync(sfxDir);
        // console.log('[' + pkg.name + '] sfxRun - moving ' + JSON.stringify(children) + ' to ' + dstDir);

        for (var child of children) {
            var from = path.resolve(archiveTmpDir, child);
            var dst = path.resolve(dstDir, child);
            // console.log('[' + pkg.name + '] sfxRun - move: ' + from + ' => ' + dst);
            fs.renameSync(from, dst);
        }

        // console.log('[' + pkg.name + '] sfxRun - extract - rm ' + archiveTmpFile);
        fs.unlinkSync(archiveTmpFile);

        // console.log('[' + pkg.name + '] sfxRun - extract - rmdir ' + archiveTmpDir);
        fs.rmdirSync(archiveTmpDir);

        doneCallback(null);
    }
}