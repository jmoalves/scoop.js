// Node dependencies
const fs = require('fs');
const path = require('path');
//

// 3rd party dependencies
const crlf = require('crlf');
//

module.exports = function(config, dstDir, pkg, task, doneCallback) {
    for (var file in task.files) {
        var filename = file
            .replace(/\$\{config\.repoURL\}/g, config.repoURL)
            .replace(/\$\{config\.envRoot\}/g, config.envRoot)
            .replace(/\$\{dstDir\}/g, dstDir);

        filename = path.resolve(filename);
        console.log('');
        console.log('[' + pkg.name + '] editFile - file: ' + filename);

        var data = fs.readFileSync(filename, 'utf8');
        fs.renameSync(filename, filename + '.bkp');
        for (var regexp in task.files[file]) {
            var txt = task.files[file][regexp]
                .replace(/\$\{config\.repoURL\}/g, config.repoURL)
                .replace(/\$\{config\.envRoot\}/g, config.envRoot)
                .replace(/\$\{dstDir\}/g, dstDir);

            data = data.replace(new RegExp(regexp, "g"), txt);
        }
        fs.writeFileSync(filename, data, 'utf8');
    }

    // doneCallback('[' + pkg.name + '] editFile - IMPLEMENT');
    doneCallback(null);
}