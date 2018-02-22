// Node dependencies
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
//

// 3rd party dependencies
const unzip = require('unzipper');
const crlf = require('crlf');
//

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

    var urlScripts = task.scripts.url.replace('${config.repoURL}', config.repoURL);
    console.log('[' + pkg.name + '] wlpCfg - scripts - src: ' + urlScripts);
    fs.mkdirSync(path.resolve(dstDir, 'bin'));

    getScripts(task.scripts.files);

    return;

    function getScripts(files) {
        //console.log('[' + pkg.name + '] wlpCfg - scripts - files: ' + files);
        var file = files.shift();
        if (!file) {
            createRuntime();
            return;
        }

        var url = urlScripts + '/' + file;
        console.log('[' + pkg.name + '] wlpCfg - scripts - file: ' + file);
        if (url.startsWith("http://")) {
            http.get(url, getFile);
        } else if (url.startsWith("https://")) {
            https.get(url, getFile);
        } else {
            doneCallback('[' + pkg.name + '] wlpCfg - Can\'t handle ' + url);
        }

        return;

        function getFile(res) {
            res.on('error', (error) => {
                console.log('[' + pkg.name + '] wlpCfg - HTTP ERROR: ' + error.message);
            });
    
            var filename = path.resolve(dstDir, 'bin', file);
            // console.log('[' + pkg.name + '] wlpCfg - SAVE: ' + filename);
            res.pipe(fs.createWriteStream(filename)
                .on('error', (error) => {
                    console.log('[' + pkg.name + '] wlpCfg - SAVE ERROR - ' + error.message);
                })
                .on('finish', () => {
                    var data = fs.readFileSync(filename, 'utf8');
                    //console.log(filename + " data: " + data);
                    for (var str in task.scripts.vars) {
                        var txt = 
                            task.scripts.vars[str]
                            .replace(/\$\{config\.repoURL\}/g, config.repoURL)
                            .replace(/\$\{dstDir\}/g, dstDir);
                        // console.log(str + ' - ' + txt);
                        data = data.replace(new RegExp(str, "g"), txt);
                    }

                    //console.log(filename + " newData: " + data);
                    fs.writeFileSync(filename, data, 'utf8');
                    crlf.set(filename, 'CRLF', function(err, endingType) {
                        getScripts(files);
                    });
                })
            );
        }
    }

    function createRuntime() {
        console.log('[' + pkg.name + '] wlpCfg');
        console.log('[' + pkg.name + '] wlpCfg - criando runtime');
        fs.mkdirSync(path.resolve(dstDir, 'runtime'));
    
        var url = task.usrTemplate.replace('${config.repoURL}', config.repoURL);
        console.log('[' + pkg.name + '] wlpCfg - criando usr - templateUrl: ' + url);
    
        if (url.startsWith("http://")) {
            http.get(url, extractFile);
        } else if (url.startsWith("https://")) {
            https.get(url, extractFile);
        } else {
            doneCallback('[' + pkg.name + '] wlpCfg - Can\'t handle ' + url);
        }
    }

    function extractFile(res) {
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
    }
}