// Node dependencies
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
//

// 3rd party dependencies
const crlf = require('crlf');
//

module.exports = function(config, dstDir, pkg, task, doneCallback) {
    if (!task.url) {
        throw "No url";
    }

    var url = task.url.replace('${config.repoURL}', config.repoURL);
    console.log('[' + pkg.name + '] getFile - url: ' + url);

    // console.log('[' + pkg.name + '] getFile - to: "' + task.to + '" - dstDir: ' + dstDir);
    var dst = undefined;
    if (task.to && task.to.length > 0) {
        dst = path.resolve(dstDir, task.to);
    } else {
        dst = path.resolve(dstDir);
    }
    console.log('[' + pkg.name + '] getFile - to: ' + dst);
    mkdirHier(dst);

    getFiles(task.files);

    return;

    function getFiles(files) {
        // console.log('[' + pkg.name + '] getFile - files: ' + files);
        var file = files.shift();
        if (!file) {
            doneCallback(null);
            return;
        }

        var urlFile = url + '/' + file;
        console.log('[' + pkg.name + '] getFile - file: ' + file);
        if (urlFile.startsWith("http://")) {
            http.get(urlFile, getFile);
        } else if (urlFile.startsWith("https://")) {
            https.get(urlFile, getFile);
        } else {
            doneCallback('[' + pkg.name + '] getFile - Can\'t handle ' + urlFile);
        }

        return;

        function getFile(res) {
            res.on('error', (error) => {
                console.log('[' + pkg.name + '] getFile - HTTP ERROR: ' + error.message);
            });
    
            var filename = path.resolve(dst, file);
            // console.log('[' + pkg.name + '] getFile - SAVE: ' + filename);
            res.pipe(fs.createWriteStream(filename)
                .on('error', (error) => {
                    console.log('[' + pkg.name + '] getFile - SAVE ERROR - ' + error.message);
                })
                .on('finish', () => {
                    if (task.vars) {
                        var data = fs.readFileSync(filename, 'utf8');
                        //console.log(filename + " data: " + data);
                        for (var str in task.vars) {
                            var txt = 
                                task.vars[str]
                                .replace(/\$\{config\.repoURL\}/g, config.repoURL)
                                .replace(/\$\{config\.envRoot\}/g, config.envRoot)
                                .replace(/\$\{dstDir\}/g, dstDir);
                            // console.log(str + ' - ' + txt);
                            data = data.replace(new RegExp(str, "g"), txt);
                        }
    
                        //console.log(filename + " newData: " + data);
                        fs.writeFileSync(filename, data, 'utf8');
                    }
                    crlf.set(filename, 'CRLF', function(err, endingType) {
                        getFiles(files);
                    });
                })
            );
        }
    }
}

function mkdirHier(dir) {
    if (fs.existsSync(dir)) {
        return;
    }

    mkdirHier(path.dirname(dir));

    console.log("MKDIR " + dir);
    fs.mkdirSync(dir);
}