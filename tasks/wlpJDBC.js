// Node dependencies
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
//

// 3rd party dependencies
//

module.exports = function(config, dstDir, pkg, task, doneCallback) {
    if (!task.jarFile) {
        throw "No jarFile";
    }

    var dstJar = path.resolve(dstDir);
    var jdbcResDir = path.dirname(dstJar);

    var dstXml = dstJar
            .replace('resources', 'config')
            .replace('.jar', '.xml');
    var jdbcCfgDir = path.dirname(dstXml);

    console.log('[' + pkg.name + '] wlpJDBC - configDir: ' + jdbcCfgDir);
    fs.mkdirSync(jdbcCfgDir);

    console.log('[' + pkg.name + '] wlpJDBC - resourcesDir: ' + jdbcResDir);
    fs.mkdirSync(jdbcResDir);

    var url = task.jarFile.replace('${config.repoURL}', config.repoURL);
    console.log('[' + pkg.name + '] wlpJDBC - src: ' + url);

    if (url.startsWith("http://")) {
        http.get(url, getFile);
    } else if (url.startsWith("https://")) {
        https.get(url, getFile);
    } else {
        doneCallback('[' + pkg.name + '] wlpJDBC - Can\'t handle ' + url);
    }

    return;

    function getFile(res) {
        res.on('error', (error) => {
            console.log('[' + pkg.name + '] wlpJDBC - HTTP ERROR: ' + error.message);
        });

        res.pipe(fs.createWriteStream(dstJar)
            .on('error', (error) => {
                console.log('[' + pkg.name + '] wlpJDBC - SAVE ERROR - ' + error.message);
            })
            .on('finish', () => {
                generateConfig();
            })
        );
    }

    function generateConfig() {
        console.log('[' + pkg.name + '] wlpJDBC - dstJar: ' + dstJar);
        console.log('[' + pkg.name + '] wlpJDBC - dstXml: ' + dstXml);
        doneCallback(null);
    }
}

