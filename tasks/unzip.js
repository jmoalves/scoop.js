const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const unzip = require('unzipper');
const tar = require('tar-fs');
const gunzip = require('gunzip-maybe');

var xz = undefined;
try {
    xz = require("xz");
} catch (error) {
    console.log('Failed xz dependency');
    xz = undefined;
}

module.exports = function(config, dstDir, pkg, task, tasks, next) {
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
        console.log('[' + pkg.name + ']\tUNZIP - Sem url que atenda ' + os.platform() + '-' + os.arch());
        fail = true;
        next(config, dstDir, pkg, tasks, next);
        return;
    }

    url = url.replace('${config.repoURL}', config.repoURL);

    console.log('[' + pkg.name + ']\tUNZIP - url: ' + url);
    console.log('[' + pkg.name + ']\tUNZIP -  to: ' + dstDir);

    http.get(url, (res) => {
        res.on('error', (error) => {
            console.log('[' + pkg.name + ']\tUNZIP - HTTP ERROR: ' + error.message);
        });

        var archive = undefined;
        if (url.endsWith('.zip')) {
            archive = res.pipe(unzip.Extract({ path: dstDir }));
        } else if (url.endsWith('.tar.gz')) {
            archive = res.pipe(gunzip()).pipe(tar.extract(dstDir));
        } else if (url.endsWith('.tar.xz') && xz) {
            archive = res.pipe(new xz.Decompressor()).pipe(tar.extract(dstDir));
        } else {
            throw "Can't handle file: " + url;
        }

        archive
            .on('error', (error) => {
                if (error.code != "ENOENT") {
                    console.log('[' + pkg.name + ']\tUNZIP - EXTRACT ERROR: ' + JSON.stringify(error, null, 3));
                    throw error;
                }
            })
            .on('finish', strip);
    });

    function strip() {
        if (task.strip && task.strip == 'true') {
            for (var toStrip of fs.readdirSync(dstDir)) {
                for (var child of fs.readdirSync(path.resolve(dstDir, toStrip))) {
                    var from = path.resolve(dstDir, toStrip, child);
                    var dst = path.resolve(dstDir, child);
                    // console.log('[' + pkg.name + ']\tUNZIP - strip: ' + from + ' => ' + dst);
                    fs.renameSync(from, dst);
                }
                fs.rmdir(path.resolve(dstDir, toStrip));
            }
        }

        next(config, dstDir, pkg, tasks, next);
    }
}