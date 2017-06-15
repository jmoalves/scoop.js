const fs = require('fs');
const path = require('path');

module.exports = function(config, dstDir, pkg, task, tasks, next) {
    var wlpDir = path.resolve(dstDir);
    var appSrv = path.dirname(wlpDir);

    console.log('[' + pkg.name + ']\twlpCfg - criando ' + wlpDir);
    if (!fs.existsSync(appSrv)) {
        fs.mkdirSync(appSrv);
    }
    fs.mkdirSync(wlpDir);

    console.log('[' + pkg.name + ']\twlpCfg - criando bin');
    fs.mkdirSync(path.resolve(dstDir, 'bin'));

    console.log('[' + pkg.name + ']\twlpCfg - criando runtimes');
    fs.mkdirSync(path.resolve(dstDir, 'runtimes'));

    next(config, dstDir, pkg, tasks, next);
}