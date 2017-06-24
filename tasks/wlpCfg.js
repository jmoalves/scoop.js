const fs = require('fs');
const http = require('http');
const path = require('path');
const unzip = require('unzipper');

module.exports = function(config, dstDir, pkg, task, doneCallback) {
    if (!task.usrTemplate) {
        throw "No usrTemplate";
    }

    var wlpDir = path.resolve(dstDir);
    var appSrv = path.dirname(wlpDir);

    console.log('[' + pkg.name + '] wlpCfg - criando ' + wlpDir);
    if (!fs.existsSync(appSrv)) {
        fs.mkdirSync(appSrv);
    }
    fs.mkdirSync(wlpDir);

    console.log('[' + pkg.name + '] wlpCfg - criando bin');
    fs.mkdirSync(path.resolve(dstDir, 'bin'));

    console.log('[' + pkg.name + '] wlpCfg - criando runtime');
    fs.mkdirSync(path.resolve(dstDir, 'runtime'));

    var url = task.usrTemplate.replace('${config.repoURL}', config.repoURL);
    console.log('[' + pkg.name + '] wlpCfg - criando usr - templateUrl: ' + url);

    http.get(url, (res) => {
        res.on('error', (error) => {
            console.log('[' + pkg.name + '] wlpCfg - HTTP ERROR: ' + error.message);
        });

        res.pipe(unzip.Parse())
            .on('error', (error) => {
                console.log('[' + pkg.name + '] wlpCfg - EXTRACT ERROR - ' + error.message);
            })
            .on('entry', (entry) => {
                var fileName = entry.path;
                var type = entry.type; // 'Directory' or 'File' 
                var size = entry.size;
                if (!fileName.startsWith("wlp/usr")) {
                    entry.autodrain();
                    return;
                }

                var target = path.resolve(dstDir, fileName.replace(/^wlp\//, ''));
                switch (type) {
                    case 'Directory':
                        fs.mkdirSync(target);
                        entry.autodrain();
                        break;

                    case 'File':
                        entry.pipe(fs.createWriteStream(target));
                        break;
                }
            })
            .on('finish', () => {
                doneCallback(null);
            });
    });
}