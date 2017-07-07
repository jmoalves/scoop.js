const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const DecompressZip = require('decompress-zip');
const tar = require('tar-fs');
const gunzip = require('gunzip-maybe');

var xz = undefined;
try {
    xz = require("xz");
} catch (error) {
    console.log('INFO: xz not available');
    xz = undefined;
}

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
        doneCallback('[' + pkg.name + '] UNZIP - Sem url que atenda ' + os.platform() + '-' + os.arch());
        return;
    }

    url = url.replace('${config.repoURL}', config.repoURL);

    console.log('[' + pkg.name + '] UNZIP - url: ' + url);
    console.log('[' + pkg.name + '] UNZIP -  to: ' + dstDir);

    var archiveTmpDir = fs.mkdtempSync(os.tmpdir() + path.sep + 'unzip-http-');
    var archiveTmpFile = archiveTmpDir + path.sep + path.basename(url);

    http.get(url, receiveFile);
    return;

    function receiveFile(res) {
        if (res.statusCode !== 200) {
            doneCallback('[' + pkg.name + '] UNZIP - HTTP GOT STATUS ' + res.statusCode + ' for ' + url);
            return;
        }

        res.on('error', (error) => {
            doneCallback('[' + pkg.name + '] UNZIP - HTTP ERROR: ' + error.message);
            return;
        });

        res.pipe(fs.createWriteStream(archiveTmpFile))
            .on('error', (error) => {
                doneCallback('[' + pkg.name + '] UNZIP - TMPFILE ERROR: ' + JSON.stringify(error, null, 3));
                return;
            })
            .on('finish', () => {
                setImmediate(extractFile);
            });
    }

    function extractFile() {
        // console.log('[' + pkg.name + ']\tUNZIP - TMPFILE ended: ' + archiveTmpFile + ' with ' + fs.lstatSync(archiveTmpFile).size + ' bytes');
        if (archiveTmpFile.endsWith('.zip')) {
            extractZip();
        } else if (archiveTmpFile.endsWith('.tar.gz')) {
            extractStream();
        } else if (archiveTmpFile.endsWith('.tar.xz') && xz) {
            extractStream();
        } else {
            doneCallback("Can't handle file: " + archiveTmpFile);
            return;
        }
    }

    function extractZip() {
        var unzipper = new DecompressZip(archiveTmpFile);
        unzipper.on('error', function(error) {
            doneCallback('[' + pkg.name + '] UNZIP - DecompressZIP ERROR: ' + error.message);
            return;
        });

        unzipper.on('extract', function(log) {
            setImmediate(extractFinished);
        });

        // unzipper.on('progress', function(fileIndex, fileCount) {
        //     console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount);
        // });

        unzipper.extract({ path: dstDir });
    }

    function extractStream() {
        var stream = fs.createReadStream(archiveTmpFile);

        var archive = undefined;
        if (archiveTmpFile.endsWith('.tar.gz')) {
            archive = stream.pipe(gunzip()).pipe(tar.extract(dstDir));
        } else if (archiveTmpFile.endsWith('.tar.xz') && xz) {
            archive = stream.pipe(new xz.Decompressor()).pipe(tar.extract(dstDir));
        } else {
            doneCallback('[' + pkg.name + "] UNZIP - Can't handle file: " + archiveTmpFile);
        }

        archive
            .on('error', (error) => {
                if (error.code != "ENOENT") {
                    doneCallback('[' + pkg.name + '] UNZIP - EXTRACT ERROR: ' + JSON.stringify(error, null, 3));
                    return;
                }
            })
            .on('finish', () => {
                setImmediate(extractFinished);
            });
    }

    function extractFinished() {
        // console.log('[' + pkg.name + '] UNZIP - finished ' + path.basename(archiveTmpFile));

        if (task.strip && task.strip == 'true') {
            var children = fs.readdirSync(dstDir);
            // console.log('[' + pkg.name + '] UNZIP - stripping ' + JSON.stringify(children) + ' from ' + dstDir);

            if (children.length > 1) {
                doneCallback('[' + pkg.name + '] UNZIP - Strip com mais de um diretorio - ' + JSON.stringify(children));
                return;
            }

            // Diretorio temporario, para evitar colisoes
            var tmpRootDir = fs.mkdtempSync(os.tmpdir() + path.sep + 'unzip-strip-');
            for (var toStrip of children) {
                // Move o diretório para um tmp
                var tmpDir = path.resolve(tmpRootDir, toStrip);
                fs.renameSync(
                    path.resolve(dstDir, toStrip),
                    tmpDir);
                for (var child of fs.readdirSync(tmpDir)) {
                    var from = path.resolve(tmpDir, child);
                    var dst = path.resolve(dstDir, child);
                    // console.log('[' + pkg.name + '] UNZIP - strip: ' + from + ' => ' + dst);
                    fs.renameSync(from, dst);
                }

                // console.log('[' + pkg.name + '] UNZIP - strip - rmdir ' + tmpDir);
                fs.rmdirSync(tmpDir);
            }

            // console.log('[' + pkg.name + '] UNZIP - strip - rmdir ' + tmpRootDir);
            fs.rmdirSync(tmpRootDir);
        }

        // console.log('[' + pkg.name + '] UNZIP - extract - rm ' + archiveTmpFile);
        fs.unlinkSync(archiveTmpFile);

        // console.log('[' + pkg.name + '] UNZIP - extract - rmdir ' + archiveTmpDir);
        fs.rmdirSync(archiveTmpDir);

        doneCallback(null);
    }
}