const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const unzip = require('unzip');
const tar = require('tar-fs');
const gunzip = require('gunzip-maybe');
const xz = require("xz");

module.exports = function(config, pkg, task, tasks, next) {
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
        next(config, pkg, tasks, next);
        return;
    }

    url = url.replace('${config.repoURL}', config.repoURL);

    var dstDir = path.resolve(config.envRoot, pkg.dstDir);
    console.log('[' + pkg.name + ']\tUNZIP - url: ' + url);
    console.log('[' + pkg.name + ']\tUNZIP -  to: ' + dstDir);

    http.get(url, (res) => {
        console.log('[' + pkg.name + ']\tUNZIP - callback');

        res.on('error', (error) => {
            console.log('[' + pkg.name + ']\tUNZIP - ERROR: ' + error.message);
        });

        if (url.endsWith('.zip')) {
            res.pipe(unzip.Extract({ path: dstDir })).on('finish', strip);
        } else if (url.endsWith('.tar.gz')) {
            res.pipe(gunzip()).pipe(tar.extract(dstDir)).on('finish', strip);
        } else if (url.endsWith('.tar.xz')) {
            res.pipe(new xz.Decompressor()).pipe(tar.extract(dstDir)).on('finish', strip);
        } else {
            throw "Can't handle file: " + url;
        }
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

        next(config, pkg, tasks, next);
    }
}